export const PUBLIC_TICKET_CUSTOMER = 'VENTA PUBLICO'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function relationName(value) {
  if (Array.isArray(value)) return text(value[1])
  if (value && typeof value === 'object') {
    return text(
      value.name
      || value.display_name
      || value.partner_name
      || value.customer_name,
    )
  }
  return text(value)
}

export function resolveTicketCustomerName(order) {
  if (!order || typeof order !== 'object') return PUBLIC_TICKET_CUSTOMER
  return text(order.partner_name)
    || relationName(order.partner_id)
    || text(order.customer_name)
    || relationName(order.customer)
    || PUBLIC_TICKET_CUSTOMER
}
