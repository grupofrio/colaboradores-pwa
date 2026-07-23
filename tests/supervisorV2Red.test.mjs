// Supervisor V2 · batería de la corrección RED (Codex): validación de
// coordenadas, clasificación explícita de respuestas (malformed / DATE_NOT_ALLOWED
// / unauthorized), estados degradados homogéneos, accesibilidad (button real).
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import {
  isValidLat, isValidLng, isValidLatLng, validPoints, computeBounds,
} from '../src/modules/supervisor-ventas/v2/radar/mapProjection.js'
import {
  PHASE, loadRouteStops, loadOperationalDay, sourceVersion, routeStopsCacheKey,
} from '../src/modules/supervisor-ventas/v2/dataSources.js'
import { normalizeSupervisorV2Response } from '../src/modules/supervisor-ventas/v2/normalizeResponse.js'

const render = (C, props) => renderToStaticMarkup(createElement(C, props))

// ── Coordenadas (P12) ────────────────────────────────────────────────────────
test('coords: rango, NaN, Infinity', () => {
  assert.equal(isValidLat(19.4), true)
  assert.equal(isValidLat(90.1), false)
  assert.equal(isValidLat(-91), false)
  assert.equal(isValidLat(NaN), false)
  assert.equal(isValidLat(Infinity), false)
  assert.equal(isValidLng(-180), true)
  assert.equal(isValidLng(181), false)
  assert.equal(isValidLatLng({ lat: 10, lng: -35 }), true)
  assert.equal(isValidLatLng({ lat: '10', lng: -35 }), false) // string ≠ número
})
test('validPoints filtra inválidos; computeBounds marca anti-meridiano', () => {
  const pts = [{ lat: 10, lng: -35 }, { lat: NaN, lng: 0 }, { lat: 200, lng: 0 }]
  assert.equal(validPoints(pts).length, 1)
  const anti = computeBounds([{ lat: 0, lng: 179 }, { lat: 0, lng: -179 }])
  assert.equal(anti.antimeridian, true)
  const normal = computeBounds([{ lat: 10, lng: -35 }])
  assert.equal(normal.antimeridian, false) // punto único, bbox no degenerado
})

// ── PositionMap SSR (mapa vial NO; a11y de marcadores) ───────────────────────
const PositionMap = await loadJsxDefault('src/modules/supervisor-ventas/v2/radar/PositionMap.jsx')
test('PositionMap: coords inválidas ⇒ nota (lista), no crash', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: NaN, lng: 0, kind: 'unit' }], height: 200 })
  assert.match(html, /v2-position-map-empty/)
})
test('PositionMap: anti-meridiano ⇒ prefiere lista', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: 0, lng: 179, kind: 'unit' }, { id: 2, lat: 0, lng: -179, kind: 'unit' }], onSelect: () => {}, height: 200 })
  assert.match(html, /v2-position-map-empty/)
  assert.match(html, /línea de fecha/)
})
test('PositionMap: marcador clicable es role=button + tabindex (teclado)', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: 10, lng: -35, kind: 'unit', label: 'R1' }], onSelect: () => {}, height: 200 })
  assert.match(html, /role="button"/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /no es mapa vial/) // se declara vista geoespacial
})

