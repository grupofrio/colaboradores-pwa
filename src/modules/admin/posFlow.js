import {
  hasValidPosCustomer,
  toPositiveSafeIntegerId,
} from './posCustomers.js'

export const ADMIN_POS_FLOW = Object.freeze({
  backTo: '/admin',
  posRoute: '/admin/pos',
  ticketBasePath: '/admin/ticket',
  title: 'Venta mostrador',
  standalone: false,
  allowSaleCancellation: true,
})

export const NIGHT_POS_FLOW = Object.freeze({
  backTo: '/',
  posRoute: '/pos-nocturno',
  ticketBasePath: '/pos-nocturno/ticket',
  title: 'POS nocturno',
  standalone: true,
  allowSaleCancellation: false,
})

export function buildPosTicketPath(flow = ADMIN_POS_FLOW, orderId) {
  const id = toPositiveSafeIntegerId(orderId)
  if (!id) return ''
  const basePath = String(flow?.ticketBasePath || ADMIN_POS_FLOW.ticketBasePath).replace(/\/+$/, '')
  return `${basePath}/${id}`
}

export function canOpenPosPayment(cart = [], customer = {}, readiness) {
  if (!Array.isArray(cart) || cart.length === 0 || !hasValidPosCustomer(customer)) return false
  if (readiness === undefined) return true

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
