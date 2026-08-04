// ─── Radar: paradas por RESULTADO, zona de la ruta y fondo del documento ─────
// Antes los dos mapas coloreaban por "¿hubo check-in?": una parada donde el
// vendedor llegó y NO vendió se pintaba igual de verde que una venta. Para un
// supervisor que mira el mapa buscando dónde se pierde la venta, eso es lo
// contrario de informar.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PLANNED_STYLE, RESULT_LEGEND, RESULT_NO_SALE, RESULT_PENDING, RESULT_SOLD,
  RESULT_STYLES, STOP_KINDS, classifyStopResult, stopKind, styleForStop,
  zoneColor, zoneLabel, zoneToLeafletPositions,
} from '../src/modules/supervisor-ventas/radar/stopResultStyle.js'
import { buildSelectedPlanPoints, selectedPlanZone } from '../src/modules/supervisor-ventas/v2/radar/radarSelection.js'
import { normalizeUnitTrack } from '../src/modules/supervisor-ventas/unitTrackState.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

// Geometría REAL de gf.delivery.polygon id=13 "Iguala SUR" (sucursal 29).
const ZONA_REAL = {
  id: 13,
  name: 'Iguala SUR B',
  level: 'subpolygon',
  color: '#ff6600',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-99.5715268887146, 18.345178638017927],
      [-99.56559747084472, 18.338960695616205],
      [-99.54886768550412, 18.311221302759353],
      [-99.5715268887146, 18.345178638017927],
    ]],
  },
}

// ── Clasificación por resultado ──────────────────────────────────────────────

test('vender es verde: las dos familias de valores del payload', () => {
  for (const raw of ['con_venta', 'delivered_full', 'delivered_partial']) {
    assert.equal(classifyStopResult({ result_status: raw }), RESULT_SOLD, raw)
  }
})

test('no venta es rojo', () => {
  for (const raw of ['no_sale', 'no_venta']) {
    assert.equal(classifyStopResult({ result_status: raw }), RESULT_NO_SALE, raw)
  }
})

test('pendiente es gris: sin check-in, null, o estado desconocido', () => {
  for (const stop of [{ result_status: null }, { result_status: '' }, { result_status: 'pending' },
    {}, null, undefined, { result_status: 42 }]) {
    assert.equal(classifyStopResult(stop), RESULT_PENDING, JSON.stringify(stop))
  }
})

test('un estado DESCONOCIDO cae en pendiente, NUNCA en vendió', () => {
  // Afirmar una venta que el backend no afirmó es la mentira cara: el supervisor
  // dejaría de visitar a un cliente creyendo que ya compró.
  assert.equal(classifyStopResult({ result_status: 'estado_nuevo' }), RESULT_PENDING)
  assert.notEqual(classifyStopResult({ result_status: 'estado_nuevo' }), RESULT_SOLD)
})

test('el color YA NO depende del check-in', () => {
  // Mismo check-in, resultados opuestos ⇒ colores opuestos.
  const conVenta = { checkin_lat: 18.3, checkin_lng: -99.5, result_status: 'con_venta' }
  const sinVenta = { checkin_lat: 18.3, checkin_lng: -99.5, result_status: 'no_sale' }
  assert.notEqual(styleForStop(conVenta).fill, styleForStop(sinVenta).fill,
    'visitar y vender no pueden pintarse igual')
  assert.equal(styleForStop(conVenta), RESULT_STYLES[RESULT_SOLD])
  assert.equal(styleForStop(sinVenta), RESULT_STYLES[RESULT_NO_SALE])
})

test('los colores viejos por visita ya no están en los mapas', () => {
  for (const rel of ['../src/modules/supervisor-ventas/UnitTrackMap.jsx',
    '../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx']) {
    const src = read(rel)
    for (const viejo of ['#fbbf24', '#22c55e', '#16a34a']) {
      assert.ok(!src.includes(viejo), `${rel} conserva el color por visita ${viejo}`)
    }
  }
})

// ── Contraste y leyenda ──────────────────────────────────────────────────────

