# M5 — Contrato de datos del frontend (`kold.os.m5.api/1`)

**Backend: GrupoVeniu/GrupoFrio PR #208 (DRAFT).** Puntos de ajuste:
`src/lib/koldOsM5Route.js` + `m5/contract.js` + regenerar fixture.

## Allowlist de `/findings` — espejo EXACTO del backend (15)

`run_id` · `category` · `rule_code` · `classification` · `verdict` · `severity`
· `lifecycle_status` · `responsible_area` · `granularity` · `entity_type` ·
`date_from` · `date_to` · `search` · `page` · `page_size`.

**Regla de admisión: un filtro entra SOLO si el hallazgo porta ese campo.**
NO existen: PII · company_id/warehouse_id/branch_id/vehicle_id/route_id/
product_id/movement_type (el contrato v1 es agregado). Un parámetro rechazado
viaja SIEMPRE en `rejected_params` y la pantalla lo muestra en rojo.

## FAIL-CLOSED (rechaza el envelope)
universe_id fuera del catálogo (11) · finding que contradice a su regla (verdict/
classification/universo) · numerador > denominador · exploratory como
incumplimiento · incumplimiento sin umbral aprobado · KPI sin universo/fuente o
en null · KPI de dominio ajeno (M3 ejecución / M4 comercial) · PII en cualquier
nivel · totales que no suman · metadata de evidencia incompleta.

## KPIs
Cada KPI porta value/universe/source_model/source_fields/coverage/caveat/
data_as_of. **Las sumas de unidades (units_*_sum) declaran en su caveat que
mezclan UOM heterogéneas** — señal direccional, no unidades comparables.
