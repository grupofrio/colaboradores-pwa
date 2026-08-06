// Supervisor V2 · detalle de ruta enriquecido + Productos vendidos.
// (a) modelo PURO de rutaDetalleModel; (b) cableado de fuente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  centerTime, durationLabel, gapLabel, travelGaps, visitsByHour, isSuspicious, isSale,
} from '../src/modules/supervisor-ventas/v2/rutas/rutaDetalleModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (a) modelo puro ──────────────────────────────────────────────────────────

test('centerTime: UTC → hora centro (−6), o "—"', () => {
  assert.equal(centerTime('2026-08-05T14:30:00Z'), '08:30')
  assert.equal(centerTime(null), '—')
  assert.equal(centerTime('basura'), '—')
})

test('durationLabel: min→"Xm Ys"; null/0 → "—"', () => {
  assert.equal(durationLabel(0.5), '30s')
  assert.equal(durationLabel(2), '2m')
  assert.equal(durationLabel(2.5), '2m 30s')
  assert.equal(durationLabel(null), '—')
  assert.equal(durationLabel(0), '—')
})

test('gapLabel: minutos legibles; null → "—"', () => {
  assert.equal(gapLabel(45), '45 min')
  assert.equal(gapLabel(90), '1 h 30 min')
  assert.equal(gapLabel(120), '2 h')
  assert.equal(gapLabel(null), '—')
})

test('travelGaps: inicio(n) − fin(n−1); faltantes → null', () => {
  const stops = [
    { stop_id: 1, actual_start_time: '2026-08-05T14:00:00Z', actual_end_time: '2026-08-05T14:10:00Z' },
    { stop_id: 2, actual_start_time: '2026-08-05T14:25:00Z', actual_end_time: '2026-08-05T14:35:00Z' }, // 15 min tras la 1
    { stop_id: 3, actual_start_time: null, actual_end_time: null }, // sin datos
  ]
  const g = travelGaps(stops)
  assert.equal(g[1], null, 'la primera no tiene previa')
  assert.equal(g[2], 15)
  assert.equal(g[3], null)
})

test('visitsByHour: agrupa por hora centro, orden ascendente', () => {
  const stops = [
    { actual_start_time: '2026-08-05T14:05:00Z' }, // 08h centro
    { actual_start_time: '2026-08-05T14:50:00Z' }, // 08h centro
    { actual_start_time: '2026-08-05T15:10:00Z' }, // 09h centro
    { actual_start_time: null },
  ]
  const s = visitsByHour(stops)
  assert.deepEqual(s.map((x) => [x.label, x.value]), [['8h', 2], ['9h', 1]])
})

test('isSuspicious: <1 min Y check-in >300 m (necesita ambos)', () => {
  assert.equal(isSuspicious({ visit_duration_min: 0.5, checkin_distance_m: 500 }), true)
  assert.equal(isSuspicious({ visit_duration_min: 0.5, checkin_distance_m: 100 }), false)
  assert.equal(isSuspicious({ visit_duration_min: 5, checkin_distance_m: 500 }), false)
  assert.equal(isSuspicious({ visit_duration_min: 0.5, checkin_distance_m: null }), false, 'sin distancia no se acusa')
})

test('isSale: por result_status o sale_order_count', () => {
  assert.equal(isSale({ result_status: 'sale' }), true)
  assert.equal(isSale({ sale_order_count: 2 }), true)
  assert.equal(isSale({ result_status: 'no_sale', sale_order_count: 0 }), false)
})

// ── (b) cableado ─────────────────────────────────────────────────────────────

test('wiring: RutaDetalle usa el modelo y pinta resumen + paradas enriquecidas', () => {
  const s = src('modules/supervisor-ventas/v2/rutas/RutaDetalle.jsx')
  assert.ok(/from '.\/rutaDetalleModel'/.test(s))
  assert.ok(/ruta-resumen/.test(s) && /ruta-hour-bars/.test(s))
  assert.ok(/ruta-stop-duration/.test(s) && /ruta-stop-travel/.test(s) && /ruta-stop-sale/.test(s))
  assert.ok(/ruta-stop-suspect/.test(s), 'marca visita sospechosa')
  assert.ok(/planSummary/.test(s))
})

test('wiring: RutasTab pasa planSummary y dataSources lo surfacea', () => {
  const tab = src('modules/supervisor-ventas/v2/tabs/RutasTab.jsx')
  assert.ok(/planSummary=\{stops\.planSummary\}/.test(tab))
  const ds = src('modules/supervisor-ventas/v2/dataSources.js')
  assert.ok(/plan_summary/.test(ds) && /planSummary/.test(ds))
})

test('wiring: products-sold tiene wrapper + mapping', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function getProductsSold/.test(api) && /\/pwa-supv\/products-sold/.test(api))
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/products-sold/.test(lib) && /supervisor\/v2\/products-sold/.test(lib))
})

test('wiring: KPIs monta la sección Productos', () => {
  const s = src('modules/supervisor-ventas/kpis/PanelKpis.jsx')
  assert.ok(/getProductsSold/.test(s) && /ProductsSection/.test(s))
  assert.ok(/products-panel/.test(s) && /product-row/.test(s) && /products-coverage/.test(s))
  assert.ok(/product-not-sold-chip/.test(s), 'muestra los no vendidos del portafolio')
})
