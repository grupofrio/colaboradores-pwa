# W120 — contexto de voz `form_energy_reading` (PENDIENTE DE S/N)

**Estado: NO aplicado.** El `VoiceInputButton` de `ScreenEnergia` ya manda
`context_id="form_energy_reading"`, pero `OPS_W120_voice_intake_v2`
(`2kNuaSpsAgQGdcPe`, **activo en producción**) todavía no conoce ese contexto:
hasta que se aplique este parche, el botón responde
`INTERNAL_ERROR: context_id desconocido` y la captura de los 3 registros se
hace a mano. El resto de la pantalla funciona completo.

**Por qué no se aplicó aquí:** W120 es un workflow **vivo en producción** que
sirve a otros 10 contextos de voz (merma, empaque rolito, incidencia rolito,
cierre de bolsas, reconciliación PT, cosecha barra, incidente de tanque, merma
almacén PT, salmuera, paro supervisor). Tocarlo es un deploy, y los deploys van
con S/N. El parche es **puramente aditivo** —ningún contexto existente cambia—
pero eso lo decide quien autoriza, no quien construye.

## El parche, nodo por nodo

Los tres nodos son `n8n-nodes-base.code`. En los tres el cambio es **agregar una
entrada**, sin tocar las existentes.

### 1. `auth_context_size_gate` — whitelist

```js
const ALLOWED_CONTEXTS = new Set([
  'form_merma',
  'form_empaque_rolito',
  'form_incidencia_rolito',
  'form_cierre_bolsas',
  'form_reconciliacion_pt',
  'form_harvest_barra',
  'form_tank_incident_barra',
  'form_almacen_pt_merma',
  'form_brine_reading',
  'form_supervisor_paro',
  'form_energy_reading',   // ← AGREGAR
]);
```

### 2. `load_catalog` — entrada nueva en `CONFIGS`

Sin catálogo externo: son 3 números directos del display del medidor.

```js
  form_energy_reading: {
    // Sin catalogo externo: 3 lecturas numericas del display del medidor.
    resolveCatalog() {
      return { catalog: {}, empty: false, fallback: false, version: null };
    },
    getSchema() {
      return {
        name: 'energy_reading_payload',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['kwh_base', 'kwh_intermedia', 'kwh_punta', 'confianza'],
          properties: {
            kwh_base: { type: ['number', 'null'] },
            kwh_intermedia: { type: ['number', 'null'] },
            kwh_punta: { type: ['number', 'null'] },
            confianza: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      };
    },
    buildSystemPrompt() {
      return `Eres un extractor de lecturas del medidor de energia CFE. El supervisor dicta TRES numeros, uno por periodo tarifario:\n- kwh_base: periodo BASE. Palabras clave: 'base'.\n- kwh_intermedia: periodo INTERMEDIA. Palabras clave: 'intermedia', 'intermedio'.\n- kwh_punta: periodo PUNTA. Palabras clave: 'punta', 'pico'.\n\nREGLAS DE EXTRACCION:\n1. PRIORIZA keywords: 'base ciento veinte' -> kwh_base=120.\n2. FALLBACK por orden: sin keywords y con TRES numeros, el orden es base, intermedia, punta.\n3. Son lecturas de display: SIEMPRE positivas y pueden tener decimales. Nunca negativas.\n4. Si un periodo no se menciona, ese campo es null (el supervisor lo captura a mano).\n5. NO sumes, NO multipliques y NO conviertas: devuelve el numero tal cual se dijo.\n\nEJEMPLOS:\n- 'base mil doscientos, intermedia trescientos cuarenta, punta ochenta' -> { kwh_base: 1200, kwh_intermedia: 340, kwh_punta: 80 }\n- 'mil doscientos, trescientos cuarenta, ochenta' -> { kwh_base: 1200, kwh_intermedia: 340, kwh_punta: 80 }\n- 'punta ochenta y cinco punto cinco' -> { kwh_base: null, kwh_intermedia: null, kwh_punta: 85.5 }\n\nNunca inventes valores.`;
    },
  },
```

### 3. `validate_business_rules` — entrada nueva en `VALIDATORS`

```js
  form_energy_reading(raw /*, c */) {
    const fields = ['kwh_base', 'kwh_intermedia', 'kwh_punta'];
    const present = fields.filter((f) => raw[f] !== null && raw[f] !== undefined);
    // Si no llego ningun numero, el usuario no dicto nada aprovechable.
    if (present.length === 0) {
      return { errors: ['ningun_valor_capturado'], error_code: 'VALIDATION_FAILED' };
    }
    // Lecturas de display: positivas. El multiplicador lo aplica Odoo, no el LLM.
    for (const f of present) {
      if (typeof raw[f] !== 'number' || raw[f] < 0 || raw[f] > 10000000) {
        return { errors: [`${f}_fuera_rango: ${raw[f]}`], error_code: 'VALIDATION_FAILED' };
      }
    }
    return { errors: [], error_code: null };
  },
```

## Notas de diseño

- La voz **completa el formulario, no lo envía**. El supervisor revisa los 3
  números y la foto antes de dar "Registrar". Un `null` de la IA no bloquea:
  la pantalla lo dice ("falta capturar Punta a mano") y el campo queda vacío.
- La validación dura sigue siendo del servidor (`create_period_reading` en
  `gf_plant_energy`): 3 obligatorios, foto obligatoria y cada fin ≥ su inicio.
  Que la IA acepte un parcial no relaja nada.
- El multiplicador ×1200 **no aparece en el prompt** a propósito: el LLM
  transcribe display, Odoo multiplica.

## Verificación después de aplicar

1. Rollback point: guardar el `versionId` de W120 antes de editar.
2. Con la sesión de Miguel (8888), dictar las 3 lecturas en `/supervision/energia`.
3. Confirmar que los 3 campos se llenan y que el envelope trae
   `ok:true` + `ai_output` con los 3 números.
4. Confirmar que **otro** contexto sigue vivo (p. ej. `form_brine_reading` desde
   el hub) — es la prueba de que el parche fue aditivo.
