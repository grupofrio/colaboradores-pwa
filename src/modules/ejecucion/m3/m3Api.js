// ─── KOLD OS · M3 — Cliente autenticado de la API (mecanismo canónico) ───────
// Consume EXCLUSIVAMENTE los endpoints GET autenticados de gf_kold_os_m3 vía
// api() (X-GF-Employee-Token, /odoo-api, ApiError status/code, sin retries,
// PROHIBIDO fallback n8n — ver directKoldOsM3 en src/lib/api.js).
//
// Política de datos: la evidencia NO se cachea ni se persiste en ningún
// almacenamiento del navegador (test lo escanea); timeout duro; respuestas
// acotadas por tamaño; contrato validado antes de entregar a la UI; el
// desmontaje descarta resultados tardíos (alive-flag: api() no acepta
// AbortSignal — limitación documentada, misma que Tower M1 y M2).

import { KOLD_OS_M3_LATEST_PATH, KOLD_OS_M3_FINDINGS_PATH, KOLD_OS_M3_RUNS_PATH, KOLD_OS_M3_FINDINGS_PARAMS } from '../../../lib/koldOsM3Route.js'
import { isM3RunId, validateM3Latest, validateM3Findings } from './contract.js'

export const M3_TIMEOUT_MS = 30000
export const M3_MAX_PAYLOAD_CHARS = 2_000_000
export const M3_MAX_TEXT_FILTER_CHARS = 120

const M3_NUMERIC_FILTERS = new Set([
  'company_id', 'branch_id', 'route_id', 'plan_id', 'vehicle_id', 'page', 'page_size',
])
const PYTHON_DECIMAL_INT_RE = /^[+-]?\d+$/

export function normalizeM3FindingsRequest(params = {}) {
  const clean = {}
  const rejected = []
  for (const key of KOLD_OS_M3_FINDINGS_PARAMS) {
    const raw = params?.[key]
    if (raw === undefined || raw === null || raw === '') continue
    const value = String(raw).trim()
    if (!value) continue
    if (M3_NUMERIC_FILTERS.has(key)) {
      const number = Number(value)
      if (!PYTHON_DECIMAL_INT_RE.test(value) || !Number.isSafeInteger(number)) rejected.push(key)
      else clean[key] = number
      continue
    }
    if (value.length > M3_MAX_TEXT_FILTER_CHARS) {
      rejected.push(key)
      continue
    }
    clean[key] = value
  }
  if (!isM3RunId(clean.run_id)) {
    delete clean.run_id
    if (!rejected.includes('run_id')) rejected.unshift('run_id')
  }
  return { ok: rejected.length === 0, params: clean, rejected_params: rejected }
}

export function createLatestRequestGate() {
  let latestRequestId = 0
  return {
    begin() {
      latestRequestId += 1
      return latestRequestId
    },
    isLatest(requestId) {
      return requestId === latestRequestId
    },
  }
}

// api() se resuelve LAZY: mantiene este módulo puro para tests (node) y solo
// carga el cliente canónico completo en el navegador cuando de verdad se usa.
async function defaultApi(method, path) {
  const { api } = await import('../../../lib/api.js')
  return api(method, path)
}

export function withTimeout(promise, ms = M3_TIMEOUT_MS) {
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

/** Mapea ApiError/contrato a estados de UI (401/403/404/409/503/5xx/timeout). */
export function classifyM3Error(err) {
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
  if (JSON.stringify(payload).length > M3_MAX_PAYLOAD_CHARS) {
    const e = new Error('payload_too_large')
    e.code = 'payload_too_large'
    e.status = 0
    throw e
  }
  return payload
}

export async function fetchM3Latest({ timeoutMs = M3_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M3_LATEST_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM3Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema, payload: canonicalPayload } = validateM3Latest(payload)
  if (!ok) {
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'invalid', errors }
  }
  return { state: 'ok', payload: canonicalPayload }
}

export async function fetchM3Findings(params = {}, {
  timeoutMs = M3_TIMEOUT_MS,
  apiImpl = defaultApi,
  latestPayload = null,
} = {}) {
  const normalized = normalizeM3FindingsRequest(params)
  if (!normalized.ok) {
    return {
      state: 'invalid_request',
      errors: ['findings: filtros invalidos'],
      rejected_params: normalized.rejected_params,
    }
  }
  const query = new URLSearchParams()
  for (const key of KOLD_OS_M3_FINDINGS_PARAMS) {
    const value = normalized.params[key]
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', `${KOLD_OS_M3_FINDINGS_PATH}${suffix}`), timeoutMs))
  } catch (err) {
    return { ...classifyM3Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  const { ok, errors, schema, payload: canonicalPayload } = validateM3Findings(
    payload, normalized.params, latestPayload,
  )
  if (!ok) {
    if (Array.isArray(payload?.rejected_params) && payload.rejected_params.length > 0) {
      return { state: 'invalid_request', errors, rejected_params: payload.rejected_params }
    }
    return schema === 'unsupported'
      ? { state: 'schema_mismatch', errors }
      : { state: 'invalid', errors }
  }
  return { state: 'ok', payload: canonicalPayload }
}

/** GET /pwa-kold-os/m3/runs (historial ligero; validación mínima). */
export async function fetchM3Runs({ timeoutMs = M3_TIMEOUT_MS, apiImpl = defaultApi } = {}) {
  let payload
  try {
    payload = guardSize(await withTimeout(apiImpl('GET', KOLD_OS_M3_RUNS_PATH), timeoutMs))
  } catch (err) {
    return { ...classifyM3Error(err), errors: [String(err?.code || err?.message || 'error')] }
  }
  if (!payload || payload.ok !== true || !Array.isArray(payload.runs)) {
    return { state: 'invalid', errors: ['runs: respuesta malformada'] }
  }
  return { state: 'ok', payload }
}
