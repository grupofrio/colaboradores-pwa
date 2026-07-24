# M7 Frontend — Arquitectura

Observatorio **read-only** de rentabilidad y costos. Nivel económico alcanzado: **L1
(ingreso observable por moneda)**. No calcula margen, COGS, utilidad ni consolidado.

## Módulos (todos bajo `src/modules/rentabilidad-costos/`)

```
ScreenRentabilidadCostosM7.jsx     Pantalla (tabs: overview/ladder/sections/findings/runs/scope)
m7/
  contract.js      resolveM7Metric (9 estados) · validateM7{Latest,Findings,Runs} · scanPii · lineageState · enums · DAG
  access.js        readM7Access (fail-closed, sólo direccion_general)
  m7Api.js         fetchM7{Latest,Findings,Runs} · classifyM7Error · timeout · guardSize
  m7Meta.js        etiquetas/colores/help · escalera L0–L6 · nota de incidencias
  filters.js       allowlist · 13 filtros no soportados · buildFindingsParams
  exporters.js     CSV/JSON sin PII · neutralización de fórmulas · linaje · downloadTextFile
  demoGate.js      isM7DemoAllowed (DEV o VITE_ENABLE_M7_DEMO)
  fixtures/apiLatestFixture.js   fixture DERIVADO del core del backend #211
src/lib/koldOsM7Route.js          rutas + allowlist de params (GET-only)
```

## Integración con el resto de la PWA (mínima)

- `registry.js` → módulo `profitability-costs`, ruta `/rentabilidad-costos`, `accessPolicy: 'm7'`.
- `navModel.js` → `ACCESS_POLICY_RESOLVERS.m7 = readM7Access` (misma autoridad para todo).
- `api.js` → `directKoldOsM7` (handler directo Odoo, **GET-only**, 405 en cualquier otro método).
- `App.jsx` → `M7RentabilidadRoute` (route guard que revalida con `readM7Access`).

## Principio rector

Una sola autoridad decide acceso (tarjeta = nav = clic = guard). Una sola autoridad
interpreta métricas (`resolveM7Metric`). El frontend **no confía** en el payload:
valida el contrato antes de renderizar y jamás pinta un `null` como `0`.
