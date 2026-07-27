import {
  hasValidPosCustomer,
  toPositiveSafeIntegerId,
} from './posCustomers.js'

export const NIGHT_POS_CANCEL_REASONS = Object.freeze([
  Object.freeze({ code: 'duplicate', label: 'Duplicidad' }),
  Object.freeze({ code: 'error', label: 'Error' }),
  Object.freeze({ code: 'customer_cancelled', label: 'Canceló' }),
  Object.freeze({ code: 'out_of_stock', label: 'Falta de stock' }),
])

export function normalizePosScope(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value !== 'day') {
    throw new TypeError('El alcance del POS no es válido.')
  }
  return value
}

export function readPosScopeOption(options, propertyName = 'posScope') {
  if (options === undefined) return undefined
  if (
    options === null
    || (typeof options !== 'object' && typeof options !== 'function')
    || Array.isArray(options)
  ) {
    throw new TypeError('El alcance del POS no es válido.')
  }

  const descriptor = Object.getOwnPropertyDescriptor(options, propertyName)
  if (!descriptor) {
    if (propertyName in options) {
      throw new TypeError('El alcance del POS no es válido.')
    }
    return undefined
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw new TypeError('El alcance del POS no es válido.')
  }
  return normalizePosScope(descriptor.value)
}

export function isNightPosCancelReasonCode(reasonCode) {
  return typeof reasonCode === 'string'
    && NIGHT_POS_CANCEL_REASONS.some((reason) => reason.code === reasonCode)
}

export const ADMIN_POS_FLOW = Object.freeze({
  backTo: '/admin',
  posRoute: '/admin/pos',
  ticketBasePath: '/admin/ticket',
  title: 'Venta mostrador',
  standalone: false,
  allowSaleCancellation: true,
  cancellationMode: 'free-text',
})

export const NIGHT_POS_FLOW = Object.freeze({
  backTo: '/',
  posRoute: '/pos-nocturno',
  ticketBasePath: '/pos-nocturno/ticket',
  salesRoute: '/pos-nocturno/ventas',
  title: 'POS nocturno',
  standalone: true,
  allowSaleCancellation: true,
  cancellationMode: 'closed-reasons',
  cancelReasons: NIGHT_POS_CANCEL_REASONS,
})

const dayPosFlow = {
  backTo: '/',
  posRoute: '/pos-diurno',
  ticketBasePath: '/pos-diurno/ticket',
  salesRoute: '/pos-diurno/ventas',
  title: 'POS día',
  standalone: true,
  posScope: 'day',
  defaultCustomerName: 'VENTA PUBLICO IGUALA',
  allowSaleCancellation: true,
  cancellationMode: 'closed-reasons',
  cancelReasons: NIGHT_POS_CANCEL_REASONS,
}
export const DAY_POS_FLOW = Object.freeze(dayPosFlow)

export async function submitPosCancellation({
  flow = ADMIN_POS_FLOW,
  orderId,
  reasonCode,
  reason,
  cancelFn,
} = {}) {
  if (!flow?.allowSaleCancellation) {
    throw new Error('La cancelación no está habilitada para este flujo.')
  }
  const normalizedOrderId = toPositiveSafeIntegerId(orderId)
  if (!normalizedOrderId) {
    throw new Error('La venta no tiene un identificador válido.')
  }
  if (typeof cancelFn !== 'function') {
    throw new TypeError('Se requiere una función de cancelación.')
  }

  if (flow.cancellationMode === 'closed-reasons') {
    const matchingReasons = Array.isArray(flow.cancelReasons)
      ? flow.cancelReasons.filter((item) => item?.code === reasonCode)
      : []
    if (matchingReasons.length !== 1) {
      throw new Error('Selecciona un motivo de cancelación válido.')
    }
    return cancelFn(normalizedOrderId, {
      reasonCode,
      ...(flow.posScope === undefined ? {} : { posScope: normalizePosScope(flow.posScope) }),
    })
  }

  if (flow.cancellationMode === 'free-text') {
    const trimmedReason = String(reason ?? '').trim()
    if (!trimmedReason) {
      throw new Error('Escribe el motivo de cancelación.')
    }
    return cancelFn(normalizedOrderId, trimmedReason)
  }

  throw new Error('El modo de cancelación no es válido.')
}

