import { CASH_SHIFT_DENOMINATIONS, normalizeCashShift } from './cashShiftModel.js'

const OWN = Object.prototype.hasOwnProperty
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SHIFT_TYPES = new Set(['night', 'day'])
const SHIFT_STATES = new Set(['open', 'pending_auth', 'closed', 'reopened'])
const DENOMINATIONS = new Set(CASH_SHIFT_DENOMINATIONS)
const CONSOLIDATED_FIELDS = [
  'payments', 'sales_total', 'expenses_total', 'adjustment_income_total',
  'adjustment_expense_total', 'products', 'product_totals', 'realized_order_ids',
  'payment_order_ids', 'cancelled_order_ids', 'expense_ids', 'adjustment_ids',
  'product_source_line_ids', 'shift_arqueos', 'net_difference', 'business_date',
  'company_id', 'warehouse_id',
]

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} no es válido.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function own(recordValue, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(recordValue, key)
  if (!descriptor || !OWN.call(descriptor, 'value')) throw new TypeError(`${label} no es válido.`)
  return descriptor.value
}

function exactRecord(value, fields, label) {
  const row = record(value, label)
  const actual = Object.keys(row).sort()
  const expected = [...fields].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} no es válido.`)
  }
  fields.forEach((key) => own(row, key, label))
  return row
}

function array(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} no es válido.`)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const allowed = new Set(['length'])
  const rows = []
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index)
    const descriptor = descriptors[key]
    if (!descriptor || !OWN.call(descriptor, 'value')) throw new TypeError(`${label} no es válido.`)
    allowed.add(key)
    rows.push(descriptor.value)
  }
  if (Object.keys(descriptors).some((key) => !allowed.has(key))) {
    throw new TypeError(`${label} no es válido.`)
  }
  return rows
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`${label} no es válido.`)
  return value
}

