// ─── KOLD OS · M4 — Cliente autenticado de la API (mecanismo canónico) ───────
// Consume EXCLUSIVAMENTE los endpoints GET autenticados de gf_kold_os_m4 vía
// api() (X-GF-Employee-Token, /odoo-api, ApiError status/code, sin retries,
// PROHIBIDO fallback n8n — ver directKoldOsM4 en src/lib/api.js).
//
// Política de datos (B1): la evidencia NO se cachea ni se persiste en ningún
// almacenamiento del navegador (hay test que escanea la ausencia de esas
// APIs); timeout duro; respuestas acotadas por tamaño; contrato validado antes
// de entregar a la UI; el desmontaje descarta resultados tardíos (patrón
// alive-flag de M1 — el mecanismo canónico api() no acepta AbortSignal; el
// resultado tardío se tira).

import {
  KOLD_OS_M4_LATEST_PATH, KOLD_OS_M4_FINDINGS_PATH, KOLD_OS_M4_RUNS_PATH,
  KOLD_OS_M4_FINDINGS_PARAMS,
} from '../../../lib/koldOsM4Route.js'
import { validateM4Latest, validateM4Findings, validateM4Runs } from './contract.js'

// api() se resuelve LAZY: mantiene este módulo puro para tests (node) y solo
// carga el cliente canónico completo en el navegador cuando de verdad se usa.
async function defaultApi(method, path) {
  const { api } = await import('../../../lib/api.js')
  return api(method, path)
}

export const M4_TIMEOUT_MS = 30000
// Techo defensivo del payload parseado (~2 MB serializado). El backend pagina
// (page_size <= 100), así que esto solo ataja respuestas anómalas.
export const M4_MAX_PAYLOAD_CHARS = 2_000_000

export function withTimeout(promise, ms = M4_TIMEOUT_MS) {
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

/** Mapea ApiError/contrato a estados de UI (B1: 401/403/404/409/5xx/timeout). */
export function classifyM4Error(err) {
  const status = Number(err?.status) || 0
  const code = String(err?.code || '')
  if (status === 503 || code === 'feature_disabled') return { state: 'disabled', retryable: true }
  if (status === 401 || code === 'no_session') return { state: 'session_expired', retryable: false }
  if (status === 403) return { state: 'forbidden', retryable: false }
  if (status === 404) return { state: 'unavailable', retryable: true }
  if (status === 409 || code === 'schema_mismatch') return { state: 'schema_mismatch', retryable: false }
  if (code === 'timeout') return { state: 'error', retryable: true, code }
  return { state: 'error', retryable: true, code: code || (status ? String(status) : 'network') }
}

function guardSize(payload) {
  if (JSON.stringify(payload).length > M4_MAX_PAYLOAD_CHARS) {
    const e = new Error('payload_too_large')
    e.code = 'payload_too_large'
    e.status = 0
    throw e
  }
  return payload
}

/**
 * GET /pwa-kold-os/m4/latest → { state: 'ok', payload } | { state, errors? }.
 * Estados: ok · disabled · session_expired · forbidden · unavailable ·
 * schema_mismatch · invalid · error.
 */
export async function fetchM4Latest({ timeoutMs = M4_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M4_LATEST_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM4Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM4Latest(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'invalid', errors }
  }
  return { state: 'ok', payload }
}

/** GET /pwa-kold-os/m4/findings con filtros del contrato (paginado server-side). */
export async function fetchM4Findings(params = {}, { timeoutMs = M4_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  const query = new URLSearchParams()
  for (const key of KOLD_OS_M4_FINDINGS_PARAMS) {
    const value = params?.[key]
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M4_FINDINGS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM4Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM4Findings(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'invalid', errors }
  }
  return { state: 'ok', payload }
}

/** GET /pwa-kold-os/m4/runs → historial de corridas ingeridas (metadatos). */
export async function fetchM4Runs({ timeoutMs = M4_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M4_RUNS_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM4Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema } = validateM4Runs(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'invalid', errors }
  }
  return { state: 'ok', payload }
}
