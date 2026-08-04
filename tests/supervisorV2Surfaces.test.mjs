// Supervisor V2 · SSR de las superficies puras (Hoy, Radar, Rutas, Pendientes)
// con los fixtures sintéticos del contrato #80. Verifica honestidad de datos
// (null≠0, unknown≠incumplimiento), banners de demo y estados degradados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import { fileURLToPath } from 'node:url'
// Contrato canónico del harness en main: { Component, mod, cleanup } + ruta
// ABSOLUTA. `loadView` adapta las cargas de este archivo a ese contrato.
const loadView = async (rel) => (
  await loadJsxDefault(fileURLToPath(new URL('../' + rel, import.meta.url)))
).Component
import { DAY_CONTROL_FIXTURE, RADAR_FIXTURE, DAY_CONTROL_FIXTURE_DEGRADED } from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import { ROUTE_STOPS_FIXTURE } from '../src/modules/supervisor-ventas/v2/fixtures/routeStops.fixture.js'
import { derivePendientes, deriveSituation, deriveFreshness } from '../src/modules/supervisor-ventas/v2/presentation.js'
import { buildSelectedPlanPoints } from '../src/modules/supervisor-ventas/v2/radar/radarSelection.js'

const NOW = Date.parse('2026-01-15T15:20:00Z')
const HoyView = await loadView('src/modules/supervisor-ventas/v2/hoy/HoyView.jsx')
const RadarView = await loadView('src/modules/supervisor-ventas/v2/radar/RadarView.jsx')
const RutasView = await loadView('src/modules/supervisor-ventas/v2/rutas/RutasView.jsx')
const RutaDetalle = await loadView('src/modules/supervisor-ventas/v2/rutas/RutaDetalle.jsx')
const PendientesView = await loadView('src/modules/supervisor-ventas/v2/pendientes/PendientesView.jsx')
const render = (C, props) => renderToStaticMarkup(createElement(C, props))
const radarTabSource = readFileSync(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/tabs/RadarTab.jsx', import.meta.url)), 'utf8')
const radarTrailHookSource = readFileSync(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/radar/useRadarTrail.js', import.meta.url)), 'utf8')

const TWO_PLAN_RADAR = {
  ...RADAR_FIXTURE,
  units: [
    {
      plan_id: 902,
      route_name: 'Ruta Sierra',
      name: 'Ana Sierra',
      vehicle: { name: 'Unidad S-2' },
      latitude: 18.4,
      longitude: -99.6,
      age_seconds: 900,
      signal_status: 'delayed',
      stops: {
        planned: [{ stop_id: 9021, name: 'Cliente Sierra', latitude: 18.41, longitude: -99.61, done: false }],
        planned_total: 1,
        done: 0,
        missing_coordinates: 0,
      },
    },
    {
      plan_id: 901,
      route_name: 'Ruta Costa',
      name: 'Beto Costa',
      vehicle: { name: 'Unidad C-1' },
      latitude: 18.5,
      longitude: -99.7,
      age_seconds: 120,
      signal_status: 'recent',
      stops: {
        planned: [{ stop_id: 9011, name: 'Cliente Costa', latitude: 18.51, longitude: -99.71, done: true }],
        planned_total: 1,
        done: 1,
        missing_coordinates: 0,
      },
    },
  ],
}

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
test('Radar muestra el selector Plan diario con los planes en el orden crudo', () => {
  const html = render(RadarView, { radar: TWO_PLAN_RADAR, source: 'live', selectedId: null, nowMs: NOW })
  assert.match(html, /Plan diario/)
  assert.match(html, /data-testid="radar-plan-select"/)
  assert.match(html, /Ruta Sierra · Ana Sierra · Unidad S-2/)
  assert.match(html, /Ruta Costa · Beto Costa · Unidad C-1/)
  assert.match(html, /<option value="902" selected="">Ruta Sierra · Ana Sierra · Unidad S-2<\/option>/)
})
test('Radar conserva la selección diaria válida y recupera el primer plan crudo ante una selección obsoleta', () => {
  const selected = render(RadarView, { radar: TWO_PLAN_RADAR, source: 'live', selectedId: 901, nowMs: NOW })
  const stale = render(RadarView, { radar: TWO_PLAN_RADAR, source: 'live', selectedId: 999, nowMs: NOW })
  assert.match(selected, /<option value="901" selected="">Ruta Costa · Beto Costa · Unidad C-1<\/option>/)
  assert.match(stale, /<option value="902" selected="">Ruta Sierra · Ana Sierra · Unidad S-2<\/option>/)
})
test('Radar entrega al mapa exclusivamente la geometría del plan diario activo', () => {
  assert.deepEqual(buildSelectedPlanPoints(TWO_PLAN_RADAR, 901, NOW), [
    { id: 901, lat: 18.5, lng: -99.7, kind: 'unit', label: 'Ruta Costa' },
    { id: 'stop:9011', lat: 18.51, lng: -99.71, kind: 'stop_done', label: 'Cliente Costa' },
  ])
})
test('Radar no expone filas con plan_id inválido como seleccionables', () => {
  const radar = { ...RADAR_FIXTURE, units: [{ ...RADAR_FIXTURE.units[0], plan_id: 0 }] }
  const html = render(RadarView, { radar, source: 'live', nowMs: NOW, onSelectUnit: () => {} })
  assert.match(html, /radar-unit-row/)
  assert.doesNotMatch(html, /data-testid="radar-unit-row" role="button"/)
})
test('Radar carga el rastro con el plan resuelto y la fecha operativa del day-control', () => {
  assert.match(radarTabSource, /resolveActivePlanId\(day\.radar\?\.units, selectedId\)/)
  assert.match(radarTabSource, /const operationalDate = day\.dayControl\?\.date/)
  assert.match(radarTabSource, /useRadarTrail\(activePlanId, operationalDate\)/)
  assert.doesNotMatch(radarTabSource, /getUnitTrack/)
})
test('Radar limpia y protege el rastro al cambiar plan o fecha', () => {
  assert.match(radarTrailHookSource, /createRadarTrailRequest\(planId, operationalDate\)/)
  assert.match(radarTrailHookSource, /loadTrack\(request\.planId, request\.operationalDate\)/)
  assert.match(radarTrailHookSource, /applyRadarTrailResponse\(prev, request\.key, response\)/)
  assert.match(radarTrailHookSource, /applyRadarTrailError\(prev, request\.key\)/)
  assert.match(radarTrailHookSource, /selectRadarTrail\(state, planId, operationalDate\)/)
})
test('Radar conserva mapa y lista base si el rastro falla', () => {
  const html = render(RadarView, {
    radar: RADAR_FIXTURE,
    dayControl: DAY_CONTROL_FIXTURE,
    source: 'live',
    nowMs: NOW,
    trail: [],
    trailStatus: 'error',
  })
  assert.match(html, /data-trail-status="error"/)
  assert.match(html, /data-testid="radar-map"/)
  assert.match(html, /data-testid="radar-list"/)
  assert.match(html, /Ruta Demo/)
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
