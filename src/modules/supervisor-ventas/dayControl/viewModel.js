import {
  CLOSE_STAGE_ORDER,
  ageText,
  closeStageLabel,
  departureLabel,
  departureTone,
  deviationText,
  journeyBuckets,
  loadKindLabel,
  loadsSummaryText,
  loadStatusLabel,
  moneyByCurrencyTexts,
  moneyText,
  operationalDateLabel,
  priorityCountChip,
  safeSignalStatus,
  serverReceivedTimeLabel,
  signalLabel,
  timezoneSourceLabel,
} from './presentation.js'

const PRIORITY_ROUTE_TYPES = Object.freeze([
  'route_not_departed',
  'gps_stale',
  'load_pending_acceptance',
])

const LOAD_KINDS = Object.freeze([
  'initial',
  'refill',
  'manual',
  'unknown',
])

const LOAD_STATUSES = Object.freeze([
  'prepared',
  'pending_acceptance',
  'accepted',
  'cancelled',
  'unknown',
])

const CAPABILITY_KEYS = Object.freeze([
  'routes_available',
  'sales_day_available',
  'sales_consolidated',
  'closure_cash_available',
  'positions_available',
  'incidents_lifecycle_available',
  'low_execution',
  'loads_available',
  'refill_classification_available',
  'load_acceptance_status_available',
  'route_return_receipt_available',
])

const QUICK_ACTIONS = Object.freeze([
  { label: 'Sin visitar', href: '/equipo/sin-visitar' },
  { label: 'Recuperación', href: '/equipo/recuperacion' },
  { label: 'Cierre', href: '/equipo/cierre' },
  { label: 'Pronóstico', href: '/equipo/pronostico' },
  { label: 'Clientes', href: '/equipo/clientes' },
])

const SAFE_ODOO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
const SAFE_ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/
const CANONICAL_OCCURRENCE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

function positiveIntegerId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const numeric = Number(value)
    return Number.isSafeInteger(numeric) ? numeric : null
  }
  return null
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonNegativeInteger(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null
}

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  const withoutUrls = value.replace(/https?:\/\/\S+/gi, '').trim()
  return withoutUrls || fallback
}

function safeCurrency(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
    ? value
    : null
}

function normalizeGeneratedAt(value) {
  if (typeof value !== 'string') return null
  const match = value.match(SAFE_ODOO_UTC_RE) || value.match(SAFE_ISO_UTC_RE)
  if (!match) return null

  const [, year, month, day, hour, minute, second] = match
  const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  const iso = value.includes(' ') ? `${base}Z` : value
  const instant = Date.parse(iso)
  if (!Number.isFinite(instant)) return null

  const normalized = new Date(instant).toISOString()
  if (normalized.slice(0, 19) !== base) return null
  return value.includes(' ') || !match[7] ? `${base}Z` : normalized
}

function safeServerReceivedTimeLabel(value) {
  const normalized = normalizeGeneratedAt(value)
  return normalized === null ? '' : serverReceivedTimeLabel(normalized)
}

function mapCapabilities(capabilities) {
  const source = capabilities || {}
  return Object.fromEntries(
    CAPABILITY_KEYS.map((key) => [key, source[key] === true]),
  )
}

function honestJourney(summary, available) {
  if (!available) {
    return {
      total: null,
      departed: null,
      late: null,
      notDeparted: null,
      unknown: null,
    }
  }

  const buckets = journeyBuckets(summary)
  return {
    total: nonNegativeInteger(summary?.routes_total) === null ? null : buckets.total,
    departed: nonNegativeInteger(summary?.departed) === null
      ? null
      : buckets.departed,
    late: nonNegativeInteger(summary?.departed_late) === null ? null : buckets.late,
    notDeparted: nonNegativeInteger(summary?.not_departed) === null
      ? null
      : buckets.notDeparted,
    unknown: nonNegativeInteger(summary?.departure_unknown) === null
      ? null
      : buckets.unknown,
  }
}

function moneyLines(entries, available) {
  if (!available || !Array.isArray(entries)) return []
  const normalized = entries.map((entry) => ({
    amount: finiteNumber(entry?.amount),
    currency: safeCurrency(entry?.currency),
  }))
  const texts = moneyByCurrencyTexts(normalized)
  return normalized.map((entry, index) => ({
    ...entry,
    ...texts[index],
  }))
}

function buildSales(summary, capabilities) {
  const available = capabilities.sales_day_available
    && summary?.sales_day_available === true
  const consolidated = capabilities.sales_consolidated
  const amount = finiteNumber(summary?.sales_day_amount)
  const currency = safeCurrency(summary?.sales_day_currency)
  const total = available && consolidated ? amount : null
  const formatted = moneyText(total, currency, available && consolidated)

  return {
    available,
    consolidated,
    total,
    currency: consolidated ? currency : null,
    text: formatted.text,
    formattedAvailable: formatted.available,
    lines: moneyLines(summary?.sales_day_by_currency, available && !consolidated),
  }
}

