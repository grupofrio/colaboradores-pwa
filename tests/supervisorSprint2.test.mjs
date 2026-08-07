// Supervisor V2 · Sprint 2 — que cada pantalla empuje una decisión:
//   (1) las rutas del día dicen QUÉ se ejecuta (plan operativo) y cuál necesita
//       atención AHORA, en vez de repetir el nombre del vendedor;
//   (2) el resumen de actividades deja de contradecir al timeline;
//   (3) las paradas se leen en orden de EJECUCIÓN y el salto de orden se ve;
//   (4) la búsqueda de clientes ofrece primero los que EMPIEZAN con lo escrito.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deriveRouteRows, routeAttention, sortRoutesByAttention } from '../src/modules/supervisor-ventas/v2/presentation.js'
import {
  sortStopsByExecution, outOfSequenceStopIds, checkinDistanceLabel,
} from '../src/modules/supervisor-ventas/v2/rutas/rutaDetalleModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (1) Rutas del día: qué se ejecuta + jerarquía de atención ────────────────

test('la ruta del día expone su plan operativo (no solo el vendedor)', () => {
  const rows = deriveRouteRows({
    routes: [{ plan_id: 1, route_name: 'ESTEVAN VALERIO', operational_plan: { tipo: 'SO', id: 3, name: 'Mercado' } }],
  })
  assert.deepEqual(rows[0].operationalPlan, { tipo: 'SO', id: 3, name: 'Mercado' })
  // Sin plan operativo NO se inventa uno: la PWA nombra la ausencia.
  const sinPlan = deriveRouteRows({ routes: [{ plan_id: 2, route_name: 'X' }] })
  assert.equal(sinPlan[0].operationalPlan, null)
})

test('la ruta que NO ha salido sube al tope y dice por qué', () => {
  const rows = [
    { routeName: 'A', departureStatus: 'on_time', stopsDone: 5, stopsTotal: 10 },
    { routeName: 'B', departureStatus: 'not_departed', stopsDone: 0, stopsTotal: 21 },
    { routeName: 'C', departureStatus: 'late', stopsDone: 8, stopsTotal: 35 },
  ]
  const orden = sortRoutesByAttention(rows).map((r) => r.routeName)
  assert.deepEqual(orden, ['B', 'C', 'A'], 'no salió → salió tarde → en orden')
  assert.equal(routeAttention(rows[1]).reason, 'No ha salido')
  assert.equal(routeAttention(rows[1]).level, 'bad')
  assert.equal(routeAttention(rows[2]).reason, 'Salió tarde')
  // Una ruta sana no inventa una alarma.
  assert.equal(routeAttention(rows[0]).reason, null)
})

test('la jerarquía distingue incidencia, sin señal y salió-pero-sin-visitas', () => {
  assert.equal(routeAttention({ departureStatus: 'on_time', incidentCount: 2 }).reason, 'Con incidencia')
  assert.equal(routeAttention({ departureStatus: 'on_time', signalStatus: 'no_signal' }).reason, 'Sin señal')
  assert.equal(
    routeAttention({ departureStatus: 'on_time', stopsDone: 0, stopsTotal: 12 }).reason,
    'Sin visitas aún',
  )
  // Sin paradas planeadas no se acusa de "sin visitas".
  assert.equal(routeAttention({ departureStatus: 'on_time', stopsDone: 0, stopsTotal: 0 }).reason, null)
})

test('el orden por atención es estable ante empates', () => {
  const rows = [{ routeName: 'A' }, { routeName: 'B' }, { routeName: 'C' }]
  assert.deepEqual(sortRoutesByAttention(rows).map((r) => r.routeName), ['A', 'B', 'C'])
  // No muta la lista original.
  const orig = [{ routeName: 'Z', departureStatus: 'not_departed' }, { routeName: 'A' }]
  const copia = [...orig]
  sortRoutesByAttention(orig)
  assert.deepEqual(orig, copia)
})

test('la tarjeta pinta el plan operativo y el motivo de atención', () => {
  const s = src('modules/supervisor-ventas/v2/rutas/RutasView.jsx')
  assert.match(s, /sortRoutesByAttention\(deriveRouteRows/, 'ordena por atención')
  assert.match(s, /Sin plan operativo/, 'nombra la ausencia del plan')
  assert.match(s, /v2-ruta-atencion/, 'el motivo va en palabra, no solo color')
})

// ── (2) Resumen de actividades coherente ────────────────────────────────────

test('el resumen distingue "sin checador" de "sin registro" y usa la salida real', () => {
  const s = src('modules/supervisor-ventas/v2/rutas/RutaDetalle.jsx')
  assert.match(s, /Sin checador/, 'no hay fuente de asistencia en el entorno')
  assert.match(s, /Sin registro/, 'hay fuente pero el vendedor no marcó')
  assert.match(s, /departureRealAt/, 'el arranque cae a la SALIDA real del day-control')
  assert.match(s, /tras salir/, 'y lo dice, en vez de fingir la brecha del checador')
})

// ── (3) Paradas en orden de ejecución ───────────────────────────────────────

test('las visitadas van por hora real; las pendientes, por secuencia planeada', () => {
  const stops = [
    { stop_id: 1, sequence: 10, actual_start_time: '2026-08-07T15:30:00Z' },
    { stop_id: 2, sequence: 20, actual_start_time: null },
    { stop_id: 3, sequence: 50, actual_start_time: '2026-08-07T15:05:00Z' },
    { stop_id: 4, sequence: 15, actual_start_time: null },
  ]
  const orden = sortStopsByExecution(stops).map((s) => s.stop_id)
  assert.deepEqual(orden, [3, 1, 4, 2], 'visitadas 15:05→15:30, luego pendientes 15→20')
  // No muta la lista original.
  assert.equal(stops[0].stop_id, 1)
})

test('el salto de secuencia se detecta sobre el recorrido real', () => {
  const stops = sortStopsByExecution([
    { stop_id: 1, sequence: 10, actual_start_time: '2026-08-07T15:00:00Z' },
    { stop_id: 2, sequence: 50, actual_start_time: '2026-08-07T15:20:00Z' },
    { stop_id: 3, sequence: 20, actual_start_time: '2026-08-07T15:40:00Z' },  // volvió atrás
  ])
  const fuera = outOfSequenceStopIds(stops)
  assert.equal(fuera.has(3), true, 'la 20 después de la 50 está fuera de orden')
  assert.equal(fuera.has(1), false)
  assert.equal(fuera.has(2), false, 'ir 10→50 aún no prueba desorden; volver atrás sí')
})

test('la distancia del check-in se nombra honestamente (0 m = en sitio)', () => {
  assert.equal(checkinDistanceLabel(0), 'en sitio', '0 m es válido, no "sin dato"')
  assert.equal(checkinDistanceLabel(350), 'a 350 m')
  assert.equal(checkinDistanceLabel(2400), 'a 2.4 km')
  assert.equal(checkinDistanceLabel(null), null, 'sin dato ⇒ no se pinta')
  assert.equal(checkinDistanceLabel(undefined), null)
})

test('el detalle pinta el orden de ejecución, el fuera de orden y la distancia', () => {
  const s = src('modules/supervisor-ventas/v2/rutas/RutaDetalle.jsx')
  assert.match(s, /sortStopsByExecution\(stops\)/)
  assert.match(s, /ruta-stop-fuera-secuencia/)
  assert.match(s, /ruta-stop-checkin-dist/)
  assert.doesNotMatch(s, /stops\.map\(\(st, i\)/, 'ya no se renderiza en orden de secuencia cruda')
})
