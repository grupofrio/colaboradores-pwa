const OWN = Object.prototype.hasOwnProperty
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-](\d{2}):?(\d{2}))?$/
const SHIFT_TYPES = new Set(['night', 'day'])
const SHIFT_STATES = new Set(['open', 'pending_auth', 'closed', 'reopened'])
const ADJUSTMENT_TYPES = new Set(['income', 'expense'])
const PAYMENT_METHODS = new Set(['cash', 'credit', 'transfer', 'card'])
const SALE_CHANNELS = new Set(['admin', 'day', 'night', 'legacy_pwa'])
const CANCELLATION_REASONS = new Map([
  ['duplicate', 'Duplicidad'],
  ['error', 'Error'],
  ['customer_cancelled', 'Canceló'],
  ['out_of_stock', 'Falta de stock'],
])
const CANCELLATION_ORIGINS = new Set(['admin', 'day', 'night'])
const EXPENSE_APPROVAL_STATES = new Set(['pending', 'approved', 'rejected'])
const AUTHORIZATION_LEVELS = new Set(['manager', 'director'])

export const CASH_SHIFT_DENOMINATIONS = Object.freeze([
  '1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '0.50',
])

const DENOMINATION_CENTS = new Map(
  CASH_SHIFT_DENOMINATIONS.map((key) => [key, Math.round(Number(key) * 100)]),
)

function plainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} no es válido.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function ownValue(record, key, label, { optional = false } = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor) {
    if (key in record || !optional) throw new TypeError(`${label} no es válido.`)
    return undefined
  }
  if (!OWN.call(descriptor, 'value')) throw new TypeError(`${label} no es válido.`)
  return descriptor.value
}

function exactInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function exactBoolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} no es válido.`)
  return value
}

function exactString(value, label, { allowEmpty = true } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function exactEnum(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new TypeError(`${label} no es válido.`)
  }
  return value
}

function optionalId(value, label) {
  if (value === false || value === null || value === undefined) return null
  return exactInteger(value, label, 1)
}

function validDate(value, label = 'La fecha') {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError(`${label} no es válida.`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new TypeError(`${label} no es válida.`)
  }
  return value
}

function optionalDatetime(value, label) {
  if (value === false || value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') {
    throw new TypeError(`${label} no es válida.`)
  }
  const match = value.match(DATETIME_PATTERN)
  if (!match) throw new TypeError(`${label} no es válida.`)
  validDate(match[1], label)
  const hour = Number(match[2])
  const minute = Number(match[3])
  const second = Number(match[4] || 0)
  if (hour > 23 || minute > 59 || second > 59) {
    throw new TypeError(`${label} no es válida.`)
  }
  if (match[5] && match[5] !== 'Z') {
    const offsetHour = Number(match[6])
    const offsetMinute = Number(match[7])
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new TypeError(`${label} no es válida.`)
    }
  }
  return value
}

function exactDatetime(value, label) {
  const normalized = optionalDatetime(value, label)
  if (normalized === null) throw new TypeError(`${label} no es válida.`)
  return normalized
}

function optionalSnapshotId(value, label) {
  if (value === false) return false
  return exactInteger(value, label, 1)
}

function safeArrayValues(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} no es válido.`)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const rows = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)]
    if (!descriptor || !OWN.call(descriptor, 'value')) {
      throw new TypeError(`${label} no es válido.`)
    }
    rows.push(descriptor.value)
  }
  for (const key of Object.keys(value)) {
    if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      throw new TypeError(`${label} no es válido.`)
    }
  }
  return rows
}

function safeClone(value, label, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return finiteNumber(value, label)
  if (!value || typeof value !== 'object') throw new TypeError(`${label} no es válido.`)
  if (seen.has(value)) throw new TypeError(`${label} no es válido.`)
  seen.add(value)
  if (Array.isArray(value)) {
    const cloned = safeArrayValues(value, label).map((item) => safeClone(item, label, seen))
    seen.delete(value)
    return cloned
  }
  const record = plainRecord(value, label)
  const cloned = {}
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(record))) {
    if (!descriptor.enumerable) continue
    if (
      key === '__proto__'
      || key === 'prototype'
      || key === 'constructor'
      || !OWN.call(descriptor, 'value')
    ) {
      throw new TypeError(`${label} no es válido.`)
    }
    cloned[key] = safeClone(descriptor.value, `${label}.${key}`, seen)
  }
  seen.delete(value)
  return cloned
}

