import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDayControlViewModel,
  compareDailyMetrics,
  resolvePriorityAction,
  routeDetailHref,
} from '../src/modules/supervisor-ventas/dayControl/viewModel.js'
import {
  DAY_CONTROL_FIXTURE,
  DAY_CONTROL_FIXTURE_DEGRADED,
} from '../src/modules/supervisor-ventas/dayControl/fixtures.js'

test('construye jornada, venta, visitas y cinco etapas desde el golden', () => {
  const view = buildDayControlViewModel(DAY_CONTROL_FIXTURE)

  assert.deepEqual(view.journey, {
    total: 4,
    departed: 3,
    late: 1,
    notDeparted: 1,
    unknown: 0,
  })
  assert.equal(view.routes.length, 4)
  assert.equal(view.commercial.sales.total, 2800.5)
  assert.equal(view.commercial.visits.text, '11/29')
  assert.equal(view.closure.stages.length, 5)
  assert.equal(view.closure.stages[0].key, 'open')
})

test('unknown permanece neutral y no suma tarde', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.summary.departed_late = 0
  payload.summary.departure_unknown = 1

  const view = buildDayControlViewModel(payload)

  assert.equal(view.journey.late, 0)
  assert.equal(view.journey.unknown, 1)
})

test('multi-moneda se desglosa y no produce consolidado de ventas', () => {
  const view = buildDayControlViewModel(DAY_CONTROL_FIXTURE_DEGRADED)

  assert.equal(view.commercial.sales.available, true)
  assert.equal(view.commercial.sales.consolidated, false)
  assert.equal(view.commercial.sales.lines.length, 2)
  assert.equal(view.commercial.sales.total, null)
})

test('caja multi-moneda se desglosa sin inventar total', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE_DEGRADED)
  payload.capabilities.closure_cash_available = true
  payload.summary.close.cash_pending_by_currency = [
    { currency: 'XTS', amount: 750 },
    { currency: 'XXX', amount: 125 },
  ]

  const cash = buildDayControlViewModel(payload).closure.cash

  assert.equal(cash.available, true)
  assert.equal(cash.consolidated, false)
  assert.equal(cash.lines.length, 2)
  assert.equal(cash.total, null)
})

test('caja no consolida líneas ambiguas y conserva moneda desconocida neutral', () => {
  const differentCurrency = structuredClone(DAY_CONTROL_FIXTURE)
  differentCurrency.summary.close.cash_pending_by_currency = [
    { currency: 'XXX', amount: 125 },
  ]

  const differentCash = buildDayControlViewModel(differentCurrency).closure.cash
  assert.equal(differentCash.consolidated, false)
  assert.equal(differentCash.total, null)
  assert.deepEqual(
    differentCash.lines.map(({ amount, currency }) => ({ amount, currency })),
    [{ amount: 125, currency: 'XXX' }],
  )

  const unknownCurrency = structuredClone(DAY_CONTROL_FIXTURE)
  unknownCurrency.summary.close.cash_pending_by_currency = [
    { currency: null, amount: 90 },
  ]

  const unknownCash = buildDayControlViewModel(unknownCurrency).closure.cash
  assert.equal(unknownCash.consolidated, false)
  assert.equal(unknownCash.total, null)
  assert.equal(unknownCash.lines.length, 1)
  assert.equal(unknownCash.lines[0].currency, null)
  assert.equal(unknownCash.lines[0].text, 'Moneda no disponible')
})