function buildVisits(summary, routesAvailable) {
  const done = routesAvailable ? nonNegativeInteger(summary?.stops_done) : null
  const total = routesAvailable ? nonNegativeInteger(summary?.stops_total) : null
  const available = done !== null && total !== null
  return {
    available,
    done: available ? done : null,
    total: available ? total : null,
    text: available ? `${done}/${total}` : 'Sin dato',
  }
}

function buildCash(summaryClose, capabilities) {
  const available = capabilities.closure_cash_available
  const amount = finiteNumber(summaryClose?.cash_pending_amount)
  const currency = safeCurrency(summaryClose?.cash_pending_currency)
  const rawLines = Array.isArray(summaryClose?.cash_pending_by_currency)
    ? summaryClose.cash_pending_by_currency
    : []
  const linesAreConsistent = rawLines.length === 0 || rawLines.every(
    (entry) => finiteNumber(entry?.amount) !== null
      && safeCurrency(entry?.currency) !== null
      && safeCurrency(entry.currency) === currency,
  )
  const consolidated = available
    && amount !== null
    && currency !== null
    && linesAreConsistent
  const total = consolidated ? amount : null
  const formatted = moneyText(total, currency, available && consolidated)

  return {
    available,
    consolidated,
    total,
    currency: consolidated ? currency : null,
    text: formatted.text,
    formattedAvailable: formatted.available,
    lines: moneyLines(rawLines, available && !consolidated),
  }
}

function mapLoadItem(item, capabilities) {
  const kind = capabilities.refill_classification_available
    ? (LOAD_KINDS.includes(item?.load_kind) ? item.load_kind : 'unknown')
    : null
  const status = capabilities.load_acceptance_status_available
    ? (LOAD_STATUSES.includes(item?.status) ? item.status : 'unknown')
    : null
  return {
    pickingId: positiveIntegerId(item?.picking_id),
    kind,
    kindLabel: loadKindLabel(kind || 'unknown'),
    status,
    statusLabel: loadStatusLabel(status || 'unknown'),
    pickingState: safeText(item?.picking_state, 'Estado no disponible'),
    createdAt: safeServerReceivedTimeLabel(item?.created_at),
    acceptedAt: capabilities.load_acceptance_status_available
      ? safeServerReceivedTimeLabel(item?.accepted_at)
      : '',
  }
}

function buildLoads(loads, capabilities) {
  const available = capabilities.loads_available && loads?.available === true
  const acceptanceAvailable = capabilities.load_acceptance_status_available
  const pending = available && acceptanceAvailable
    ? nonNegativeInteger(loads?.pending_acceptance_count)
    : null
  const summary = available && !acceptanceAvailable
    ? { text: 'Información de aceptación de cargas no disponible' }
    : loadsSummaryText(available
      ? { ...loads, pending_acceptance_count: pending }
      : { available: false })
  return {
    available,
    pending,
    text: summary.text,
    items: available && Array.isArray(loads?.items)
      ? loads.items.map((item) => mapLoadItem(item, capabilities))
      : [],
  }
}

function buildSignal(position, capabilities, nowMs) {
  if (!capabilities.positions_available) {
    return {
      available: false,
      status: null,
      label: 'Información de posición no disponible',
      age: null,
      capturedAt: '',
      isMoving: null,
    }
  }
  if (!position) {
    return {
      available: true,
      status: 'no_signal',
      label: signalLabel('no_signal'),
      age: ageText(null),
      capturedAt: '',
      isMoving: null,
    }
  }

  const capturedAt = position.captured_at == null
    ? null
    : normalizeGeneratedAt(position.captured_at)
  const signalStatus = position.signal_status
  const signalInput = capturedAt === null
    ? position
    : {
        ...position,
        captured_at: capturedAt.replace('T', ' ').replace(/Z$/, ''),
      }
  let status
  if (signalStatus === 'no_signal') {
    status = 'no_signal'
  } else if (capturedAt === null || !Number.isFinite(nowMs)) {
    status = 'invalid'
  } else {
    status = safeSignalStatus(signalInput, nowMs)
  }
  return {
    available: true,
    status,
    label: signalLabel(status),
    age: ageText(position.age_seconds),
    capturedAt: safeServerReceivedTimeLabel(capturedAt),
    isMoving: typeof position.is_moving === 'boolean' ? position.is_moving : null,
  }
}

