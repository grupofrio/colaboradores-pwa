const OWN = Object.prototype.hasOwnProperty
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-](\d{2}):?(\d{2}))?$/
const SHIFT_TYPES = new Set(['night', 'day'])
const SHIFT_STATES = new Set(['open', 'pending_auth', 'closed', 'reopened'])
const ADJUSTMENT_TYPES = new Set(['income', 'expense'])

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
  const payments = safeClone(ownValue(root, 'payments', 'Los pagos'), 'Los pagos')
  plainRecord(payments, 'Los pagos')

  return {
    folio,
    versionId,
    versionNumber,
    closingType: rawClosingType || null,
    responsible,
    closedOrReclosedAt,
    evidence,
    previousVersionId,
    priorTotals: safeClone(ownValue(root, 'prior_totals', 'Los totales previos'), 'Los totales previos'),
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
    products: safeClone(ownValue(root, 'products', 'Los productos'), 'Los productos'),
    productTotals: safeClone(ownValue(root, 'product_totals', 'Los totales de producto'), 'Los totales de producto'),
    payments,
    sales: safeClone(ownValue(root, 'sales', 'Las ventas'), 'Las ventas'),
    cancellations: safeClone(ownValue(root, 'cancellations', 'Las cancelaciones'), 'Las cancelaciones'),
    expenses: safeClone(ownValue(root, 'expenses', 'Los gastos'), 'Los gastos'),
    denominations: normalizeDenominations(ownValue(root, 'denominations', 'El arqueo')),
    adjustments: normalizeAdjustments(ownValue(root, 'adjustments', 'Los ajustes')),
    authorizations: safeClone(ownValue(root, 'authorizations', 'Las autorizaciones'), 'Las autorizaciones'),
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
