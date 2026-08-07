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
const FINITE_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

function primitiveText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(...values) {
  for (const value of values) {
    const text = primitiveText(value)
    if (text) return text
  }
  return ''
}

function relationId(value) {
  if (Array.isArray(value)) return toPositiveSafeIntegerId(value[0]) || null
  if (value && typeof value === 'object') {
    return toPositiveSafeIntegerId(value.id) || null
  }
  return toPositiveSafeIntegerId(value) || null
}

function relationName(value) {
  if (Array.isArray(value)) return primitiveText(value[1])
  if (value && typeof value === 'object') {
    return firstText(value.display_name, value.name)
  }
  return ''
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const text = value.trim()
  if (!FINITE_NUMBER_PATTERN.test(text)) return 0
  const number = Number(text)
  return Number.isFinite(number) ? number : 0
}

function primitiveDate(...values) {
  return firstText(...values) || null
}

function normalizeSaleRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const orderId = relationId(row.order_id) || relationId(row.id)
  if (!orderId) return null

  const partnerId = relationId(row.partner_id) || relationId(row.customer_id)
  const partnerName = firstText(
    row.partner_name,
    row.customer,
    row.customer_name,
    relationName(row.partner_id),
    relationName(row.customer_id),
  )
  const dateOrder = primitiveDate(row.date_order, row.date, row.create_date)
  const amountTotal = finiteNumber(row.amount_total ?? row.total)
  const cancelBlockCode = primitiveText(row.cancel_block_code)

  return {
    id: orderId,
    order_id: orderId,
    name: firstText(row.name, row.folio),
    partner_id: partnerId,
    partner_name: partnerName,
    warehouse_id: relationId(row.warehouse_id),
    company_id: relationId(row.company_id),
    date_order: dateOrder,
    amount_total: amountTotal,
    total: amountTotal,
    state: primitiveText(row.state).toLowerCase(),
    can_cancel: row.can_cancel === true,
    cancel_block_code: cancelBlockCode || null,
  }
}

function responseRows(response) {
  const data = response?.data ?? response
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.orders)) return data.orders
  return []
}

export function normalizeRestrictedPosSalesResponse(response) {
  return responseRows(response)
    .map(normalizeSaleRow)
    .filter(Boolean)
}

export const normalizeNightPosSalesResponse = normalizeRestrictedPosSalesResponse

export function getPosSaleStateLabel(state) {
  const key = primitiveText(state).toLowerCase()
  return Object.prototype.hasOwnProperty.call(SALE_STATE_LABELS, key)
    ? SALE_STATE_LABELS[key]
    : UNKNOWN_STATE_LABEL
}

export function getPosCancelBlockMessage(code) {
  const key = primitiveText(code)
  return isKnownPosCancelBlockCode(key)
    ? CANCEL_BLOCK_MESSAGES[key]
    : SAFE_CANCEL_BLOCK_MESSAGE
}

export function isKnownPosCancelBlockCode(code) {
  return Object.prototype.hasOwnProperty.call(CANCEL_BLOCK_MESSAGES, primitiveText(code))
}
