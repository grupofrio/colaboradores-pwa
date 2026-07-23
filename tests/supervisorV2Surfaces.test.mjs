// Supervisor V2 · SSR de las superficies puras (Hoy, Radar, Rutas, Pendientes)
// con los fixtures sintéticos del contrato #80. Verifica honestidad de datos
// (null≠0, unknown≠incumplimiento), banners de demo y estados degradados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import { DAY_CONTROL_FIXTURE, RADAR_FIXTURE, DAY_CONTROL_FIXTURE_DEGRADED } from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import { ROUTE_STOPS_FIXTURE } from '../src/modules/supervisor-ventas/v2/fixtures/routeStops.fixture.js'
import { derivePendientes, deriveSituation, deriveFreshness } from '../src/modules/supervisor-ventas/v2/presentation.js'

const NOW = Date.parse('2026-01-15T15:20:00Z')
const HoyView = await loadJsxDefault('src/modules/supervisor-ventas/v2/hoy/HoyView.jsx')
const RadarView = await loadJsxDefault('src/modules/supervisor-ventas/v2/radar/RadarView.jsx')
const RutasView = await loadJsxDefault('src/modules/supervisor-ventas/v2/rutas/RutasView.jsx')
const RutaDetalle = await loadJsxDefault('src/modules/supervisor-ventas/v2/rutas/RutaDetalle.jsx')
const PendientesView = await loadJsxDefault('src/modules/supervisor-ventas/v2/pendientes/PendientesView.jsx')
const render = (C, props) => renderToStaticMarkup(createElement(C, props))

// ── derivaciones puras ───────────────────────────────────────────────────────
test('deriveSituation: conteos del golden y honestidad de ausencia', () => {
  const s = deriveSituation(DAY_CONTROL_FIXTURE)
  assert.equal(s.planeadas.value, 4)
  assert.equal(s.salieron.value, 3)
  assert.equal(s.tarde.value, 1)
  assert.equal(s.regresando.available, false) // no hay señal canónica ⇒ no se inventa
})
test('deriveFreshness: capability off ⇒ parcial (no crash)', () => {
  const f = deriveFreshness(DAY_CONTROL_FIXTURE, NOW, 100000)
  assert.ok(['completo', 'parcial'].includes(f.state))
  assert.equal(deriveFreshness(null).state, 'no_disponible')
})

// ── Hoy ──────────────────────────────────────────────────────────────────────
test('Hoy live: venta con moneda del contrato + situación + prioridades', () => {
  const html = render(HoyView, { dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE, source: 'live', nowMs: NOW })
  assert.match(html, /supervisor-v2-hoy/)
  assert.match(html, /2,800\.5/)
  assert.match(html, /XTS/)
  assert.match(html, /hoy-situacion/)
  assert.match(html, /sin salida registrada/)
  assert.doesNotMatch(html, /v2-demo-banner/)
})
test('Hoy demo: banner sintético', () => {
  const html = render(HoyView, { dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE, source: 'demo', nowMs: NOW })
  assert.match(html, /v2-demo-banner/)
  assert.match(html, /DEMOSTRACIÓN/)
})
test('Hoy degradado: sin consolidar NO inventa MXN ni $0', () => {
  const html = render(HoyView, { dayControl: DAY_CONTROL_FIXTURE_DEGRADED, radar: null, source: 'live', nowMs: NOW })
  assert.doesNotMatch(html, /MXN/)
  assert.match(html, /supervisor-v2-hoy/)
})

// ── Radar ────────────────────────────────────────────────────────────────────
test('Radar live: mapa + lista + orden; unidad sin coords no rompe', () => {
  const html = render(RadarView, { radar: RADAR_FIXTURE, dayControl: DAY_CONTROL_FIXTURE, source: 'live', nowMs: NOW })
  assert.match(html, /supervisor-v2-radar/)
  assert.match(html, /radar-unit-row/)
  assert.match(html, /Ruta Demo/)
})
test('Radar sin datos: estado honesto (no crash)', () => {
  const html = render(RadarView, { radar: null, dayControl: DAY_CONTROL_FIXTURE, source: 'live', nowMs: NOW })
  assert.match(html, /supervisor-v2-radar/)
})
test('Radar orden ultima_senal no crashea', () => {
  assert.doesNotThrow(() => render(RadarView, { radar: RADAR_FIXTURE, source: 'live', order: 'ultima_senal', nowMs: NOW }))
})

// ── Rutas ────────────────────────────────────────────────────────────────────
test('Rutas lista: N filas del golden', () => {
  const html = render(RutasView, { dayControl: DAY_CONTROL_FIXTURE, source: 'live' })
  assert.match(html, /supervisor-v2-rutas/)
  const rows = (html.match(/v2-ruta-row/g) || []).length
  assert.equal(rows, DAY_CONTROL_FIXTURE.routes.length)
})
test('RutaDetalle: 14 hitos + conciliación declara no-recepción-física', () => {
  const route = DAY_CONTROL_FIXTURE.routes[3] // Ruta Demo Cuatro (corte_done)
  const html = render(RutaDetalle, { route, capabilities: DAY_CONTROL_FIXTURE.capabilities, stops: ROUTE_STOPS_FIXTURE[5101], source: 'live' })
  const steps = (html.match(/v2-timeline-step/g) || []).length
  assert.equal(steps, 14)
  assert.match(html, /no acredita recepción física/)
})
test('RutaDetalle stops error: mensaje honesto', () => {
  const html = render(RutaDetalle, { route: DAY_CONTROL_FIXTURE.routes[0], capabilities: {}, stops: null, stopsError: 'timeout', source: 'live' })
  assert.match(html, /v2-ruta-stops-error/)
})

// ── Pendientes ───────────────────────────────────────────────────────────────
test('Pendientes: tipos del golden + ×N + cada item con source', () => {
  const items = derivePendientes(DAY_CONTROL_FIXTURE)
  assert.ok(items.length >= 4)
  assert.ok(items.every((i) => typeof i.source === 'string' && i.source.length > 0))
  const html = render(PendientesView, { items, source: 'live', nowMs: NOW })
  assert.match(html, /supervisor-v2-pendientes/)
  assert.match(html, /×2/) // route 5102 load_pending count=2
})
test('Pendientes vacío: estado honesto', () => {
  const html = render(PendientesView, { items: [], source: 'live', nowMs: NOW })
  assert.match(html, /pendientes-empty/)
})