test('comparación de venta exige disponibilidad, consolidación y misma moneda', () => {
  const today = structuredClone(DAY_CONTROL_FIXTURE)
  const yesterday = structuredClone(DAY_CONTROL_FIXTURE)
  yesterday.summary.sales_day_amount = 1000

  const differentCurrency = structuredClone(yesterday)
  differentCurrency.summary.sales_day_currency = 'USD'
  const unconsolidated = structuredClone(DAY_CONTROL_FIXTURE_DEGRADED)
  const nullAmount = structuredClone(yesterday)
  nullAmount.summary.sales_day_amount = null
  const summaryUnavailable = structuredClone(yesterday)
  summaryUnavailable.summary.sales_day_available = false
  const capabilityUnavailable = structuredClone(yesterday)
  capabilityUnavailable.capabilities.sales_day_available = false

  assert.equal(compareDailyMetrics(today, yesterday).sales.available, true)
  assert.equal(compareDailyMetrics(today, differentCurrency).sales.available, false)
  assert.equal(compareDailyMetrics(today, unconsolidated).sales.available, false)
  assert.equal(compareDailyMetrics(today, nullAmount).sales.available, false)
  assert.equal(compareDailyMetrics(today, summaryUnavailable).sales.available, false)
  assert.equal(compareDailyMetrics(today, capabilityUnavailable).sales.available, false)
})

test('comparación expone solo métricas diarias compatibles', () => {
  const comparison = compareDailyMetrics(
    DAY_CONTROL_FIXTURE,
    DAY_CONTROL_FIXTURE,
  )

  assert.deepEqual(Object.keys(comparison).sort(), [
    'routes',
    'sales',
    'visitsDone',
    'visitsTotal',
  ])
  assert.deepEqual(comparison.routes, {
    available: true,
    today: 4,
    yesterday: 4,
    delta: 0,
  })
  assert.ok(!('generatedAt' in comparison))
  assert.ok(!('positions' in comparison))
  assert.ok(!('monthlySales' in comparison))
})

test('routeDetailHref exige employee_id y plan_id enteros positivos', () => {
  assert.equal(
    routeDetailHref(DAY_CONTROL_FIXTURE.routes[0]),
    '/equipo/vendedor/1001?route_id=5101',
  )

  for (const route of [
    null,
    {},
    { plan_id: 1, driver: {} },
    { plan_id: 0, driver: { employee_id: 1 } },
    { plan_id: -1, driver: { employee_id: 1 } },
    { plan_id: 1.5, driver: { employee_id: 1 } },
    { plan_id: Number.MAX_SAFE_INTEGER + 1, driver: { employee_id: 1 } },
    { plan_id: 1, driver: { employee_id: 'no-id' } },
  ]) {
    assert.equal(routeDetailHref(route), null)
  }
})

test('resolvePriorityAction aplica allowlist y solo abre rutas encontradas', () => {
  const routes = DAY_CONTROL_FIXTURE.routes

  assert.equal(resolvePriorityAction({ type: 'closure_pending' }, routes), '/equipo/cierre')
  for (const type of ['route_not_departed', 'gps_stale', 'load_pending_acceptance']) {
    assert.equal(
      resolvePriorityAction({ type, route_id: 5102 }, routes),
      '/equipo/vendedor/1002?route_id=5102',
    )
    assert.equal(resolvePriorityAction({ type, route_id: 999999 }, routes), null)
  }
  assert.equal(resolvePriorityAction({ type: 'tipo_nuevo', route_id: 5102 }, routes), null)
  assert.equal(resolvePriorityAction(null, routes), null)
})

test('routes capability apagada oculta prioridades sin cambiar resolver standalone', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.capabilities.routes_available = false

  assert.deepEqual(buildDayControlViewModel(payload).priorities, [])
  assert.equal(
    resolvePriorityAction(
      { type: 'route_not_departed', route_id: 5102 },
      DAY_CONTROL_FIXTURE.routes,
    ),
    '/equipo/vendedor/1002?route_id=5102',
  )
  assert.equal(
    resolvePriorityAction({ type: 'closure_pending' }, []),
    '/equipo/cierre',
  )
})

test('capabilities apagadas conservan ausencia y no inventan ceros', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.capabilities.routes_available = false
  payload.capabilities.sales_day_available = false
  payload.capabilities.closure_cash_available = false
  payload.summary.sales_day_amount = null
  payload.summary.sales_day_available = false
  payload.summary.close.cash_pending_amount = null
  payload.summary.close.cash_pending_currency = null

  const view = buildDayControlViewModel(payload)

  assert.deepEqual(view.journey, {
    total: null,
    departed: null,
    late: null,
    notDeparted: null,
    unknown: null,
  })
  assert.equal(view.commercial.visits.total, null)
  assert.equal(view.commercial.visits.done, null)
  assert.equal(view.commercial.sales.available, false)
  assert.equal(view.commercial.sales.total, null)
  assert.equal(view.closure.cash.available, false)
  assert.equal(view.closure.cash.total, null)
})

