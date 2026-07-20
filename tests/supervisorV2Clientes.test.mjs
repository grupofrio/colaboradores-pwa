// Cobertura de la superficie CLIENTES de Supervisor V2 (vista PURA ClientesView):
//   · SSR con segments = segmentCustomers(routeStops fixture APLANADO) — la fuente
//     real de segmentación en V1 (gf.route.stop agregado de las rutas del día);
//   · fila de chips por segmento con su conteo (etiquetas CUSTOMER_SEGMENT_LABELS);
//   · lista del segmento activo (nombre, ruta, resultado, venta, motivo, evidencia);
//   · motivo de no-venta SOLO en no_venta; banner de demo; vacío honesto por segmento;
//   · BLINDAJE: la vista NUNCA muestra saldo/finanzas ni edición inline (V1 read-only).
// El conteo esperado se deriva a mano del fixture (no del componente) para que el
// test MUERDA si la segmentación o el render cambian.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  segmentCustomers, CUSTOMER_SEGMENT_LABELS,
} from '../src/modules/supervisor-ventas/v2/presentation.js'
import { ROUTE_STOPS_FIXTURE } from '../src/modules/supervisor-ventas/v2/fixtures/routeStops.fixture.js'
import { loadJsxDefault, createElement, renderToStaticMarkup } from './helpers/renderJsx.mjs'

// route-stops del día = TODAS las paradas de TODAS las rutas, aplanadas.
const ALL_STOPS = Object.values(ROUTE_STOPS_FIXTURE).flat()
const SEGMENTS = segmentCustomers(ALL_STOPS)

// Conteo esperado por segmento, calculado a mano desde el fixture:
//   6101 con_venta/checkin/done · 6102 pending · 6103 no_venta/checkin/reason ·
//   6201 con_venta(2)/checkin/incident · 6202 pending.
const EXPECTED = {
  planeados: 5, visitados: 3, pendientes: 2, no_venta: 1, con_venta: 2, incidencia: 1, fuera_secuencia: 0,
}

const View = await loadJsxDefault('src/modules/supervisor-ventas/v2/clientes/ClientesView.jsx')
const renderView = (props) => renderToStaticMarkup(createElement(View, {
  segments: SEGMENTS, onSelectSegment: () => {}, onOpenCustomer: () => {}, ...props,
}))

// ¿El chip <seg> muestra su etiqueta canónica y su conteo?
function chipShows(html, seg, count) {
  const label = CUSTOMER_SEGMENT_LABELS[seg]
  return new RegExp(`data-testid="clientes-chip-${seg}"[\\s\\S]*?${label}[\\s\\S]*?>${count}<`).test(html)
}
// Conteo del encabezado de la lista, anclado al testid (evita falsos positivos).
const countRe = (n, word) => new RegExp(`data-testid="clientes-count"[^>]*>${n} ${word}<`)

// ── Segmentación (fuente del componente) ─────────────────────────────────────
test('segmentCustomers sobre el fixture APLANADO da los conteos esperados', () => {
  for (const [seg, n] of Object.entries(EXPECTED)) {
    assert.equal((SEGMENTS[seg] || []).length, n, `segmento ${seg}`)
  }
})

// ── Chips con conteo ─────────────────────────────────────────────────────────
test('chips: fila con los 7 segmentos y su conteo (CUSTOMER_SEGMENT_LABELS)', () => {
  const html = renderView({ activeSegment: 'planeados' })
  assert.match(html, /data-testid="supervisor-v2-clientes"/)
  assert.match(html, /data-testid="clientes-segment-chips"/)
  for (const seg of Object.keys(EXPECTED)) {
    assert.match(html, new RegExp(`data-testid="clientes-chip-${seg}"`), `chip ${seg} presente`)
    assert.ok(chipShows(html, seg, EXPECTED[seg]), `chip ${seg} etiqueta + conteo ${EXPECTED[seg]}`)
  }
})

