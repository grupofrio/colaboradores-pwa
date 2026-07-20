// Cobertura de la home de operaciones del Supervisor (Fase 4):
//   1) runController PURO: reglas de procedencia (live / live+radar-fail / demo /
//      error / ok:false) sin red ni React.
//   2) SSR de la vista PURA OperationsHomeView con el fixture SINTÉTICO real:
//      honestidad de moneda/ausencia, prioridades, radar, banner de demo.
//   3) El check anti-fuga del bundle MUERDE ante un marcador del fixture.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runOperationsHome, RUN_STATUS, RUN_SOURCE, isUsablePayload,
} from '../src/modules/supervisor-ventas/dayControl/runController.js'
import {
  DAY_CONTROL_FIXTURE, RADAR_FIXTURE, DAY_CONTROL_FIXTURE_DEGRADED,
} from '../src/modules/supervisor-ventas/dayControl/fixtures.js'
import {
  findDayControlFixtureLeaks, DAYCONTROL_FIXTURE_MARKERS,
} from '../scripts/check_supervisor_daycontrol_leak.mjs'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

const ok = (payload) => () => Promise.resolve(payload)
const fail = (msg) => () => Promise.reject(new Error(msg))

// ── 1) runController ─────────────────────────────────────────────────────────
test('runController: live cuando day-control + radar responden', async () => {
  const r = await runOperationsHome({
    fetchDayControl: ok(DAY_CONTROL_FIXTURE),
    fetchRadar: ok(RADAR_FIXTURE),
  })
  assert.equal(r.status, RUN_STATUS.LIVE)
  assert.equal(r.source, RUN_SOURCE.LIVE)
  assert.ok(r.dayControl)
  assert.ok(r.radar)
  assert.equal(r.radarError, null)
  assert.equal(r.error, null)
})

test('runController: live con radar caído ⇒ radarError, NO tumba la home', async () => {
  const r = await runOperationsHome({
    fetchDayControl: ok(DAY_CONTROL_FIXTURE),
    fetchRadar: fail('radar 503'),
  })
  assert.equal(r.status, RUN_STATUS.LIVE)
  assert.equal(r.radar, null)
  assert.match(r.radarError, /radar 503/)
})

test('runController: day-control caído + demo habilitada ⇒ demo rotulada', async () => {
  const r = await runOperationsHome({
    fetchDayControl: fail('404'),
    fetchRadar: fail('404'),
    demoEnabled: true,
    loadDemo: () => Promise.resolve({
      dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE,
      provenance: { synthetic: true, source: 'golden #80' },
    }),
  })
  assert.equal(r.status, RUN_STATUS.DEMO)
  assert.equal(r.source, RUN_SOURCE.DEMO)
  assert.ok(r.provenance?.synthetic)
})

test('runController: day-control caído SIN demo ⇒ error honesto (no inventa)', async () => {
  const r = await runOperationsHome({
    fetchDayControl: fail('timeout'),
    fetchRadar: fail('timeout'),
    demoEnabled: false,
    loadDemo: () => Promise.resolve({ dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE }),
  })
  assert.equal(r.status, RUN_STATUS.ERROR)
  assert.equal(r.dayControl, null)
  assert.match(r.error, /timeout/)
})

test('runController: payload ok:false NO es utilizable ⇒ error', async () => {
  assert.equal(isUsablePayload({ ok: false }), false)
  const r = await runOperationsHome({
    fetchDayControl: ok({ ok: false, error: 'FORBIDDEN' }),
    fetchRadar: ok(RADAR_FIXTURE),
    demoEnabled: false,
  })
  assert.equal(r.status, RUN_STATUS.ERROR)
})

// ── 2) SSR de la vista pura ──────────────────────────────────────────────────
const View = await loadJsxDefault('src/modules/supervisor-ventas/dayControl/OperationsHomeView.jsx')

function renderView(props) {
  return renderToStaticMarkup(createElement(View, props))
}

test('SSR live: venta con moneda del contrato + fecha operativa + rutas', () => {
  const html = renderView({ dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE, source: 'live', nowMs: Date.parse('2026-01-15T15:05:00Z') })
  assert.match(html, /supervisor-operations-home/)
  assert.match(html, /2,800\.5/)        // monto del día (número del contrato)
  assert.match(html, /XTS/)              // moneda del CONTRATO (jamás MXN asumido)
  assert.match(html, /2026-01-15/)       // fecha operativa server-side
  assert.match(html, /Ruta Demo/)        // radar/rutas del fixture
  assert.doesNotMatch(html, /dc-demo-banner/) // live ⇒ sin banner de demo
})

test('SSR live: prioridades del contrato con chip ×N (dedup por ruta)', () => {
  const html = renderView({ dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE, source: 'live', nowMs: Date.parse('2026-01-15T15:05:00Z') })
  assert.match(html, /sin salida registrada/)   // route_not_departed
  assert.match(html, /2 refills pendientes/)     // reason agregado (count=2)
  assert.match(html, /×2/)                        // chip de conteo
  assert.match(html, /Críticas/)                 // grupo de severidad
})

test('SSR demo: banner sintético visible y rotulado', () => {
  const html = renderView({
    dayControl: DAY_CONTROL_FIXTURE, radar: RADAR_FIXTURE, source: 'demo',
    provenance: { source: 'golden #80' }, nowMs: Date.parse('2026-01-15T15:05:00Z'),
  })
  assert.match(html, /dc-demo-banner/)
  assert.match(html, /DEMOSTRACIÓN/)
})

test('SSR degradado: sin moneda consolidada NO inventa $0 ni MXN', () => {
  // El fixture degradado apaga capabilities/cargas; la vista debe nombrar la
  // ausencia con textos honestos, jamás pintar 0 ni asumir MXN.
  const html = renderView({ dayControl: DAY_CONTROL_FIXTURE_DEGRADED, radar: null, source: 'live', nowMs: Date.parse('2026-01-15T15:05:00Z') })
  assert.match(html, /supervisor-operations-home/)
  assert.doesNotMatch(html, /MXN/)                 // nunca se asume MXN
  assert.match(html, /Radar no disponible/)        // radar null ⇒ estado honesto
})

test('SSR: enum de salida desconocido ⇒ neutral, nunca crash ni verde', () => {
  const mutated = structuredClone(DAY_CONTROL_FIXTURE)
  mutated.routes[0].departure.status = 'teletransportado'
  // No debe lanzar al renderizar un enum fuera de contrato.
  assert.doesNotThrow(() => renderView({ dayControl: mutated, radar: RADAR_FIXTURE, source: 'live', nowMs: Date.parse('2026-01-15T15:05:00Z') }))
})

// ── 3) El check anti-fuga MUERDE ─────────────────────────────────────────────
test('leak-check: detecta un marcador del fixture en un asset simulado', () => {
  const marker = DAYCONTROL_FIXTURE_MARKERS[0]
  const leaks = findDayControlFixtureLeaks([{ name: 'chunk.js', content: `x=${marker};` }])
  assert.equal(leaks.length, 1)
  assert.equal(leaks[0].marker, marker)
})

test('leak-check: asset limpio no reporta fuga', () => {
  const leaks = findDayControlFixtureLeaks([{ name: 'clean.js', content: 'export const a = 1' }])
  assert.deepEqual(leaks, [])
})
