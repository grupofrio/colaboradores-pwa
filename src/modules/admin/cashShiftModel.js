const OWN = Object.prototype.hasOwnProperty
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/
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
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value)) {
    throw new TypeError(`${label} no es válida.`)
  }
  return value
}

function list(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} no es válido.`)
  return value
}

function optionalServerNumber(record, key, label, fallback = 0) {
  const value = ownValue(record, key, label, { optional: true })
  return value === undefined ? fallback : finiteNumber(value, label)
}

export function normalizeDenominations(value) {
  return list(value, 'El arqueo').map((raw, index) => {
    const line = plainRecord(raw, `La denominación ${index + 1}`)
    const denomination = ownValue(line, 'denomination', 'La denominación')
    if (typeof denomination !== 'string' || !DENOMINATION_CENTS.has(denomination)) {
      throw new TypeError('La denominación no es válida.')
    }
    const count = exactInteger(ownValue(line, 'count', 'El conteo'), 'El conteo')
    if (count > 2_147_483_647) throw new TypeError('El conteo excede el máximo válido.')
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
  return list(value, 'Los ajustes').map((raw, index) => {
    const line = plainRecord(raw, `El ajuste ${index + 1}`)
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
  const root = plainRecord(value, 'El turno')
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

  const rawPeriod = plainRecord(ownValue(root, 'period', 'El periodo'), 'El periodo')
  const timezone = ownValue(rawPeriod, 'timezone', 'La zona horaria')
  if (timezone !== 'America/Mexico_City') {
    throw new TypeError('La zona horaria del turno no es válida.')
  }
  const rawSchedule = plainRecord(ownValue(root, 'schedule', 'El horario'), 'El horario')
  const rawTotals = plainRecord(ownValue(root, 'totals', 'Los totales'), 'Los totales')

  return {
    shift: { id, type, businessDate, state, version },
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
      salesCash: optionalServerNumber(rawTotals, 'sales_cash', 'Ventas en efectivo'),
      salesCard: optionalServerNumber(rawTotals, 'sales_card', 'Ventas con terminal'),
      salesTotal: optionalServerNumber(rawTotals, 'sales_total', 'Ventas totales'),
      expenses: optionalServerNumber(rawTotals, 'expenses', 'Gastos'),
      expectedCash: optionalServerNumber(rawTotals, 'expected_cash', 'Efectivo esperado'),
    },
    openingFund: optionalServerNumber(root, 'opening_fund', 'Fondo inicial'),
    physicalCash: optionalServerNumber(root, 'physical_cash', 'Efectivo físico'),
    difference: optionalServerNumber(root, 'difference', 'Diferencia'),
    products: [...list(ownValue(root, 'products', 'Los productos'), 'Los productos')],
    payments: { ...plainRecord(ownValue(root, 'payments', 'Los pagos'), 'Los pagos') },
    sales: [...list(ownValue(root, 'sales', 'Las ventas'), 'Las ventas')],
    cancellations: [...list(ownValue(root, 'cancellations', 'Las cancelaciones'), 'Las cancelaciones')],
    expenses: [...list(ownValue(root, 'expenses', 'Los gastos'), 'Los gastos')],
    denominations: normalizeDenominations(ownValue(root, 'denominations', 'El arqueo')),
    adjustments: normalizeAdjustments(ownValue(root, 'adjustments', 'Los ajustes')),
    authorizations: [...list(ownValue(root, 'authorizations', 'Las autorizaciones'), 'Las autorizaciones')],
    printable: Boolean(ownValue(root, 'printable', 'El indicador de impresión', { optional: true })),
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