function number(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} no es válido.`)
  return value
}

function string(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} no es válido.`)
  return value
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} no es válido.`)
  return value
}

function validDate(value, label = 'La fecha operativa') {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError(`${label} no es válida.`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) throw new TypeError(`${label} no es válida.`)
  return value
}

function uniqueIds(value, label) {
  const seen = new Set()
  return array(value, label).map((raw) => {
    const id = integer(raw, label, 1)
    if (seen.has(id)) throw new TypeError(`${label} contiene IDs duplicados.`)
    seen.add(id)
    return id
  })
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function sortedIds(value) {
  return [...value].sort((left, right) => left - right)
}

function addSnapshotId(target, value, label) {
  const id = integer(value, label, 1)
  if (target.has(id)) throw new TypeError(`${label} está duplicado entre turnos.`)
  target.add(id)
}

function persistedSnapshotIds(shifts) {
  const ids = {
    realizedOrderIds: new Set(),
    paymentOrderIds: new Set(),
    cancelledOrderIds: new Set(),
    expenseIds: new Set(),
    adjustmentIds: new Set(),
    productSourceLineIds: new Set(),
  }
  for (const shift of shifts) {
    if (shift.versionId === null) continue
    shift.sales.forEach((row) => addSnapshotId(ids.realizedOrderIds, row.order_id, 'La venta histórica'))
    shift.payments.rows.forEach((row) => addSnapshotId(ids.paymentOrderIds, row.order_id, 'El pago histórico'))
    shift.cancellations.forEach((row) => addSnapshotId(ids.cancelledOrderIds, row.order_id, 'La cancelación histórica'))
    shift.expenses.forEach((row) => addSnapshotId(ids.expenseIds, row.expense_id, 'El gasto histórico'))
    shift.adjustments.forEach((row) => addSnapshotId(ids.adjustmentIds, row.id, 'El ajuste histórico'))
    shift.products.forEach((product) => product.source_line_ids.forEach((lineId) => (
      addSnapshotId(ids.productSourceLineIds, lineId, 'La línea histórica de producto')
    )))
  }
  return Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, sortedIds(value)]))
}

function assertExactSnapshotIds(snapshotIds, consolidated) {
  const comparisons = [
    ['realizedOrderIds', consolidated.realizedOrderIds],
    ['paymentOrderIds', consolidated.paymentOrderIds],
    ['cancelledOrderIds', consolidated.cancelledOrderIds],
    ['expenseIds', consolidated.expenseIds],
    ['adjustmentIds', consolidated.adjustmentIds],
    ['productSourceLineIds', consolidated.productSourceLineIds],
  ]
  for (const [field, consolidatedIds] of comparisons) {
    if (!sameIds(snapshotIds[field], sortedIds(consolidatedIds))) {
      throw new TypeError('Los movimientos consolidados no coinciden con las fotografías versionadas.')
    }
  }
}

function normalizeConsolidatedProducts(value, sourceIds) {
  const productIds = new Set()
  const observedSources = []
  const observedSourceSet = new Set()
  const products = array(value, 'Los productos consolidados').map((raw, index) => {
    const row = exactRecord(raw, [
      'product_id', 'sku', 'product_name', 'weight_unknown', 'quantity',
      'amount_total', 'weight_total_kg', 'source_line_ids',
    ], `El producto consolidado ${index + 1}`)
    const productId = integer(own(row, 'product_id', 'El producto consolidado'), 'El producto consolidado', 1)
    if (productIds.has(productId)) throw new TypeError('Los productos consolidados contienen IDs duplicados.')
    productIds.add(productId)
    const productSources = uniqueIds(own(row, 'source_line_ids', 'Las líneas fuente'), 'Las líneas fuente')
    for (const sourceId of productSources) {
      if (observedSourceSet.has(sourceId)) throw new TypeError('Las líneas fuente están duplicadas entre productos.')
      observedSourceSet.add(sourceId)
      observedSources.push(sourceId)
    }
    return {
      productId,
      sku: string(own(row, 'sku', 'El SKU'), 'El SKU'),
      productName: string(own(row, 'product_name', 'El producto'), 'El producto'),
      weightUnknown: boolean(own(row, 'weight_unknown', 'El indicador de peso'), 'El indicador de peso'),
      quantity: number(own(row, 'quantity', 'La cantidad'), 'La cantidad'),
      amountTotal: number(own(row, 'amount_total', 'El importe'), 'El importe'),
      weightTotalKg: number(own(row, 'weight_total_kg', 'El peso'), 'El peso'),
      sourceLineIds: productSources,
    }
  })
  if (!sameIds(sortedIds(observedSources), sortedIds(sourceIds))) {
    throw new TypeError('Las líneas fuente consolidadas no coinciden.')
  }
  return products
}

function normalizeConsolidatedDenominations(value) {
  const seenIds = new Set()
  const seenValues = new Set()
  return array(value, 'Las denominaciones del turno').map((raw) => {
    const row = exactRecord(raw, ['id', 'denomination', 'count', 'subtotal'], 'La denominación del turno')
    const id = integer(own(row, 'id', 'La denominación del turno'), 'La denominación del turno', 1)
    const denomination = string(own(row, 'denomination', 'La denominación'), 'La denominación')
    if (seenIds.has(id) || seenValues.has(denomination) || !DENOMINATIONS.has(denomination)) {
      throw new TypeError('Las denominaciones del turno no son válidas.')
    }
    seenIds.add(id)
    seenValues.add(denomination)
    return {
      id,
      denomination,
      count: integer(own(row, 'count', 'El conteo'), 'El conteo'),
      subtotal: number(own(row, 'subtotal', 'El subtotal'), 'El subtotal'),
    }
  })
}

function normalizeShiftArqueos(value, businessDate, normalizedShifts) {
  const shiftIds = new Set()
  const versionIds = new Set()
  const shiftsById = new Map(normalizedShifts.map((shift) => [shift.shift.id, shift]))
  return array(value, 'Los arqueos por turno').map((raw) => {
    const row = exactRecord(raw, [
      'shift', 'version_id', 'opening_fund', 'expected_cash', 'physical_cash',
      'difference', 'denominations',
    ], 'El arqueo por turno')
    const shift = exactRecord(own(row, 'shift', 'El turno del arqueo'), [
      'id', 'type', 'business_date', 'state',
    ], 'El turno del arqueo')
    const id = integer(own(shift, 'id', 'El turno del arqueo'), 'El turno del arqueo', 1)
    const versionId = integer(own(row, 'version_id', 'La versión del arqueo'), 'La versión del arqueo', 1)
    const type = string(own(shift, 'type', 'El tipo de turno'), 'El tipo de turno')
    const state = string(own(shift, 'state', 'El estado del turno'), 'El estado del turno')
    if (
      shiftIds.has(id) || versionIds.has(versionId)
      || !SHIFT_TYPES.has(type) || !SHIFT_STATES.has(state)
      || validDate(own(shift, 'business_date', 'La fecha del turno')) !== businessDate
    ) throw new TypeError('El arqueo por turno no es válido.')
    const sourceShift = shiftsById.get(id)
    if (!sourceShift || sourceShift.shift.type !== type || sourceShift.versionId !== versionId) {
      throw new TypeError('El arqueo no coincide con la fotografía del turno.')
    }
    shiftIds.add(id)
    versionIds.add(versionId)
    return {
      shift: { id, type, businessDate, state },
      versionId,
      openingFund: number(own(row, 'opening_fund', 'El fondo del turno'), 'El fondo del turno'),
      expectedCash: number(own(row, 'expected_cash', 'El esperado del turno'), 'El esperado del turno'),
      physicalCash: number(own(row, 'physical_cash', 'El físico del turno'), 'El físico del turno'),
      difference: number(own(row, 'difference', 'La diferencia del turno'), 'La diferencia del turno'),
      denominations: normalizeConsolidatedDenominations(own(row, 'denominations', 'Las denominaciones del turno')),
    }
  })
}

function normalizeConsolidated(value, businessDate, normalizedShifts) {
  const row = exactRecord(value, CONSOLIDATED_FIELDS, 'El consolidado operativo')
  if (validDate(own(row, 'business_date', 'La fecha consolidada')) !== businessDate) {
    throw new TypeError('La fecha del consolidado no coincide.')
  }
  const payments = exactRecord(own(row, 'payments', 'Los pagos consolidados'), ['cash', 'card', 'total'], 'Los pagos consolidados')
  const realizedOrderIds = uniqueIds(own(row, 'realized_order_ids', 'Las ventas consolidadas'), 'Las ventas consolidadas')
  const paymentOrderIds = uniqueIds(own(row, 'payment_order_ids', 'Los pagos consolidados'), 'Los pagos consolidados')
  const cancelledOrderIds = uniqueIds(own(row, 'cancelled_order_ids', 'Las cancelaciones consolidadas'), 'Las cancelaciones consolidadas')
  const expenseIds = uniqueIds(own(row, 'expense_ids', 'Los gastos consolidados'), 'Los gastos consolidados')
  const adjustmentIds = uniqueIds(own(row, 'adjustment_ids', 'Los ajustes consolidados'), 'Los ajustes consolidados')
  const productSourceLineIds = uniqueIds(own(row, 'product_source_line_ids', 'Las líneas de producto consolidadas'), 'Las líneas de producto consolidadas')
  if (!sameIds(realizedOrderIds, paymentOrderIds)) {
    throw new TypeError('Las ventas y pagos consolidados no coinciden.')
  }
  const realized = new Set(realizedOrderIds)
  if (cancelledOrderIds.some((id) => realized.has(id))) {
    throw new TypeError('Una venta no puede estar realizada y cancelada en el consolidado.')
  }
  const productTotals = exactRecord(own(row, 'product_totals', 'Los totales de producto'), [
    'quantity', 'amount_total', 'weight_total_kg', 'products_without_weight',
  ], 'Los totales de producto')
  return {
    payments: {
      cash: number(own(payments, 'cash', 'El efectivo consolidado'), 'El efectivo consolidado'),
      card: number(own(payments, 'card', 'La terminal consolidada'), 'La terminal consolidada'),
      total: number(own(payments, 'total', 'Los pagos consolidados'), 'Los pagos consolidados'),
    },
    salesTotal: number(own(row, 'sales_total', 'Las ventas consolidadas'), 'Las ventas consolidadas'),
    expensesTotal: number(own(row, 'expenses_total', 'Los gastos consolidados'), 'Los gastos consolidados'),
    adjustmentIncomeTotal: number(own(row, 'adjustment_income_total', 'Los ingresos ajustados'), 'Los ingresos ajustados'),
    adjustmentExpenseTotal: number(own(row, 'adjustment_expense_total', 'Los egresos ajustados'), 'Los egresos ajustados'),
    products: normalizeConsolidatedProducts(own(row, 'products', 'Los productos consolidados'), productSourceLineIds),
    productTotals: {
      quantity: number(own(productTotals, 'quantity', 'La cantidad total'), 'La cantidad total'),
      amountTotal: number(own(productTotals, 'amount_total', 'El importe de productos'), 'El importe de productos'),
      weightTotalKg: number(own(productTotals, 'weight_total_kg', 'El peso total'), 'El peso total'),
      productsWithoutWeight: integer(own(productTotals, 'products_without_weight', 'Los productos sin peso'), 'Los productos sin peso'),
    },
    realizedOrderIds,
    paymentOrderIds,
    cancelledOrderIds,
    expenseIds,
    adjustmentIds,
    productSourceLineIds,
    shiftArqueos: normalizeShiftArqueos(own(row, 'shift_arqueos', 'Los arqueos por turno'), businessDate, normalizedShifts),
    netDifference: number(own(row, 'net_difference', 'La diferencia neta'), 'La diferencia neta'),
    businessDate,
    companyId: integer(own(row, 'company_id', 'La compañía consolidada'), 'La compañía consolidada', 1),
    warehouseId: integer(own(row, 'warehouse_id', 'El almacén consolidado'), 'El almacén consolidado', 1),
  }
}

export function mexicoBusinessDate(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new TypeError('La hora actual no es válida.')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(nowMs)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function validateOperationalHistoryDate(value, nowMs = Date.now()) {
  const date = validDate(value)
  if (date > mexicoBusinessDate(nowMs)) {
    throw new TypeError('La fecha operativa no puede ser futura en México.')
  }
  return date
}

export function normalizeCashShiftHistory(value, expectedBusinessDate) {
  const root = exactRecord(value, ['business_date', 'shifts', 'consolidated'], 'El historial operativo')
  const businessDate = validDate(own(root, 'business_date', 'La fecha operativa'))
  if (expectedBusinessDate !== undefined && validDate(expectedBusinessDate) !== businessDate) {
    throw new TypeError('La fecha operativa de la respuesta no coincide.')
  }
  const shiftIds = new Set()
  const shiftTypes = new Set()
  const shifts = array(own(root, 'shifts', 'Los turnos'), 'Los turnos').map((raw) => {
    const shift = normalizeCashShift(raw)
    if (shift.shift.businessDate !== businessDate || shiftIds.has(shift.shift.id) || shiftTypes.has(shift.shift.type)) {
      throw new TypeError('Los turnos del historial no son válidos.')
    }
    shiftIds.add(shift.shift.id)
    shiftTypes.add(shift.shift.type)
    return shift
  }).sort((left, right) => (
    (left.shift.type === 'night' ? 0 : 1) - (right.shift.type === 'night' ? 0 : 1)
  ))
  const consolidated = normalizeConsolidated(
    own(root, 'consolidated', 'El consolidado'),
    businessDate,
    shifts,
  )
  const versionedShiftIds = shifts.filter((shift) => shift.versionId !== null).map((shift) => shift.shift.id)
  const arqueoShiftIds = consolidated.shiftArqueos.map((row) => row.shift.id)
  if (!sameIds(sortedIds(versionedShiftIds), sortedIds(arqueoShiftIds))) {
    throw new TypeError('Los arqueos no coinciden con las versiones del historial.')
  }
  if (shifts.some((shift) => (
    shift.scope.companyId !== consolidated.companyId
    || shift.scope.warehouseId !== consolidated.warehouseId
  ))) {
    throw new TypeError('El alcance consolidado no coincide con los turnos.')
  }
  assertExactSnapshotIds(persistedSnapshotIds(shifts), consolidated)
  return {
    businessDate,
    shifts,
    consolidated,
  }
}

export function operationalHistorySections(history) {
  const day = Number(history.businessDate.slice(-2))
  return [
    ...history.shifts.map((cashShift) => ({
      kind: 'shift',
      key: `shift-${cashShift.shift.id}`,
      label: `${cashShift.shift.type === 'night' ? 'Noche' : 'Día'} ${day}`,
      cashShift,
    })),
    {
      kind: 'consolidated',
      key: `consolidated-${history.businessDate}`,
      label: `Consolidado ${day}`,
      consolidated: history.consolidated,
    },
  ]
}