function exactRecord(value, keys, label) {
  const record = plainRecord(value, label)
  const actual = Object.keys(record).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(`${label} no es válido.`)
  }
  return record
}

function uniqueId(value, seen, label) {
  const id = exactInteger(value, label, 1)
  if (seen.has(id)) throw new TypeError(`${label} está duplicado.`)
  seen.add(id)
  return id
}

function normalizeProductSources(value, label) {
  const seen = new Set()
  return safeArrayValues(value, label).map((raw, index) => {
    const rowLabel = `${label} ${index + 1}`
    const row = exactRecord(raw, [
      'line_id', 'order_id', 'quantity', 'amount_total', 'weight_total_kg',
    ], rowLabel)
    return {
      line_id: uniqueId(ownValue(row, 'line_id', 'La línea de venta'), seen, 'La línea de venta'),
      order_id: exactInteger(ownValue(row, 'order_id', 'La venta'), 'La venta', 1),
      quantity: finiteNumber(ownValue(row, 'quantity', 'La cantidad'), 'La cantidad'),
      amount_total: finiteNumber(ownValue(row, 'amount_total', 'El importe'), 'El importe'),
      weight_total_kg: finiteNumber(
        ownValue(row, 'weight_total_kg', 'El peso total'),
        'El peso total',
      ),
    }
  })
}

function normalizeProductSnapshots(value) {
  const products = safeArrayValues(value, 'Los productos')
  const productIds = new Set()
  return products.map((raw, index) => {
    const label = `El producto ${index + 1}`
    const row = exactRecord(raw, [
      'product_id', 'sku', 'product_name', 'quantity', 'amount_total',
      'weight_per_unit_kg', 'weight_total_kg', 'weight_unknown',
      'source_line_ids', 'sources',
    ], label)
    const sourceLineIds = safeArrayValues(
      ownValue(row, 'source_line_ids', 'Las líneas fuente'),
      'Las líneas fuente',
    )
    const sourceIds = new Set()
    const normalizedSourceLineIds = sourceLineIds.map((id) => (
      uniqueId(id, sourceIds, 'La línea fuente')
    ))
    const sources = normalizeProductSources(ownValue(row, 'sources', 'Las fuentes'), 'La fuente')
    if (
      normalizedSourceLineIds.length !== sources.length
      || normalizedSourceLineIds.some((id, sourceIndex) => id !== sources[sourceIndex].line_id)
    ) {
      throw new TypeError('Las fuentes del producto no son válidas.')
    }
    return {
      product_id: uniqueId(
        ownValue(row, 'product_id', 'El producto'),
        productIds,
        'El producto',
      ),
      sku: exactString(ownValue(row, 'sku', 'El SKU'), 'El SKU'),
      product_name: exactString(
        ownValue(row, 'product_name', 'El nombre del producto'),
        'El nombre del producto',
      ),
      quantity: finiteNumber(ownValue(row, 'quantity', 'La cantidad'), 'La cantidad'),
      amount_total: finiteNumber(ownValue(row, 'amount_total', 'El importe'), 'El importe'),
      weight_per_unit_kg: finiteNumber(
        ownValue(row, 'weight_per_unit_kg', 'El peso unitario'),
        'El peso unitario',
      ),
      weight_total_kg: finiteNumber(
        ownValue(row, 'weight_total_kg', 'El peso total'),
        'El peso total',
      ),
      weight_unknown: exactBoolean(
        ownValue(row, 'weight_unknown', 'El indicador de peso'),
        'El indicador de peso',
      ),
      source_line_ids: normalizedSourceLineIds,
      sources,
    }
  })
}

function normalizeProductTotals(value) {
  const row = exactRecord(value, [
    'quantity', 'amount_total', 'weight_total_kg', 'products_without_weight',
  ], 'Los totales de producto')
  return {
    quantity: finiteNumber(ownValue(row, 'quantity', 'La cantidad total'), 'La cantidad total'),
    amount_total: finiteNumber(ownValue(row, 'amount_total', 'El importe total'), 'El importe total'),
    weight_total_kg: finiteNumber(
      ownValue(row, 'weight_total_kg', 'El peso total'),
      'El peso total',
    ),
    products_without_weight: exactInteger(
      ownValue(row, 'products_without_weight', 'Los productos sin peso'),
      'Los productos sin peso',
    ),
  }
}

