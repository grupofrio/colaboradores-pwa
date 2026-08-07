// KOLD OS · M3 — routing directo a Odoo para los endpoints de observabilidad
// de EJECUCIÓN DE RUTAS. PROHIBIDO el fallback n8n (viven SOLO en Odoo,
// gf_kold_os_m3, PR GrupoVeniu/GrupoFrio#202). El server revalida
// flag/token/acceso/params; esta allowlist solo evita mandar params fuera del
// contrato kold.os.m3.api/1. NOTA: employee_id NO está permitido (privacidad).

export const KOLD_OS_M3_LATEST_PATH = '/pwa-kold-os/m3/latest'
export const KOLD_OS_M3_FINDINGS_PATH = '/pwa-kold-os/m3/findings'
export const KOLD_OS_M3_RUNS_PATH = '/pwa-kold-os/m3/runs'

export const KOLD_OS_M3_FINDINGS_PARAMS = Object.freeze([
  'run_id', 'company_id', 'branch_id', 'route_id', 'plan_id', 'vehicle_id',
  'category', 'rule_code', 'severity', 'lifecycle_status', 'responsible_area',
  'verdict', 'classification',
  'granularity', 'entity_type', 'date_from', 'date_to', 'search', 'page', 'page_size',
])

export function isKoldOsM3Path(cleanPath) {
  return cleanPath === KOLD_OS_M3_LATEST_PATH
    || cleanPath === KOLD_OS_M3_FINDINGS_PATH
    || cleanPath === KOLD_OS_M3_RUNS_PATH
}

// Acepta URLSearchParams o un objeto plano; devuelve SOLO params del contrato
// con valor no vacío. Jamás deja pasar employee_id/domain u otros.
export function filterKoldOsM3Params(query) {
  const out = {}
  for (const key of KOLD_OS_M3_FINDINGS_PARAMS) {
    const value = query?.get ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