export function canCancelPosOrder(flow, order, backendCap) {
  if (backendCap !== true || flow?.allowSaleCancellation !== true) return false
  if (!order || typeof order !== 'object' || Array.isArray(order)) return false

  const orderId = toPositiveSafeIntegerId(order.id)
    || toPositiveSafeIntegerId(order.order_id)
  if (!orderId) return false

  const state = typeof order.state === 'string'
    ? order.state.trim().toLowerCase()
    : ''
  if (state === 'cancel' || state === 'done') return false

  if (flow.cancellationMode === 'closed-reasons') {
    return state === 'sale' && order.can_cancel === true
  }
  return flow.cancellationMode === 'free-text'
}

export function buildPosTicketPath(flow = ADMIN_POS_FLOW, orderId) {
  const id = toPositiveSafeIntegerId(orderId)
  if (!id) return ''
  const basePath = String(flow?.ticketBasePath || ADMIN_POS_FLOW.ticketBasePath).replace(/\/+$/, '')
  return `${basePath}/${id}`
}

export function canOpenPosPayment(cart = [], customer = {}, readiness) {
  if (!Array.isArray(cart) || cart.length === 0 || !hasValidPosCustomer(customer)) return false
  if (readiness === undefined) return true
  if (readiness?.defaultCustomerReady === false) return false

  const customerId = toPositiveSafeIntegerId(customer.id)
  const catalogCustomerId = toPositiveSafeIntegerId(readiness?.catalogCustomerId)
  return readiness?.loading === false && catalogCustomerId === customerId
}

function responseLayers(response) {
  const layers = []
  let current = response
  while (current && typeof current === 'object' && !Array.isArray(current)) {
    layers.push(current)
    if (!current.data || typeof current.data !== 'object' || Array.isArray(current.data)) break
    current = current.data
  }
  return layers
}

function responseMessage(layers, fallback) {
  for (const layer of layers) {
    const message = layer?.user_message
      || layer?.error?.message
      || layer?.error
      || layer?.message
    if (message && typeof message !== 'object') return String(message)
  }
  return fallback
}

export function classifyPosSaleCreateError(error) {
  const code = String(error?.code || '').toLowerCase()
  const status = Number(error?.status)
  const isUncertain = error instanceof TypeError
    || code === 'network'
    || code === 'timeout'
    || status === 0
    || (Number.isFinite(status) && status >= 500 && status < 600)

  if (isUncertain) {
    return {
      status: 'uncertain',
      message: 'No vuelvas a cobrar; verifica la venta antes de reintentar porque no se pudo confirmar el resultado.',
    }
  }

  return {
    status: 'error',
    message: error?.message || 'Error al crear venta',
  }
}

export function normalizePosSaleResult(response) {
  const layers = responseLayers(response)
  const explicitError = layers.find((layer) => (
    layer.ok === false
    || layer.success === false
    || String(layer.status || '').toLowerCase() === 'error'
  ))

  if (explicitError) {
    return {
      status: 'error',
      message: responseMessage(
        [explicitError, ...layers],
        'Error al crear venta',
      ),
    }
  }

  for (const layer of [...layers].reverse()) {
    const orderId = toPositiveSafeIntegerId(layer.order_id)
      || toPositiveSafeIntegerId(layer.id)
    if (orderId) return { status: 'created', orderId }
  }

  return {
    status: 'uncertain',
    message: 'Venta creada pero sin folio. No vuelvas a cobrar; verifica la venta antes de reintentar.',
  }
}