function normalizePriorTotals(value) {
  const record = plainRecord(value, 'Los totales previos')
  if (Object.keys(record).length === 0) return {}
  const row = exactRecord(record, [
    'sales_cash',
    'sales_card',
    'sales_total',
    'expenses_total',
    'adjustment_income_total',
    'adjustment_expense_total',
    'expected_cash',
    'physical_cash',
    'difference',
  ], 'Los totales previos')
  return {
    salesCash: serverNumber(row, 'sales_cash', 'Las ventas previas en efectivo'),
    salesCard: serverNumber(row, 'sales_card', 'Las ventas previas con terminal'),
    salesTotal: serverNumber(row, 'sales_total', 'Las ventas previas totales'),
    expensesTotal: serverNumber(row, 'expenses_total', 'Los gastos previos'),
    adjustmentIncomeTotal: serverNumber(
      row,
      'adjustment_income_total',
      'Los ingresos ajustados previos',
    ),
    adjustmentExpenseTotal: serverNumber(
      row,
      'adjustment_expense_total',
      'Los egresos ajustados previos',
    ),
    expectedCash: serverNumber(row, 'expected_cash', 'El efectivo esperado previo'),
    physicalCash: serverNumber(row, 'physical_cash', 'El efectivo físico previo'),
    difference: serverNumber(row, 'difference', 'La diferencia previa'),
  }
}

function normalizePaymentSnapshots(value) {
  const row = exactRecord(value, ['cash', 'card', 'total', 'rows'], 'Los pagos')
  const orderIds = new Set()
  const rows = safeArrayValues(ownValue(row, 'rows', 'Los pagos'), 'Los pagos').map((raw, index) => {
    const label = `El pago ${index + 1}`
    const payment = exactRecord(raw, ['order_id', 'method', 'amount'], label)
    return {
      order_id: uniqueId(ownValue(payment, 'order_id', 'La venta'), orderIds, 'La venta'),
      method: exactEnum(
        ownValue(payment, 'method', 'El método de pago'),
        PAYMENT_METHODS,
        'El método de pago',
      ),
      amount: finiteNumber(ownValue(payment, 'amount', 'El importe'), 'El importe'),
    }
  })
  return {
    cash: finiteNumber(ownValue(row, 'cash', 'El efectivo'), 'El efectivo'),
    card: finiteNumber(ownValue(row, 'card', 'La terminal'), 'La terminal'),
    total: finiteNumber(ownValue(row, 'total', 'El total de pagos'), 'El total de pagos'),
    rows,
  }
}

function normalizeSaleRow(raw, label) {
  const row = exactRecord(raw, [
    'order_id', 'name', 'amount_total', 'payment_method', 'employee_id',
    'recorded_at', 'channel',
  ], label)
  return {
    order_id: exactInteger(ownValue(row, 'order_id', 'La venta'), 'La venta', 1),
    name: exactString(ownValue(row, 'name', 'El folio de venta'), 'El folio de venta'),
    amount_total: finiteNumber(ownValue(row, 'amount_total', 'El total de venta'), 'El total de venta'),
    payment_method: exactEnum(
      ownValue(row, 'payment_method', 'El método de pago'),
      PAYMENT_METHODS,
      'El método de pago',
    ),
    employee_id: optionalSnapshotId(
      ownValue(row, 'employee_id', 'El empleado de venta'),
      'El empleado de venta',
    ),
    recorded_at: exactDatetime(
      ownValue(row, 'recorded_at', 'La fecha de venta'),
      'La fecha de venta',
    ),
    channel: exactEnum(
      ownValue(row, 'channel', 'El canal de venta'),
      SALE_CHANNELS,
      'El canal de venta',
    ),
  }
}

function normalizeSaleSnapshots(value) {
  const orderIds = new Set()
  return safeArrayValues(value, 'Las ventas').map((raw, index) => {
    const normalized = normalizeSaleRow(raw, `La venta ${index + 1}`)
    uniqueId(normalized.order_id, orderIds, 'La venta')
    return normalized
  })
}