test('cargas respetan disponibilidad y null sin presentarlos como cero', () => {
  const available = buildDayControlViewModel(DAY_CONTROL_FIXTURE)
  const degraded = buildDayControlViewModel(DAY_CONTROL_FIXTURE_DEGRADED)

  assert.equal(available.routes[1].loads.available, true)
  assert.equal(available.routes[1].loads.pending, 2)
  assert.equal(available.routes[1].loads.items.length, 2)
  assert.equal(degraded.routes[0].loads.available, false)
  assert.equal(degraded.routes[0].loads.pending, null)
  assert.match(degraded.routes[0].loads.text, /no disponible/i)
})

test('classification capability apagada oculta kind sin ocultar items de carga', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.capabilities.refill_classification_available = false

  const loads = buildDayControlViewModel(payload).routes[1].loads

  assert.equal(loads.available, true)
  assert.equal(loads.items.length, 2)
  for (const item of loads.items) {
    assert.equal(item.kind, null)
    assert.equal(item.kindLabel, 'Tipo no disponible')
    assert.ok(!/refill|manual|initial/.test(JSON.stringify(item)))
  }
})

test('acceptance capability apagada oculta count, estados y acceptedAt', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.capabilities.load_acceptance_status_available = false

  const routes = buildDayControlViewModel(payload).routes
  const pendingLoads = routes[1].loads
  const acceptedItem = routes[0].loads.items[0]

  assert.equal(pendingLoads.available, true)
  assert.equal(pendingLoads.pending, null)
  assert.equal(
    pendingLoads.text,
    'Información de aceptación de cargas no disponible',
  )
  for (const item of [...pendingLoads.items, acceptedItem]) {
    assert.equal(item.status, null)
    assert.equal(item.statusLabel, 'Estado no disponible')
    assert.equal(item.acceptedAt, '')
    assert.ok(!Object.values(item).includes('pending_acceptance'))
    assert.ok(!Object.values(item).includes('accepted'))
  }
})

test('enums inválidos de carga se normalizan a unknown con labels neutrales', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes[0].loads.items[0].load_kind = 'kind_inventado'
  payload.routes[0].loads.items[0].status = 'status_inventado'

  const item = buildDayControlViewModel(payload).routes[0].loads.items[0]

  assert.equal(item.kind, 'unknown')
  assert.equal(item.kindLabel, 'Tipo no disponible')
  assert.equal(item.status, 'unknown')
  assert.equal(item.statusLabel, 'Estado no disponible')
  assert.ok(!JSON.stringify(item).includes('inventado'))
})

test('señal inválida es neutral y posiciones no disponibles conservan ausencia', () => {
  const invalidSignal = structuredClone(DAY_CONTROL_FIXTURE)
  invalidSignal.routes[0].position.age_seconds = -1
  const invalidView = buildDayControlViewModel(invalidSignal)
  assert.equal(invalidView.routes[0].signal.status, 'invalid')
  assert.equal(invalidView.routes[0].signal.label, 'Señal inválida')

  const noPositions = structuredClone(DAY_CONTROL_FIXTURE)
  noPositions.capabilities.positions_available = false
  const unavailableView = buildDayControlViewModel(noPositions)
  assert.equal(unavailableView.routes[0].signal.available, false)
  assert.equal(unavailableView.routes[0].signal.status, null)
})

