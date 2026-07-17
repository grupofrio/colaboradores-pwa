# M7 Frontend — Modo demo

El backend #211 **no está desplegado** y la API real **no ha sido probada**. Para que
Dirección pueda ver la superficie con datos reales de forma (fixture derivado del core
del backend), existe un modo demo — **estrictamente fuera de producción**.

## Gate

`isM7DemoAllowed(env)` = **DEV** o `VITE_ENABLE_M7_DEMO === 'true'`.

- En **producción**, `?demo=1` se **ignora**: la pantalla resuelve `unavailable`
  (backend 404) como corresponde a un módulo cuyo endpoint aún no existe.
- El demo se marca en TODA su evidencia: banner `MODO DEMO`, banner `EVIDENCIA NO
  FORMAL`, y nombre de archivo `_DEMO_NONFORMAL`.

## Qué NO es el demo

- **No es evidencia productiva.** El fixture proviene de correr
  `core.build_latest_payload` del backend congelado por XML-RPC read-only, no de una
  corrida odoo-shell formal.
- **No prueba la API real.** Prueba el contrato y la presentación, no el transporte.
- **No debe presentarse como "M7 en vivo".** Los docs y el PR lo declaran.

## Origen del fixture

`fixtures/apiLatestFixture.js` con `M7_API_FIXTURE_PROVENANCE`:
`backend_content_commit 88c09f49…`, `measuring_commit fd34bb95…`,
`is_production_shell_run false`, `lineage_status pre_migration_lineage`,
`reseal_required true`, `profitability_level_reached L1_observable_revenue`.

Ver también [`M7_FE_LINEAGE_GATE.md`](M7_FE_LINEAGE_GATE.md).