function mapIncidentMarker(marker) {
  return {
    id: positiveIntegerId(marker?.incident_type_id),
    name: safeText(marker?.name, 'Marcador de incidencia'),
    type: safeText(marker?.type, 'unknown'),
    severity: safeText(marker?.severity, 'unknown'),
    requiresFollowUp: marker?.requires_follow_up === true,
    stopId: positiveIntegerId(marker?.stop_id),
    recordedAt: safeServerReceivedTimeLabel(marker?.recorded_at),
  }
}

function mapRoute(route, capabilities, nowMs) {
  const departureStatus = safeText(route?.departure?.status, 'unknown')
  const routeSalesAvailable = capabilities.sales_day_available
    && route?.sales?.available === true
  const routeSalesAmount = routeSalesAvailable
    ? finiteNumber(route?.sales?.day_amount)
    : null
  const routeSalesCurrency = safeCurrency(route?.sales?.currency)
  const routeSalesText = moneyText(
    routeSalesAmount,
    routeSalesCurrency,
    routeSalesAvailable,
  )
  const closeStage = safeText(route?.close?.stage, 'unknown')

  return {
    planId: positiveIntegerId(route?.plan_id),
    name: safeText(route?.route_name, 'Ruta sin nombre'),
    date: operationalDateLabel(route?.route_date),
    state: safeText(route?.state, 'unknown'),
    driver: {
      employeeId: positiveIntegerId(route?.driver?.employee_id),
      name: safeText(route?.driver?.name, 'Responsable no disponible'),
    },
    vehicle: {
      id: positiveIntegerId(route?.vehicle?.id),
      name: safeText(route?.vehicle?.name, 'Unidad no disponible'),
    },
    departure: {
      targetAt: finiteNumber(route?.departure?.target_at),
      realAt: safeServerReceivedTimeLabel(route?.departure?.real_at),
      deviationMinutes: finiteNumber(route?.departure?.deviation_minutes),
      deviation: deviationText(route?.departure?.deviation_minutes),
      status: departureStatus,
      label: departureLabel(departureStatus),
      tone: departureTone(departureStatus),
      toleranceMinutes: nonNegativeInteger(route?.departure?.tolerance_minutes),
      toleranceSource: safeText(route?.departure?.tolerance_source, 'unknown'),
    },
    stops: {
      total: nonNegativeInteger(route?.stops?.total),
      done: nonNegativeInteger(route?.stops?.done),
      pending: nonNegativeInteger(route?.stops?.pending),
      progressPct: finiteNumber(route?.stops?.progress_pct),
      nextStop: route?.stops?.next_stop
        ? {
            id: positiveIntegerId(route.stops.next_stop.stop_id),
            sequence: nonNegativeInteger(route.stops.next_stop.sequence),
            name: safeText(route.stops.next_stop.name, 'Parada sin nombre'),
          }
        : null,
    },
    sales: {
      available: routeSalesAvailable,
      total: routeSalesAmount,
      currency: routeSalesCurrency,
      text: routeSalesText.text,
      formattedAvailable: routeSalesText.available,
    },
    incidentMarkers: Array.isArray(route?.incident_markers)
      ? route.incident_markers.map(mapIncidentMarker)
      : [],
    signal: buildSignal(route?.position, capabilities, nowMs),
    loads: buildLoads(route?.loads, capabilities),
    close: {
      stage: closeStage,
      label: closeStageLabel(closeStage),
    },
    href: routeDetailHref(route),
  }
}

function mapPriority(priority, routes) {
  const rawCount = nonNegativeInteger(priority?.count)
  const count = rawCount !== null && rawCount > 0 ? rawCount : null
  return {
    type: safeText(priority?.type, 'unknown'),
    severity: ['critical', 'warning', 'info'].includes(priority?.severity)
      ? priority.severity
      : 'info',
    reason: safeText(priority?.reason, 'Prioridad sin detalle'),
    count,
    countChip: count === null
      ? { show: false, text: '', count: null }
      : priorityCountChip({ count }),
    occurredAt: typeof priority?.occurred_at === 'string'
      && CANONICAL_OCCURRENCE_RE.test(priority.occurred_at)
      && normalizeGeneratedAt(priority.occurred_at) === priority.occurred_at
      ? priority.occurred_at
      : null,
    dataAsOf: safeServerReceivedTimeLabel(priority?.data_as_of),
    href: resolvePriorityAction(priority, routes),
  }
}

function comparableCount(payload, key) {
  if (payload?.capabilities?.routes_available !== true) return null
  return nonNegativeInteger(payload?.summary?.[key])
}

function compareNumbers(today, yesterday) {
  const available = today !== null && yesterday !== null
  return {
    available,
    today: available ? today : null,
    yesterday: available ? yesterday : null,
    delta: available ? today - yesterday : null,
  }
}

