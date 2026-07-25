import { hasValidPosCustomer } from './posCustomers.js'

export const ADMIN_POS_FLOW = Object.freeze({
  backTo: '/admin',
  posRoute: '/admin/pos',
  ticketBasePath: '/admin/ticket',
  title: 'Venta mostrador',
  standalone: false,
})

export const NIGHT_POS_FLOW = Object.freeze({
  backTo: '/',
  posRoute: '/pos-nocturno',
  ticketBasePath: '/pos-nocturno/ticket',
  title: 'POS nocturno',
  standalone: true,
})

export function buildPosTicketPath(flow = ADMIN_POS_FLOW, orderId) {
  const id = Number(orderId || 0)
  if (!id) return ''
  const basePath = String(flow?.ticketBasePath || ADMIN_POS_FLOW.ticketBasePath).replace(/\/+$/, '')
  return `${basePath}/${id}`
}

export function canOpenPosPayment(cart = [], customer = {}) {
  return Array.isArray(cart) && cart.length > 0 && hasValidPosCustomer(customer)
}
