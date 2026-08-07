# M7 Frontend — Modo demo

El backend #211 **no está desplegado** y la API real **no ha sido probada**. Para que
Dirección pueda ver la superficie con datos reales de forma (fixture derivado del core
del backend), existe un modo demo — **estrictamente fuera de producción**.

## Gate (fail-closed, reforzado tras Codex)

`canLoadM7DemoFixture(env, ctx)`:
- **DEV local** (`import.meta.env.DEV`) ⇒ permitido.
- **Preview de Vercel** (`VITE_VERCEL_ENV === 'preview'`) **+** `VITE_ENABLE_M7_DEMO === 'true'` ⇒ permitido.
- **Producción real** (`VITE_VERCEL_ENV === 'production'`) ⇒ **NUNCA**, aunque el flag esté encendido.
- Usuario no autorizado ⇒ negado. Cualquier otro caso ⇒ negado (fail-closed).

Codex marcó que `VITE_ENABLE_M7_DEMO='true'` NO debe bastar por sí solo en
producción: ahora se exige la señal de entorno de Vercel, no sólo el flag.

- En **producción**, `?demo=1` se **ignora**: la pantalla resuelve `unavailable`.
- El demo se marca en TODA su evidencia: banner `MODO DEMO`, `EVIDENCIA NO FORMAL`,
  y nombre de archivo `_DEMO_NONFORMAL`.

## Carga por import DINÁMICO (el fixture NO viaja en producción)

El fixture se carga con `await import('virtual:m7-demo-fixture')` **sólo tras pasar
el gate**. En build de producción ese módulo virtual resuelve a un stub
(`demoFixtureLoader.prod.js`) que no importa el fixture ⇒ el payload financiero
queda **fuera del bundle productivo**. Lo verifica `scripts/check_m7_demo_bundle.mjs`
en `npm run build` (sentinels: run_id, scope_key, content commit, importe). Evidencia:
el chunk de la pantalla bajó de ~122 kB a ~57 kB.

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
