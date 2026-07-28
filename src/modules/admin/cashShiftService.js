import {
  authorizeCashShift,
  closeCashShift,
  getCashShiftOperationStatus,
  openCashShift,
  recloseCashShift,
  reopenCashShift,
} from './api.js'
import { buildSessionIdentity } from '../supervisor-ventas/v2/sessionScope.js'

const OPERATIONS = new Set(['open', 'close', 'reclose', 'reopen', 'authorize'])
const DEFAULT_REQUEST_REGISTRY = new Map()
const DEFAULT_REGISTRY_LIMIT = 128
let defaultRegistryIdentity = null
let registrySequence = 0

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
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const normalized = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)]
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError('El contenido de la operación no es válido.')
      }
      normalized.push(stableValue(descriptor.value, seen))
    }
    for (const key of Reflect.ownKeys(descriptors)) {
      if (key === 'length') continue
      if (
        typeof key !== 'string'
        || !/^(0|[1-9]\d*)$/.test(key)
        || Number(key) >= value.length
      ) {
        throw new TypeError('El contenido de la operación no es válido.')
      }
    }
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

function registryLimit(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_REGISTRY_LIMIT
}

function trimRegistry(registry, limit) {
  while (registry.size > limit) {
    let candidate = null
    for (const [key, entry] of registry) {
      if (!entry || typeof entry !== 'object' || entry.pending !== false) continue
      if (!candidate || entry.sequence < candidate.sequence) candidate = { key, sequence: entry.sequence }
    }
    if (!candidate) return
    registry.delete(candidate.key)
  }
}

export function resetCashShiftRequestRegistry(identity = null) {
  DEFAULT_REQUEST_REGISTRY.clear()
  defaultRegistryIdentity = identity ? String(identity) : null
}

function requestRegistryContext(dependencies) {
  const identity = String(
    dependencies.sessionIdentity || buildSessionIdentity().sessionKey,
  )
  if (dependencies.requestRegistry) {
    return {
      registry: dependencies.requestRegistry,
      identity,
      limit: registryLimit(dependencies.registryLimit),
    }
  }
  if (defaultRegistryIdentity !== identity) {
    resetCashShiftRequestRegistry(identity)
  }
  return {
    registry: DEFAULT_REQUEST_REGISTRY,
    identity,
    limit: registryLimit(dependencies.registryLimit),
  }
}

function reserveRequest(registry, registryKey, fingerprint, limit) {
  const reserved = registry.get(registryKey)
  const reservedFingerprint = reserved && typeof reserved === 'object'
    ? reserved.fingerprint
    : reserved
  if (reservedFingerprint !== undefined && reservedFingerprint !== fingerprint) {
    throw new TypeError('Una clave de idempotencia solo puede reutilizarse con el mismo contenido.')
  }
  if (reservedFingerprint === undefined) {
    // Abrir espacio únicamente con operaciones ya terminadas. Una operación
    // pending conserva siempre su key y borrador para recuperación manual.
    trimRegistry(registry, limit - 1)
    if (registry.size >= limit) {
      const error = new Error(
        'Hay demasiadas operaciones de corte pendientes. Confirma o recupera una antes de continuar.',
      )
      error.name = 'CashShiftRegistryError'
      error.code = 'cash_shift_pending_limit'
      error.details = { limit }
      throw error
    }
  }
  const entry = reserved && typeof reserved === 'object'
    ? reserved
    : { fingerprint }
  entry.pending = true
  entry.sequence = ++registrySequence
  registry.set(registryKey, entry)
  trimRegistry(registry, limit)
  return entry
}

function settleRequest(registry, registryKey, limit) {
  const entry = registry.get(registryKey)
  if (!entry || typeof entry !== 'object') return
  entry.pending = false
  entry.sequence = ++registrySequence
  trimRegistry(registry, limit)
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

function operationError(code, envelope, message = 'La operación de corte fue rechazada por el servidor.') {
  const error = new Error(message)
  error.name = 'CashShiftOperationError'
  error.code = String(code || 'cash_shift_rejected')
  error.status = Number(envelope?.status_code || 0) || 400
  error.details = envelope?.data && typeof envelope.data === 'object'
    ? stableValue(envelope.data)
    : {}
  return error
}

function pendingOperation(key, request) {
  return {
    status: 'pending',
    data: null,
    key,
    request: stableValue(request),
    draft: stableValue(request),
    retryable: true,
  }
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
    throw operationError(code, envelope)
  }
  return raw
}

export function recoverCommittedOperation(raw, operation, key, request) {
  const envelope = unwrapEnvelope(raw)
  const data = envelope?.data
  if (envelope?.ok === false) {
    const code = String(data?.code || envelope?.code || 'cash_shift_status_invalid')
    if (code === 'operation_not_found') return pendingOperation(key, request)
    throw operationError(code, envelope, 'No fue posible confirmar la operación de corte.')
  }
  if (
    envelope?.ok === true
    && data?.state === 'completed'
    && data?.operation === operation
    && data?.key === key
    && data?.response
  ) {
    return { status: 'completed', data: data.response, key }
  }
  if (
    envelope?.ok === true
    && data?.state === 'processing'
    && data?.operation === operation
    && data?.key === key
  ) {
    return pendingOperation(key, request)
  }
  if (envelope?.ok === true && ['completed', 'processing'].includes(data?.state)) {
    throw operationError(
      'cash_shift_status_mismatch',
      envelope,
      'El estado consultado no corresponde con la operación de corte.',
    )
  }
  throw operationError(
    'cash_shift_status_invalid',
    envelope,
    'El servidor devolvió un estado de operación no válido.',
  )
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
  const registryContext = requestRegistryContext(dependencies)
  const { registry } = registryContext
  const registryKey = `${registryContext.identity}:${operation}:${key}`
  const fingerprint = requestFingerprint(operation, request)
  reserveRequest(registry, registryKey, fingerprint, registryContext.limit)
  const settle = () => settleRequest(registry, registryKey, registryContext.limit)

  const mutate = dependencies.mutate || defaultMutate
  const getOperationStatus = dependencies.getOperationStatus || getCashShiftOperationStatus
  try {
    const data = successfulMutationResponse(await mutate(operation, request))
    settle()
    return { status: 'completed', data, key }
  } catch (error) {
    if (!isUncertainCashShiftError(error)) {
      settle()
      throw error
    }
  }
  try {
    const data = successfulMutationResponse(await mutate(operation, request))
    settle()
    return { status: 'completed', data, key }
  } catch (replayError) {
    if (!isUncertainCashShiftError(replayError)) {
      settle()
      throw replayError
    }
  }
  let result
  try {
    result = await getOperationStatus({ operation, idempotencyKey: key })
  } catch (statusError) {
    if (isUncertainCashShiftError(statusError)) return pendingOperation(key, request)
    settle()
    throw statusError
  }
  try {
    const recovered = recoverCommittedOperation(result, operation, key, request)
    if (recovered.status === 'completed') settle()
    return recovered
  } catch (statusContractError) {
    settle()
    throw statusContractError
  }
}
