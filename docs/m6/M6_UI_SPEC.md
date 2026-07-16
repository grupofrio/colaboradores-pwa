# M6 — Spec de UI

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Secciones (en este orden)

1. **Encabezado** — titulo, READ-ONLY, estado del auditor, estado de datos,
   FORMAL/NO FORMAL, DEMO. Debajo: corte, ventana, compañias, sucursales,
   monedas, consultas, `auditor_build_sha`, `contract_build_sha`, `run_id`,
   `scope_key`, fuente de medicion.
2. **Banner de evidencia no formal** — cuando `is_production_shell_run=false`,
   con sus bloqueadores. Se decide por el **DATO**, no por el modo de entrega.
3. **Banner de demo** — declara backend TEMP_PR_OPEN_NOT_DEPLOYED y que la API
   real nunca fue probada.
4. **Nivel 1 · Estado financiero reportado** — tiles por veredicto + las mismas
   reglas por clasificacion y por severidad.
5. **Señales por bloque** — 7 bloques (facturacion, pagos, caja de ruta, corte y
   liquidacion, depositos, conciliacion, cartera y aging).
6. **Nivel 2 · Cobertura de la instrumentacion**.
7. **Nivel 3 · Capacidades no disponibles** — "—" con razon, jamas 0.
8. **Hallazgos** — filtros de los 4 ejes + tabla + panel de detalle.
9. **Exports**.

## Reglas duras

- El titulo **no** afirma un cuadre.
- `capability=false` ⇒ **"—" con su razon**, JAMAS un 0.
- Ausencia de dato ⇒ **el tile no se renderiza** (ausencia ≠ cero).
- Los veredictos se muestran **con nombre**, no solo con color.
- **Nunca** un total consolidado entre monedas.
- `rejected_params` en **banner rojo**: un filtro rechazado en silencio es una
  mentira.
- **Cero botones de accion** (`auto_fix=false`, sin writes).
- Cada tile declara: valor · unidad · universo · cobertura · fuente (query+campo)
  · salvedad.

## Estados de la pantalla

`loading` · `ready` · `unavailable` (**el estado real hoy**: backend no
desplegado) · `flag_off` · `unauthorized` (401) · `forbidden` (403) ·
`schema_mismatch` · `malformed` · `stale` · `nonformal` · `empty` (vacio ≠ sin
datos) · `demo` (solo DEV/Preview).

**Produccion sin backend NO se convierte en `empty` ni carga el demo**: dice
`unavailable` y explica por que.
