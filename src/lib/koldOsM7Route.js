// KOLD OS · M7 — routing directo a Odoo para rentabilidad/costos (GET-only).
//
// PROHIBIDO el fallback n8n: estas rutas viven SOLO en Odoo (gf_kold_os_m7). El
// server revalida flag/token/acceso/params; esta allowlist sólo evita mandar
// params fuera del contrato kold.os.m7.api/1.
//
// ⚠️ El backend M7 vive en un PR TEMPORAL PRE-MIGRACIÓN (GrupoVeniu/GrupoFrio#211)
// y NO está desplegado (el repo Odoo migra a grupofrio/gf). Estos endpoints no
// existen en runtime todavía: en producción el cliente resuelve `unavailable`.
// Sin número de PR en runtime: un número envejece y miente (M5 citó el PR de M4).

export const KOLD_OS_M7_LATEST_PATH = '/pwa-kold-os/m7/latest'
export const KOLD_OS_M7_FINDINGS_PATH = '/pwa-kold-os/m7/findings'
export const KOLD_OS_M7_RUNS_PATH = '/pwa-kold-os/m7/runs'

// ESPEJO EXACTO de core.FINDINGS_FILTER_PARAMS del backend M7 (#211, content
// 88c09f49). NO están (y no deben enviarse) los de UNSUPPORTED_FILTERS:
// company_id, branch_id, currency_id, channel_id, product_id,
// product_category_id, route_id, vehicle_id, allocation_policy_id, granularity,
// coverage_status, profitability_level, partner_id. Los hallazgos v1 son
// AGREGADOS y no portan esas dimensiones: un filtro que el hallazgo no puede
// satisfacer devolvería 0 SIEMPRE (bug 3 de M3). Un param de más cae en
// rejected_params y el backend devuelve SIN filtrar; uno de menos se descarta
// antes de salir. Por eso el espejo es exacto y rejected_params se muestra.
export const KOLD_OS_M7_FINDINGS_PARAMS = Object.freeze([
  'run_id', 'scope_key', 'category', 'rule_code', 'classification', 'verdict',
  'severity', 'lifecycle_status', 'responsible_area', 'entity_type',
  'date_basis', 'cost_method', 'search', 'date_from', 'date_to',
  'page', 'page_size',
])

// runs acepta un subconjunto (el backend filtra runs por estos).
export const KOLD_OS_M7_RUNS_PARAMS = Object.freeze([
  'run_id', 'scope_key', 'date_from', 'date_to', 'page', 'page_size',
])

export function isKoldOsM7Path(cleanPath) {
  return cleanPath === KOLD_OS_M7_LATEST_PATH
    || cleanPath === KOLD_OS_M7_FINDINGS_PATH
    || cleanPath === KOLD_OS_M7_RUNS_PATH
}

// Acepta URLSearchParams o un objeto plano; devuelve SÓLO params del contrato con
// valor no vacío. Jamás deja pasar employee_id/domain/partner_id u otros. El
// conjunto permitido depende de la ruta (findings vs runs).
export function filterKoldOsM7Params(query, cleanPath) {
  const allow = cleanPath === KOLD_OS_M7_RUNS_PATH
    ? KOLD_OS_M7_RUNS_PARAMS
    : KOLD_OS_M7_FINDINGS_PARAMS
  const out = {}
  for (const key of allow) {
    const value = query?.get ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
