# M3 — Contrato de datos (frontend ↔ gf_kold_os_m3)

Contrato canónico completo: `gf_kold_os_m3/docs/M3_API_CONTRACT.md` (backend,
PR GrupoVeniu/GrupoFrio#202). Este doc fija lo que la PWA VALIDA y CONSUME.

## Endpoints consumidos
`GET /pwa-kold-os/m3/latest` · `GET /pwa-kold-os/m3/findings` (paginado ≤100)
· `GET /pwa-kold-os/m3/runs`. Vía `api()` canónico con `X-GF-Employee-Token`
(handler `directKoldOsM3`, GET-only, 405 en otros verbos, sin n8n).
**`/routes/<id>` NO existe en v1** (decisión backend documentada).

## Validación fail-closed (`m3/contract.js`)
- `schema_version` EXPLÍCITO = `kold.os.m3.api/1`; futura ⇒ `schema_mismatch`
  controlado; campos extra compatibles OK; queries nuevas via
  `capabilities.required/optional_query_ids`.
- Scope FLEXIBLE: forma (ids positivos, ventana 1..366), sin compañías fijas.
- **Granularidad en ambas direcciones**: `aggregate` con branch/route/entity
  ids ⇒ rechazo; `branch` sin `branch_id` entero ⇒ rechazo.
- `summary.unique_records_available` DEBE ser false (v1); claves sensibles
  prohibidas en todo el envelope (scan recursivo).
- KPIs requeridos (objeto `kpis`), cada uno de UNA entidad.

## Cliente (`m3/m3Api.js`)
Timeout 30 s · límite de payload 2M chars · 401→session_expired ·
403→forbidden · 404→unavailable · 409→schema_mismatch · 503→disabled ·
5xx/red→error retryable · contrato validado antes de entregar · cero
persistencia en el navegador · resultados tardíos descartados al desmontar
(alive-flag; `api()` no acepta AbortSignal — limitación documentada).

## Filtros (espejo del backend)
`run_id, company_id, branch_id, route_id, plan_id, vehicle_id, category,
rule_code, severity, lifecycle_status, responsible_area, granularity,
entity_type, date_from, date_to, search, page, page_size`.
**`employee_id` NO viaja jamás** (privacidad; el backend además lo rechaza).
El filtro visual por `status` (RED/AMBER) es local sobre la página servida
(el backend no lo expone; documentado en la UI).

## Fixture (tests + demo)
`m3/fixtures/apiLatestFixture.js`: envelope EMITIDO por el core real del
auditor M3 + core real del backend con los **agregados REALES** medidos en
producción (XML-RPC read-only 2026-07-15). Procedencia declarada
(`is_production_shell_run:false`); el run es `dev` — no finge una corrida
odoo-shell. Nada servible en `public/` (test de blindaje).
