# M4 — Contrato de datos del frontend (`kold.os.m4.api/1`)

**Backend: GrupoVeniu/GrupoFrio PR #205 (DRAFT, head `4e195a92`).** Puntos de
ajuste si el contrato cambia: `src/lib/koldOsM4Route.js` (paths/allowlist) +
`m4/contract.js` (validador) + regenerar fixture. La pantalla no se toca.

## Endpoints (GET-only, Odoo directo, sin fallback n8n)
| Path | Valida con |
|---|---|
| `/pwa-kold-os/m4/latest` | `validateM4Latest` |
| `/pwa-kold-os/m4/findings` | `validateM4Findings` (paginado server-side ≤100) |
| `/pwa-kold-os/m4/runs` | `validateM4Runs` |

## Allowlist de `/findings` — espejo EXACTO del backend

Los **15** que `core.FINDINGS_FILTER_PARAMS` soporta de verdad:

`run_id` · `category` · `rule_code` · `classification` · `verdict` ·
`severity` · `lifecycle_status` · `responsible_area` · `granularity` ·
`entity_type` · `date_from` · `date_to` · `search` · `page` · `page_size`.

**Regla de admisión: un filtro entra SOLO si el hallazgo porta ese campo.**

**JAMÁS**: employee_id, customer_name, phone, email, vat/rfc, address (PII).
**Tampoco**:
- `channel` / `customer_segment` / `product_id` — el contrato v1 es agregado y
  no tiene esas dimensiones.
- `company_id` / `branch_id` — `company_dimension=false` / `branch_dimension=false`:
  ningún hallazgo los porta ⇒ filtrar por ellos daría vacío **siempre**, y el
  lector concluiría "no hay datos" en vez de "ese filtro no existe". La
  compañía es el **scope de la corrida**, no un filtro.
- `route_id` / `plan_id` / `vehicle_id` — ontología de M3: un hallazgo comercial
  no vive en una ruta.

Debe coincidir campo por campo con `core.FINDINGS_FILTER_PARAMS`, y hay un test
que lo fija. Los dos modos de derivar fallan **en silencio** y en direcciones
opuestas:

- **Parámetro de más** → el backend lo mete en `rejected_params` y devuelve la
  lista SIN filtrar: la UI muestra "Incumplimiento" seleccionado y lista
  anomalías.
- **Parámetro de menos** → `filterKoldOsM4Params` lo descarta antes de salir: el
  selector se ve pero no hace nada.

Ninguno lanza un error. Por eso se fijan los dos lados.

## Lo que el validador EXIGE del envelope

schema_version explícita · run con guardas booleanas + hashes + **linaje**
(`auditor_build_sha` ≠ `contract_build_sha`; `build_sha` suelto RECHAZADO) +
**metadata de evidencia** (`is_production_shell_run` bool, `blocked_by` no vacío
cuando false, `evidence_source`/`evidence_classification` de enums cerrados) +
**scope con ventana ABSOLUTA** `[window_start, window_end_exclusive)` ·
`capabilities` (required_query_ids + `granularities` + `features` con las
dimensiones y las fronteras M5/M6/M7 declaradas) · history.runs_count ·
**`kpis` con contrato por KPI** · metrics · summary con
`unique_records_available:false` y **totales = suma exacta recomputada de
rule_results** · rule_results y findings con el contrato epistémico completo
(classification/verdict/confidence/universe/business_assumption/
evidence_limitations/approved_threshold/threshold_source).

### Contrato por KPI

Cada entrada de `kpis` es un objeto, no un número suelto: `value` (finito) ·
`universe` (obligatorio — un número sin universo no significa nada) ·
`source_model` · `source_fields` (lista no vacía) · `data_as_of` (ISO) ·
`coverage` y `caveat` opcionales. **Un KPI en `null` se rechaza**: si la fuente
no existe, el backend omite la clave (jamás un cero falso).

## Fail-closed (rechaza el envelope entero)

exploratory como incumplimiento · incumplimiento sin umbral aprobado ·
not_evaluable con incidencias · total inconsistente · metadata no formal
incompleta · **PII detectada en cualquier nivel** (`scanForbiddenKeys`) ·
granularidad incompatible (aggregate con ids / branch sin id / granularidad no
declarada en capabilities / findings de sucursal con `branch_dimension=false`) ·
finding que contradice a su rule_result · **residuo M3 en `kpis`** · capability
que afirme medir entregado/facturado/cobrado/margen · schema desconocida.

## Estados del cliente (m4Api)

ok · disabled(503/flag) · session_expired(401) · forbidden(403) ·
unavailable(404) · schema_mismatch(409/versión) · invalid(contrato) ·
error(timeout/red/payload>2MB). Timeout 30 s; alive-flag (api() sin
AbortSignal); cero persistencia local.
