# M2 — Contrato de datos

## 1. Contrato v1 vigente: `kold.tower.m2.run/1`

Es **el JSON que ya emite el auditor** (`render_report` → `JSON_SUMMARY`) en
`gf_route_compliance/tools/kold_tower_m2_audit_core.py` (GrupoVeniu/GrupoFrio, build
`fb03840919cf5ee9cc9f939d88f0d7f5456187be`). La PWA lo valida con
`src/modules/planeacion/m2/contract.js` (fail-closed: cualquier desviación ⇒ no se muestra).

### run (metadatos)
`status` PASS|FAIL · `transaction_read_only` · `write_blocked` · `rollback_confirmed` ·
`environment` dev|staging|production · `manifest_sha256` · `evidence_sha256` · `run_id_sha256`
(sha256 del run_id opaco) · `build_sha` (SHA del auditor) · `started_at`/`finished_at` (ISO UTC) ·
`duration_ms` · `scope { aggregate_all_companies, company_ids[], branch_ids[], window_days }` ·
`executed_queries[]` · `skipped_queries[{query_id, reason}]` · `findings[]` (del AUDITOR = queries
omitidas, no hallazgos de negocio) · `production_contract {contract_satisfied, database_match,
scope_exact}` (obligatorio 3/3 en producción).

### metrics (13 queries del manifiesto cerrado)
`module_status` · `schema_catalog` · `optimizer_configuration` (booleans, jamás valores) ·
`scope_validation` · `forecast_metrics` · `history_metrics` · `snapshot_metrics` (por estado) ·
`weekly_plan_metrics` (por estado) · `handoff_metrics` · `branch_resolution_metrics` (por fuente) ·
`capacity_metrics` · `solver_evidence_metrics` (por status×fuente) ·
`territory_load_handoff_metrics`.

Garantías heredadas del auditor: SQL solo-SELECT con manifiesto validado, transacción READ ONLY,
write-probe (sqlstate 25006), rollback final, claves sensibles prohibidas
(password/token/…/display_name/employee_name), strings ≤ 512, sin credenciales.

### Reglas de producción (espejadas en la PWA)
DB exacta `grupofrio-grupofrio-31972140` · companies exactamente `[1,34,35,36]` · branch_ids `[]` ·
window ≤ 90 · production_contract 3/3.

## 2. Estado técnico derivado (PWA)

`technicalStateFor(run, now)`: **FAIL** si status≠PASS o guardas false · **STALE** si
`finished_at` > 7 días (M2_STALE_DAYS) · **UNAVAILABLE** si no hay doc o no valida · **PASS** resto.

## 3. Contrato UI derivado: `kold.tower.m2.finding/1`

Producido client-side por `deriveFindings.js` + `lifecycle.js` (nunca viaja por red):

`finding_id` estable (`rule_code::company:branch::entity`) · `rule_code` · `category` · `severity` ·
`status` (RED/AMBER) · `title` · `description` · `company_id` (null v1) · `company_scope[]` ·
`branch_id/branch_code/branch_name` (null v1) · `entity_type` · `entity_id` (null v1) ·
`entity_reference` · `observed_value` · `expected_rule` · `numerator/denominator/pct` ·
`first_seen_at` · `last_seen_at` · `occurrence_count` · `lifecycle_status`
(new/persistent/corrected/recurrent) · `responsible_area` · `responsible_employee_id` (null salvo
fuente autoritativa) · `owner_status` (unassigned) · `recommended_action` ·
`evidence_reference {query_id, evidence_fields, evidence_sha256, manifest_sha256, build_sha}` ·
`source_model` · `source_timestamp` · `drilldown_route` (null v1) · `auto_fix:false`.

## 4. Distribución del run (v1)

El loader (`loadM2Run.js`) solo consume la base allowlisted **`/m2/kold.tower.m2.run.latest.json`**.
**HOY NO HAY NADA PUBLICADO AHÍ** ⇒ la superficie muestra UNAVAILABLE honesto. **PROHIBIDO** servir
el run real como estático en `public/` (fuga de datos operativos sin auth; test de blindaje lo
verifica). La publicación real requiere una fuente autenticada (ver §5 y M2_RUNBOOK).

## 5. Extensión v1.1 PROPUESTA (lado auditor/Odoo — Sebastián)

La salida v1 es solo agregada ⇒ para drill-down real se propone AMPLIAR el contrato read-only
(sin tocar la operación):

1. **Dimensión sucursal**: mismas queries con `GROUP BY company_id, effective_branch_config_id`
   (+ branch_code catálogo sin PII) ⇒ habilita atribución, scope por sucursal y
   `branches_affected`.
2. **Detalle sanitizado y paginable por regla**: para cada regla, lista de entidades afectadas
   `{entity_id, entity_reference (name técnico p.ej. code del plan, NO partner), company_id,
   branch_config_id, date}` con límite/página (p.ej. 200/regla por corrida) y las mismas garantías
   del sanitizador. Habilita `drilldown_route` y "Abrir registro en Odoo"
   (`/odoo/action-…` read-only por permisos estándar).
3. **Endpoint autenticado** `GET /pwa-tower/m2-run` (patrón gf_tower_m1: flag OFF + token + rol +
   scope) o publicación gateada equivalente. Decisión y ejecución = backend (Sebas) con su propio
   gate; la PWA ya valida el contrato y renderiza los campos nuevos cuando existan.
4. **Índice de historial** `kold.tower.m2.runs.index.json` (lista de runs con fecha+hashes) para
   lifecycle multi-corrida sin datastore nuevo. Si se decide un datastore propio del observatorio,
   va FUERA de tablas operativas Odoo (separación documentada) y con autorización propia.

Nada de §5 se implementa en este PR: la UI ya soporta la parte que le toca (campos opcionales,
lifecycle multi-run, filtros por sucursal cuando lleguen datos).
