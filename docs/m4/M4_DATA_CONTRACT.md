# M4 — Contrato de datos del frontend (kold.os.m4.api/1, PROVISIONAL)

**Backend CONGELADO en `978994c4` bajo auditoría. Puntos de ajuste post-
veredicto: `src/lib/koldOsM4Route.js` (paths/allowlist) + `m4/contract.js`
(validador) + regenerar fixture. La pantalla no se toca.**

## Endpoints (GET-only, Odoo directo, sin fallback n8n)
| Path | Valida con |
|---|---|
| `/pwa-kold-os/m4/latest` | `validateM4Latest` |
| `/pwa-kold-os/m4/findings` | `validateM4Findings` (paginado server-side ≤100) |
| `/pwa-kold-os/m4/runs` | `validateM4Runs` |

Allowlist de /findings: run_id, company_id, branch_id, channel, customer_segment,
product_id, category, rule_code, classification, verdict, severity,
lifecycle_status, granularity, entity_type, date_from, date_to, search, page,
page_size. **JAMÁS**: employee_id, customer_name, phone, email, vat/rfc, address.

## Lo que el validador EXIGE del envelope
schema_version explícita · run con guardas booleanas + hashes + **linaje**
(`auditor_build_sha` ≠ `contract_build_sha`; `build_sha` suelto RECHAZADO) +
**metadata de evidencia** (`is_production_shell_run` bool, `blocked_by` no vacío
cuando false, `evidence_source`/`evidence_classification` de enums cerrados) +
**scope con ventana ABSOLUTA** `[window_start, window_end_exclusive)` ·
capabilities.required_query_ids · history.runs_count · kpis/metrics objetos ·
summary con `unique_records_available:false` y **totales = suma exacta
recomputada de rule_results** · rule_results y findings con el contrato
epistémico completo (classification/verdict/confidence/universe/
business_assumption/evidence_limitations/approved_threshold/threshold_source).

## Fail-closed (rechaza el envelope)
exploratory como incumplimiento · incumplimiento sin umbral aprobado ·
not_evaluable con incidencias · total inconsistente · metadata no formal
incompleta · **PII detectada en cualquier nivel** (`scanForbiddenKeys`) ·
granularidad incompatible (aggregate con ids / branch sin id) · finding que
contradice a su rule_result · schema desconocida.

## Estados del cliente (m4Api)
ok · disabled(503/flag) · session_expired(401) · forbidden(403) ·
unavailable(404) · schema_mismatch(409/versión) · invalid(contrato) ·
error(timeout/red/payload>2MB). Timeout 30 s; alive-flag (api() sin AbortSignal);
cero persistencia local.

## Gap declarado del backend congelado
`kpis` llega con forma M3 (todo None): el frontend deriva KPIs de `metrics` y el
gap queda flagueado para la corrección post-auditoría.