function normalizeCancellationSnapshots(value) {
  const orderIds = new Set()
  return safeArrayValues(value, 'Las cancelaciones').map((raw, index) => {
    const label = `La cancelación ${index + 1}`
    const row = exactRecord(raw, [
      'order_id', 'name', 'amount_total', 'payment_method', 'employee_id',
      'recorded_at', 'channel', 'reason_code', 'reason_text',
      'cancelled_by_employee_id', 'cancelled_by_user_id', 'cancelled_at', 'origin',
    ], label)
    const base = normalizeSaleRow({
      order_id: ownValue(row, 'order_id', 'La venta'),
      name: ownValue(row, 'name', 'El folio de venta'),
      amount_total: ownValue(row, 'amount_total', 'El total de venta'),
      payment_method: ownValue(row, 'payment_method', 'El método de pago'),
      employee_id: ownValue(row, 'employee_id', 'El empleado de venta'),
      recorded_at: ownValue(row, 'recorded_at', 'La fecha de venta'),
      channel: ownValue(row, 'channel', 'El canal de venta'),
    }, label)
    uniqueId(base.order_id, orderIds, 'La venta cancelada')
    const reasonCode = ownValue(row, 'reason_code', 'La razón de cancelación')
    const reasonText = ownValue(row, 'reason_text', 'La razón de cancelación')
    const cancelledByEmployeeId = ownValue(
      row,
      'cancelled_by_employee_id',
      'El empleado que canceló',
    )
    const cancelledByUserId = ownValue(row, 'cancelled_by_user_id', 'El usuario que canceló')
    const cancelledAt = ownValue(row, 'cancelled_at', 'La fecha de cancelación')
    const origin = ownValue(row, 'origin', 'El origen de cancelación')
    const withoutAudit = [
      reasonCode, reasonText, cancelledByEmployeeId, cancelledByUserId, cancelledAt, origin,
    ].every((item) => item === false)
    if (withoutAudit) {
      return {
        ...base,
        reason_code: false,
        reason_text: false,
        cancelled_by_employee_id: false,
        cancelled_by_user_id: false,
        cancelled_at: false,
        origin: false,
      }
    }
    const normalizedOrigin = exactEnum(
      origin,
      CANCELLATION_ORIGINS,
      'El origen de cancelación',
    )
    const normalizedReasonText = exactString(
      reasonText,
      'La razón de cancelación',
      { allowEmpty: false },
    )
    const normalizedReason = reasonCode === false
      ? false
      : exactEnum(
        reasonCode,
        new Set(CANCELLATION_REASONS.keys()),
        'La razón de cancelación',
      )
    if (
      normalizedOrigin !== 'admin'
      && (
        normalizedReason === false
        || normalizedReasonText !== CANCELLATION_REASONS.get(normalizedReason)
      )
    ) {
      throw new TypeError('La razón de cancelación no es válida.')
    }
    return {
      ...base,
      reason_code: normalizedReason,
      reason_text: normalizedReasonText,
      cancelled_by_employee_id: exactInteger(
        cancelledByEmployeeId,
        'El empleado que canceló',
        1,
      ),
      cancelled_by_user_id: optionalSnapshotId(cancelledByUserId, 'El usuario que canceló'),
      cancelled_at: exactDatetime(cancelledAt, 'La fecha de cancelación'),
      origin: normalizedOrigin,
    }
  })
}

function normalizeExpenseSnapshots(value) {
  const expenseIds = new Set()
  return safeArrayValues(value, 'Los gastos').map((raw, index) => {
    const label = `El gasto ${index + 1}`
    const row = exactRecord(raw, [
      'expense_id', 'name', 'concept', 'amount', 'approval_state',
      'employee_id', 'recorded_at',
    ], label)
    const approvalState = ownValue(row, 'approval_state', 'El estado de aprobación')
    return {
      expense_id: uniqueId(
        ownValue(row, 'expense_id', 'El gasto'),
        expenseIds,
        'El gasto',
      ),
      name: exactString(ownValue(row, 'name', 'El nombre del gasto'), 'El nombre del gasto'),
      concept: exactString(ownValue(row, 'concept', 'El concepto del gasto'), 'El concepto del gasto'),
      amount: finiteNumber(ownValue(row, 'amount', 'El importe del gasto'), 'El importe del gasto'),
      approval_state: approvalState === false
        ? false
        : exactEnum(approvalState, EXPENSE_APPROVAL_STATES, 'El estado de aprobación'),
      employee_id: optionalSnapshotId(
        ownValue(row, 'employee_id', 'El empleado del gasto'),
        'El empleado del gasto',
      ),
      recorded_at: exactDatetime(
        ownValue(row, 'recorded_at', 'La fecha del gasto'),
        'La fecha del gasto',
      ),
    }
  })
}

