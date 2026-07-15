// ─── KOLD OS · M4 — routing directo a Odoo (contrato PROVISIONAL) ────────────
// PROHIBIDO el fallback n8n para estas rutas (viven SOLO en Odoo,
// gf_kold_os_m4). El backend está CONGELADO en GrupoVeniu/GrupoFrio
// `978994c4` bajo auditoría de Codex: si el veredicto cambia paths o campos,
// este archivo y m4/contract.js son los únicos puntos de ajuste del wiring.
// Molde: koldOsM2Route.js (patrón mergeado en main).

export const KOLD_OS_M4_LATEST_PATH = '/pwa-kold-os/m4/latest'
export const KOLD_OS_M4_FINDINGS_PATH = '/pwa-kold-os/m4/findings'
export const KOLD_OS_M4_RUNS_PATH = '/pwa-kold-os/m4/runs'

// Allowlist DURA de parámetros de /findings (espejo de FINDINGS_ALLOWED_PARAMS
// del backend congelado). JAMÁS: employee_id, customer_name, phone, email,
// vat/rfc, address — PII / fuera del contrato v1.
export const KOLD_OS_M4_FINDINGS_PARAMS = Object.freeze([
  'run_id', 'company_id', 'branch_id', 'channel', 'customer_segment', 'product_id',
  'category', 'rule_code', 'classification', 'verdict', 'severity',
  'lifecycle_status', 'granularity', 'entity_type', 'date_from', 'date_to',
  'search', 'page', 'page_size',
])

export function isKoldOsM4Path(cleanPath) {
  return cleanPath === KOLD_OS_M4_LATEST_PATH
    || cleanPath === KOLD_OS_M4_FINDINGS_PATH
    || cleanPath === KOLD_OS_M4_RUNS_PATH
}

// Filtra un query (URLSearchParams u objeto plano) a SOLO la allowlist.
export function filterKoldOsM4Params(query) {
  const out = {}
  for (const key of KOLD_OS_M4_FINDINGS_PARAMS) {
    const value = typeof query?.get === 'function' ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
