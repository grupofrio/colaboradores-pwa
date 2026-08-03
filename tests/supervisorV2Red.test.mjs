// Supervisor V2 · batería de la corrección RED (Codex): validación de
// coordenadas, clasificación explícita de respuestas (malformed / DATE_NOT_ALLOWED
// / unauthorized), estados degradados homogéneos, accesibilidad (button real).
import test from 'node:test'
import assert from 'node:assert/strict'
import TestRenderer, { act } from 'react-test-renderer'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
// Contrato canónico del harness en main: { Component, mod, cleanup } + ruta
// ABSOLUTA. `loadView` adapta las cargas de este archivo a ese contrato.
const loadView = async (rel) => (
  await loadJsxDefault(fileURLToPath(new URL('../' + rel, import.meta.url)))
).Component
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

// ── PositionMap SSR + contrato Leaflet ───────────────────────────────────────
const PositionMap = await loadView('src/modules/supervisor-ventas/v2/radar/PositionMap.jsx')
const positionMapSource = await readFile(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/radar/PositionMap.jsx', import.meta.url)), 'utf8')
const leafletPositionMapSource = await readFile(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx', import.meta.url)), 'utf8')
test('PositionMap: coords inválidas ⇒ nota (lista), no crash', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: NaN, lng: 0, kind: 'unit' }], height: 200 })
  assert.match(html, /v2-position-map-empty/)
})
test('PositionMap: anti-meridiano ⇒ prefiere lista', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: 0, lng: 179, kind: 'unit' }, { id: 2, lat: 0, lng: -179, kind: 'unit' }], onSelect: () => {}, height: 200 })
  assert.match(html, /v2-position-map-empty/)
  assert.match(html, /línea de fecha/)
})
test('PositionMap: CEDIS se excluye antes de calcular geometría del mapa', () => {
  const cedisOnly = render(PositionMap, { points: [{ id: 'cedis:1', lat: 19.4, lng: -99.1, kind: 'cedis' }], height: 200 })
  assert.match(cedisOnly, /v2-position-map-empty/)
  const unitWithDistantCedis = render(PositionMap, {
    points: [
      { id: 1, lat: 19.4, lng: 179, kind: 'unit' },
      { id: 'cedis:1', lat: 19.4, lng: -179, kind: 'cedis' },
    ],
    height: 200,
  })
  assert.doesNotMatch(unitWithDistantCedis, /línea de fecha/)
})
test('PositionMap: SSR válido conserva un fallback accesible, sin afirmar calles visibles', () => {
  const html = render(PositionMap, { points: [{ id: 1, lat: 10, lng: -35, kind: 'unit', label: 'R1' }], onSelect: () => {}, height: 200 })
  assert.match(html, /data-testid="v2-position-map"/)
  assert.match(html, /últimas posiciones conocidas/i)
  assert.doesNotMatch(html, /calles visibles/i)
})
test('PositionMap: conserva width y backdropUrl para los callers del SVG previo', () => {
  assert.match(positionMapSource, /height = 300, backdropUrl = null, width = 640, testid = 'v2-position-map'/)
  assert.match(positionMapSource, /backdropUrl=\{backdropUrl\} width=\{width\}/)
  assert.match(leafletPositionMapSource, /backdropUrl/)
  assert.match(leafletPositionMapSource, /backdropUrl se conserva como no-op/i)
  assert.match(leafletPositionMapSource, /width: width === 640 \? '100%' : width/)
})
test('PositionMap: wrapper carga Leaflet de forma diferida y el hijo define el contrato vial', () => {
  assert.doesNotMatch(positionMapSource, /^\s*import[\s\S]*?from\s+['"](?:react-leaflet|leaflet|leaflet\/dist\/leaflet\.css)['"]/m)
  assert.match(positionMapSource, /lazy\(\(\)\s*=>\s*import\(['"]\.\/LeafletPositionMap\.jsx['"]\)\)/)
  assert.match(leafletPositionMapSource, /import\s*{\s*MapContainer,\s*TileLayer,\s*CircleMarker,\s*Marker,\s*Polyline,\s*Tooltip,\s*useMap\s*}\s*from\s*['"]react-leaflet['"]/) ;
  assert.match(leafletPositionMapSource, /import\s*{\s*divIcon\s*}\s*from\s*['"]leaflet['"]/) ;
  assert.match(leafletPositionMapSource, /import\s*['"]leaflet\/dist\/leaflet\.css['"]/) ;
  assert.match(leafletPositionMapSource, /https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/)
  assert.match(leafletPositionMapSource, /OpenStreetMap/)
  assert.match(leafletPositionMapSource, /if \(!UNIT_STYLES\[point\.kind\]\) return null/)
  assert.match(leafletPositionMapSource, /event\.originalEvent\?\.preventDefault\?\.\(\)/)
})
test('PositionMap: el mapa no obtiene ni persiste datos y declara últimas posiciones, no seguimiento vivo', () => {
  const source = `${positionMapSource}\n${leafletPositionMapSource}`
  assert.doesNotMatch(source, /\b(fetch|localStorage|sessionStorage|indexedDB|POST|PUT|PATCH|DELETE)\b/i)
  assert.match(source, /posiciones conocidas/i)
  assert.doesNotMatch(source, /seguimiento en vivo|rastreo en vivo|posiciones en vivo/i)
})

test('PositionMap: el rastro GPS válido se pasa como una Polyline y amplía la geometría sin crear marcadores', () => {
  assert.match(positionMapSource, /trail = \[\]/)
  assert.match(positionMapSource, /computeBounds\(\[\.\.\.plotted, \.\.\.trailPoints\]\)/)
  assert.match(positionMapSource, /LeafletPositionMap[\s\S]*trail=\{trailPoints\}/)
  assert.match(leafletPositionMapSource, /\bPolyline\b/)
  assert.match(leafletPositionMapSource, /trail\.length >= 2/)
  assert.match(leafletPositionMapSource, /Polyline[^>]*positions=\{trail\}/)
  assert.doesNotMatch(leafletPositionMapSource, /Polyline[^>]*positions=\{points\}/)
})

test('PositionMap: un rastro GPS puede ser la única geometría y también participa en el límite anti-meridiano', () => {
  const trailOnly = render(PositionMap, {
    points: [], trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }], height: 200,
  })
  assert.match(trailOnly, /data-testid="v2-position-map"/)
  assert.doesNotMatch(trailOnly, /v2-position-map-empty/)

  const crossDateLine = render(PositionMap, {
    points: [{ id: 41, kind: 'unit', lat: 18.34, lng: 179 }],
    trail: [{ lat: 18.35, lng: -179 }, { lat: 18.36, lng: -178.9 }], height: 200,
  })
  assert.match(crossDateLine, /línea de fecha/)
})

test('PositionMap: un solo punto GPS no cambia la elegibilidad ni el límite del mapa', () => {
  const singleTrailOnly = render(PositionMap, { points: [], trail: [{ lat: 18.34, lng: -99.53 }], height: 200 })
  assert.match(singleTrailOnly, /v2-position-map-empty/)

  const unitWithDistantSingleTrail = render(PositionMap, {
    points: [{ id: 41, kind: 'unit', lat: 18.34, lng: 179 }],
    trail: [{ lat: 18.35, lng: -179 }], height: 200,
  })
  assert.doesNotMatch(unitWithDistantSingleTrail, /línea de fecha/)
})

const RadarView = await loadView('src/modules/supervisor-ventas/v2/radar/RadarView.jsx')

test('RadarView: abre mapa con el mismo rastro GPS y el diálogo atrapa Tab, cierra con Escape y devuelve foco', async () => {
  const priorWindow = globalThis.window
  const priorDocument = globalThis.document
  const focusLog = []
  const documentMock = { activeElement: null }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.document = documentMock
  const nodeMocks = new Map()

  let renderer
  try {
    const nodeMock = (element) => {
      if (element.type === 'button') {
        const key = element.props['data-testid'] || element.props['aria-label'] || element.props.children
        if (nodeMocks.has(key)) return nodeMocks.get(key)
        const node = {
          focus() {
            documentMock.activeElement = node
            focusLog.push(element.props['aria-label'] || element.props.children)
          },
        }
        nodeMocks.set(key, node)
        return node
      }
      if (element.props?.role === 'dialog') {
        return {
          querySelectorAll() {
            return [documentMock.closeButton]
          },
        }
      }
      return {}
    }
    await act(async () => {
      renderer = TestRenderer.create(createElement(RadarView, {
        radar: { units: [{ plan_id: 41, route_name: 'Ruta norte', name: 'Ana', vehicle: { name: 'U-1' }, stops: {} }] },
        selectedId: 41,
        trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }],
      }), { createNodeMock: nodeMock })
    })
    const expand = renderer.root.findByProps({ 'data-testid': 'radar-expand-map' })
    const expandNode = expand.instance
    assert.equal(documentMock.activeElement, null)

    await act(async () => { expand.props.onClick() })
    const dialog = renderer.root.findByProps({ role: 'dialog' })
    const close = renderer.root.findByProps({ 'data-testid': 'radar-close-expanded-map' })
    documentMock.closeButton = close.instance
    assert.equal(documentMock.activeElement, close.instance)

    let tabPrevented = false
    await act(async () => {
      dialog.props.onKeyDown({ key: 'Tab', shiftKey: false, preventDefault() { tabPrevented = true } })
    })
    assert.equal(tabPrevented, true)
    assert.equal(documentMock.activeElement, close.instance)

    let shiftTabPrevented = false
    await act(async () => {
      dialog.props.onKeyDown({ key: 'Tab', shiftKey: true, preventDefault() { shiftTabPrevented = true } })
    })
    assert.equal(shiftTabPrevented, true)
    assert.equal(documentMock.activeElement, close.instance)

    await act(async () => { dialog.props.onKeyDown({ key: 'Escape', preventDefault() {} }) })
    assert.throws(() => renderer.root.findByProps({ role: 'dialog' }))
    assert.equal(documentMock.activeElement, expandNode)
    assert.deepEqual(focusLog, ['Cerrar mapa ampliado', 'Cerrar mapa ampliado', 'Cerrar mapa ampliado', 'Ampliar mapa'])
  } finally {
    if (renderer) act(() => renderer.unmount())
    globalThis.window = priorWindow
    globalThis.document = priorDocument
  }
})

test('RadarView: declara el rastro GPS o su ausencia, sin afirmar tiempo real', async () => {
  const radarViewSource = await readFile(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/radar/RadarView.jsx', import.meta.url)), 'utf8')
  assert.match(radarViewSource, /Rastro GPS de hoy/)
  assert.match(radarViewSource, /Sin recorrido GPS disponible para esta jornada\./)
  assert.doesNotMatch(radarViewSource, /rastro GPS en vivo|rastro GPS en tiempo real/i)
  const radar = { units: [{ plan_id: 41, route_name: 'Ruta norte', name: 'Ana', vehicle: { name: 'U-1' }, stops: {} }] }
  assert.match(render(RadarView, { radar, selectedId: 41 }), /Sin recorrido GPS disponible para esta jornada\./)
  assert.match(render(RadarView, {
    radar, selectedId: 41, trail: [{ lat: 18.34, lng: -99.53 }, { lat: 18.35, lng: -99.54 }],
  }), /Recorrido GPS disponible para esta jornada\./)
})

test('RadarView: los controles del mapa tienen un objetivo táctil mínimo de 44px', async () => {
  const radarViewSource = await readFile(fileURLToPath(new URL('../src/modules/supervisor-ventas/v2/radar/RadarView.jsx', import.meta.url)), 'utf8')
  assert.match(radarViewSource, /const MAP_ACTION_STYLE = \{[\s\S]*minHeight: 44/)
  assert.match(radarViewSource, /radar-expand-map[\s\S]*style=\{MAP_ACTION_STYLE\}/)
  assert.match(radarViewSource, /radar-close-expanded-map[\s\S]*style=\{MAP_ACTION_STYLE\}/)
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
const RowButton = await loadView('src/modules/supervisor-ventas/v2/components/RowButton.jsx')
test('RowButton: onClick ⇒ <button> real; sin onClick ⇒ <div> inerte', () => {
  const btn = render(RowButton, { onClick: () => {}, ariaLabel: 'abrir', children: 'x' })
  assert.match(btn, /<button/)
  assert.match(btn, /aria-label="abrir"/)
  const div = render(RowButton, { children: 'x' })
  assert.doesNotMatch(div, /<button/)
})

// ── DayStateGate (P14 homogéneo) ─────────────────────────────────────────────
const DayStateGate = await loadView('src/modules/supervisor-ventas/v2/dayStateGate.jsx')
test('DayStateGate: date_not_allowed ⇒ estado explícito', () => {
  const html = render(DayStateGate, { day: { status: 'date_not_allowed' } })
  assert.match(html, /v2-date-not-allowed/)
  assert.match(html, /Fecha no permitida/)
})
test('DayStateGate: error ⇒ reintentar; loading ⇒ neutral', () => {
  assert.match(render(DayStateGate, { day: { status: 'error', error: 'x', reload: () => {} } }), /Reintentar/)
  assert.match(render(DayStateGate, { day: { status: 'loading' } }), /Cargando/)
})
