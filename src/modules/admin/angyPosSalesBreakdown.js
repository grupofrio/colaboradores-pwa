const LOAD_ERROR_MESSAGE = 'No se pudo cargar el desglose POS'
const MEXICO_TIME_ZONE = 'America/Mexico_City'
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return year >= 1
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysPerMonth[month - 1]
}

export function isAngelicaJaimesSession(session = {}) {
  const source = [
    session?.name,
    session?.display_name,
    session?.employee?.name,
  ].filter(Boolean).join(' ')
  const tokens = source
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter(Boolean)

  return tokens.includes('angelica') && tokens.includes('jaimes')
}

export function getMexicoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return `${byType.year}-${byType.month}-${byType.day}`
}

export function isSelectableSalesDate(value, today = getMexicoDateKey()) {
  return isCalendarDate(value) && isCalendarDate(today) && value <= today
}

export function normalizePosProductBreakdown(response) {
  if (response?.ok === false) {
    throw new Error(response.message || response.error || LOAD_ERROR_MESSAGE)
  }

  const data = response?.data ?? response ?? {}
  const rawProducts = Array.isArray(data.products) ? data.products : []
  const products = rawProducts.map((rawProduct) => {
    const product = rawProduct ?? {}

    return {
      productId: toFiniteNumber(product.product_id),
      sku: String(product.sku || ''),
      productName: String(product.product_name || 'Producto'),
      quantity: toFiniteNumber(product.quantity),
      amountTotal: toFiniteNumber(product.amount_total),
      weightPerUnitKg: toFiniteNumber(product.weight_per_unit_kg),
      weightTotalKg: toFiniteNumber(product.weight_total_kg),
      weightConfigured: product.weight_configured === true,
    }
  })

  const rawTotals = data.product_totals
  const hasBackendTotals = rawTotals !== null
    && typeof rawTotals === 'object'
    && !Array.isArray(rawTotals)
  const totals = hasBackendTotals
    ? {
        quantity: toFiniteNumber(rawTotals.quantity),
        amountTotal: toFiniteNumber(rawTotals.amount_total),
        weightTotalKg: toFiniteNumber(rawTotals.weight_total_kg),
        productsWithoutWeight: toFiniteNumber(rawTotals.products_without_weight),
      }
    : products.reduce((result, product) => ({
        quantity: result.quantity + product.quantity,
        amountTotal: result.amountTotal + product.amountTotal,
        weightTotalKg: result.weightTotalKg
          + (product.weightConfigured ? product.weightTotalKg : 0),
        productsWithoutWeight: result.productsWithoutWeight
          + (product.weightConfigured ? 0 : 1),
      }), {
        quantity: 0,
        amountTotal: 0,
        weightTotalKg: 0,
        productsWithoutWeight: 0,
      })

  return {
    date: String(data.date || ''),
    products,
    totals,
  }
}

export function createInitialBreakdownState(date = getMexicoDateKey()) {
  return {
    loading: true,
    error: '',
    result: normalizePosProductBreakdown({
      date,
      products: [],
    }),
  }
}

export function breakdownStateReducer(state, action = {}) {
  if (action.type === 'loading') {
    return {
      loading: true,
      error: '',
      result: state.result,
    }
  }

  if (action.type === 'success') {
    return {
      loading: false,
      error: '',
      result: action.result,
    }
  }

  if (action.type === 'error') {
    return {
      loading: false,
      error: action.message || action.error?.message || action.error || LOAD_ERROR_MESSAGE,
      result: state.result,
    }
  }

  return state
}

export function createLatestRequestTracker() {
  let latestRequestId = 0

  return {
    begin() {
      latestRequestId += 1
      return latestRequestId
    },
    isCurrent(requestId) {
      return latestRequestId > 0 && requestId === latestRequestId
    },
  }
}

export async function loadPosProductBreakdown({
  warehouseId,
  companyId,
  date,
  fetchSales,
}) {
  const response = await fetchSales({ warehouseId, companyId, date })
  return normalizePosProductBreakdown(response)
}
