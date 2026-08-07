import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { unitTrackAvailability } from '../src/modules/supervisor-ventas/unitTrackState.js'
import {
  canRenderUnitTrackMap,
  createUnitTrackRequestGate,
  loadRouteStopsWithUnitTrack,
  retryUnitTrackRequest,
} from '../src/modules/supervisor-ventas/unitTrackScreenState.js'

const componentUrl = new URL('../src/modules/supervisor-ventas/UnitTrackMap.jsx', import.meta.url)
const detailScreenUrl = new URL('../src/modules/supervisor-ventas/ScreenDetalleVendedor.jsx', import.meta.url)
const packageUrl = new URL('../package.json', import.meta.url)
const packageLockUrl = new URL('../package-lock.json', import.meta.url)

function stripComments(source) {
  let cleaned = ''
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (character === '\n') {
        lineComment = false
        cleaned += character
      }
      continue
    }

    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      cleaned += character
      if (character === '\\') {
        cleaned += next ?? ''
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (character === '\'' || character === '"' || character === '`') quote = character
    cleaned += character
  }

  return cleaned
}

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

async function readComponent() {
  return stripComments(await readFile(componentUrl, 'utf8'))
}

async function readDetailScreen() {
  return stripComments(await readFile(detailScreenUrl, 'utf8'))
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('unavailable unit-track responses cannot render UnitTrackMap even when geometry exists', () => {
  const geometry = { current: { lat: 19.43, lng: -99.13 }, trail: [], stops: [] }
  const unavailableResponses = [
    { result: { ok: false, data: { code: 'FEATURE_DISABLED' } } },
    { result: { ok: false, payload: { status: 'FORBIDDEN' } } },
    { result: { ok: false, payload: { status: 'DATE_NOT_ALLOWED' } } },
    { jsonrpc: '2.0', error: { code: 'SERVER_ERROR' } },
  ]

  for (const response of unavailableResponses) {
    const unitTrackState = unitTrackAvailability(response)
    assert.equal(canRenderUnitTrackMap({
      routePlanId: 41,
      unitTrackPlanId: 41,
      unitTrackState,
      unitTrack: geometry,
    }), false)
  }
})

test('stale unit-track responses are ignored after a route change or unmount', async () => {
  const gate = createUnitTrackRequestGate()
  const acceptedResponses = []

  const routeChangeResponse = deferred()
  const routeChangeRequestId = gate.start()
  const routeChangeRequest = retryUnitTrackRequest({
    requestGate: gate,
    requestId: routeChangeRequestId,
    routePlanId: 41,
    api: { getUnitTrack: () => routeChangeResponse.promise },
    onResponse: (response) => acceptedResponses.push(response),
    onError: assert.fail,
  })
  gate.invalidate()
  routeChangeResponse.resolve({ result: { ok: true, data: {} } })
  await routeChangeRequest

  const unmountResponse = deferred()
  const unmountRequestId = gate.start()
  const unmountRequest = retryUnitTrackRequest({
    requestGate: gate,
    requestId: unmountRequestId,
    routePlanId: 42,
    api: { getUnitTrack: () => unmountResponse.promise },
    onResponse: (response) => acceptedResponses.push(response),
    onError: assert.fail,
  })
  gate.invalidate()
  unmountResponse.resolve({ result: { ok: true, data: {} } })
  await unmountRequest

  assert.deepEqual(acceptedResponses, [])
})

test('detail stops complete while the concurrent unit-track request remains unresolved', async () => {
  const gate = createUnitTrackRequestGate()
  const requestId = gate.start()
  const stopsResponse = deferred()
  const trackResponse = deferred()
  const trackHandled = deferred()

  const stopsCompletion = loadRouteStopsWithUnitTrack({
    requestGate: gate,
    requestId,
    routePlanId: 41,
    getRouteStops: () => stopsResponse.promise,
    api: { getUnitTrack: () => trackResponse.promise },
    onTrackResponse: (response) => trackHandled.resolve(response),
    onTrackError: trackHandled.reject,
  })

  stopsResponse.resolve([{ id: 1 }])
  assert.deepEqual(await stopsCompletion, [{ id: 1 }])

  trackResponse.resolve({ result: { ok: true, data: {} } })
  assert.deepEqual(await trackHandled.promise, { result: { ok: true, data: {} } })
})

test('unit-track retry calls only getUnitTrack', async () => {
  const gate = createUnitTrackRequestGate()
  const requestId = gate.start()
  const accessedMethods = []
  const api = new Proxy({
    getUnitTrack: async (planId) => {
      assert.equal(planId, 41)
      return { result: { ok: true, data: {} } }
    },
  }, {
    get(target, property) {
      accessedMethods.push(property)
      if (property === 'getDayOverview' || property === 'getRouteStops') {
        throw new Error(`${String(property)} must not be accessed by retry`)
      }
      return target[property]
    },
  })
  const acceptedResponses = []

  await retryUnitTrackRequest({
    requestGate: gate,
    requestId,
    routePlanId: 41,
    api,
    onResponse: (response) => acceptedResponses.push(response),
    onError: assert.fail,
  })

  assert.deepEqual(accessedMethods, ['getUnitTrack'])
  assert.equal(acceptedResponses.length, 1)
})

test('vendor detail wires the optional, read-only unit-track map without disrupting route stops', async () => {
  const source = await readDetailScreen()
  const rawSource = await readFile(detailScreenUrl, 'utf8')

  assert.match(source, /import\s*\{\s*getUnitTrack\s*\}\s*from\s*['"]\.\/api\.js['"]/)
  assert.match(source, /import\s*\{\s*UnitTrackMap\s*\}\s*from\s*['"]\.\/UnitTrackMap\.jsx['"]/)
  assert.match(source, /import\s*\{\s*normalizeUnitTrack\s*,\s*unitTrackAvailability\s*,\s*buildUnitTrackBounds\s*\}\s*from\s*['"]\.\/unitTrackState\.js['"]/)
  assert.match(source, /import\s*\{\s*canRenderUnitTrackMap\s*,\s*createUnitTrackRequestGate\s*,\s*loadRouteStopsWithUnitTrack\s*,\s*retryUnitTrackRequest\s*,?\s*\}\s*from\s*['"]\.\/unitTrackScreenState\.js['"]/)
  assert.match(source, /const\s+routePlanId\s*=\s*useMemo\(/)
  assert.match(source, /routePlanId\s*=.*?Number\.isSafeInteger.*?>\s*0/s)
  assert.match(rawSource, /\/\/[^\n]*route_id[^\n]*gf\.route\.plan[^\n]*(?:plan|id)/i)
  assert.match(source, /const\s*\[unitTrack,\s*setUnitTrack\]\s*=\s*useState\(null\)/)
  assert.match(source, /const\s*\[unitTrackState,\s*setUnitTrackState\]\s*=\s*useState\(['"]idle['"]\)/)
  assert.match(source, /const\s*\[unitTrackError,\s*setUnitTrackError\]\s*=\s*useState\(['"]['"]\)/)
  assert.match(source, /await\s+loadRouteStopsWithUnitTrack\(/)
  assert.match(source, /getRouteStops\s*,/)
  assert.match(source, /api:\s*\{\s*getUnitTrack\s*\}/)
  assert.match(source, /setStops\(Array\.isArray\(stopsData\)/)
  assert.match(source, /onTrackResponse:\s*\(response\)\s*=>\s*setUnitTrackResponse\(response,\s*trackRequestId\)/)
  assert.match(source, /unitTrackAvailability\(response\)/)
  assert.match(source, /normalizeUnitTrack\(/)
  assert.match(source, /buildUnitTrackBounds\(unitTrackForCurrentPlan\)/)
  assert.match(source, /RECORRIDO DE UNIDAD/)
  assert.match(source, /Sin recorrido GPS disponible para esta jornada\./)
  assert.match(source, /Reintentar/)
  assert.match(source, /onClick=\{retryUnitTrack\}/)
  assert.match(source, /const\s+unitTrackRequestIdRef\s*=\s*useRef\(createUnitTrackRequestGate\(\)\)/)
  assert.match(source, /const\s+unitTrackRequestGate\s*=\s*unitTrackRequestIdRef\.current/)
  assert.match(source, /unitTrackRequestIdRef\.current\.start\(\)/)
  assert.match(source, /return\s*\(\)\s*=>\s*\{[\s\S]*?unitTrackRequestGate\.invalidate\(\)/)
  assert.match(source, /unitTrackRequestIdRef\.current\.isCurrent\(requestId\)/)
  assert.match(source, /const\s+shouldRenderUnitTrackMap\s*=\s*canRenderUnitTrackMap\(/)
  assert.match(source, /\{shouldRenderUnitTrackMap\s*&&\s*\(\s*<UnitTrackMap/)
  const retryFunction = source.match(/async function retryUnitTrack\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(retryFunction, /retryUnitTrackRequest\(/)
  assert.doesNotMatch(retryFunction, /getDayOverview|getRouteStops/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\b(?:axios|XMLHttpRequest|sendBeacon)\b/)
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|removeItem|clear)\s*\(/)
  assert.doesNotMatch(source, /\b(?:indexedDB|caches)\s*\.\s*\w+\s*\(/)
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/)
})

test('UnitTrackMap is a read-only Leaflet view with the required operational geometry', async () => {
  const source = await readComponent()
  const reactLeafletImports = [...source.matchAll(/import\s*\{([^{}]*)\}\s*from\s*['"]react-leaflet['"]/g)]

  assert.equal(reactLeafletImports.length, 1)
  assert.deepEqual(
    reactLeafletImports[0][1].split(',').map((name) => name.trim()).filter(Boolean).sort(),
    ['CircleMarker', 'MapContainer', 'Polygon', 'Polyline', 'TileLayer', 'Tooltip', 'useMap'].sort(),
  )
  assert.match(source, /import\s+['"]leaflet\/dist\/leaflet\.css['"]/)
  assert.match(source, /import\s*{\s*buildUnitTrackBounds\s*}\s*from\s*['"]\.\/unitTrackState\.js['"]/)
  assert.match(source, /export function UnitTrackMap\(\{ track, typo \}\)/)
  assert.match(source, /const bounds = buildUnitTrackBounds\(track\)/)
  assert.match(source, /if \(bounds\.length === 0\) return null/)
  assert.equal((source.match(/<MapContainer\b/g) ?? []).length, 1)
  assert.ok(source.indexOf('if (bounds.length === 0) return null') < source.indexOf('<MapContainer'))
  assert.match(source, /<div\s+style=\{\{\s*height:\s*280,\s*minHeight:\s*280,\s*width:\s*['"]100%['"]/)
  // La leyenda vive FUERA del contenedor del mapa, por eso ahora hay un div
  // envolvente; el del mapa conserva sus 280px.
  assert.match(source, /data-testid="unit-track-legend"/)
  assert.match(source, /<MapContainer[\s\S]*?style=\{\{\s*height:\s*['"]100%['"],\s*minHeight:\s*280/)
  assert.match(source, /url=['"]https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png['"]/)
  assert.match(source, /attribution=/)
  assert.match(source, /\{trailPositions\.length >= 2 && \(\s*<Polyline\s+positions=\{trailPositions\}\s+color="#2563eb"/)
  // El color de la parada YA NO sale del check-in sino del RESULTADO de venta:
  // una parada visitada sin venta se pintaba igual de verde que una venta.
  assert.match(source, /<CircleMarker\s+center=\{plannedPosition\}\s+radius=\{PLANNED_STYLE\.radius\}/)
  assert.match(source, /center=\{checkinPosition \|\| plannedPosition\}\s+radius=\{style\.radius\}\s+pathOptions=\{pathOptionsForStop\(stop\)\}/)
  assert.ok(!source.includes('#d97706') && !source.includes('#15803d'),
    'los colores por visita ya no existen')
  assert.match(source, /\{currentPosition && \(\s*<CircleMarker\s+center=\{currentPosition\}[^>]*color="#2563eb"[\s\S]*?<Tooltip[^>]*>[\s\S]*?Hora:[\s\S]*?Velocidad:/)
  assert.match(source, /function MapViewport\(\{ bounds \}\)[\s\S]*?const map = useMap\(\)/)
  assert.match(source, /if \(bounds\.length >= 2\)[\s\S]*map\.fitBounds/)
  assert.match(source, /map\.setView\(bounds\[0\], SINGLE_POINT_ZOOM\)/)
  assert.match(source, /map\.invalidateSize\(\)/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\b(?:axios|XMLHttpRequest|sendBeacon)\b/)
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|removeItem|clear)\s*\(/)
  assert.doesNotMatch(source, /\b(?:indexedDB|caches)\s*\.\s*\w+\s*\(/)
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/)
})

test('UnitTrackMap locks the React 19-compatible Leaflet dependency pair', async () => {
  const packageJson = await readJson(packageUrl)
  const packageLock = await readJson(packageLockUrl)

  assert.equal(packageJson.dependencies.leaflet, '^1.9.4')
  assert.equal(packageJson.dependencies['react-leaflet'], '^5.0.0')
  assert.equal(packageLock.packages[''].dependencies.leaflet, '^1.9.4')
  assert.equal(packageLock.packages[''].dependencies['react-leaflet'], '^5.0.0')
  assert.equal(packageLock.packages['node_modules/leaflet'].version, '1.9.4')
  assert.equal(packageLock.packages['node_modules/react-leaflet'].version, '5.0.0')
  assert.equal(packageLock.packages['node_modules/react-leaflet'].peerDependencies.react, '^19.0.0')
})
