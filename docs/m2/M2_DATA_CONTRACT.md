# M2 — Contrato de datos (v2: API autenticada)

## 1. Endpoints (backend `gf_kold_os_m2`, GrupoVeniu/GrupoFrio PR #201)

| Endpoint | Auth | Contenido |
|---|---|---|
| `GET /pwa-kold-os/m2/latest` | flag + `X-GF-Employee-Token` + acceso M2 | envelope completo (abajo) |
| `GET /pwa-kold-os/m2/findings` | ídem | hallazgos paginados/filtrables |

Errores: `503 feature_disabled · 401 missing_token/invalid_session · 403 forbidden ·
404 no_run_available/run_not_found · 405 (verbos ≠ GET) · 500`. La PWA los mapea a estados
de UI (m2Api.classifyM2Error) incluyendo `409 → schema_mismatch`.

## 2. Envelope `kold.os.m2.api/1` (/latest)

`ok` · **`schema_version`** (explícito; la UI NUNCA infiere por estructura) ·
`capabilities { required_query_ids, optional_query_ids, granularities, features
{history, findings_pagination, branch_dimension:false, entity_detail:false},
stale_days, findings_max_page_size }` ·
`run { run_id, status, technical_state, environment, build_sha, manifest_sha256,
evidence_sha256, started_at, finished_at, duration_ms, scope, executed_queries,
skipped_queries, transaction_read_only, write_blocked, rollback_confirmed, ingested_at }` ·
**`stale`** + `age_days` · `metrics` (agregados del auditor, transparencia) ·
`summary { overall_status, total_rules, rules_pass, rules_warning, rules_fail,
rules_not_evaluable, total_incidences, unique_records_available:false }` ·
`rule_results[24]` · `findings[]` (RED/AMBER con lifecycle) · `corrected[]` ·
`history { runs_count, previous_finished_at, latest_finished_at }` ·
`applied_scope { level }` · `read_only:true`.

### Versionado (B8)
- Versión soportada → render. **Versión futura → error controlado** (`schema_mismatch`),
  jamás adivinar. Campos ADICIONALES compatibles se ignoran (test).
- Queries nuevas del auditor entran por `capabilities.optional_query_ids` sin romper el
  run (`required_query_ids` = las 13 actuales).

### Scope (B9)
La PWA valida FORMA del scope (ids positivos, ventana 1..366), **no valores fijos**: nuevas
compañías autorizadas, scope parcial, branch scope y ventana configurable pasan sin tocar
la UI. El backend valida que el scope servido esté dentro del autorizado del usuario
(fail-closed); las garantías duras de producción las impone el AUDITOR en origen.

## 3. Item de finding (`/findings` y `findings[]` de /latest)

`finding_id` (estable: rule+scope+entity/aggregate key) · `rule_code` · `category` ·
`severity` · `status` · **`granularity`** (`aggregate` v1 — con ids nulos POR CONTRATO;
la validación rechaza un aggregate con ids: mentir granularidad es error) · `title` ·
`description` · `company_id/company_name` · `branch_id/code/name` · `entity_type` ·
`entity_id` · `entity_reference` (sanitizada) · `observed_value` · `expected_rule` ·
`numerator/denominator/pct` · **`incidences`** (afectaciones de la regla, NO entidades
únicas) · `first_seen_at` · `last_seen_at` · `occurrence_count` · `lifecycle_status` ·
`responsible_area` · `owner_status` (`unassigned` — sin dueños inventados) ·
`recommended_action` · `evidence_reference {query_id, evidence_fields, evidence_sha256,
manifest_sha256, build_sha}` · `source_model` · `source_timestamp`.

Parámetros de `/findings`: `run_id, company_id, branch_id, category, rule_code, severity,
lifecycle_status, responsible_area, entity_type, date_from, date_to, search, page,
page_size(≤100)`. Desconocidos ⇒ `rejected_params`. Respuesta: `total/page/pages/
page_size/items/applied_scope/applied_filters/rejected_params`.

## 4. Contrato de ENTRADA (auditor → ingesta)

El backend valida el `JSON_SUMMARY` del auditor (`gf_route_compliance` @ `fb03840`)
fail-closed: guardas técnicas, hashes, manifiesto (13 requeridas cubiertas; extras no
rompen), claves sensibles prohibidas, `production_contract` 3/3 en producción. Ingesta
idempotente por `run_id` y `evidence_sha256` (constraints SQL). Ver
`gf_kold_os_m2/README.md`.

## 5. Extensión v1.1 (lado auditor/Odoo — Sebastián; NO en estos PRs)

1. Dimensión compañía/sucursal (GROUP BY) → `granularity:'branch'`, scope por sucursal,
   `branches_affected` y filtros company/branch con datos reales.
2. Detalle por registro sanitizado y paginable (listas de IDs acotadas) →
   `granularity:'record'`, "Detalle por registro" y apertura segura en Odoo.
3. `capabilities.features` ya anuncia ambos en `false`: la PWA los descubre sin romperse.

## 6. Prohibiciones vigentes

Ningún JSON de M2 servible en `public/` (test de blindaje) · cero persistencia de
evidencia en el navegador (test) · cero writes desde la PWA (test) · el fixture del
envelope es **generado por código real** y jamás suplanta la evidencia productiva
(hash real citado solo como referencia de procedencia; test).
