// M1-D prereq C.2: routing directo a Odoo para el endpoint Tower M1.
// PROHIBIDO el fallback n8n para esta ruta (el endpoint vive SOLO en Odoo,
// gf_tower_m1 v18.0.1.1.0). El server revalida rol/scope/params; esta allowlist
// solo evita mandar params fuera del contrato mergeado (kold-os 57175d4).

export const TOWER_M1_BACKLOG_PATH = '/pwa-tower/m1-backlog'

export const TOWER_M1_ALLOWED_PARAMS = Object.freeze([
  'bucket',
  'state_bucket',
  'date_from',
  'date_to',
  'limit',
  'offset',
  'sort',
  'branch_id',        // solo lo honra el server para admin; supervisor lo ignora
  'close_candidate',  // F-1
])

export function isTowerM1Path(cleanPath) {
  return cleanPath === TOWER_M1_BACKLOG_PATH
}

// Acepta URLSearchParams o un objeto plano; devuelve SOLO params del contrato
// con valor no vacío. Jamás deja pasar employee_id/company_id/domain u otros.
export function filterTowerM1Params(query) {
  const out = {}
  for (const key of TOWER_M1_ALLOWED_PARAMS) {
    const value = query?.get ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
