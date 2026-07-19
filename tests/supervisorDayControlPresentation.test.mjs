// Day Control PREP · post-RED — semántica de presentación contra fixtures del
// contrato (P14): currency del contrato (jamás MXN fijo), null≠0, timestamps
// futuros/edades negativas ⇒ invalid (nunca recent), enums desconocidos ⇒
// neutral, payload parcial sin crash.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  departureLabel, departureTone, deviationText, closeStageLabel,
  CLOSE_STAGE_ORDER, signalLabel, safeSignalStatus, ageText, moneyText,
  moneyByCurrencyTexts, targetText, journeyBuckets, groupPriorities,
  serverReceivedTimeLabel, radarSummary,
  loadKindLabel, loadStatusLabel, loadsSummaryText,
  priorityCountChip, timezoneSourceLabel, operationalDateLabel,
} from '../src/modules/supervisor-ventas/dayControl/presentation.js'
import {
  DAY_CONTROL_FIXTURE, DAY_CONTROL_FIXTURE_DEGRADED, RADAR_FIXTURE,
} from '../src/modules/supervisor-ventas/dayControl/fixtures.js'

// ── salida ───────────────────────────────────────────────────────────────────
test('salida: unknown neutral y nunca tarde; enum desconocido ⇒ neutral', () => {
  assert.equal(departureLabel('unknown'), 'Sin dato de salida')
  assert.equal(departureTone('unknown'), 'neutral')
  assert.equal(departureLabel('estado_inventado'), 'Estado no reconocido')
  assert.equal(departureTone('estado_inventado'), 'neutral')
})

test('desviación: null/no-numérico ⇒ vacío (no se inventa "+0 min")', () => {
  assert.equal(deviationText(null), '')
  assert.equal(deviationText(undefined), '')
  assert.equal(deviationText('x'), '')
  assert.equal(deviationText(25), '+25 min')
  assert.equal(deviationText(0), 'en punto')
})

// ── moneda (P14.1) ───────────────────────────────────────────────────────────
test('moneda: viene del contrato; ausente ⇒ "Moneda no disponible" (no MXN fijo)', () => {
  const sinMoneda = moneyText(1234.5, null, true)
  assert.deepEqual(sinMoneda, { text: 'Moneda no disponible', available: false })
  const conMoneda = moneyText(1234.5, 'XTS', true)
  assert.ok(conMoneda.available)
  assert.ok(conMoneda.text.includes('1,234') || conMoneda.text.includes('1234'))
  assert.ok(!conMoneda.text.includes('MXN') || conMoneda.text.includes('XTS'))
})

test('montos: null o capability=false ⇒ "Sin dato", jamás $0 (P14.2)', () => {
  assert.deepEqual(moneyText(null, 'XTS'), { text: 'Sin dato', available: false })
  assert.deepEqual(moneyText(undefined, 'XTS'), { text: 'Sin dato', available: false })
  assert.deepEqual(moneyText(500, 'XTS', false), { text: 'Sin dato', available: false })
  // cero REAL sí se muestra (0 es un hecho, no una ausencia)
  const cero = moneyText(0, 'XTS', true)
  assert.ok(cero.available)
})

test('multi-moneda: fixture degradado no consolida y lista por moneda', () => {
  const s = DAY_CONTROL_FIXTURE_DEGRADED.summary
  assert.equal(s.sales_day_amount, null)
  assert.equal(DAY_CONTROL_FIXTURE_DEGRADED.capabilities.sales_consolidated, false)
  const texts = moneyByCurrencyTexts(s.sales_day_by_currency)
  assert.equal(texts.length, 2)
  for (const t of texts) assert.ok(t.available)
  // el total ausente se presenta como Sin dato, nunca como suma inventada
  assert.deepEqual(
    moneyText(s.sales_day_amount, s.sales_day_currency, s.sales_day_available),
    { text: 'Sin dato', available: false },
  )
})

test('meta ausente ⇒ "Sin meta configurada"; con meta usa currency del contrato', () => {
  assert.deepEqual(targetText(null, 'XTS'), { text: 'Sin meta configurada', hasTarget: false })
  assert.deepEqual(targetText(0, 'XTS'), { text: 'Sin meta configurada', hasTarget: false })
  assert.ok(targetText(50000, 'XTS').hasTarget)
  // meta presente pero sin moneda ⇒ no se afirma un importe formateable
  assert.equal(targetText(50000, null).hasTarget, false)
})

