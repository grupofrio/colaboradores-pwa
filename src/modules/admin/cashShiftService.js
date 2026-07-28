import {
  authorizeCashShift,
  closeCashShift,
  getCashShiftOperationStatus,
  openCashShift,
  recloseCashShift,
  reopenCashShift,
} from './api.js'

const OPERATIONS = new Set(['open', 'close', 'reclose', 'reopen', 'authorize'])
const DEFAULT_REQUEST_REGISTRY = new Map()

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `cash-shift-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function stableValue(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('El contenido de la operación no es válido.')
    return value
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError('El contenido de la operación no es válido.')
  }
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('El contenido de la operación no es válido.')
  }
  if (seen.has(value)) throw new TypeError('El contenido de la operación no es válido.')
  seen.add(value)
  if (Array.isArray(value)) {
    const normalized = value.map((item) => stableValue(item, seen))
    seen.delete(value)
    return normalized
  }
  const normalized = {}
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Object.keys(value).sort()) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new TypeError('El contenido de la operación no es válido.')
    }
    const descriptor = descriptors[key]
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new TypeError('El contenido de la operación no es válido.')
    }
    if (descriptor.value === undefined) continue
    normalized[key] = stableValue(descriptor.value, seen)
  }
  seen.delete(value)
  return normalized
}

function requestFingerprint(operation, request) {
  const payload = { ...request }
  delete payload.idempotencyKey
  return JSON.stringify(stableValue({ operation, payload }))
}

function unwrapEnvelope(value) {
  return value && typeof value === 'object' && value.result !== undefined
    ? value.result
    : value
}

export function isUncertainCashShiftError(error) {
  const status = typeof error?.status === 'number' ? error.status : null
  const code = String(error?.code || '').toLowerCase()
  return status === 0
    || (status !== null && status >= 500)
    || ['network', 'timeout', 'request_timeout', 'response_lost'].includes(code)
}

function successfulMutationResponse(raw) {
  const envelope = unwrapEnvelope(raw)
  if (envelope?.ok === false) {
    const code = String(envelope?.data?.code || envelope?.code || 'cash_shift_rejected')
    const error = new Error('La operación de corte fue rechazada por el servidor.')
    error.name = 'CashShiftOperationError'
    error.code = code
    error.status = Number(envelope?.status_code || 0) || 400
    error.details = envelope?.data && typeof envelope.data === 'object'
      ? { ...envelope.data }
      : {}
    throw error
  }
  return raw
}

export function recoverCommittedOperation(raw, operation, key, request) {
  const envelope = unwrapEnvelope(raw)
  const data = envelope?.data
  if (
    envelope?.ok === true
    && data?.state === 'completed'
    && data?.operation === operation
    && data?.key === key
    && data?.response
  ) {
    return { status: 'completed', data: data.response, key }
  }
  return {
    status: 'pending',
    data: null,
    key,
    request,
    retryable: true,
  }
}

async function defaultMutate(operation, request) {
  const handlers = {
    open: openCashShift,
    close: closeCashShift,
    reclose: recloseCashShift,
    reopen: reopenCashShift,
    authorize: authorizeCashShift,
  }
  return handlers[operation](request)
}

/**
 * Repite exactamente la misma mutación después de una respuesta incierta y,
 * si también se pierde el replay, consulta el registro idempotente del servidor.
 */
export async function mutateShiftWithRecovery(operation, input, dependencies = {}) {
  if (!OPERATIONS.has(operation)) throw new TypeError('La operación de corte no es válida.')
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Los datos de la operación no son válidos.')
  }
  const normalizedInput = stableValue(input)
  const createKey = dependencies.createKey || createIdempotencyKey
  const key = String(normalizedInput.idempotencyKey || createKey()).trim()
  if (!key) throw new TypeError('La clave de idempotencia no es válida.')
  const request = { ...normalizedInput, idempotencyKey: key }
  const registry = dependencies.requestRegistry || DEFAULT_REQUEST_REGISTRY
  const registryKey = `${operation}:${key}`
  const fingerprint = requestFingerprint(operation, request)
  const reserved = registry.get(registryKey)
  if (reserved !== undefined && reserved !== fingerprint) {
    throw new TypeError('Una clave de idempotencia solo puede reutilizarse con el mismo contenido.')
  }
  registry.set(registryKey, fingerprint)

  const mutate = dependencies.mutate || defaultMutate
  const getOperationStatus = dependencies.getOperationStatus || getCashShiftOperationStatus
  try {
    const data = successfulMutationResponse(await mutate(operation, request))
    return { status: 'completed', data, key }
  } catch (error) {
    if (!isUncertainCashShiftError(error)) throw error
  }
  try {
    const data = successfulMutationResponse(await mutate(operation, request))
    return { status: 'completed', data, key }
  } catch (replayError) {
    if (!isUncertainCashShiftError(replayError)) throw replayError
  }
  const result = await getOperationStatus({ operation, idempotencyKey: key })
  return recoverCommittedOperation(result, operation, key, request)
}