function lum(hex) {
  const v = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test('los rellenos cumplen AA contra el mapa claro', () => {
  // Las teselas de OSM son claras; un relleno pálido desaparecería encima.
  for (const key of [RESULT_SOLD, RESULT_NO_SALE, RESULT_PENDING]) {
    const ratio = contrast(RESULT_STYLES[key].fill, '#FFFFFF')
    assert.ok(ratio >= 4.5, `${key}: ${ratio.toFixed(2)}:1 sobre blanco (AA exige 4.5)`)
  }
})

test('el COLOR no puede ser lo único que distingue un resultado', () => {
  // Medido: el verde y el rojo que cumplen AA contra un mapa claro quedan en
  // 1.10:1 ENTRE SÍ. En escala de grises son el mismo punto, y quien no
  // distingue rojo de verde no podría leer el mapa. La leyenda no lo resuelve
  // porque los puntos del mapa no llevan texto encima.
  const ratio = contrast(RESULT_STYLES[RESULT_SOLD].fill, RESULT_STYLES[RESULT_NO_SALE].fill)
  assert.ok(ratio < 1.6, `si algún día se separan en luminancia (${ratio.toFixed(2)}:1), revisa este test`)

  // Por eso cada resultado trae FORMA. Los radios tienen que ser distintos…
  const radios = [RESULT_SOLD, RESULT_NO_SALE, RESULT_PENDING].map((k) => RESULT_STYLES[k].radius)
  assert.equal(new Set(radios).size, 3, `radios repetidos: ${radios.join(', ')}`)
  // …y la separación tiene que ser visible, no de un píxel.
  const ordenados = [...radios].sort((x, y) => x - y)
  assert.ok(ordenados[1] - ordenados[0] >= 2 && ordenados[2] - ordenados[1] >= 2,
    `radios demasiado juntos: ${ordenados.join(', ')}`)
  // Y el trazo distingue "no venta" también en silueta.
  assert.ok(RESULT_STYLES[RESULT_NO_SALE].dashArray, 'no venta va punteada')
  assert.ok(!RESULT_STYLES[RESULT_SOLD].dashArray, 'vendió va sólida')
})

test('los mapas PINTAN la forma, no solo el color', () => {
  const unit = read('../src/modules/supervisor-ventas/UnitTrackMap.jsx')
  assert.match(unit, /pathOptionsForStop\(stop\)/)
  assert.match(unit, /radius=\{style\.radius\}/)
  const leaflet = read('../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx')
  assert.match(leaflet, /radius=\{style\.radius \?\? 6\}/)
  assert.match(leaflet, /dashArray: style\.dashArray/)
})

test('la leyenda reproduce la forma, no solo el color', () => {
  for (const rel of ['../src/modules/supervisor-ventas/UnitTrackMap.jsx',
    '../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx']) {
    const src = read(rel)
    assert.match(src, /width: item\.radius \* 2/, rel)
    assert.match(src, /item\.dashArray \? 'dashed' : 'solid'/, rel)
  }
})

test('la leyenda lleva PALABRA, no solo color', () => {
  assert.equal(RESULT_LEGEND.length, 4, 'los tres resultados + la posición planeada')
  for (const item of RESULT_LEGEND) {
    assert.ok(item.label && item.label.length > 2, JSON.stringify(item))
    assert.ok(item.fill && item.stroke, item.key)
  }
  assert.deepEqual(RESULT_LEGEND.map((i) => i.label),
    ['Vendió', 'No venta', 'Pendiente', 'Posición planeada'])
})

test('los dos mapas PINTAN la leyenda', () => {
  assert.match(read('../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx'),
    /data-testid="v2-map-legend"/)
  assert.match(read('../src/modules/supervisor-ventas/UnitTrackMap.jsx'),
    /data-testid="unit-track-legend"/)
})

test('la posición planeada se conserva como referencia tenue', () => {
  // Sin ella no se puede ver el desvío entre dónde debía estar el cliente y
  // dónde se hizo el check-in.
  assert.ok(PLANNED_STYLE.fill.startsWith('rgba('), 'translúcida, no sólida')
  const src = read('../src/modules/supervisor-ventas/UnitTrackMap.jsx')
  assert.match(src, /PLANNED_STYLE\.stroke/)
  assert.match(src, /dashArray/, 'punteada para no competir con el resultado')
})

// ── El radar usa el mismo criterio ───────────────────────────────────────────

const radarConParadas = (result) => ({
  units: [{
    plan_id: 6842, latitude: 18.34, longitude: -99.57, route_name: 'RICARDO MIRANDA',
    zone: ZONA_REAL,
    stops: { planned: [{ stop_id: 1, latitude: 18.33, longitude: -99.56, name: 'Tienda', done: true, result_status: result }] },
  }],
})

test('el radar colorea sus paradas por resultado, igual que el detalle', () => {
  const vendio = buildSelectedPlanPoints(radarConParadas('con_venta'), 6842, Date.now())
  const noVenta = buildSelectedPlanPoints(radarConParadas('no_sale'), 6842, Date.now())
  assert.equal(vendio.find((p) => String(p.id).startsWith('stop:')).kind, 'stop_sold')
  assert.equal(noVenta.find((p) => String(p.id).startsWith('stop:')).kind, 'stop_no_sale')
})

test('una parada visitada SIN venta ya no se pinta como visitada y ya', () => {
  // `done: true` sigue en el contrato, pero ya no decide el color.
  const puntos = buildSelectedPlanPoints(radarConParadas('no_sale'), 6842, Date.now())
  const parada = puntos.find((p) => String(p.id).startsWith('stop:'))
  assert.equal(parada.done, true, 'la visita sigue reportándose')
  assert.equal(parada.kind, 'stop_no_sale', 'pero el color es el del resultado')
})

test('sin result_status del backend, la parada cae en pendiente sin romper el mapa', () => {
  // Contrato viejo: `done` sin `result_status`. No se puede inventar una venta.
  const puntos = buildSelectedPlanPoints(radarConParadas(undefined), 6842, Date.now())
  assert.equal(puntos.find((p) => String(p.id).startsWith('stop:')).kind, 'stop_pending')
})

test('los kinds nuevos son dibujables por el mapa', () => {
  const src = read('../src/modules/supervisor-ventas/v2/radar/PositionMap.jsx')
  assert.match(src, /\.\.\.STOP_KINDS/, 'PositionMap acepta los kinds por resultado')
  const leaflet = read('../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx')
  for (const kind of STOP_KINDS) {
    assert.match(leaflet, new RegExp(`${kind}:`), `${kind} sin estilo en el mapa`)
  }
  assert.match(leaflet, /stop_done:/, 'se conserva el kind viejo por compatibilidad')
})

// ── Zona (polígono) ──────────────────────────────────────────────────────────

test('la geometría se voltea de [lon,lat] a [lat,lng] para Leaflet', () => {
  // GeoJSON usa [lon, lat]; Leaflet usa [lat, lng]. Sin voltear, el polígono de
  // Guerrero acabaría en medio del océano Índico.
  const rings = zoneToLeafletPositions(ZONA_REAL)
  assert.equal(rings.length, 1)
  const [lat, lng] = rings[0][0]
  assert.ok(lat > 17 && lat < 19, `latitud de Guerrero, no ${lat}`)
  assert.ok(lng < -98 && lng > -101, `longitud de Guerrero, no ${lng}`)
})

test('sin zona NO se dibuja nada', () => {
  // Un cuadro inventado se leería como que la unidad se salió de su zona, que
  // es justo lo que el supervisor mira aquí.
  for (const zona of [null, undefined, {}, { geometry: null }, { geometry: { type: 'Polygon' } },
    { geometry: { type: 'Point', coordinates: [-99.5, 18.3] } },
    { geometry: { type: 'Polygon', coordinates: [] } }]) {
    assert.equal(zoneToLeafletPositions(zona), null, JSON.stringify(zona))
  }
})

test('un anillo de menos de 3 puntos no encierra área', () => {
  assert.equal(zoneToLeafletPositions({ geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } }), null)
})

