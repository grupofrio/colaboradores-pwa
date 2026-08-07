// Supervisor V2 · Sprint 1 — correcciones de la auditoría del puesto:
//   (1) Clientes: nombre de ruta adjunto, orden de ejecución, y las paradas SIN
//       cliente en su propio segmento (antes encabezaban "Pendientes" como
//       "Cliente sin nombre" · 42 de 187 paradas reales de la sucursal 29);
//   (2) segmentos operativos visibles al armar (no se filtran por polígono:
//       4 de 5 segmentos de la sucursal 29 no tienen polígono);
//   (3) la jornada EN CURSO no emite veredicto (matriz + cobertura de KPIs).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { segmentCustomers, isStopWithoutCustomer } from '../src/modules/supervisor-ventas/v2/presentation.js'
import { cellTone, isCurrentDay, todayFromTomorrow, toneWord } from '../src/modules/supervisor-ventas/v2/planear/routesWeekModel.js'
import { buildFunnel } from '../src/modules/supervisor-ventas/kpis/kpisModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (1) Clientes ─────────────────────────────────────────────────────────────

test('isStopWithoutCustomer detecta el hueco en todas sus formas', () => {
  assert.equal(isStopWithoutCustomer({ customer_id: false }), true)   // Odoo m2o vacío
  assert.equal(isStopWithoutCustomer({ customer_id: null }), true)
  assert.equal(isStopWithoutCustomer({ customer_id: 0 }), true)
  assert.equal(isStopWithoutCustomer({}), true)
  assert.equal(isStopWithoutCustomer({ customer_id: 51198 }), false)
  assert.equal(isStopWithoutCustomer({ customer_id: [51198, 'AGUAS LA GORDA'] }), false)
})

test('las paradas sin cliente van a su propio segmento, NO a Pendientes', () => {
  const stops = [
    { stop_id: 1, customer_id: 51198, name: 'AGUAS LA GORDA', state: 'pending' },
    { stop_id: 2, customer_id: false, state: 'pending' },   // hueco de datos
    { stop_id: 3, customer_id: false, state: 'pending' },   // hueco de datos
    { stop_id: 4, customer_id: 51408, name: 'FARMACIA LA FE', state: 'done' },
  ]
  const seg = segmentCustomers(stops)
  assert.equal(seg.sin_cliente.length, 2, 'las 2 sin cliente en su segmento')
  assert.equal(seg.pendientes.length, 1, 'Pendientes solo trae clientes reales')
  assert.equal(seg.visitados.length, 1)
  // planeados NO se maquilla: es el total real del plan (incluye los huecos).
  assert.equal(seg.planeados.length, 4)
})

test('ClientesTab adjunta el nombre de la ruta y ordena por ejecución', () => {
  const s = src('modules/supervisor-ventas/v2/tabs/ClientesTab.jsx')
  assert.match(s, /planRoutesOf/, 'usa los planes CON su nombre de ruta')
  assert.match(s, /route_name:\s*routeName/, 'marca cada parada con su ruta')
  assert.match(s, /sort\(bySequence\)/, 'ordena por ruta + secuencia')
  assert.doesNotMatch(s, /planIdsOf/, 'ya no se piden solo ids sueltos')
})

test('la vista nombra el hueco en vez de fingir un cliente anónimo', () => {
  const s = src('modules/supervisor-ventas/v2/clientes/ClientesView.jsx')
  assert.match(s, /Parada sin cliente asignado/, 'nombra el hueco de datos')
  assert.doesNotMatch(s, /'Cliente sin nombre'/, 'sin el placeholder anónimo')
  assert.doesNotMatch(s, /'Ruta sin nombre'/, 'la ruta ya viene de day-control')
  assert.match(s, /sin_cliente/, 'segmento declarado en la fila de chips')
})

// ── (2) Segmentos operativos al armar ────────────────────────────────────────

test('los segmentos NO se filtran por polígono (4 de 5 no tienen)', () => {
  const s = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(s, /getPlanningSegments\(\)/, 'se piden todos los de la sucursal')
  assert.doesNotMatch(s, /getPlanningSegments\(polygonId/, 'sin filtro por zona heredada')
})

// ── (3) Jornada en curso ≠ veredicto ─────────────────────────────────────────

test('hoy se deriva del servidor (tomorrow − 1), nunca del reloj local', () => {
  assert.equal(todayFromTomorrow('2026-08-08'), '2026-08-07')
  assert.equal(todayFromTomorrow('2026-03-01'), '2026-02-28')  // cruce de mes
  assert.equal(todayFromTomorrow(''), null)
})

test('la celda del día en curso no se pinta "Bajo" aunque vaya en 0%', () => {
  const hoy = { date: '2026-08-07', has_plan: true, coverage_pct: 0, coverage_tone: 'bad' }
  assert.equal(cellTone(hoy, '2026-08-07'), 'today')
  assert.equal(toneWord('today'), 'En curso')
  // Un día ya cerrado SÍ conserva su veredicto.
  const ayer = { date: '2026-08-06', has_plan: true, coverage_pct: 22.9, coverage_tone: 'bad' }
  assert.equal(cellTone(ayer, '2026-08-07'), 'bad')
  // Sin plan sigue siendo "sin ruta" (hecho cerrado), no "en curso".
  assert.equal(cellTone({ date: '2026-08-07', has_plan: false }, '2026-08-07'), 'none')
  assert.equal(isCurrentDay(hoy, '2026-08-07'), true)
  assert.equal(isCurrentDay(ayer, '2026-08-07'), false)
})

test('la cobertura de "Hoy" es parcial, no "Crítico" a media mañana', () => {
  const payload = { funnel: { agendados: 165, visitados: 12, compraron: 11, coverage_pct: 7.3, coverage_tone: 'bad' } }
  const hoy = buildFunnel(payload, 'hoy').drops.find((d) => d.key === 'coverage')
  assert.equal(hoy.tone, 'partial')
  assert.equal(hoy.toneWord, 'En curso')
  assert.equal(hoy.partial, true)
  assert.equal(hoy.pct, 7.3, 'la cifra real se conserva; solo cambia el veredicto')
  assert.match(hoy.note, /jornada no ha terminado/)
  // Semana/Mes son períodos cerrados ⇒ el veredicto del backend manda.
  const semana = buildFunnel(payload, 'semana').drops.find((d) => d.key === 'coverage')
  assert.equal(semana.tone, 'bad')
  assert.equal(semana.toneWord, 'Crítico')
})