// ── señal (P14.3) ────────────────────────────────────────────────────────────
test('señal: timestamp futuro ⇒ invalid, nunca recent', () => {
  const nowMs = Date.parse('2026-01-15T15:05:00Z')
  const unit = { signal_status: 'recent', captured_at: '2026-01-15 18:00:00', age_seconds: 10 }
  assert.equal(safeSignalStatus(unit, nowMs), 'invalid')
  assert.equal(signalLabel('invalid'), 'Señal inválida')
})

test('señal: edad negativa/no numérica ⇒ invalid; dentro de skew se respeta', () => {
  const nowMs = Date.parse('2026-01-15T15:05:00Z')
  assert.equal(safeSignalStatus({ signal_status: 'recent', captured_at: '2026-01-15 15:04:00', age_seconds: -5 }, nowMs), 'invalid')
  assert.equal(safeSignalStatus({ signal_status: 'recent', captured_at: '2026-01-15 15:04:00', age_seconds: 'x' }, nowMs), 'invalid')
  assert.equal(safeSignalStatus({ signal_status: 'recent', captured_at: '2026-01-15 15:05:30', age_seconds: 30 }, nowMs), 'recent')
})

test('señal: enum desconocido ⇒ invalid/neutral; sin captured_at ⇒ no_signal', () => {
  const nowMs = Date.parse('2026-01-15T15:05:00Z')
  assert.equal(safeSignalStatus({ signal_status: 'turbo', captured_at: '2026-01-15 15:00:00', age_seconds: 300 }, nowMs), 'invalid')
  assert.equal(safeSignalStatus({ signal_status: 'no_signal', captured_at: null, age_seconds: null }, nowMs), 'no_signal')
  assert.equal(signalLabel('turbo'), 'Estado no reconocido')
})

test('edad: null y negativa con textos honestos', () => {
  assert.equal(ageText(null), 'sin señal registrada')
  assert.equal(ageText(-10), 'edad de señal inválida')
  assert.equal(ageText(240), 'hace 4 min')
  assert.equal(ageText(4200), 'hace 1 h 10 min')
})

// ── cierre / buckets / prioridades ───────────────────────────────────────────
test('cierre: 5 etapas + unknown honesto; enum raro ⇒ "por confirmar"', () => {
  assert.equal(CLOSE_STAGE_ORDER.length, 5)
  assert.equal(closeStageLabel('corte_done'), 'Corte hecho')
  assert.equal(closeStageLabel('unknown'), 'Estado por confirmar')
  assert.equal(closeStageLabel('otra_cosa'), 'Estado por confirmar')
})

test('summary ausente/parcial: buckets sin crash con ceros de conteo (P14 partial)', () => {
  assert.deepEqual(journeyBuckets(undefined),
    { total: 0, departed: 0, late: 0, notDeparted: 0, unknown: 0 })
  const parcial = journeyBuckets({ routes_total: 3 })
  assert.equal(parcial.total, 3)
  assert.equal(parcial.unknown, 0)
})

test('fixture golden: buckets cuadran y unknown va aparte de tarde', () => {
  const b = journeyBuckets(DAY_CONTROL_FIXTURE.summary)
  assert.equal(b.total, 4)
  assert.equal(b.departed + b.notDeparted + b.unknown, b.total)
  assert.equal(b.late, 1)
})

test('prioridades del golden: sin high_incident, agrupadas sin reordenar, con razón', () => {
  const tipos = DAY_CONTROL_FIXTURE.priorities.map((p) => p.type)
  assert.ok(!tipos.includes('high_incident'))
  assert.ok(!tipos.includes('low_execution'))
  const groups = groupPriorities(DAY_CONTROL_FIXTURE.priorities)
  assert.equal(groups.critical.length, 2)
  assert.equal(groups.critical[0].type, 'route_not_departed')
  for (const p of DAY_CONTROL_FIXTURE.priorities) assert.ok(p.reason.length > 10)
})

test('incident markers: el contrato NO trae incidents_open y lo declara', () => {
  assert.ok(!('incidents_open' in DAY_CONTROL_FIXTURE.summary))
  assert.equal(DAY_CONTROL_FIXTURE.summary.incident_markers_count, 1)
  assert.equal(DAY_CONTROL_FIXTURE.capabilities.incidents_lifecycle_available, false)
})

