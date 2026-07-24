# RFC — Modelo común de señal (PRELIMINAR, no productivo en 0A)

> **Estado: RFC.** En Etapa 0A **no** se implementa código productivo de
> `signalModel`. Este documento fija el schema preliminar, ejemplos, decisiones
> abiertas y una prueba conceptual de trazabilidad. La implementación productiva
> llega en **Etapa 1**, junto con la Home "Hoy", los adaptadores de señal, la matriz
> señal→fuente, la matriz de priorización, el ranking y las reglas de overlap.
> No se crea código sin consumidor solo para anticipar el contrato.

## Motivación

Hoy cada módulo emite sus hallazgos con forma propia. Para una Home ejecutiva y una
bandeja de prioridades común hace falta una forma única — pero **derivada** de los
contratos existentes (adaptadores), nunca recalculada.

## Schema preliminar

```
Signal {
  id                 // estable, derivado de módulo+regla+entidad
  title              // lenguaje natural, sin códigos
  what               // qué ocurrió
  why                // por qué importa
  magnitude { observed, universe, coverage, unit, currency|null }
  trend              // v1: SIEMPRE 'first_run' (no hay 2ª corrida comparable)
  scope { period, companies, branch|null }
  confidence         // definitive | caveated | exploratory | not_evaluable
  cause { text, kind } // kind: hypothesis | rule_based | related_factor | to_confirm
                       // NUNCA lenguaje causal definitivo sin evidencia
  action { text, why, area, urgency, limitations }|null // recomendación curada;
                       // NO inventar una persona responsable si el dato no existe
  due     // null en Etapa 1 (llega en Etapa 4)
  followUp // null en Etapa 1
  evidence { module, endpoint, field, rule|capability, data_as_of, caveat } // OBLIGATORIO
}
```

## Ejemplos

```
{ title: "$582,175 de venta cash sin recibir",
  what: "244 rutas abiertas; 198 con más de 7 días",
  why: "dinero cobrado en calle sin confirmar recepción",
  magnitude: { observed: 582175, universe: 244, coverage: null, unit: "MXN", currency: "MXN" },
  trend: "first_run",
  confidence: "caveated",
  cause: { text: "cierres no validados en sucursal", kind: "to_confirm" },
  action: { text: "validar las 6 candidatas a cierre", why: "reduce el pendiente",
            area: "Gerentes de sucursal", urgency: "alta",
            limitations: "el monto no prueba faltante" },
  evidence: { module: "M1", endpoint: "backlog", field: "cash_pending",
              rule: null, data_as_of: "2026-07-17T16:03Z", caveat: "totales globales" } }
```

## Decisiones abiertas (para Etapa 1)

1. Deduplicación de una misma entidad que aparece en varias reglas.
2. Reglas de overlap entre módulos (M1 cash vs M6 conciliación).
3. Matriz de priorización (impacto/urgencia/entidades/antigüedad/confianza/…): la
   define Yamil o se propone para su S/N.
4. Cómo se marca "qué cambió" cuando exista 2ª corrida comparable (scope_key igual).
5. Umbrales de `coverage` para degradar `confidence`.

## Prueba conceptual de trazabilidad (no montada en la app)

Toda señal debe poder responder `describeTrace(signal)`:
"Esto viene de {evidence.module}/{evidence.endpoint}, campo {evidence.field}, con
corte {evidence.data_as_of}." Si `evidence` está incompleto, la señal **no valida** y
no puede mostrarse. Este invariante es el que impide una "segunda fuente de verdad" en
la Home: sin trazabilidad, no hay señal.
