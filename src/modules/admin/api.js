// ─── API Admin Sucursal — POS, Gastos, Requisiciones ─────────────────────────
// Endpoints del módulo Odoo `gf_pwa_admin` (Sebastián, rollout 2026-04-10).
import { api, ApiError } from '../../lib/api.js'
import {
  buildPosCatalogPath,
  buildPosCustomerSearchPath,
  normalizePosCatalogResponse,
  normalizePosProductsResponse,
} from './posProducts.js'
import {
  isNightPosCancelReasonCode,
  normalizePosScope,
  readPosScopeOption,
} from './posFlow.js'
import {
  normalizeAdjustments,
  normalizeDenominations,
} from './cashShiftModel.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toQuery(filters = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

function readOwnIntent(source, propertyName, validator) {
  const descriptor = Object.getOwnPropertyDescriptor(source, propertyName)
  if (!descriptor) {
    if (propertyName in source) {
      throw new TypeError('El alcance del POS no es válido.')
    }
    return { present: false, value: undefined }
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw new TypeError('El alcance del POS no es válido.')
  }
  return { present: true, value: validator(descriptor.value) }
}

function cashShiftInput(value, label = 'Los datos del corte') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} no son válidos.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} no son válidos.`)
  }
  const clean = Object.create(null)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable) continue
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new TypeError(`${label} no son válidos.`)
    }
    clean[key] = descriptor.value
  }
  return clean
}

function cashShiftInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function cashShiftMoney(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function cashShiftText(value, label, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return undefined
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value.trim()
}

function cashShiftType(value) {
  if (value !== 'night' && value !== 'day') {
    throw new TypeError('El tipo de turno no es válido.')
  }
  return value
}

function cashShiftDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('La fecha operativa no es válida.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new TypeError('La fecha operativa no es válida.')
  }
  return value
}

function cashShiftContractVersion(value) {
  if (value === undefined || value === 'v1') return undefined
  if (value === 'v2') return 'v2'
  throw new TypeError('La versión del contrato de cortes no es válida.')
}

// ── POS Mostrador ────────────────────────────────────────────────────────────

const DAY_POS_ACCESS_ERROR = 'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.'
const DAY_POS_READ_ERROR = 'No se pudo consultar el POS día. Inténtalo de nuevo.'

function safeDayPosReadError(error, posScope) {
  if (posScope !== 'day') return error
  if (error?.status === 403) {
    return new ApiError(DAY_POS_ACCESS_ERROR, { status: 403, code: 'forbidden' })
  }
  if (Number(error?.status || 0) >= 500) {
    return new ApiError(DAY_POS_READ_ERROR, {
      status: Number(error.status),
      code: 'day_pos_service_unavailable',
    })
  }
  return error
}

function requireSuccessfulPosRead(response, posScope) {
  if (response?.ok !== false) return response
  if (posScope === 'day') {
    throw new ApiError(DAY_POS_READ_ERROR, {
      status: 200,
      code: String(response?.data?.code || response?.code || 'day_pos_read_failed'),
    })
  }
  throw new ApiError(
    String(response?.message || 'No fue posible consultar el POS.'),
    {
      status: 200,
      code: String(
        response?.data?.code
        || response?.code
        || 'pos_read_failed',
      ),
    },
  )
}

/** Catálogo POS con stock y pricelist aplicados para el cliente seleccionado */
export function getPosCatalog(filters = {}) {
  const posScope = readPosScopeOption(filters)
  return api('GET', buildPosCatalogPath({
    warehouseId: filters?.warehouseId,
    companyId: filters?.companyId,
    partnerId: filters?.partnerId,
    ...(posScope === undefined ? {} : { posScope }),
  }))
    .then((response) => normalizePosCatalogResponse(
      requireSuccessfulPosRead(response, posScope),
    ))
    .catch((error) => { throw safeDayPosReadError(error, posScope) })
}

/** Productos disponibles con stock en el CEDIS del empleado */
export function getPosProducts(arg) {
  const filters = typeof arg === 'object'
    ? arg
    : { warehouseId: arg }
  const posScope = readPosScopeOption(filters)
  return api('GET', buildPosCatalogPath({
    warehouseId: filters?.warehouseId,
    companyId: filters?.companyId,
    partnerId: filters?.partnerId,
    ...(posScope === undefined ? {} : { posScope }),
  }))
    .then((response) => normalizePosProductsResponse(
      requireSuccessfulPosRead(response, posScope),
    ))
    .catch((error) => { throw safeDayPosReadError(error, posScope) })
}

/** Buscar clientes (para factura) */
export function searchCustomers(query, companyId, options = {}) {
  const posScope = readPosScopeOption(options)
  return api(
    'GET',
    buildPosCustomerSearchPath(
      query,
      companyId,
      posScope === undefined ? {} : { posScope },
    ),
  )
    .then((response) => requireSuccessfulPosRead(response, posScope))
    .catch((error) => { throw safeDayPosReadError(error, posScope) })
}

/** Cliente default "Publico Mostrador" de la sucursal */
export function getDefaultCustomer(companyId, options = {}) {
  const posScope = readPosScopeOption(options)
  return api('GET', `/pwa-admin/default-customer${toQuery({
    company_id: companyId,
    pos_scope: posScope,
  })}`)
    .then((response) => requireSuccessfulPosRead(response, posScope))
    .catch((error) => { throw safeDayPosReadError(error, posScope) })
}

/** Crear venta (sale.order + confirmar) */
export function createSaleOrder(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Los datos de la venta no son válidos.')
  }
  const posScope = readOwnIntent(data, 'pos_scope', normalizePosScope)
  const nightPos = readOwnIntent(data, 'night_pos', (value) => {
    if (typeof value !== 'string' || value !== '1') {
      throw new TypeError('El alcance del POS no es válido.')
    }
    return value
  })
  return api('POST', '/pwa-admin/sale-create', {
    ...data,
    ...(posScope.present ? { pos_scope: posScope.value } : {}),
    ...(nightPos.present ? { night_pos: nightPos.value } : {}),
  })
}

/** Ver detalle de un ticket/venta */
export function getSaleOrder(orderId, options = {}) {
  const posScope = readPosScopeOption(options)
  return api('GET', `/pwa-admin/sale-detail${toQuery({
    order_id: orderId,
    pos_scope: posScope,
  })}`)
    .catch((error) => { throw safeDayPosReadError(error, posScope) })
}

/** Cancela una venta (sale.order.action_cancel). Revierte stock moves.
 *  Rechaza si la venta ya está `done`. La razón queda en el chatter. */
export function cancelSaleOrder(orderId, reasonOrOptions) {
  let optionsReasonCode = null
  let optionsPosScope
  let hasOptions = false
  if (reasonOrOptions !== null && typeof reasonOrOptions === 'object') {
    const prototype = Object.getPrototypeOf(reasonOrOptions)
    const isPlainObject = prototype === Object.prototype || prototype === null
    const reasonDescriptor = isPlainObject
      ? Object.getOwnPropertyDescriptor(reasonOrOptions, 'reasonCode')
      : null
    const hasReasonValue = reasonDescriptor
      && Object.prototype.hasOwnProperty.call(reasonDescriptor, 'value')
    if (
      !isPlainObject
      || !hasReasonValue
      || !isNightPosCancelReasonCode(reasonDescriptor.value)
    ) {
      throw new TypeError('Selecciona un motivo de cancelación válido.')
    }
    optionsPosScope = readPosScopeOption(reasonOrOptions)
    optionsReasonCode = reasonDescriptor.value
    hasOptions = true
  }
  return api('POST', '/pwa-admin/sale-cancel', {
    order_id: orderId,
    ...(hasOptions
      ? {
          reason_code: optionsReasonCode,
          ...(optionsPosScope === undefined ? {} : { pos_scope: optionsPosScope }),
        }
      : { reason: reasonOrOptions || '' }),
  })
}

/** Ventas POS de un día. Acepta { warehouseId, companyId, date } o un número legacy. */
export function getTodaySales(arg) {
  if (typeof arg === 'number' || typeof arg === 'string') {
    return api('GET', `/pwa-admin/today-sales?warehouse_id=${arg}`)
  }
  const { warehouseId, companyId, date } = arg || {}
  const qs = toQuery({ warehouse_id: warehouseId, company_id: companyId, date })
  return api('GET', `/pwa-admin/today-sales${qs}`)
}

/** Ventas de hoy del POS nocturno. El backend fija identidad y fecha efectiva. */
export function getNightTodaySales() {
  return api('GET', '/pwa-admin/today-sales?night_pos=1')
}

/** Ventas propias de hoy del POS diurno restringido. */
export function getDayTodaySales() {
  return api('GET', '/pwa-admin/today-sales?pos_scope=day')
}

// ── Validación de ticket (Almacenista Entregas) ──────────────────────────────

/** Buscar ticket por folio */
export function findTicket(folio) {
  return api('GET', `/pwa-admin/find-ticket?folio=${encodeURIComponent(folio)}`)
}

/** Confirmar despacho de ticket → descuenta inventario */
export function dispatchTicket(orderId) {
  return api('POST', '/pwa-admin/dispatch-ticket', { order_id: orderId })
}

/** Tickets pendientes de despacho */
export function getPendingTickets(warehouseId) {
  return api('GET', `/pwa-admin/pending-tickets?warehouse_id=${warehouseId}`)
}

// ── Gastos ────────────────────────────────────────────────────────────────────

/** Registrar gasto (`hr.expense`). Payload completo soportado por
 *  gf_pwa_admin.expense-create: ver docs de Sebastián 2026-04-10. */
export function createExpense(data) {
  return api('POST', '/pwa-admin/expense-create', data)
}

/** Gastos del día. Acepta filtros { companyId, warehouseId }. */
export function getTodayExpenses(filters = {}) {
  const { companyId, warehouseId } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId })
  return api('GET', `/pwa-admin/today-expenses${qs}`)
}

/** Traspasos MP del día para el feed contextual del módulo admin. */
export function getTodayMpTransfers(filters = {}) {
  const { companyId, warehouseId, limit } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId, limit })
  return api('GET', `/pwa-admin/traspaso-mp/today${qs}`)
}

/** Adjunta una foto/archivo a un hr.expense. Base64 sin prefix data:. */
export function attachExpense(payload) {
  const { expenseId, filename, base64, mime } = payload || {}
  return api('POST', '/pwa-admin/expense-attach', {
    expense_id: expenseId,
    filename,
    base64,
    mime,
  })
}

/** Lista los adjuntos de un gasto. */
export function getExpenseAttachments(expenseId) {
  return api('GET', `/pwa-admin/expense-attachments?expense_id=${expenseId}`)
}

/** Historial de gastos con filtros:
 *    company_id, warehouse_id, employee_id, date_from, date_to,
 *    state, limit, offset */
export function getExpensesHistory(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    warehouse_id: filters.warehouseId ?? filters.warehouse_id,
    employee_id: filters.employeeId ?? filters.employee_id,
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    state: filters.state,
    limit: filters.limit,
    offset: filters.offset,
  }
  return api('GET', `/pwa-admin/expenses-history${toQuery(mapped)}`)
}

// ── Analítica (Odoo 18 — analytic_distribution) ──────────────────────────────

/** Cuentas analíticas filtradas por razón social (company_id).
 *  Devuelve { ok, data: { company_id, count, accounts: [...] } }. */
export function getAnalyticAccounts(companyId) {
  return api('GET', `/pwa-admin/analytic-accounts?company_id=${companyId}`)
}

/** Feature flags del backend (leídos al boot por AdminProvider). */
export function getCapabilities() {
  return api('GET', '/pwa-admin/capabilities')
}

// ── Cortes POS por turno ────────────────────────────────────────────────────

/** Turno activo del alcance derivado exclusivamente del token del empleado. */
export function getActiveCashShift() {
  return api('GET', '/pwa-admin/cash-shifts/active')
}

/** Vista previa inicial o viva; nunca acepta compañía/almacén/analítica. */
export function previewCashShift(input = {}) {
  const value = cashShiftInput(input, 'Los datos de vista previa')
  const mode = value.mode ?? 'active'
  if (mode === 'initial') {
    return api('GET', `/pwa-admin/cash-shifts/preview${toQuery({
      mode,
      shift_type: cashShiftType(value.shiftType),
      business_date: cashShiftDate(value.businessDate),
      start_at: cashShiftText(value.startAt, 'La hora inicial'),
    })}`)
  }
  if (mode === 'pending') {
    return api('GET', `/pwa-admin/cash-shifts/preview${toQuery({
      mode,
      shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
      contract_version: 'v2',
    })}`)
  }
  if (mode !== 'active') throw new TypeError('El modo de vista previa no es válido.')
  return api('GET', `/pwa-admin/cash-shifts/preview${toQuery({
    mode,
    shift_id: value.shiftId === undefined
      ? undefined
      : cashShiftInteger(value.shiftId, 'El ID del turno', 1),
  })}`)
}

/** Arqueos separados automáticamente; este selector es exclusivamente v2. */
export function getPendingCashShiftCounts() {
  return api('GET', '/pwa-admin/cash-shifts/pending-counts?contract_version=v2')
}

export function openCashShift(input) {
  const value = cashShiftInput(input)
  return api('POST', '/pwa-admin/cash-shifts/open', {
    shift_type: cashShiftType(value.shiftType),
    business_date: cashShiftDate(value.businessDate),
    start_at: cashShiftText(value.startAt, 'La hora inicial'),
    opening_fund: cashShiftMoney(value.openingFund, 'El fondo inicial'),
    idempotency_key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  })
}

function cashShiftClosePayload(input, { reclose }) {
  const value = cashShiftInput(input)
  const expectedVersion = cashShiftInteger(value.expectedVersion, 'La versión esperada')
  if ((!reclose && expectedVersion !== 0) || (reclose && expectedVersion < 1)) {
    throw new TypeError('La versión esperada no corresponde al tipo de cierre.')
  }
  const payload = {
    shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
    expected_version: expectedVersion,
    denominations: normalizeDenominations(value.denominations ?? []),
    adjustments: normalizeAdjustments(value.adjustments ?? []),
    notes: cashShiftText(value.notes, 'Las notas', { optional: true }),
    idempotency_key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  }
  if (!reclose) {
    payload.next_opening_fund = cashShiftMoney(
      value.nextOpeningFund,
      'El fondo inicial del siguiente turno',
    )
  }
  return payload
}

export function closeCashShift(input) {
  return api('POST', '/pwa-admin/cash-shifts/close', cashShiftClosePayload(input, {
    reclose: false,
  }))
}

export function recloseCashShift(input) {
  return api('POST', '/pwa-admin/cash-shifts/close', cashShiftClosePayload(input, {
    reclose: true,
  }))
}

export function settleCashShift(input) {
  const value = cashShiftInput(input, 'Los datos del arqueo pendiente')
  const expectedVersion = cashShiftInteger(value.expectedVersion, 'La versión esperada')
  if (expectedVersion !== 0) {
    throw new TypeError('La versión esperada no corresponde al arqueo pendiente.')
  }
  if (typeof value.separationConfirmed !== 'boolean') {
    throw new TypeError('La confirmación de separación no es válida.')
  }
  return api('POST', '/pwa-admin/cash-shifts/settle', {
    shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
    expected_version: expectedVersion,
    denominations: normalizeDenominations(value.denominations ?? []),
    adjustments: normalizeAdjustments(value.adjustments ?? []),
    notes: cashShiftText(value.notes, 'Las notas', { optional: true }),
    separation_confirmed: value.separationConfirmed,
    separation_exception_note: cashShiftText(
      value.separationExceptionNote,
      'La nota de separación',
      { optional: true },
    ),
    idempotency_key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  })
}

export function getCashShiftHistory(input = {}) {
  const value = cashShiftInput(input, 'Los filtros de historial')
  return api('GET', `/pwa-admin/cash-shifts/history${toQuery({
    business_date: value.businessDate === undefined
      ? undefined
      : cashShiftDate(value.businessDate),
  })}`)
}

export function getCashShiftDetail(input) {
  const value = cashShiftInput(input, 'Los datos del detalle')
  return api('GET', `/pwa-admin/cash-shifts/detail${toQuery({
    shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
    version_id: value.versionId === undefined
      ? undefined
      : cashShiftInteger(value.versionId, 'El ID de versión', 1),
    contract_version: cashShiftContractVersion(value.contractVersion),
  })}`)
}

export function reopenCashShift(input) {
  const value = cashShiftInput(input)
  return api('POST', '/pwa-admin/cash-shifts/reopen', {
    shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
    expected_version: cashShiftInteger(value.expectedVersion, 'La versión esperada', 1),
    reason: cashShiftText(value.reason, 'La razón de reapertura'),
    idempotency_key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  })
}

export function authorizeCashShift(input) {
  const value = cashShiftInput(input)
  if (value.level !== 'manager' && value.level !== 'director') {
    throw new TypeError('El nivel de autorización no es válido.')
  }
  return api('POST', '/pwa-admin/cash-shifts/authorize', {
    shift_id: cashShiftInteger(value.shiftId, 'El ID del turno', 1),
    version_id: cashShiftInteger(value.versionId, 'El ID de versión', 1),
    level: value.level,
    idempotency_key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  })
}

export function getCashShiftOperationStatus(input) {
  const value = cashShiftInput(input, 'La consulta de operación')
  const operation = value.operation
  if (!['open', 'close', 'reclose', 'settle', 'reopen', 'authorize'].includes(operation)) {
    throw new TypeError('La operación no es válida.')
  }
  return api('GET', `/pwa-admin/cash-shifts/operations/status${toQuery({
    operation,
    key: cashShiftText(value.idempotencyKey, 'La clave de idempotencia'),
  })}`)
}

// ── Requisiciones ────────────────────────────────────────────────────────────

/** Crear requisición (purchase.order draft con analytic_distribution) */
export function createRequisition(data) {
  return api('POST', '/pwa-admin/requisition-create', data)
}

/** Requisiciones recientes. Acepta filtros {companyId, state, dateFrom, dateTo, limit, offset}. */
export function getRequisitions(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    state: filters.state,
    operational_state: filters.operationalState ?? filters.operational_state,
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    limit: filters.limit,
    offset: filters.offset,
  }
  const qs = toQuery(mapped)
  return api('GET', `/pwa-admin/requisitions${qs}`)
}

/** Detalle de requisición con líneas. */
export function getRequisitionDetail(id) {
  return api('GET', `/pwa-admin/requisition-detail?id=${id}`)
}

/** Cancela una requisición en draft/sent. Rechaza si está confirmada. */
export function cancelRequisition(id) {
  return api('POST', '/pwa-admin/requisition-cancel', { id })
}

/** Aprueba una requisición pendiente (requiere rol gerente/director). */
export function approveRequisition(id) {
  return api('POST', '/pwa-admin/requisition-approve', { id })
}

/** Rechaza una requisición pendiente o aprobada con motivo obligatorio. */
export function rejectRequisition(id, reason) {
  return api('POST', '/pwa-admin/requisition-reject', { id, reason })
}

// ── Cierre de Caja ───────────────────────────────────────────────────────────

/** Resumen del día (ventas, gastos, neto) — read-only */
export function getCashClosing(filters = {}) {
  const { companyId, warehouseId } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId })
  return api('GET', `/pwa-admin/cash-closing${qs}`)
}

/** Cierre formal del día (arqueo con denominaciones). Sprint 3.
 *  Payload:
 *    { company_id, warehouse_id, opening_fund,
 *      denominations: [{denomination, count}, ...],
 *      other_income, other_expense, notes, close }
 *  `sales_total` y `expenses_total` los computa el backend. */
export function createCashClosing(data) {
  return api('POST', '/pwa-admin/cash-closing', data)
}

/** Historial de cierres (gf.cash.closing) con paginación y filtros. */
export function getCashClosingHistory(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    warehouse_id: filters.warehouseId ?? filters.warehouse_id,
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    state: filters.state,
    limit: filters.limit,
    offset: filters.offset,
  }
  return api('GET', `/pwa-admin/cash-closing/history${toQuery(mapped)}`)
}

/** Detalle de un cierre específico (denominaciones + diferencia + notas). */
export function getCashClosingDetail(id) {
  return api('GET', `/pwa-admin/cash-closing/detail?id=${id}`)
}

// ── Liquidaciones (wrappers gf_logistics_ops) ───────────────────────────────

/** Planes de ruta cerrados pendientes de validación. */
export function getPendingLiquidations(filters = {}) {
  const { companyId, warehouseId } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId })
  return api('GET', `/pwa-admin/liquidaciones/pending${qs}`)
}

/** Detalle del plan con build_liquidation_summary() + reconciliation lines. */
export function getLiquidationDetail(planId) {
  return api('GET', `/pwa-admin/liquidaciones/detail?plan_id=${planId}`)
}

/** Valida la conciliación → marca reconciliation como done. */
export function validateLiquidation(planId) {
  return api('POST', '/pwa-admin/liquidaciones/validate', { plan_id: planId })
}

/** Historial de liquidaciones validadas (reconciliation state=done). */
export function getLiquidationsHistory(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    warehouse_id: filters.warehouseId ?? filters.warehouse_id,
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    limit: filters.limit,
    offset: filters.offset,
  }
  return api('GET', `/pwa-admin/liquidaciones/history${toQuery(mapped)}`)
}

// ── Materia Prima ────────────────────────────────────────────────────────────

/** Inventario de MP (stock.quant) por warehouse/company. */
export function getMpStock(filters = {}) {
  const { companyId, warehouseId } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId })
  return api('GET', `/pwa-admin/materia-prima/stock${qs}`)
}

/** Recepciones del día (stock.picking incoming). */
export function getMpReceipts(filters = {}) {
  const { companyId, warehouseId } = filters
  const qs = toQuery({ company_id: companyId, warehouse_id: warehouseId })
  return api('GET', `/pwa-admin/materia-prima/receipts${qs}`)
}

/** Consumos del día (gf.transformation.order). */
export function getMpConsumption(filters = {}) {
  const { companyId } = filters
  const qs = toQuery({ company_id: companyId })
  return api('GET', `/pwa-admin/materia-prima/consumption${qs}`)
}

/** Kardex: stock.move done para un producto específico con filtros de fecha. */
export function getMpMoves(filters = {}) {
  const mapped = {
    product_id: filters.productId ?? filters.product_id,
    company_id: filters.companyId ?? filters.company_id,
    warehouse_id: filters.warehouseId ?? filters.warehouse_id,
    date_from: filters.dateFrom ?? filters.date_from,
    date_to: filters.dateTo ?? filters.date_to,
    limit: filters.limit,
  }
  return api('GET', `/pwa-admin/materia-prima/moves${toQuery(mapped)}`)
}

// ── Búsqueda de productos server-side ───────────────────────────────────────

/** Búsqueda real de productos por nombre/SKU/barcode. Reemplaza el
 *  fetch bulk de getPosProducts cuando BACKEND_CAPS.productSearch = true. */
export function searchProducts(filters = {}) {
  const { q, scope, limit, categId, companyId } = filters
  const qs = toQuery({ q, scope, limit, categ_id: categId, company_id: companyId })
  return api('GET', `/pwa-admin/products/search${qs}`)
}

// ── Aprobación de gastos (B2 — 2026-04-18) ──────────────────────────────────

/** Lista de gastos pendientes de aprobación (solo ve gerente/director).
 *  Backend: GET /pwa-admin/expenses-pending-approval?company_id=&limit=&offset=
 *  Retorna hr.expense con x_approval_state='pending' del company_id. */
export function getExpensesPendingApproval(filters = {}) {
  const mapped = {
    company_id:   filters.companyId   ?? filters.company_id,
    warehouse_id: filters.warehouseId ?? filters.warehouse_id,
    limit:        filters.limit,
    offset:       filters.offset,
  }
  return api('GET', `/pwa-admin/expenses-pending-approval${toQuery(mapped)}`)
}

/** Aprueba un gasto pendiente. Backend registra al aprobador en chatter. */
export function approveExpense(expenseId) {
  return api('POST', '/pwa-admin/expense-approve', { expense_id: Number(expenseId) })
}

/** Rechaza un gasto con motivo. Guardado en x_rejection_reason + chatter. */
export function rejectExpense(expenseId, reason) {
  return api('POST', '/pwa-admin/expense-reject', {
    expense_id: Number(expenseId),
    reason: String(reason || '').trim(),
  })
}

// ── Torres de Control — Validación de Requisiciones (2026-04-24) ────────────

/** Lista de requisiciones draft/sent disponibles para el Operador Torre. */
export function getTorreRequisitions(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
  }
  return api('GET', `/pwa-admin/torre/requisitions${toQuery(mapped)}`)
}

/** Detalle de una requisición con sus líneas (para el formulario de validación). */
export function getTorreRequisitionDetail(id) {
  return api('GET', `/pwa-admin/torre/requisition-detail?id=${id}`)
}

/** Actualiza líneas: price_unit y/o analytic_distribution. */
export function updateTorreRequisitionLines(poId, lines) {
  return api('POST', '/pwa-admin/torre/requisition-update', { id: poId, lines })
}

/** Confirma la requisición → purchase.order confirmado + approval_state='approved'. */
export function confirmTorreRequisition(id) {
  return api('POST', '/pwa-admin/torre/requisition-confirm', { id })
}

/** Cuentas analíticas del plan "PL" (Plazas) para distribuir por línea. */
export function getTorrePlazas(companyId) {
  const qs = companyId ? `?company_id=${companyId}` : ''
  return api('GET', `/pwa-admin/torre/plazas${qs}`)
}

// ── Clientes (supv) — Inactivos y Recuperación (A3) ─────────────────────────

/** Clientes sin orden en los últimos N días (backend: 60 por default). */
export function getInactiveCustomers(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    limit:      filters.limit,
    offset:     filters.offset,
  }
  return api('GET', `/pwa-supv/customers/inactive${toQuery(mapped)}`)
}

/** Clientes marcados needs_recovery_plan=true por el backend. */
export function getRecoveryCustomers(filters = {}) {
  const mapped = {
    company_id: filters.companyId ?? filters.company_id,
    limit:      filters.limit,
    offset:     filters.offset,
  }
  return api('GET', `/pwa-supv/customers/recovery${toQuery(mapped)}`)
}

// ── Requisition receipt ───────────────────────────────────────────────────────

/** Detalle del picking de recepción asociado a una requisición confirmada.
 *  Devuelve: { picking_id, state, lines: [{ move_id, product_name, qty_ordered,
 *    qty_received, qty_pending }] } */
export function getRequisitionReceiptDetail(id) {
  return api('GET', `/pwa-admin/requisition-receipt-detail?id=${id}`)
}

/** Registra recepción parcial o total sobre el picking de Odoo.
 *  Payload: { id: purchase_order_id, lines: [{ move_id, receive_now_qty }] } */
export function receiveRequisitionProducts(data) {
  return api('POST', '/pwa-admin/requisition-receive', data)
}
