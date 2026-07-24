// KOLD OS · M2 — routing directo a Odoo para los endpoints de observabilidad.
// PROHIBIDO el fallback n8n para estas rutas (viven SOLO en Odoo,
// gf_kold_os_m2). El server revalida flag/token/acceso/params; esta allowlist
// solo evita mandar params fuera del contrato kold.os.m2.api/1.

export const KOLD_OS_M2_LATEST_PATH = '/pwa-kold-os/m2/latest'
export const KOLD_OS_M2_FINDINGS_PATH = '/pwa-kold-os/m2/findings'

export const KOLD_OS_M2_FINDINGS_PARAMS = Object.freeze([
  'run_id', 'company_id', 'branch_id', 'category', 'rule_code', 'severity',
  'lifecycle_status', 'responsible_area', 'entity_type', 'date_from', 'date_to',
  'search', 'page', 'page_size',
])

export function isKoldOsM2Path(cleanPath) {
  return cleanPath === KOLD_OS_M2_LATEST_PATH || cleanPath === KOLD_OS_M2_FINDINGS_PATH
}

// Acepta URLSearchParams o un objeto plano; devuelve SOLO params del contrato
// con valor no vacío. Jamás deja pasar employee_id/domain u otros.
export function filterKoldOsM2Params(query) {
  const out = {}
  for (const key of KOLD_OS_M2_FINDINGS_PARAMS) {
    const value = query?.get ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