function normalizeDenominationSnapshots(value) {
  const seen = new Set()
  return safeArrayValues(value, 'El arqueo').map((raw, index) => {
    const label = `La denominación ${index + 1}`
    const record = plainRecord(raw, label)
    const historical = OWN.call(record, 'id')
    const row = exactRecord(record, historical
      ? ['id', 'denomination', 'count', 'subtotal']
      : ['denomination', 'count', 'subtotal'], label)
    const denomination = exactEnum(
      ownValue(row, 'denomination', 'La denominación'),
      new Set(CASH_SHIFT_DENOMINATIONS),
      'La denominación',
    )
    if (seen.has(denomination)) throw new TypeError('La denominación está duplicada.')
    seen.add(denomination)
    const count = exactInteger(ownValue(row, 'count', 'El conteo'), 'El conteo')
    if (count > 2_147_483_647) throw new TypeError('El conteo excede el máximo válido.')
    const normalized = {
      denomination,
      count,
      subtotal: finiteNumber(ownValue(row, 'subtotal', 'El subtotal'), 'El subtotal'),
    }
    return historical
      ? { id: exactInteger(ownValue(row, 'id', 'El ID de denominación'), 'El ID de denominación', 1), ...normalized }
      : normalized
  })
}

function normalizeAdjustmentSnapshots(value) {
  const ids = new Set()
  return safeArrayValues(value, 'Los ajustes').map((raw, index) => {
    const label = `El ajuste ${index + 1}`
    const record = plainRecord(raw, label)
    const historical = OWN.call(record, 'id')
    const row = exactRecord(record, historical
      ? ['id', 'type', 'amount', 'concept', 'actor_employee_id', 'recorded_at']
      : ['type', 'amount', 'concept'], label)
    const amount = finiteNumber(ownValue(row, 'amount', 'El importe'), 'El importe')
    if (amount <= 0) throw new TypeError('El importe del ajuste debe ser positivo.')
    const normalized = {
      type: exactEnum(
        ownValue(row, 'type', 'El tipo de ajuste'),
        ADJUSTMENT_TYPES,
        'El tipo de ajuste',
      ),
      amount,
      concept: exactString(
        ownValue(row, 'concept', 'El concepto'),
        'El concepto',
        { allowEmpty: false },
      ),
    }
    if (!historical) return normalized
    return {
      id: uniqueId(ownValue(row, 'id', 'El ID de ajuste'), ids, 'El ID de ajuste'),
      ...normalized,
      actor_employee_id: exactInteger(
        ownValue(row, 'actor_employee_id', 'El actor del ajuste'),
        'El actor del ajuste',
        1,
      ),
      recorded_at: exactDatetime(
        ownValue(row, 'recorded_at', 'La fecha del ajuste'),
        'La fecha del ajuste',
      ),
    }
  })
}

function normalizeAuthorizationSnapshots(value) {
  const ids = new Set()
  const levels = new Set()
  return safeArrayValues(value, 'Las autorizaciones').map((raw, index) => {
    const label = `La autorización ${index + 1}`
    const row = exactRecord(raw, ['id', 'level', 'actor_employee_id', 'authorized_at'], label)
    const level = exactEnum(
      ownValue(row, 'level', 'El nivel de autorización'),
      AUTHORIZATION_LEVELS,
      'El nivel de autorización',
    )
    if (levels.has(level)) throw new TypeError('El nivel de autorización está duplicado.')
    levels.add(level)
    return {
      id: uniqueId(ownValue(row, 'id', 'El ID de autorización'), ids, 'El ID de autorización'),
      level,
      actor_employee_id: exactInteger(
        ownValue(row, 'actor_employee_id', 'El actor de autorización'),
        'El actor de autorización',
        1,
      ),
      authorized_at: exactDatetime(
        ownValue(row, 'authorized_at', 'La fecha de autorización'),
        'La fecha de autorización',
      ),
    }
  })
}