test('MultiPolygon se aplana a varios anillos', () => {
  const multi = {
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[[-99.5, 18.3], [-99.4, 18.3], [-99.4, 18.4], [-99.5, 18.3]]],
        [[[-99.2, 18.1], [-99.1, 18.1], [-99.1, 18.2], [-99.2, 18.1]]],
      ],
    },
  }
  assert.equal(zoneToLeafletPositions(multi).length, 2)
})

test('las coordenadas basura se filtran sin tumbar la zona', () => {
  const sucia = {
    geometry: {
      type: 'Polygon',
      coordinates: [[[-99.5, 18.3], ['x', 'y'], [-99.4, 18.3], null, [-99.4, 18.4], [-99.5, 18.3]]],
    },
  }
  assert.equal(zoneToLeafletPositions(sucia)[0].length, 4)
})

test('el color de la zona sale del backend, con respaldo de marca', () => {
  assert.equal(zoneColor(ZONA_REAL), '#ff6600')
  for (const malo of [null, {}, { color: '' }, { color: 'rojo' }, { color: 'javascript:x' }]) {
    assert.equal(zoneColor(malo), '#0077BB', JSON.stringify(malo))
  }
})

test('la etiqueta dice de qué nivel es la zona', () => {
  assert.equal(zoneLabel(ZONA_REAL), 'Iguala SUR B (subpolígono)')
  assert.equal(zoneLabel({ name: 'Iguala SUR', level: 'polygon' }), 'Iguala SUR (polígono)')
  assert.equal(zoneLabel({}), '')
})