test('captured_at malformado invalida señal y timestamps seguros conservan hora', () => {
  const malformed = structuredClone(DAY_CONTROL_FIXTURE)
  malformed.routes[0].position.captured_at = 'timestamp inválido 12:34'
  malformed.routes[0].position.signal_status = 'recent'
  malformed.routes[0].position.age_seconds = 10

  const malformedSignal = buildDayControlViewModel(malformed).routes[0].signal
  assert.equal(malformedSignal.status, 'invalid')
  assert.equal(malformedSignal.label, 'Señal inválida')
  assert.equal(malformedSignal.capturedAt, '')

  const naiveSignal = buildDayControlViewModel(DAY_CONTROL_FIXTURE).routes[0].signal
  assert.equal(naiveSignal.capturedAt, 'registrado 15:01')

  const canonical = structuredClone(DAY_CONTROL_FIXTURE)
  canonical.routes[0].position.captured_at = '2026-01-15T15:01:00Z'
  const canonicalSignal = buildDayControlViewModel(canonical).routes[0].signal
  assert.equal(canonicalSignal.status, 'recent')
  assert.equal(canonicalSignal.capturedAt, 'registrado 15:01')
})

test('señal recent exige captura y reloj servidor válidos; no_signal permanece neutral', () => {
  const missingCapturedAt = structuredClone(DAY_CONTROL_FIXTURE)
  missingCapturedAt.routes[0].position.captured_at = null
  missingCapturedAt.routes[0].position.signal_status = 'recent'
  assert.equal(
    buildDayControlViewModel(missingCapturedAt).routes[0].signal.status,
    'invalid',
  )

  const invalidServerClock = structuredClone(DAY_CONTROL_FIXTURE)
  invalidServerClock.generated_at = 'reloj servidor inválido'
  invalidServerClock.routes[0].position.signal_status = 'recent'
  assert.equal(
    buildDayControlViewModel(invalidServerClock).routes[0].signal.status,
    'invalid',
  )

  const noSignal = structuredClone(DAY_CONTROL_FIXTURE)
  noSignal.generated_at = 'reloj servidor inválido'
  noSignal.routes[0].position.captured_at = null
  noSignal.routes[0].position.signal_status = 'no_signal'
  const noSignalView = buildDayControlViewModel(noSignal).routes[0].signal
  assert.equal(noSignalView.status, 'no_signal')
  assert.equal(noSignalView.label, 'Sin señal')
})

test('timestamps nested inválidos no producen labels parciales ni occurredAt', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes[0].loads.items[0].created_at = '2026-01-15 88:77:00'
  payload.routes[0].loads.items[0].accepted_at = 'not-a-timestamp'
  payload.routes[1].incident_markers[0].recorded_at = '2026-02-30 12:00:00'
  payload.routes[0].departure.real_at = '2026-01-15 77:66:00'
  payload.priorities[0].data_as_of = 'not-a-timestamp 88:77'
  payload.priorities[0].occurred_at = '2026-02-30T12:00:00Z'

  const view = buildDayControlViewModel(payload)
  const load = view.routes[0].loads.items[0]

  assert.equal(load.createdAt, '')
  assert.equal(load.acceptedAt, '')
  assert.equal(view.routes[1].incidentMarkers[0].recordedAt, '')
  assert.equal(view.routes[0].departure.realAt, '')
  assert.equal(view.priorities[0].dataAsOf, '')
  assert.equal(view.priorities[0].occurredAt, null)
})

test('freshness normaliza solo ISO válido o naive Odoo UTC seguro', () => {
  const canonical = structuredClone(DAY_CONTROL_FIXTURE)
  canonical.generated_at = '2026-01-15T15:05:00Z'
  assert.equal(
    buildDayControlViewModel(canonical).header.dataAsOf,
    '2026-01-15T15:05:00Z',
  )

  assert.equal(
    buildDayControlViewModel(DAY_CONTROL_FIXTURE).header.dataAsOf,
    '2026-01-15T15:05:00Z',
  )

  for (const generatedAt of [
    null,
    '',
    '2026-02-30 15:05:00',
    '2026-01-15 25:05:00',
    'texto arbitrario',
  ]) {
    const payload = structuredClone(DAY_CONTROL_FIXTURE)
    payload.generated_at = generatedAt
    assert.equal(buildDayControlViewModel(payload).header.dataAsOf, null)
  }
})