function serverNumber(record, key, label) {
  return finiteNumber(ownValue(record, key, label), label)
}

export function normalizeDenominations(value) {
  const seen = new Set()
  return safeArrayValues(value, 'El arqueo').map((raw, index) => {
    const label = `La denominación ${index + 1}`
    const line = plainRecord(safeClone(raw, label), label)
    const denomination = ownValue(line, 'denomination', 'La denominación')
    if (typeof denomination !== 'string' || !DENOMINATION_CENTS.has(denomination)) {
      throw new TypeError('La denominación no es válida.')
    }
    const count = exactInteger(ownValue(line, 'count', 'El conteo'), 'El conteo')
    if (count > 2_147_483_647) throw new TypeError('El conteo excede el máximo válido.')
    if (seen.has(denomination)) throw new TypeError('La denominación está duplicada.')
    seen.add(denomination)
    return { denomination, count }
  })
}

export function calculatePhysicalTotal(value) {
  const lines = normalizeDenominations(value)
  const cents = lines.reduce(
    (total, line) => total + (DENOMINATION_CENTS.get(line.denomination) * line.count),
    0,
  )
  if (!Number.isSafeInteger(cents)) throw new TypeError('El total físico excede el límite válido.')
  return cents / 100
}

export function normalizeAdjustments(value) {
  return safeArrayValues(value, 'Los ajustes').map((raw, index) => {
    const label = `El ajuste ${index + 1}`
    const line = plainRecord(safeClone(raw, label), label)
    const type = ownValue(line, 'type', 'El tipo de ajuste')
    if (typeof type !== 'string' || !ADJUSTMENT_TYPES.has(type)) {
      throw new TypeError('El tipo de ajuste no es válido.')
    }
    const concept = ownValue(line, 'concept', 'El concepto')
    if (typeof concept !== 'string' || !concept.trim()) {
      throw new TypeError('El concepto del ajuste es obligatorio.')
    }
    const amount = finiteNumber(ownValue(line, 'amount', 'El importe'), 'El importe')
    if (amount <= 0) throw new TypeError('El importe del ajuste debe ser positivo.')
    return { type, concept: concept.trim(), amount }
  })
}