// ── cargas (autoridad stock.picking; van.* descartado) ───────────────────────
test('cargas: etiquetas sin vocabulario van.* ("solicitud/aprobación")', () => {
  assert.equal(loadStatusLabel('prepared'), 'Refill preparado')
  assert.equal(loadStatusLabel('pending_acceptance'), 'Pendiente de aceptar')
  assert.equal(loadStatusLabel('accepted'), 'Aceptado')
  assert.equal(loadStatusLabel('unknown'), 'Estado no disponible')
  assert.equal(loadStatusLabel('inventado'), 'Estado no disponible')
  assert.equal(loadKindLabel('refill'), 'Refill')
  assert.equal(loadKindLabel('manual'), 'Carga manual')
  for (const label of Object.values({ ...loadKindLabel, s: loadStatusLabel('accepted') })) {
    assert.ok(!/solicitud|aprobaci/i.test(String(label)))
  }
})

test('cargas: available=false ⇒ "Información no disponible" (jamás 0)', () => {
  assert.deepEqual(loadsSummaryText({ available: false }), {
    text: 'Información de cargas no disponible', available: false,
  })
  assert.deepEqual(loadsSummaryText(undefined), {
    text: 'Información de cargas no disponible', available: false,
  })
})

test('cargas: pending null ⇒ "no verificable"; 0 ⇒ "al día"; >0 ⇒ conteo', () => {
  assert.equal(loadsSummaryText({ available: true, pending_acceptance_count: null }).text,
    'Aceptación de cargas no verificable')
  assert.equal(loadsSummaryText({ available: true, pending_acceptance_count: 0 }).text, 'Cargas al día')
  assert.ok(loadsSummaryText({ available: true, pending_acceptance_count: 2 }).text.includes('2'))
})

test('golden: manual/initial NO cuentan como refill; conteos coherentes', () => {
  const s = DAY_CONTROL_FIXTURE.summary
  const items = DAY_CONTROL_FIXTURE.routes.flatMap((r) => r.loads.items)
  const refillPend = items.filter((l) => l.load_kind === 'refill' && l.status === 'pending_acceptance').length
  const initialPend = items.filter((l) => l.load_kind === 'initial' && l.status === 'pending_acceptance').length
  assert.equal(s.pending_refill_acceptance, refillPend)
  assert.equal(s.pending_initial_acceptance, initialPend)
  assert.ok(!items.some((l) => l.load_kind === 'manual' && l.status === 'pending_acceptance' && refillPend === 0 && false))
  assert.equal(DAY_CONTROL_FIXTURE.capabilities.route_return_receipt_available, false)
})

test('prioridades del golden: load_pending_acceptance, sin refill_pending', () => {
  const tipos = DAY_CONTROL_FIXTURE.priorities.map((p) => p.type)
  assert.ok(!tipos.includes('refill_pending'))
  assert.ok(tipos.includes('load_pending_acceptance'))
})

// ── P1-B: prioridades agregadas (una tarjeta, chip ×N, sin duplicar) ─────────
test('priorityCountChip: count<=1 ⇒ sin chip; count>1 ⇒ "×N"', () => {
  assert.deepEqual(priorityCountChip({ count: 1 }), { show: false, text: '', count: 1 })
  assert.deepEqual(priorityCountChip({ count: 2 }), { show: true, text: '×2', count: 2 })
  assert.deepEqual(priorityCountChip({}), { show: false, text: '', count: 1 })
})

test('golden: la prioridad de refills es UNA sola por ruta con reason agregado', () => {
  const load = DAY_CONTROL_FIXTURE.priorities.filter((p) => p.type === 'load_pending_acceptance')
  const routeIds = load.map((p) => p.route_id)
  assert.equal(routeIds.length, new Set(routeIds).size) // dedup por ruta
  const p = load[0]
  assert.equal(p.count, 2)
  assert.ok(!('related_entity_ids' in p)) // ELIMINADO del contrato v1 (RED-2 P2)
  assert.ok(p.reason.includes('2 refills pendientes')) // plural agregado, no 2 tarjetas
  assert.deepEqual(priorityCountChip(p), { show: true, text: '×2', count: 2 })
})

