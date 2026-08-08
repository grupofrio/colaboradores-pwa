// Cliente de Compras CSC GF. Este módulo nunca manda empresa, almacén,
// solicitante, aprobador ni estado: son autoridad exclusiva de Odoo.
import { api } from '../../lib/api.js'

const AUTHORITY_FIELDS = new Set([
  'company_id', 'warehouse_id', 'employee_id', 'requested_by_employee_id',
  'requester_id', 'requester_employee_id', 'requester_user_id', 'approver_id',
  'approver_employee_id', 'approved_by_id', 'approval_state', 'state',
  'confirmed_by_id', 'confirmed_by_employee_id',
])
const PRODUCT_TYPES = new Set(['consu', 'product', 'service'])

function numberId(value) {
  const id = Number(value || 0)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador de requisición inválido.')
  return id
}

function forbidAuthority(payload = {}) {
  for (const key of Object.keys(payload || {})) {
    if (AUTHORITY_FIELDS.has(key)) throw new Error(`Campo autoritativo no permitido: ${key}`)
  }
}

// Los controllers buyer pueden devolver HTTP 200 con `{ok:false, message}`.
// Nunca debe interpretarse como éxito en la UI: las transiciones locales
// aprobar/confirmar solo ocurren después de esta aserción.
export function unwrapBuyerResponse(response) {
  const envelope = response?.result !== undefined ? response.result : response
  if (envelope?.ok === false) {
    throw new Error(envelope.message || envelope.error || 'Odoo rechazó la operación de Compras.')
  }
  return envelope
}

function buyerApi(method, path, payload) {
  return api(method, path, payload).then(unwrapBuyerResponse)
}

export function getBuyerScope() {
  return buyerApi('GET', '/pwa-admin/buyer-scope')
}

export function getBuyerRequisitions({ limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(Number(limit) || 100, 1), 500)), offset: String(Math.max(Number(offset) || 0, 0)) })
  return buyerApi('GET', `/pwa-admin/buyer/requisitions?${params}`)
}

export function getBuyerRequisitionDetail(id) {
  return buyerApi('GET', `/pwa-admin/buyer/requisition-detail?id=${numberId(id)}`)
}

export function updateBuyerRequisition(id, lines) {
  const cleanLines = (Array.isArray(lines) ? lines : []).map((line) => {
    forbidAuthority(line)
    const next = { line_id: numberId(line?.line_id) }
    if (line?.product_id !== undefined) next.product_id = numberId(line.product_id)
    if (line?.quantity !== undefined) next.quantity = Number(line.quantity)
    if (line?.price_unit !== undefined) next.price_unit = Number(line.price_unit)
    if (line?.analytic_distribution !== undefined) next.analytic_distribution = line.analytic_distribution
    return next
  })
  if (!cleanLines.length) throw new Error('Incluye al menos una línea para actualizar.')
  return buyerApi('POST', '/pwa-admin/buyer/requisition-update', { id: numberId(id), lines: cleanLines })
}

export function createBuyerProduct(id, values = {}) {
  forbidAuthority(values)
  const product_type = String(values.product_type || '').trim()
  if (!PRODUCT_TYPES.has(product_type)) throw new Error('Tipo de producto inválido.')
  const payload = {
    id: numberId(id),
    name: String(values.name || '').trim(),
    categ_id: numberId(values.categ_id),
    uom_id: numberId(values.uom_id),
    product_type,
  }
  const reference = String(values.default_code || '').trim()
  if (reference) payload.default_code = reference
  return buyerApi('POST', '/pwa-admin/buyer/product-create', payload)
}

export function approveBuyerRequisition(id) {
  return buyerApi('POST', '/pwa-admin/buyer/requisition-approve', { id: numberId(id) })
}

export function confirmBuyerRequisition(id) {
  return buyerApi('POST', '/pwa-admin/buyer/requisition-confirm', { id: numberId(id) })
}

export const __buyerInternals = { AUTHORITY_FIELDS, PRODUCT_TYPES, forbidAuthority }