test('conteos negativos o fraccionarios quedan null y no son comparables', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.tolerance.minutes = -1
  payload.counters.positions_invalid = -1
  payload.counters.positions_out_of_window = 1.5
  payload.summary.routes_total = -1
  payload.summary.departed = 1.5
  payload.summary.departed_late = -1
  payload.summary.not_departed = 2.5
  payload.summary.departure_unknown = -1
  payload.summary.stops_done = -1
  payload.summary.stops_total = 2.5
  payload.summary.close.open = -1
  payload.summary.close.closed = 1.5
  payload.summary.close.unknown = -1
  payload.routes[0].departure.tolerance_minutes = -1
  payload.routes[0].stops.total = -1
  payload.routes[0].stops.done = 1.5
  payload.routes[0].stops.pending = -1
  payload.routes[0].stops.next_stop.sequence = 1.5
  payload.routes[0].loads.pending_acceptance_count = -1
  payload.priorities[0].count = -1

  const view = buildDayControlViewModel(payload)

  assert.deepEqual(view.journey, {
    total: null,
    departed: null,
    late: null,
    notDeparted: null,
    unknown: null,
  })
  assert.equal(view.commercial.visits.available, false)
  assert.equal(view.commercial.visits.done, null)
  assert.equal(view.commercial.visits.total, null)
  assert.equal(view.header.tolerance.minutes, null)
  assert.equal(view.header.counters.positionsInvalid, null)
  assert.equal(view.header.counters.positionsOutOfWindow, null)
  assert.equal(view.closure.stages[0].count, null)
  assert.equal(view.closure.stages[1].count, null)
  assert.equal(view.closure.unknown.count, null)
  assert.equal(view.routes[0].departure.toleranceMinutes, null)
  assert.equal(view.routes[0].stops.total, null)
  assert.equal(view.routes[0].stops.done, null)
  assert.equal(view.routes[0].stops.pending, null)
  assert.equal(view.routes[0].stops.nextStop.sequence, null)
  assert.equal(view.routes[0].loads.pending, null)
  assert.equal(view.priorities[0].count, null)
  assert.equal(compareDailyMetrics(payload, DAY_CONTROL_FIXTURE).routes.available, false)
  assert.equal(compareDailyMetrics(payload, DAY_CONTROL_FIXTURE).visitsDone.available, false)
  assert.equal(compareDailyMetrics(payload, DAY_CONTROL_FIXTURE).visitsTotal.available, false)
})

test('view model excluye coordenadas y no produce URLs http', () => {
  const serialized = JSON.stringify(buildDayControlViewModel(DAY_CONTROL_FIXTURE))

  assert.ok(!serialized.includes('latitude'))
  assert.ok(!serialized.includes('longitude'))
  assert.ok(!serialized.includes('http://'))
  assert.ok(!serialized.includes('https://'))
})

test('prioridades se limitan a cinco sin reordenar y conservan chip agregado', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.priorities = Array.from({ length: 6 }, (_, index) => ({
    ...payload.priorities[index % payload.priorities.length],
    reason: `Prioridad ${index + 1}`,
  }))

  const priorities = buildDayControlViewModel(payload).priorities

  assert.equal(priorities.length, 5)
  assert.deepEqual(
    priorities.map((priority) => priority.reason),
    ['Prioridad 1', 'Prioridad 2', 'Prioridad 3', 'Prioridad 4', 'Prioridad 5'],
  )
  const aggregated = buildDayControlViewModel(DAY_CONTROL_FIXTURE)
    .priorities.find((priority) => priority.type === 'load_pending_acceptance')
  assert.deepEqual(aggregated.countChip, { show: true, text: '×2', count: 2 })
})

test('acciones rápidas son una allowlist fija de rutas internas existentes', () => {
  assert.deepEqual(
    buildDayControlViewModel(DAY_CONTROL_FIXTURE)
      .quickActions.map((action) => action.href),
    [
      '/equipo/sin-visitar',
      '/equipo/recuperacion',
      '/equipo/cierre',
      '/equipo/pronostico',
      '/equipo/clientes',
    ],
  )
})
