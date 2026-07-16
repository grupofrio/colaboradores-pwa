// ─── KOLD OS · M6 — Cliente autenticado de la API (mecanismo canónico) ───────
// Consume EXCLUSIVAMENTE los endpoints GET autenticados de gf_kold_os_m6 vía
// api() (X-GF-Employee-Token, /odoo-api, ApiError status/code, sin retries,
// PROHIBIDO fallback n8n — ver directKoldOsM6 en src/lib/api.js).
//
// ⚠️ LA API REAL NUNCA HA SIDO PROBADA: el backend M6 está construido en LOCAL y
// no publicado (el repo Odoo migra a grupofrio/gf). Hoy NO existe endpoint
// desplegado ⇒ en producción este cliente resuelve `unavailable` (404) y la
// pantalla lo declara. Jamás carga el fixture como sustituto.
//
// Política de datos: la evidencia NO se cachea ni se persiste en ningún
// almacenamiento del navegador (hay test que escanea la ausencia de esas APIs);
// timeout duro; respuestas acotadas por tamaño; contrato validado antes de
// entregar a la UI; el desmontaje descarta resultados tardíos.

import {
  KOLD_OS_M6_LATEST_PATH, KOLD_OS_M6_FINDINGS_PATH, KOLD_OS_M6_RUNS_PATH,
  KOLD_OS_M6_FINDINGS_PARAMS,
} from '../../../lib/koldOsM6Route.js'
import { validateM6Latest, validateM6Findings, validateM6Runs } from './contract.js'

// api() se resuelve LAZY: mantiene este módulo puro para tests (node) y solo
// carga el cliente canónico completo en el navegador cuando de verdad se usa.
async function defaultApi(method, path) {
  const { api } = await import('../../../lib/api.js')
  return api(method, path)
}

export const M6_TIMEOUT_MS = 30000
// Techo defensivo del payload parseado (~2 MB). El backend pagina
// (page_size <= 100), así que esto solo ataja respuestas anómalas.
export const M6_MAX_PAYLOAD_CHARS = 2_000_000

export function withTimeout(promise, ms = M6_TIMEOUT_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('timeout')
      e.code = 'timeout'
      e.status = 0
      reject(e)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Mapea ApiError/contrato a estados de UI.
 * 404 => `unavailable`: es EL estado esperado hoy (backend no desplegado).
 */
export function classifyM6Error(err) {
  const status = Number(err?.status) || 0
  const code = String(err?.code || '')
  if (status === 503 || code === 'feature_disabled') return { state: 'flag_off', retryable: true }
  if (status === 401 || code === 'no_session') return { state: 'unauthorized', retryable: false }
  if (status === 403) return { state: 'forbidden', retryable: false }
  if (status === 404 || code === 'module_disabled') return { state: 'unavailable', retryable: true }
  if (status === 405 || code === 'method_not_allowed') return { state: 'error', retryable: false, code: 'method_not_allowed' }
  if (status === 409 || code === 'schema_mismatch') return { state: 'schema_mismatch', retryable: false }
  if (status === 422) return { state: 'malformed', retryable: false }
  if (code === 'timeout') return { state: 'error', retryable: true, code }
  if (code === 'payload_too_large') return { state: 'malformed', retryable: false, code }
  return { state: 'error', retryable: true, code: code || (status ? String(status) : 'network') }
}

function guardSize(payload) {
  if (JSON.stringify(payload).length > M6_MAX_PAYLOAD_CHARS) {
    const e = new Error('payload_too_large')
    e.code = 'payload_too_large'
    e.status = 0
    throw e
  }
  return payload
}

/**
 * GET /pwa-kold-os/m6/latest → { state: 'ok', payload } | { state, errors? }.
 * Estados: ok · flag_off · unauthorized · forbidden · unavailable ·
 * schema_mismatch · malformed · error.
 */
export async function fetchM6Latest({ timeoutMs = M6_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M6_LATEST_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM6Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM6Latest(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed', errors }
  }
  return { state: 'ok', payload }
}

/**
 * GET /pwa-kold-os/m6/findings con filtros del contrato.
 * TODOS los filtros viajan al backend: el backend filtra → cuenta → pagina.
 * El frontend JAMÁS filtra funcionalmente el resultado (bug 3 de M3).
 */
export async function fetchM6Findings(params = {}, { timeoutMs = M6_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  const query = new URLSearchParams()
  for (const key of KOLD_OS_M6_FINDINGS_PARAMS) {
    const value = params?.[key]
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M6_FINDINGS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM6Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM6Findings(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed', errors }
  }
  return { state: 'ok', payload }
}

/** GET /pwa-kold-os/m6/runs — historial del scope (jamás mezcla scopes). */
export async function fetchM6Runs(params = {}, { timeoutMs = M6_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  const query = new URLSearchParams()
  for (const key of ['scope_key', 'page', 'page_size']) {
    const value = params?.[key]
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M6_RUNS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM6Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM6Runs(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed', errors }
  }
  return { state: 'ok', payload }
}