function comparableSales(payload) {
  const available = payload?.capabilities?.sales_day_available === true
    && payload?.capabilities?.sales_consolidated === true
    && payload?.summary?.sales_day_available === true
  const amount = available ? finiteNumber(payload?.summary?.sales_day_amount) : null
  const currency = available ? safeCurrency(payload?.summary?.sales_day_currency) : null
  return amount !== null && currency !== null ? { amount, currency } : null
}

export function routeDetailHref(route) {
  const employeeId = positiveIntegerId(route?.driver?.employee_id)
  const planId = positiveIntegerId(route?.plan_id)
  return employeeId !== null && planId !== null
    ? `/equipo/vendedor/${employeeId}?route_id=${planId}`
    : null
}

export function resolvePriorityAction(priority, routes) {
  if (priority?.type === 'closure_pending') return '/equipo/cierre'
  if (!PRIORITY_ROUTE_TYPES.includes(priority?.type)) return null
  const routeId = positiveIntegerId(priority?.route_id)
  if (routeId === null || !Array.isArray(routes)) return null
  const route = routes.find(
    (item) => positiveIntegerId(item?.plan_id) === routeId,
  )
  return routeDetailHref(route)
}

export function compareDailyMetrics(todayPayload, yesterdayPayload) {
  const todaySales = comparableSales(todayPayload)
  const yesterdaySales = comparableSales(yesterdayPayload)
  const salesAvailable = todaySales !== null
    && yesterdaySales !== null
    && todaySales.currency === yesterdaySales.currency

  return {
    sales: {
      available: salesAvailable,
      today: salesAvailable ? todaySales.amount : null,
      yesterday: salesAvailable ? yesterdaySales.amount : null,
      delta: salesAvailable ? todaySales.amount - yesterdaySales.amount : null,
      currency: salesAvailable ? todaySales.currency : null,
    },
    routes: compareNumbers(
      comparableCount(todayPayload, 'routes_total'),
      comparableCount(yesterdayPayload, 'routes_total'),
    ),
    visitsDone: compareNumbers(
      comparableCount(todayPayload, 'stops_done'),
      comparableCount(yesterdayPayload, 'stops_done'),
    ),
    visitsTotal: compareNumbers(
      comparableCount(todayPayload, 'stops_total'),
      comparableCount(yesterdayPayload, 'stops_total'),
    ),
  }
}

export function buildDayControlViewModel(payload) {
  const source = payload || {}
  const summary = source.summary || {}
  const summaryClose = summary.close || {}
  const capabilities = mapCapabilities(source.capabilities)
  const routesSource = capabilities.routes_available && Array.isArray(source.routes)
    ? source.routes
    : []
  const dataAsOf = normalizeGeneratedAt(source.generated_at)
  const nowMs = dataAsOf === null ? null : Date.parse(dataAsOf)

  return {
    header: {
      branch: safeText(source.branch?.name, 'Sucursal no disponible'),
      date: operationalDateLabel(source.date),
      timezone: safeText(source.timezone, 'Zona horaria no disponible'),
      timezoneSource: timezoneSourceLabel(source.timezone_source),
      dataAsOf,
      tolerance: {
        minutes: nonNegativeInteger(source.tolerance?.minutes),
        source: safeText(source.tolerance?.source, 'unknown'),
      },
      counters: {
        positionsInvalid: nonNegativeInteger(source.counters?.positions_invalid),
        positionsOutOfWindow: nonNegativeInteger(
          source.counters?.positions_out_of_window,
        ),
      },
    },
    capabilities,
    journey: honestJourney(summary, capabilities.routes_available),
    priorities: capabilities.routes_available
      ? (Array.isArray(source.priorities) ? source.priorities : [])
        .slice(0, 5)
        .map((priority) => mapPriority(priority, routesSource))
      : [],
    routes: routesSource.map((route) => mapRoute(route, capabilities, nowMs)),
    commercial: {
      sales: buildSales(summary, capabilities),
      visits: buildVisits(summary, capabilities.routes_available),
    },
    closure: {
      stages: CLOSE_STAGE_ORDER.map((key) => ({
        key,
        label: closeStageLabel(key),
        count: capabilities.routes_available
          ? nonNegativeInteger(summaryClose[key])
          : null,
      })),
      unknown: {
        label: closeStageLabel('unknown'),
        count: capabilities.routes_available
          ? nonNegativeInteger(summaryClose.unknown)
          : null,
      },
      cash: buildCash(summaryClose, capabilities),
      systemReconciliationNote: 'Validada significa conciliación de sistema.',
    },
    quickActions: QUICK_ACTIONS.map((action) => ({ ...action })),
  }
}