export function normalizeCashShift(value) {
  const root = plainRecord(safeClone(value, 'El turno'), 'El turno')
  const folio = exactString(ownValue(root, 'folio', 'El folio'), 'El folio', {
    allowEmpty: false,
  })
  const versionId = optionalId(ownValue(root, 'version_id', 'El ID de versión'), 'El ID de versión')
  const versionNumber = exactInteger(
    ownValue(root, 'version_number', 'El número de versión'),
    'El número de versión',
  )
  const rawClosingType = ownValue(root, 'closing_type', 'El tipo de cierre')
  if (rawClosingType !== false && rawClosingType !== 'close' && rawClosingType !== 'reclose') {
    throw new TypeError('El tipo de cierre no es válido.')
  }
  const rawResponsible = plainRecord(
    ownValue(root, 'responsible', 'El responsable'),
    'El responsable',
  )
  const responsible = {
    employeeId: optionalId(
      ownValue(rawResponsible, 'employee_id', 'El empleado responsable'),
      'El empleado responsable',
    ),
    employeeName: exactString(
      ownValue(rawResponsible, 'employee_name', 'El nombre del responsable'),
      'El nombre del responsable',
    ),
    userId: optionalId(
      ownValue(rawResponsible, 'user_id', 'El usuario responsable'),
      'El usuario responsable',
    ),
    userName: exactString(
      ownValue(rawResponsible, 'user_name', 'El usuario responsable'),
      'El usuario responsable',
    ),
  }
  const closedOrReclosedAt = optionalDatetime(
    ownValue(root, 'closed_or_reclosed_at', 'La fecha de cierre'),
    'La fecha de cierre',
  )
  const rawEvidence = ownValue(root, 'evidence', 'La evidencia')
  let evidence = null
  if (rawEvidence !== false && rawEvidence !== null) {
    const evidenceRecord = plainRecord(rawEvidence, 'La evidencia')
    evidence = {
      id: exactInteger(ownValue(evidenceRecord, 'id', 'El ID de evidencia'), 'El ID de evidencia', 1),
      name: exactString(ownValue(evidenceRecord, 'name', 'El nombre de evidencia'), 'El nombre de evidencia'),
      mimetype: exactString(ownValue(evidenceRecord, 'mimetype', 'El MIME de evidencia'), 'El MIME de evidencia', { allowEmpty: false }),
      fileSize: exactInteger(ownValue(evidenceRecord, 'file_size', 'El tamaño de evidencia'), 'El tamaño de evidencia'),
      digest: exactString(ownValue(evidenceRecord, 'digest', 'El digest de evidencia'), 'El digest de evidencia', { allowEmpty: false }),
      reference: exactString(ownValue(evidenceRecord, 'reference', 'La referencia de evidencia'), 'La referencia de evidencia', { allowEmpty: false }),
    }
  }
  const previousVersionId = optionalId(
    ownValue(root, 'previous_version_id', 'La versión anterior'),
    'La versión anterior',
  )
  const rawShift = plainRecord(ownValue(root, 'shift', 'El turno'), 'El turno')
  const id = exactInteger(ownValue(rawShift, 'id', 'El ID del turno'), 'El ID del turno', 1)
  const type = ownValue(rawShift, 'type', 'El tipo de turno')
  if (typeof type !== 'string' || !SHIFT_TYPES.has(type)) {
    throw new TypeError('El tipo de turno no es válido.')
  }
  const businessDate = validDate(
    ownValue(rawShift, 'business_date', 'La fecha operativa'),
    'La fecha operativa',
  )
  const state = ownValue(rawShift, 'state', 'El estado del turno')
  if (typeof state !== 'string' || !SHIFT_STATES.has(state)) {
    throw new TypeError('El estado del turno no es válido.')
  }
  const version = exactInteger(
    ownValue(rawShift, 'version', 'La versión', { optional: true }) ?? 0,
    'La versión',
  )
  if (version !== versionNumber) throw new TypeError('La versión del turno no coincide.')

  const rawPeriod = plainRecord(ownValue(root, 'period', 'El periodo'), 'El periodo')
  const timezone = ownValue(rawPeriod, 'timezone', 'La zona horaria')
  if (timezone !== 'America/Mexico_City') {
    throw new TypeError('La zona horaria del turno no es válida.')
  }
  const rawSchedule = plainRecord(ownValue(root, 'schedule', 'El horario'), 'El horario')
  const rawTotals = plainRecord(ownValue(root, 'totals', 'Los totales'), 'Los totales')
  const rawScope = plainRecord(ownValue(root, 'scope', 'El alcance'), 'El alcance')
  const scope = {
    companyId: exactInteger(ownValue(rawScope, 'company_id', 'La compañía'), 'La compañía', 1),
    companyName: exactString(ownValue(rawScope, 'company_name', 'La compañía'), 'La compañía'),
    warehouseId: exactInteger(ownValue(rawScope, 'warehouse_id', 'El almacén'), 'El almacén', 1),
    warehouseName: exactString(ownValue(rawScope, 'warehouse_name', 'El almacén'), 'El almacén'),
    analyticAccountId: optionalId(
      ownValue(rawScope, 'analytic_account_id', 'La cuenta analítica'),
      'La cuenta analítica',
    ),
    analyticAccountName: exactString(
      ownValue(rawScope, 'analytic_account_name', 'La cuenta analítica'),
      'La cuenta analítica',
    ),
  }
  const payments = normalizePaymentSnapshots(ownValue(root, 'payments', 'Los pagos'))

  return {
    folio,
    versionId,
    versionNumber,
    closingType: rawClosingType || null,
    responsible,
    closedOrReclosedAt,
    evidence,
    previousVersionId,
    priorTotals: normalizePriorTotals(ownValue(root, 'prior_totals', 'Los totales previos')),
    reopenReason: exactString(ownValue(root, 'reopen_reason', 'La razón de reapertura'), 'La razón de reapertura'),
    shift: { id, type, businessDate, state, version },
    scope,
    period: {
      openedAt: optionalDatetime(ownValue(rawPeriod, 'opened_at', 'La apertura'), 'La apertura'),
      closedAt: optionalDatetime(ownValue(rawPeriod, 'closed_at', 'El cierre'), 'El cierre'),
      timezone,
    },
    schedule: {
      expectedClose: optionalDatetime(
        ownValue(rawSchedule, 'expected_close', 'El cierre esperado'),
        'El cierre esperado',
      ),
      overdue: exactBoolean(
        ownValue(rawSchedule, 'overdue', 'El aviso de horario'),
        'El aviso de horario',
      ),
    },
    totals: {
      salesCash: serverNumber(rawTotals, 'sales_cash', 'Ventas en efectivo'),
      salesCard: serverNumber(rawTotals, 'sales_card', 'Ventas con terminal'),
      salesTotal: serverNumber(rawTotals, 'sales_total', 'Ventas totales'),
      expenses: serverNumber(rawTotals, 'expenses', 'Gastos'),
      expectedCash: serverNumber(rawTotals, 'expected_cash', 'Efectivo esperado'),
    },
    openingFund: serverNumber(root, 'opening_fund', 'Fondo inicial'),
    physicalCash: serverNumber(root, 'physical_cash', 'Efectivo físico'),
    difference: serverNumber(root, 'difference', 'Diferencia'),
    products: normalizeProductSnapshots(ownValue(root, 'products', 'Los productos')),
    productTotals: normalizeProductTotals(
      ownValue(root, 'product_totals', 'Los totales de producto'),
    ),
    payments,
    sales: normalizeSaleSnapshots(ownValue(root, 'sales', 'Las ventas')),
    cancellations: normalizeCancellationSnapshots(
      ownValue(root, 'cancellations', 'Las cancelaciones'),
    ),
    expenses: normalizeExpenseSnapshots(ownValue(root, 'expenses', 'Los gastos')),
    denominations: normalizeDenominationSnapshots(ownValue(root, 'denominations', 'El arqueo')),
    adjustments: normalizeAdjustmentSnapshots(ownValue(root, 'adjustments', 'Los ajustes')),
    authorizations: normalizeAuthorizationSnapshots(
      ownValue(root, 'authorizations', 'Las autorizaciones'),
    ),
    differenceNote: exactString(ownValue(root, 'difference_note', 'La nota de diferencia'), 'La nota de diferencia'),
    evidencePresent: exactBoolean(ownValue(root, 'evidence_present', 'La evidencia presente'), 'La evidencia presente'),
    needsManagerAuth: exactBoolean(ownValue(root, 'needs_manager_auth', 'La autorización gerencial'), 'La autorización gerencial'),
    needsDirectorAuth: exactBoolean(ownValue(root, 'needs_director_auth', 'La autorización de dirección'), 'La autorización de dirección'),
    printable: exactBoolean(ownValue(root, 'printable', 'El indicador de impresión'), 'El indicador de impresión'),
  }
}

function nextBusinessDate(value) {
  validDate(value, 'La fecha operativa')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10)
}

export function nextTransitionLabel({ type, businessDate }) {
  if (!SHIFT_TYPES.has(type)) throw new TypeError('El tipo de turno no es válido.')
  validDate(businessDate, 'La fecha operativa')
  const currentDay = Number(businessDate.slice(-2))
  if (type === 'night') return `Cerrar Noche ${currentDay} y abrir Día ${currentDay}`
  return `Cerrar Día ${currentDay} y abrir Noche ${Number(nextBusinessDate(businessDate).slice(-2))}`
}

function mexicoWallClock(instant) {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) throw new TypeError('La hora actual no es válida.')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`
}

export function cashShiftScheduleWarning({ type, businessDate, now = new Date() }) {
  if (!SHIFT_TYPES.has(type)) throw new TypeError('El tipo de turno no es válido.')
  validDate(businessDate, 'La fecha operativa')
  const expectedClose = `${businessDate} ${type === 'night' ? '06:00' : '18:00'}`
  return {
    overdue: mexicoWallClock(now) > expectedClose,
    expectedClose,
    automatic: false,
  }
}