// ── Normalizador único (§4) — ENVELOPES REALES ───────────────────────────────
test('normalizeSupervisorV2Response: envelope de servicio real {status,code,data}', () => {
  assert.equal(normalizeSupervisorV2Response({ status: 'ok', code: 'OK', data: { stops: [] } }).phase, PHASE.OK)
  assert.equal(normalizeSupervisorV2Response({ status: 'error', code: 'DATE_NOT_ALLOWED', user_message: 'x' }).phase, PHASE.DATE_NOT_ALLOWED)
  assert.equal(normalizeSupervisorV2Response({ status: 'error', code: 'FORBIDDEN' }).phase, PHASE.UNAUTHORIZED)
  assert.equal(normalizeSupervisorV2Response({ status: 'error', code: 'FEATURE_DISABLED' }).phase, PHASE.FEATURE_DISABLED)
  assert.equal(normalizeSupervisorV2Response({ status: 'busy', code: 'LOCKED' }).phase, PHASE.CONFLICT)
  assert.equal(normalizeSupervisorV2Response({ status: 'error', code: 'CONFLICT' }).phase, PHASE.CONFLICT)
})
test('normalizeSupervisorV2Response: payload crudo day-control {ok:true|false}', () => {
  assert.equal(normalizeSupervisorV2Response({ ok: true, contract: 'x', generated_at: '2026-01-15 15:05:00' }).phase, PHASE.OK)
  assert.equal(normalizeSupervisorV2Response({ ok: false, code: 'DATE_NOT_ALLOWED' }).phase, PHASE.DATE_NOT_ALLOWED)
})
test('normalizeSupervisorV2Response: throw y forma inesperada', () => {
  const e = new Error('nope'); e.code = 'DATE_NOT_ALLOWED'
  assert.equal(normalizeSupervisorV2Response(null, e).phase, PHASE.DATE_NOT_ALLOWED)
  assert.equal(normalizeSupervisorV2Response(null, { message: 'Failed to fetch' }).phase, PHASE.NETWORK)
  assert.equal(normalizeSupervisorV2Response({ weird: 1 }).phase, PHASE.MALFORMED)
})
test('loadRouteStops: envelope real ⇒ malformed ≠ empty; empty real; denied', async () => {
  const svcOk = (stops) => ({ status: 'ok', code: 'OK', data: { stops, data_as_of: '2026-01-15T15:05:00Z' } })
  const okR = await loadRouteStops(5101, { fetch: async () => svcOk([{ stop_id: 1 }]) })
  assert.equal(okR.phase, PHASE.OK)
  assert.equal(okR.dataAsOf, '2026-01-15T15:05:00Z')
  const empty = await loadRouteStops(5101, { fetch: async () => svcOk([]) })
  assert.equal(empty.phase, PHASE.EMPTY)
  const notList = await loadRouteStops(5101, { fetch: async () => svcOk('x') })
  assert.equal(notList.phase, PHASE.MALFORMED)
  const partial = await loadRouteStops(5101, { fetch: async () => svcOk([{ stop_id: 1 }, { junk: 1 }]) })
  assert.equal(partial.phase, PHASE.MALFORMED) // alguna malformada ⇒ NO vacío
  assert.equal(partial.partial, true)
  assert.equal(partial.stops.length, 1) // conserva la válida
  const denied = await loadRouteStops(5101, { fetch: async () => ({ status: 'error', code: 'FORBIDDEN' }) })
  assert.equal(denied.phase, PHASE.UNAUTHORIZED)
  const badId = await loadRouteStops(0)
  assert.equal(badId.phase, PHASE.VALIDATION)
})
test('loadOperationalDay: DATE_NOT_ALLOWED es fase propia (no falso vacío)', async () => {
  const r = await loadOperationalDay({
    fetchDayControl: async () => ({ ok: false, code: 'DATE_NOT_ALLOWED' }),
    fetchRadar: async () => null,
  })
  assert.equal(r.ok, false)
  assert.equal(r.phase, PHASE.DATE_NOT_ALLOWED)
})
test('routeStopsCacheKey incluye fecha+sucursal+plan+generated_at', () => {
  const k = routeStopsCacheKey({ dayControl: { date: '2026-01-15', branch: { branch_config_id: 2001 }, generated_at: 'g1' }, planId: 5101 })
  assert.match(k, /2026-01-15/); assert.match(k, /2001/); assert.match(k, /5101/); assert.match(k, /g1/)
})
test('sourceVersion incluye fecha+sucursal+generated_at', () => {
  const v = sourceVersion({ date: '2026-01-15', branch: { branch_config_id: 2001 }, generated_at: '2026-01-15 15:05:00' })
  assert.match(v, /2026-01-15/)
  assert.match(v, /2001/)
})

// ── RowButton (a11y) ─────────────────────────────────────────────────────────
const RowButton = await loadJsxDefault('src/modules/supervisor-ventas/v2/components/RowButton.jsx')
test('RowButton: onClick ⇒ <button> real; sin onClick ⇒ <div> inerte', () => {
  const btn = render(RowButton, { onClick: () => {}, ariaLabel: 'abrir', children: 'x' })
  assert.match(btn, /<button/)
  assert.match(btn, /aria-label="abrir"/)
  const div = render(RowButton, { children: 'x' })
  assert.doesNotMatch(div, /<button/)
})

// ── DayStateGate (P14 homogéneo) ─────────────────────────────────────────────
const DayStateGate = await loadJsxDefault('src/modules/supervisor-ventas/v2/dayStateGate.jsx')
test('DayStateGate: date_not_allowed ⇒ estado explícito', () => {
  const html = render(DayStateGate, { day: { status: 'date_not_allowed' } })
  assert.match(html, /v2-date-not-allowed/)
  assert.match(html, /Fecha no permitida/)
})
test('DayStateGate: error ⇒ reintentar; loading ⇒ neutral', () => {
  assert.match(render(DayStateGate, { day: { status: 'error', error: 'x', reload: () => {} } }), /Reintentar/)
  assert.match(render(DayStateGate, { day: { status: 'loading' } }), /Cargando/)
})
