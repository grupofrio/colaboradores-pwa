// ─── KOLD OS · M2 — Loader del run (base allowlisted, fail-closed) ───────────
// Mismo blindaje que E1 (loadTowerStatus): SOLO se consume la base canónica
// `/m2`. HOY no hay nada publicado ahí ⇒ la superficie muestra el estado
// técnico UNAVAILABLE de forma honesta. La fuente real (endpoint autenticado
// u origen gateado) es parte del runbook v1.1 y NO se despliega en este PR.
// PROHIBIDO publicar el run real como JSON servible en public/ (fuga de datos
// operativos sin auth) — hay test de blindaje que lo verifica.

import { validateM2Report } from './contract.js'

export const ALLOWED_M2_BASE = '/m2'
export const M2_RUN_FILENAME = 'kold.tower.m2.run.latest.json'

export function assertSafeM2Base(base, { allowCustom = false } = {}) {
  if (base === ALLOWED_M2_BASE) return base
  if (allowCustom && typeof base === 'string' && /^\/[a-z0-9/_-]*$/i.test(base)) return base
  throw new Error(`Base M2 no permitida: ${String(base)}`)
}

export function m2RunUrl(base = ALLOWED_M2_BASE, options = {}) {
  const safe = assertSafeM2Base(base, options)
  return `${safe.replace(/\/$/, '')}/${M2_RUN_FILENAME}`
}

/**
 * Carga y valida el run más reciente. GET puro, sin credenciales, sin writes.
 * @returns {Promise<{state:'ok'|'unavailable'|'invalid', report?:object, errors?:string[]}>}
 */
export async function fetchM2Run({ base = ALLOWED_M2_BASE, fetchImpl, allowCustom = false } = {}) {
  const impl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null)
  if (!impl) return { state: 'unavailable', errors: ['fetch no disponible'] }
  let response
  try {
    response = await impl(m2RunUrl(base, { allowCustom }), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    return { state: 'unavailable', errors: ['red no disponible'] }
  }
  if (!response || !response.ok) {
    return { state: 'unavailable', errors: [`HTTP ${response?.status ?? 'sin respuesta'}`] }
  }
  let doc
  try {
    doc = await response.json()
  } catch {
    return { state: 'invalid', errors: ['JSON inválido'] }
  }
  const { ok, errors, report } = validateM2Report(doc)
  if (!ok) return { state: 'invalid', errors }
  return { state: 'ok', report }
}