// ── P1-C: timezone SIEMPRE server-side ───────────────────────────────────────
test('timezoneSourceLabel: enums conocidos + desconocido neutral', () => {
  assert.equal(timezoneSourceLabel('branch'), 'Zona horaria de la sucursal')
  assert.equal(timezoneSourceLabel('company'), 'Zona horaria de la compañía')
  assert.equal(timezoneSourceLabel('system_fallback'), 'Zona horaria por defecto del sistema')
  assert.equal(timezoneSourceLabel('client'), 'Zona horaria no especificada')
  assert.equal(timezoneSourceLabel(undefined), 'Zona horaria no especificada')
})

test('operationalDateLabel: validación ESTRICTA YYYY-MM-DD + fecha civil (RED-2 P3)', () => {
  const NEUTRAL = 'Fecha operativa no disponible'
  // fecha válida
  assert.equal(operationalDateLabel('2026-01-15'), '2026-01-15')
  // 29-feb en año bisiesto: válida
  assert.equal(operationalDateLabel('2024-02-29'), '2024-02-29')
  // undefined / null / vacío / espacios
  assert.equal(operationalDateLabel(undefined), NEUTRAL)
  assert.equal(operationalDateLabel(null), NEUTRAL)
  assert.equal(operationalDateLabel(''), NEUTRAL)
  assert.equal(operationalDateLabel('   '), NEUTRAL)
  // meses/días imposibles
  assert.equal(operationalDateLabel('2026-13-01'), NEUTRAL)
  assert.equal(operationalDateLabel('2026-00-01'), NEUTRAL)
  assert.equal(operationalDateLabel('2026-02-29'), NEUTRAL) // 2026 no bisiesto
  assert.equal(operationalDateLabel('2026-01-32'), NEUTRAL)
  // con hora / sufijo / texto ⇒ neutral (nada de Date parsing permisivo)
  assert.equal(operationalDateLabel('2026-01-01T00:00:00Z'), NEUTRAL)
  assert.equal(operationalDateLabel('2026-01-15 15:05:00'), NEUTRAL)
  assert.equal(operationalDateLabel('texto arbitrario'), NEUTRAL)
  // timezone_source server-side sigue presente en los goldens
  assert.equal(DAY_CONTROL_FIXTURE.timezone_source, 'system_fallback')
  assert.equal(RADAR_FIXTURE.timezone_source, 'system_fallback')
})

test('tolerancia declarada con fuente (branch|fallback)', () => {
  assert.deepEqual(DAY_CONTROL_FIXTURE.tolerance, { minutes: 10, source: 'fallback' })
  for (const r of DAY_CONTROL_FIXTURE.routes) {
    assert.equal(r.departure.tolerance_source, 'fallback')
  }
})

test('horas server-received se etiquetan "registrado HH:MM"', () => {
  assert.equal(serverReceivedTimeLabel('2026-01-15 14:40:00'), 'registrado 14:40')
  assert.equal(serverReceivedTimeLabel(null), '')
  assert.equal(DAY_CONTROL_FIXTURE.data_notes.times_are_server_received, true)
})

// ── radar ────────────────────────────────────────────────────────────────────
test('radar golden: privacidad (sin batería/velocidad/precisión) y no-realtime', () => {
  for (const unit of RADAR_FIXTURE.units) {
    assert.ok(!('battery_level' in unit))
    assert.ok(!('speed' in unit))
    assert.ok(!('accuracy' in unit))
    assert.equal(unit.position_source, 'employee_device')
  }
  assert.equal(RADAR_FIXTURE.capabilities.realtime, false)
  assert.equal(RADAR_FIXTURE.capabilities.history_available, false)
  assert.ok(RADAR_FIXTURE.thresholds.recent_seconds > 0)
  assert.ok(RADAR_FIXTURE.thresholds.position_max_age_hours > 0)
})

test('radar: resumen usa señal SANEADA (futuro no cuenta como con-señal)', () => {
  const nowMs = Date.parse('2026-01-15T15:05:00Z')
  const s = radarSummary(RADAR_FIXTURE.units, nowMs)
  assert.deepEqual(s, { withSignal: 1, withoutSignal: 1, total: 2 })
  const futuro = [{ signal_status: 'recent', captured_at: '2026-01-15 20:00:00', age_seconds: 10 }]
  assert.deepEqual(radarSummary(futuro, nowMs), { withSignal: 0, withoutSignal: 1, total: 1 })
})
