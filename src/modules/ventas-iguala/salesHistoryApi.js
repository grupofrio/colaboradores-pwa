import { api } from '../../lib/api.js'

export const PAGE_SIZE = 50
export const MAX_SELECTED_TICKETS = 100

function toQuery(filters = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const search = query.toString()
  return search ? `?${search}` : ''
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function text(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function normalizeRelation(value) {
  if (Array.isArray(value)) {
    return { id: positiveId(value[0]), name: text(value[1]) }
  }
  if (value && typeof value === 'object') {
    return {
      id: positiveId(value.id),
      name: text(value.name ?? value.display_name),
    }
  }
  return { id: 0, name: text(value) }
}

function normalizePayment(payment) {
  const source = payment && typeof payment === 'object' && !Array.isArray(payment) ? payment : {}
  const breakdown = Array.isArray(source.breakdown) ? source.breakdown : []
  return {
    method: text(source.method),
    label: text(source.label),
    amount: safeNumber(source.amount),
    breakdown: breakdown.map((item) => {
      const part = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
      return {
        method: text(part.method),
        label: text(part.label),
        amount: safeNumber(part.amount),
      }
    }),
  }
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return []
  return lines.map((item) => {
    const line = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    return {
      product_id: positiveId(line.product_id),
      product_name: text(line.product_name ?? line.name),
      quantity: safeNumber(line.quantity),
      unit_price: safeNumber(line.unit_price),
      line_total: safeNumber(line.line_total),
    }
  })
}

function normalizeOrder(order, id = positiveId(order?.id)) {
  const source = order && typeof order === 'object' && !Array.isArray(order) ? order : {}
  return {
    id,
    folio: text(source.folio),
    ordered_at: text(source.ordered_at),
    customer: normalizeRelation(source.customer),
    responsible_employee: normalizeRelation(source.responsible_employee),
    payment: normalizePayment(source.payment),
    currency: text(source.currency),
    amount_total: safeNumber(source.amount_total),
    state: text(source.state),
    lines: normalizeLines(source.lines),
  }
}

function unwrapEnvelope(payload) {
  if (payload?.ok === true && payload.data !== undefined) return payload.data
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
}

function invalidTicketContract() {
  const error = new Error('invalid_batch_ticket_contract')
  error.code = 'invalid_batch_ticket_contract'
  return error
}

function validRequestedIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_SELECTED_TICKETS) return null
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return null
  if (new Set(ids).size !== ids.length) return null
  return ids
}

export function buildSalesHistoryPath(filters = {}) {
  return `/pwa-admin/iguala-sales-history${toQuery({
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    search: filters.search,
    page: filters.page,
    page_size: PAGE_SIZE,
  })}`
}

export function normalizeSalesHistory(payload) {
  const data = unwrapEnvelope(payload)
  const orders = Array.isArray(data.orders) ? data.orders : []
  return {
    timezone: text(data.timezone),
    scope_label: text(data.scope_label),
    filters: data.filters && typeof data.filters === 'object' && !Array.isArray(data.filters) ? data.filters : {},
    pagination: data.pagination && typeof data.pagination === 'object' && !Array.isArray(data.pagination)
      ? {
          page: safeNumber(data.pagination.page),
          page_size: safeNumber(data.pagination.page_size),
          total: safeNumber(data.pagination.total),
        }
      : { page: 0, page_size: 0, total: 0 },
    orders: orders
      .map((order) => normalizeOrder(order))
      .filter((order) => order.id > 0),
  }
}

export function normalizeSalesTickets(payload, requestedIds) {
  const ids = validRequestedIds(requestedIds)
  if (!ids) throw invalidTicketContract()

  const data = unwrapEnvelope(payload)
  const tickets = Array.isArray(data.tickets) ? data.tickets : []
  const requested = new Set(ids)
  const byId = new Map()

  for (const ticket of tickets) {
    const source = ticket && typeof ticket === 'object' && !Array.isArray(ticket) ? ticket : {}
    const orderId = positiveId(source.order_id)
    if (!requested.has(orderId)) continue
    if (byId.has(orderId)) throw invalidTicketContract()
    byId.set(orderId, source)
  }

  if (byId.size !== ids.length) throw invalidTicketContract()

  return ids.map((orderId) => {
    const normalized = normalizeOrder(byId.get(orderId), orderId)
    return {
      order_id: orderId,
      folio: normalized.folio,
      ordered_at: normalized.ordered_at,
      customer: normalized.customer,
      responsible_employee: normalized.responsible_employee,
      currency: normalized.currency,
      subtotal: safeNumber(byId.get(orderId).subtotal),
      amount_total: normalized.amount_total,
      payment: normalized.payment,
      lines: normalized.lines,
    }
  })
}

export async function getIgualaSalesHistory(filters = {}) {
  const response = await api('GET', buildSalesHistoryPath(filters))
  return normalizeSalesHistory(response)
}

export async function getIgualaSalesTickets(ids) {
  const requestedIds = validRequestedIds(ids)
  if (!requestedIds) throw invalidTicketContract()
  const response = await api('POST', '/pwa-admin/iguala-sales-tickets', { order_ids: requestedIds })
  return normalizeSalesTickets(response, requestedIds)
}
