# M7 Frontend — Filtros

Espejo **exacto** de la allowlist del backend #211. Los filtros se aplican
**server-side** (validar → filtrar → contar → paginar); el frontend no filtra en
memoria y no oculta el `rejected_params` que devuelve el backend.

## Soportados

**`/findings`:** `run_id, scope_key, category, rule_code, classification, verdict,
severity, lifecycle_status, responsible_area, entity_type, date_basis, cost_method,
search, date_from, date_to, page, page_size`.

**`/runs`:** `run_id, scope_key, date_from, date_to, page, page_size`.

Ejes con validación de VALOR contra el enum (igual que el backend): verdict,
classification, severity, lifecycle_status.

## NO soportados (13) — se muestran con razón, **nunca se envían**

Ofrecer un filtro que el hallazgo no porta devuelve **0 siempre** y se lee como "no
hay nada". Por eso se muestran deshabilitados con su razón:

| Filtro | Razón |
|--------|-------|
| `company_id` | hallazgos agregados: no portan compañía individual |
| `branch_id` | sin dimensión de sucursal en v1 |
| `currency_id` | los importes viajan POR MONEDA en metrics, no en findings |
| `channel_id` / `product_id` / `product_category_id` | sin esa dimensión en findings v1 |
| `route_id` / `vehicle_id` | sin esa dimensión en findings v1 |
| `allocation_policy_id` | v1 no tiene políticas: siempre 'none' |
| `granularity` | v1 emite una sola (aggregate) |
| `coverage_status` | no existe como campo filtrable en v1 |
| `profitability_level` | es del RUN (capabilities), no del hallazgo |
| `partner_id` | **identidad de cliente = PII; jamás viaja** |

## `run_id` real (nunca "el último")

La pestaña de runs selecciona un `run_id` explícito y lo envía. Nunca se "cae" al
último silenciosamente — ese fue un riesgo detectado en M3. Prueba: `m7AccessApi`
"fetchM7Runs pasa run_id al backend (selección real, no latest)".
