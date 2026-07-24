// ─── KOLD OS · M7 — Cliente autenticado de la API (mecanismo canónico) ───────
// Consume EXCLUSIVAMENTE los endpoints GET autenticados de gf_kold_os_m7 vía
// api() (X-GF-Employee-Token, /odoo-api, ApiError status/code, sin retries,
// PROHIBIDO fallback n8n — ver directKoldOsM7 en src/lib/api.js).
//
// Si la API no está disponible, la pantalla resuelve `unavailable` sin cargar el
// fixture como sustituto. La PWA nunca infiere habilitación desde el cliente.
// La evidencia NO se cachea ni se persiste; timeout duro; respuestas acotadas;
// contrato validado antes de entregar; el desmontaje descarta resultados tardíos.

import {
  KOLD_OS_M7_LATEST_PATH, KOLD_OS_M7_FINDINGS_PATH, KOLD_OS_M7_RUNS_PATH,
  KOLD_OS_M7_FINDINGS_PARAMS, KOLD_OS_M7_RUNS_PARAMS,
} from '../../../lib/koldOsM7Route.js'
import { validateM7Latest, validateM7Findings, validateM7Runs } from './contract.js'

async function defaultApi(method, path) {
  const { api } = await import('../../../lib/api.js')
  return api(method, path)
}

export const M7_TIMEOUT_MS = 30000
export const M7_MAX_PAYLOAD_CHARS = 2_000_000

export function withTimeout(promise, ms = M7_TIMEOUT_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('timeout'); e.code = 'timeout'; e.status = 0; reject(e)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Mapea ApiError/contrato a estados de UI.
 * 404 => `unavailable`: es EL estado esperado hoy (backend #211 no desplegado).
 */
export function classifyM7Error(err) {
  const status = Number(err?.status) || 0
  const code = String(err?.code || '')
  if (status === 503 || code === 'feature_disabled') return { state: 'module_disabled', retryable: true }
  if (status === 401 || code === 'no_session') return { state: 'unauthorized', retryable: false }
  if (status === 403) return { state: 'forbidden', retryable: false }
  if (status === 404 || code === 'module_disabled') return { state: 'unavailable', retryable: true }
  if (status === 405 || code === 'method_not_allowed') return { state: 'error', retryable: false, code: 'method_not_allowed' }
  if (status === 409 || code === 'schema_mismatch') return { state: 'schema_mismatch', retryable: false }
  if (status === 422) return { state: 'malformed_contract', retryable: false }
  if (code === 'timeout') return { state: 'error', retryable: true, code }
  if (code === 'payload_too_large') return { state: 'malformed_contract', retryable: false, code }
  return { state: 'error', retryable: true, code: code || (status ? String(status) : 'network') }
}

function guardSize(payload) {
  if (JSON.stringify(payload).length > M7_MAX_PAYLOAD_CHARS) {
    const e = new Error('payload_too_large'); e.code = 'payload_too_large'; e.status = 0
    throw e
  }
  return payload
}

function buildQuery(params, allow) {
  const query = new URLSearchParams()
  for (const key of allow) {
    const value = params?.[key]
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const s = query.toString()
  return s ? `?${s}` : ''
}

/** GET /pwa-kold-os/m7/latest → { state: 'ok', payload } | { state, errors? }. */
export async function fetchM7Latest({ timeoutMs = M7_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M7_LATEST_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM7Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM7Latest(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed_contract', errors }
  }
  return { state: 'ok', payload }
}

/**
 * GET /pwa-kold-os/m7/findings — TODOS los filtros viajan al backend: el backend
 * filtra → cuenta → pagina. El frontend JAMÁS filtra funcionalmente (bug 3 de M3).
 */
export async function fetchM7Findings(params = {}, { timeoutMs = M7_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  const suffix = buildQuery(params, KOLD_OS_M7_FINDINGS_PARAMS)
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M7_FINDINGS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM7Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM7Findings(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed_contract', errors }
  }
  return { state: 'ok', payload }
}

/**
 * GET /pwa-kold-os/m7/runs — permite seleccionar una corrida histórica con
 * run_id. El backend NUNCA cae a latest ante un run_id desconocido (422).
 */
export async function fetchM7Runs(params = {}, { timeoutMs = M7_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  const suffix = buildQuery(params, KOLD_OS_M7_RUNS_PARAMS)
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M7_RUNS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM7Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM7Runs(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'malformed_contract', errors }
  }
  return { state: 'ok', payload }
}
