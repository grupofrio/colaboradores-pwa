// KOLD OS · M6 — routing directo a Odoo para los endpoints de caja/cobranza.
//
// PROHIBIDO el fallback n8n para estas rutas: viven SOLO en Odoo (gf_kold_os_m6).
// El server revalida flag/token/acceso/params; esta allowlist solo evita mandar
// params fuera del contrato kold.os.m6.api/1.
//
// ⚠️ El backend M6 esta construido en LOCAL y AUN NO PUBLICADO (el repo Odoo
// migra de GrupoVeniu/GrupoFrio a grupofrio/gf). Estos endpoints NO existen
// desplegados todavia: en produccion el cliente resuelve `unavailable`. Sin
// numero de PR aqui: un numero en runtime envejece y miente (M5 cito el PR de M4).

export const KOLD_OS_M6_LATEST_PATH = '/pwa-kold-os/m6/latest'
export const KOLD_OS_M6_FINDINGS_PATH = '/pwa-kold-os/m6/findings'
export const KOLD_OS_M6_RUNS_PATH = '/pwa-kold-os/m6/runs'

// ESPEJO EXACTO de core.FINDINGS_FILTER_PARAMS del backend M6.
//
// NO estan (y no deben enviarse): company_id, branch_id, currency_id, journal_id,
// aging_bucket, partner_id. M6 v1 es AGREGADO (granularities == ['aggregate']) y
// los hallazgos NO portan esas dimensiones: un filtro que el hallazgo no puede
// satisfacer devolveria 0 SIEMPRE. Ambos fallos del espejo son silenciosos —
// un param de mas cae en rejected_params y el backend devuelve la lista SIN
// filtrar; uno de menos se descarta antes de salir. Por eso el espejo es exacto
// y rejected_params se muestra en la UI.
export const KOLD_OS_M6_FINDINGS_PARAMS = Object.freeze([
  'run_id', 'scope_key', 'category', 'rule_code', 'classification', 'verdict',
  'severity', 'lifecycle_status', 'responsible_area', 'entity_type',
  'search', 'date_from', 'date_to', 'page', 'page_size',
])

export function isKoldOsM6Path(cleanPath) {
  return cleanPath === KOLD_OS_M6_LATEST_PATH
    || cleanPath === KOLD_OS_M6_FINDINGS_PATH
    || cleanPath === KOLD_OS_M6_RUNS_PATH
}

// Acepta URLSearchParams o un objeto plano; devuelve SOLO params del contrato con
// valor no vacio. Jamas deja pasar employee_id/domain/partner_id u otros.
export function filterKoldOsM6Params(query) {
  const out = {}
  for (const key of KOLD_OS_M6_FINDINGS_PARAMS) {
    const value = query?.get ? query.get(key) : query?.[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}
