# M7 — Matriz de contrato Backend ↔ Frontend

> Autoauditoría conjunta. Cada campo/consulta/enum que el **backend #211**
> (`GrupoVeniu/GrupoFrio`, content `88c09f49`, auditor build `fd34bb95`, base
> `GrupoFrio @ a1bf33ac`, tip `881a9c62`) emite → dónde lo **consume el frontend**
> → qué **fixture** lo representa → qué **prueba** lo fija.
>
> **El backend queda CONGELADO durante esta tarea.** Esta matriz se construyó
> LEYENDO el backend congelado (se ejecutó `core.build_latest_payload` para derivar
> el fixture); no se modificó ninguna semántica, regla, capability, query, filtro
> ni modelo. No apareció ningún blocker contractual.

## 1 · Envelope `/pwa-kold-os/m7/latest`

| Campo backend | Consumidor frontend | Fixture | Prueba |
|---------------|---------------------|---------|--------|
| `schema_version = kold.os.m7.api/1` | `validateM7Latest` rechaza otra | `M7_API_LATEST_FIXTURE.schema_version` | `m7Contract` "schema desconocido => unsupported" |
| `read_only = true` | `validateM7Latest` exige true | ✓ | `m7Contract` "el fixture valida" |
| `run.scope_key` (sha256) | linaje + export | ✓ | `m7Contract` valida; `m7Exports` "sin scope_key" |
| `run.is_production_shell_run` | `lineageState` deriva formalidad | `false` | `m7Contract` "linaje pre-migración, no formal" |
| `run.auditor_build_sha` / `contract_build_sha` | linaje + export | `fd34bb95…` | `m7Exports` "sin auditor_build_sha" |
| `run.measurement_method` | etiqueta de evidencia | `xml_rpc_read_only` | `m7Exports` "EVIDENCIA NO FORMAL" |
| `summary.total_incidences` | recomputado y validado | `14981` | `m7Contract` "suma exacta recomputada" |
| `summary.total_incidences_note` | nota anti-doble-lectura (con "pesos") | ✓ | `m7Contract` "la nota incluye pesos" |
| `summary.classification/severity_rule_counts` | ejes del dictamen | ✓ | `validateM7Latest` |
| `capabilities.profitability_level_reached` | escalera + home | `L1_observable_revenue` | `m7Contract` "nivel = L1" |
| `capabilities.features.*` (44 flags) | tiles / secciones / capability ladder | ✓ | `m7Capabilities` |
| `capabilities.historical_sales_cost_match_count` | tarjeta match (null, no 0) | `null` | `m7Contract` "count = null (jamás 0)" |
| `capability_requirements.{6}` | DAG con prereqs+compat+unmet | ✓ | `m7Capabilities` "cada capability fuerte tiene contrato" |
| `rule_results[]` (classification/verdict/severity/universe_id) | ejes + findings | 36 reglas | `validateM7Latest` valida enums |
| `findings[]` | tabla de findings | 36 | `m7Contract` "universos dentro del catálogo" |
| `metrics.{13 queries}` | `resolveM7Metric` por tile | ✓ | `m7MetricStates` |

## 2 · Las 13 queries de `metrics` → tile del frontend

| Query backend | Tile / sección frontend | Campos leídos |
|---------------|-------------------------|---------------|
| `module_status` | encabezado / disponibilidad | estado del módulo |
| `invoice_revenue_by_currency` | §1 Ingresos POR MONEDA | `currency_id, invoice_count, untaxed_total` |
| `credit_note_by_currency` | §1 Ingreso neto (facturas − NC) | por moneda |
| `sale_order_metrics` | §1 pedidos sin facturar · §7 team_id | `uninvoiced_count, with_team_count, missing_team_count` |
| `discount_metrics` | (señal de descuentos) | agregados |
| `product_cost_coverage` | cobertura de costo configurado | conteos |
| `valuation_layer_metrics` | §4 Señales SVL | `nonpositive_unit_cost_count` |
| `sales_lines_current_cost_presence` | §2 Presencia costo estándar ACTUAL | `with/without_current_standard_price_count` (denominador 728) |
| `cost_method_metrics` | método de costo del scope | `cost_method` |
| `route_readiness_metrics` | §8 rutas (señales) | `with_distance_count` |
| `fleet_cost_metrics` | §8 flota (señales) | `vehicle_count, vehicles_without_company_count` |
| `expense_analytic_metrics` | §5 gastos contabilizados | `expense_line_count` |
| `currency_metrics` | §6 moneda y consolidación | `currency_count, applicable_rate_count_in_window` |

## 3 · Ejes (4 vocabularios independientes) — espejo exacto

| Eje | Backend | Frontend enum | Prueba |
|-----|---------|---------------|--------|
| classification | `definitive/caveated/exploratory/not_evaluable/invalid` | `M7_CLASSIFICATIONS` | `m7Contract` "ejes disjuntos" |
| verdict | `incumplimiento/riesgo/anomalia/cumple/no_evaluable` | `M7_VERDICTS` | idem |
| severity | `critical/high/medium/low/informational` | `M7_SEVERITIES` | idem |
| lifecycle | `new/persistent/recurrent` (**sin `corrected`**) | `M7_LIFECYCLE_STATES` | `m7Contract` "corrected NO está en el enum" |

## 4 · Filtros — allowlist espejada

- **Soportados (server-side):** `verdict, classification, severity, lifecycle_status,
  category, rule_code, search, date_from, date_to, page, page_size` (findings);
  `run_id, scope_key, date_from, date_to, page, page_size` (runs).
- **NO soportados (13):** `company_id, branch_id, currency_id, channel_id,
  product_id, product_category_id, route_id, vehicle_id, allocation_policy_id,
  granularity, coverage_status, profitability_level, partner_id` — se muestran con
  razón, **nunca se envían** (enviarlos daría 0 siempre). `partner_id` = PII, jamás.
- Prueba: `m7AccessApi` "filtros NO soportados: ninguno en la allowlist".

## 5 · Monedas

- `money_keys`: MXN = `currency_id 33` (169 facturas, 297 459.30), USD = `currency_id 1`
  (1 factura, 11.25). **Nunca sumadas**; sin `consolidated_global_total`.
- Prueba: `m7Exports` "no suma MXN+USD"; `m7Contract` "multi-moneda … sin consolidación".

## 6 · Permisos

- Backend `_access_for`: `ALLOWED_JOB_KEYS = ("direccion_general",)` — única constante.
- Frontend `M7_ALLOWED_JOB_KEYS = ['direccion_general']`, fail-closed.
- Prueba: `m7AccessApi`, `m7Surface`.

## 7 · Divergencias declaradas (NO son bugs)

| Tema | Estado |
|------|--------|
| Linaje fixture vs `grupofrio/gf` | **pre-migración**, `reseal_required=true`. Esperado. |
| Evidencia | **no formal** (`xml_rpc_read_only`); backend #211 no desplegado; API real no probada. |
| `kpis` backend con forma heredada | los tiles derivan de `metrics`, no de un bloque `kpis` afirmativo. |

**Veredicto de la autoauditoría:** el frontend consume el contrato del backend
congelado sin ampliarlo ni contradecirlo. Todo campo consumido existe en el payload
derivado; todo enum coincide; ningún filtro no soportado se envía; ninguna moneda se
consolida; ningún nivel supera L1. **No se encontró blocker contractual.**
