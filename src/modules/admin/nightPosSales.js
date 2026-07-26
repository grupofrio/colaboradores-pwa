import { toPositiveSafeIntegerId } from './posCustomers.js'

const SALE_STATE_LABELS = Object.freeze({
  sale: 'Activa',
  done: 'Cerrada',
  cancel: 'Cancelada',
})

const CANCEL_BLOCK_MESSAGES = Object.freeze({
  manager_required: 'Esta venta requiere autorización de un gerente.',
  already_cancelled: 'Esta venta ya está cancelada.',
  closed: 'Esta venta está cerrada y requiere reversión manual.',
  invalid_state: 'Esta venta no se puede cancelar en su estado actual.',
})

const UNKNOWN_STATE_LABEL = 'Desconocida'
const SAFE_CANCEL_BLOCK_MESSAGE = 'Esta venta no se puede cancelar.'

function relationId(value) {
  if (Array.isArray(value)) return toPositiveSafeIntegerId(value[0]) || null
  if (value && typeof value === 'object') {
    return toPositiveSafeIntegerId(value.id) || null
  }
  return toPositiveSafeIntegerId(value) || null
}

function relationName(value) {
  if (Array.isArray(value)) return String(value[1] || '').trim()
  if (value && typeof value === 'object') {
    return String(value.display_name || value.name || '').trim()
  }
  return ''
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeSaleRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const orderId = relationId(row.order_id ?? row.id)
  if (!orderId) return null

  const partnerId = relationId(row.partner_id ?? row.customer_id)
  const partnerName = String(
    row.partner_name
      || row.customer
      || row.customer_name
      || relationName(row.partner_id)
      || '',
  ).trim()
  const dateOrder = row.date_order ?? row.date ?? row.create_date ?? null
  const amountTotal = finiteNumber(row.amount_total ?? row.total)

  return {
    ...row,
    id: orderId,
    order_id: orderId,
    name: String(row.name || row.folio || '').trim(),
    partner_id: partnerId,
    partner_name: partnerName,
    warehouse_id: relationId(row.warehouse_id),
    company_id: relationId(row.company_id),
    date_order: dateOrder ? String(dateOrder) : null,
    amount_total: amountTotal,
    total: amountTotal,
    state: String(row.state || '').toLowerCase(),
    can_cancel: row.can_cancel === true,
    cancel_block_code: row.cancel_block_code
      ? String(row.cancel_block_code)
      : null,
  }
}

function responseRows(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object' || Array.isArray(response.data)) return []
  if (Array.isArray(response.data?.items)) return response.data.items
  if (Array.isArray(response.data?.orders)) return response.data.orders
  return []
}

export function normalizeNightPosSalesResponse(response) {
  return responseRows(response)
    .map(normalizeSaleRow)
    .filter(Boolean)
}

export function getPosSaleStateLabel(state) {
  return SALE_STATE_LABELS[String(state || '').toLowerCase()] || UNKNOWN_STATE_LABEL
}

export function getPosCancelBlockMessage(code) {
  return CANCEL_BLOCK_MESSAGES[String(code || '')] || SAFE_CANCEL_BLOCK_MESSAGE
}