// ── Lista del segmento activo ────────────────────────────────────────────────
test('segmento activo "pendientes": solo los no visitados, con ausencia NOMBRADA', () => {
  const html = renderView({ activeSegment: 'pendientes' })
  assert.match(html, countRe(2, 'clientes'))
  assert.match(html, /Cliente Demo Dos/)
  assert.match(html, /Cliente Demo Doce/)
  assert.match(html, /Ruta Demo/)                 // route_name presente
  assert.doesNotMatch(html, /Cliente Demo Uno/)   // visitado/con venta ⇒ no pendiente
  assert.match(html, /Sin resultado/)             // parada sin resultado ⇒ honesto (no "0")
  assert.match(html, /Sin check-in/)              // sin evidencia ⇒ nombrada
})

test('segmento "con_venta": muestra "Con venta", el conteo de pedidos y el check-in', () => {
  const html = renderView({ activeSegment: 'con_venta' })
  assert.match(html, countRe(2, 'clientes'))
  assert.match(html, /Cliente Demo Uno/)
  assert.match(html, /Cliente Demo Once/)
  assert.match(html, /Con venta/)
  assert.match(html, /Con venta · 2/)             // 6201 = 2 pedidos (sale_order_count)
  assert.match(html, /Check-in/)
})

test('segmento "no_venta": resultado + MOTIVO (not_visited_reason SOLO si no_venta)', () => {
  const html = renderView({ activeSegment: 'no_venta' })
  assert.match(html, countRe(1, 'cliente'))       // singular
  assert.match(html, /Cliente Demo Tres/)
  assert.match(html, /No venta/)
  assert.match(html, /Motivo: cerrado/)
})

test('el MOTIVO no aparece fuera de no_venta (regla: solo si no_venta)', () => {
  assert.doesNotMatch(renderView({ activeSegment: 'con_venta' }), /Motivo:/)
  assert.doesNotMatch(renderView({ activeSegment: 'pendientes' }), /Motivo:/)
})

// ── Demo banner ──────────────────────────────────────────────────────────────
test('banner de demo: visible con source=demo, ausente en live', () => {
  const demo = renderView({ activeSegment: 'pendientes', source: 'demo' })
  assert.match(demo, /data-testid="v2-demo-banner"/)
  assert.match(demo, /DEMOSTRACIÓN/)
  assert.match(demo, /data-source="demo"/)

  const live = renderView({ activeSegment: 'pendientes', source: 'live' })
  assert.doesNotMatch(live, /data-testid="v2-demo-banner"/)
  assert.match(live, /data-source="live"/)
})

// ── Vacío honesto por segmento ───────────────────────────────────────────────
test('vacío honesto: fuera_secuencia (0) declara el vacío, sin lista fantasma', () => {
  const html = renderView({ activeSegment: 'fuera_secuencia' })
  assert.match(html, /data-testid="clientes-empty"/)
  assert.match(html, /Fuera de secuencia/)        // etiqueta del segmento en el vacío
  assert.match(html, countRe(0, 'clientes'))
  assert.doesNotMatch(html, /data-testid="clientes-row"/)  // sin filas
})

// ── BLINDAJE: sin saldo/finanzas ni edición inline ───────────────────────────
test('BLINDAJE: ningún segmento filtra saldo/finanzas ni ofrece edición inline', () => {
  for (const seg of Object.keys(EXPECTED)) {
    const html = renderView({ activeSegment: seg })
    assert.doesNotMatch(html, /saldo|adeudo|cobranza|deuda|balance|financ/i, `${seg}: sin léxico financiero`)
    assert.doesNotMatch(html, /MXN|USD|\$\s?\d/, `${seg}: sin montos monetarios`)
    assert.doesNotMatch(html, /Editar|Guardar|Modificar cliente/i, `${seg}: sin edición inline`)
  }
})

// ── Robustez (props ausentes / segments vacío) ───────────────────────────────
test('robustez: props ausentes o segments vacío ⇒ no revienta, vacío honesto', () => {
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(View, {})))
  const html = renderToStaticMarkup(createElement(View, { segments: {}, activeSegment: 'pendientes' }))
  assert.match(html, /data-testid="supervisor-v2-clientes"/)
  assert.match(html, /data-testid="clientes-empty"/)
  assert.match(html, countRe(0, 'clientes'))
})