test('la zona viaja del contrato al mapa por las dos superficies', () => {
  assert.equal(selectedPlanZone(radarConParadas('con_venta'), 6842), ZONA_REAL)
  assert.equal(selectedPlanZone(radarConParadas('con_venta'), 999), null, 'otro plan, sin zona')
  assert.equal(normalizeUnitTrack({ zone: ZONA_REAL, stops: [] }).zone, ZONA_REAL)
  assert.equal(normalizeUnitTrack({ stops: [] }).zone, null)
  assert.equal(normalizeUnitTrack({ zone: 'basura', stops: [] }).zone, null)
})

test('los dos mapas dibujan el polígono y sólo si existe', () => {
  for (const rel of ['../src/modules/supervisor-ventas/UnitTrackMap.jsx',
    '../src/modules/supervisor-ventas/v2/radar/LeafletPositionMap.jsx']) {
    const src = read(rel)
    assert.match(src, /zoneToLeafletPositions\(zone\)/, rel)
    assert.match(src, /\{zoneRings && \(/, `${rel} debe dibujar la zona SOLO si existe`)
    assert.match(src, /<Polygon/, rel)
  }
})

// ── Fondo del documento (las franjas negras) ─────────────────────────────────

test('la franja negra se corta en el DOCUMENTO, no pantalla por pantalla', () => {
  // No salía de ninguna pantalla: salía del `body`, que pinta --bg0 (#030811) y
  // se asoma en el rebote del scroll. Arreglar cada pantalla no la habría
  // quitado nunca.
  const css = read('../src/index.css')
  assert.match(css, /:root\[data-brand-light="1"\]\s*\{/)
  assert.match(css, /--bg0:\s*#F0F9FF/)
  assert.match(css, /--text:\s*#0F2A3D/)
})

test('el atributo lo pone el ROL y se quita al salir', () => {
  const app = read('../src/App.jsx')
  assert.match(app, /isBrandLightSession\(session\)\) root\.setAttribute\('data-brand-light', '1'\)/)
  assert.match(app, /else root\.removeAttribute\('data-brand-light'\)/,
    'sin esto, otro rol heredaría el claro al cambiar de sesión')
  assert.match(app, /return \(\) => root\.removeAttribute\('data-brand-light'\)/)
})

test('ya no quedan fondos negros duros en el shell', () => {
  const app = read('../src/App.jsx')
  assert.ok(!app.includes("'#030811'"), 'el loader y el error boundary siguen el tema del documento')
  assert.match(app, /background: 'var\(--bg0\)'/)
})

test('el claro del documento es EXACTAMENTE el de BRAND_TOKENS', async () => {
  // Dos fuentes para el mismo azul acabarían divergiendo.
  const { BRAND_TOKENS } = await import('../src/theme/brandTokens.js')
  const css = read('../src/index.css')
  const bloque = css.slice(css.indexOf(':root[data-brand-light="1"]'))
  assert.ok(bloque.includes(BRAND_TOKENS.colors.bg0), `--bg0 debe ser ${BRAND_TOKENS.colors.bg0}`)
  assert.ok(bloque.includes(BRAND_TOKENS.colors.text), `--text debe ser ${BRAND_TOKENS.colors.text}`)
})
