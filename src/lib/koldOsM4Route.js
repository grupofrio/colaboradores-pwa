// ─── KOLD OS · M4 — routing directo a Odoo ───────────────────────────────────
// PROHIBIDO el fallback n8n para estas rutas (viven SOLO en Odoo,
// gf_kold_os_m4). Espejo del backend GrupoVeniu/GrupoFrio PR #205:
// si el contrato cambia paths o campos, este archivo y m4/contract.js son los
// únicos puntos de ajuste del wiring.
// Molde: koldOsM2Route.js (patrón mergeado en main).

export const KOLD_OS_M4_LATEST_PATH = '/pwa-kold-os/m4/latest'
export const KOLD_OS_M4_FINDINGS_PATH = '/pwa-kold-os/m4/findings'
export const KOLD_OS_M4_RUNS_PATH = '/pwa-kold-os/m4/runs'

// Allowlist DURA de parámetros de /findings: espejo EXACTO de
// core.FINDINGS_FILTER_PARAMS del backend. Debe coincidir campo por campo —
// un parámetro que el backend no conoce cae en `rejected_params` y la pantalla
// muestra el filtro puesto con la lista SIN filtrar (mentira silenciosa); uno
// que falte aquí se descarta antes de salir y el filtro no hace nada.
// JAMÁS: employee_id, customer_name, phone, email, vat/rfc, address — PII.
// Sin channel/customer_segment/product_id: el contrato v1 es AGREGADO y no
// tiene esas dimensiones. Sin route_id/plan_id/vehicle_id: son de M3.
// Sin company_id/branch_id: capabilities declara company_dimension=false y
// branch_dimension=false ⇒ ningún hallazgo los porta ⇒ filtrar por ellos daría
// vacío SIEMPRE, y el usuario leería "no hay datos" en vez de "no existe ese
// filtro". La compañía es el SCOPE de la corrida, no un filtro.
export const KOLD_OS_M4_FINDINGS_PARAMS = Object.freeze([
  'run_id',
  'category', 'rule_code', 'classification', 'verdict', 'severity',
  'lifecycle_status', 'responsible_area',
  'granularity', 'entity_type', 'date_from', 'date_to',
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
