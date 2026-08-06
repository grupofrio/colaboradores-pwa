// Supervisor V2 · matriz semanal de cumplimiento ("Mis rutas de mañana").
// (a) modelo puro routesWeekModel; (b) cableado de fuente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  weekdayLabel, toneWord, cellLabel, tomorrowSummary, rowName, rowRouteId, rowZone,
} from '../src/modules/supervisor-ventas/v2/planear/routesWeekModel.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')

// ── (a) modelo puro ──────────────────────────────────────────────────────────

test('weekdayLabel: ISO → "Lun 3" (tz centro), o "—"', () => {
  assert.match(weekdayLabel('2026-08-03'), /3/) // lunes 3
  assert.equal(weekdayLabel(null), '—')
})

test('cellLabel: sin ruta ≠ 0% (has_plan=false → "Sin ruta")', () => {
  assert.equal(cellLabel({ has_plan: false }), 'Sin ruta')
  assert.equal(cellLabel({ has_plan: true, coverage_pct: 0 }), '0%', 'un 0 REAL sí se pinta')
  assert.equal(cellLabel({ has_plan: true, coverage_pct: 90 }), '90%')
  assert.equal(cellLabel({ has_plan: true, coverage_pct: null }), 'Sin dato')
})

test('toneWord: semáforo en palabra', () => {
  assert.equal(toneWord('ok'), 'Bien')
  assert.equal(toneWord('watch'), 'Parcial')
  assert.equal(toneWord('bad'), 'Bajo')
  assert.equal(toneWord('none'), 'Sin ruta')
})

test('tomorrowSummary: asignada arma unidad·chofer·vendedor; sin asignar lo dice', () => {
  const a = tomorrowSummary({ assigned: true, vehicle: { name: 'V1' }, driver: { name: 'D' }, salesperson: { name: 'S' } })
  assert.ok(a.assigned)
  assert.equal(a.text, 'V1 · D · S')
  const b = tomorrowSummary({ assigned: false })
  assert.ok(!b.assigned)
  assert.match(b.text, /sin asignar/i)
})

test('rowName: SIEMPRE subpolígono; NUNCA nombre de ruta/vendedor', () => {
  // backend entrega display_name resuelto (subpolígono o "Sin subpolígono asignado")
  assert.equal(rowName({ display_name: 'Iguala NORTE A', subpolygon: { name: 'Iguala NORTE A' }, route: { name: 'MANUEL CRUZ ARMENTA' } }), 'Iguala NORTE A')
  // sin subpolígono NO cae al nombre del vendedor: fila honesta del hueco de datos
  assert.equal(rowName({ display_name: 'Sin subpolígono asignado', subpolygon: null, route: { name: 'MANUEL CRUZ ARMENTA' } }), 'Sin subpolígono asignado')
  // red de seguridad si faltara display_name: subpolígono, jamás la ruta
  assert.equal(rowName({ subpolygon: { name: 'Sub A' }, route: { name: 'R7' } }), 'Sub A')
  assert.equal(rowName({ subpolygon: null, route: { name: 'R7' } }), 'Sin subpolígono asignado')
})

test('rowRouteId / rowZone: ruta para asignar + zona heredada', () => {
  assert.equal(rowRouteId({ route: { id: 7 } }), 7)
  assert.equal(rowRouteId({}), 0)
  assert.deepEqual(rowZone({ polygon: { id: 50 }, subpolygon: { id: 3 } }), { polygonId: 50, subpolygonId: 3 })
  assert.deepEqual(rowZone({ subpolygon: null }), { polygonId: 0, subpolygonId: 0 })
})

// ── (b) cableado ─────────────────────────────────────────────────────────────

test('wiring: getRoutesWeek + mapping /pwa-supv/routes-week → v2/routes-week', () => {
  const api = src('modules/supervisor-ventas/api.js')
  assert.ok(/export function getRoutesWeek/.test(api) && /\/pwa-supv\/routes-week/.test(api))
  const lib = src('lib/api.js')
  assert.ok(/\/pwa-supv\/routes-week/.test(lib) && /supervisor\/v2\/routes-week/.test(lib))
})

test('wiring: la matriz pinta 7 días + columna Mañana con Asignar/Reasignar', () => {
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.ok(/getRoutesWeek/.test(m))
  assert.ok(/rw-table/.test(m) && /rw-cell/.test(m) && /rw-tomorrow/.test(m))
  assert.ok(/rw-asignar/.test(m) && /rw-reasignar/.test(m))
  assert.ok(/data\.week\.days/.test(m), 'usa los 7 días del contrato')
})

test('wiring: Asignar navega al flujo de la ruta de mañana (armar+route)', () => {
  const cont = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.ok(/armar/.test(cont) && /route/.test(cont), 'switch por query param')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/initialRouteId/.test(tab) && /onExit/.test(tab), 'el flujo acepta ruta inicial y salida a la matriz')
  assert.ok(/planear-a-semana/.test(tab), 'botón de regreso a la semana')
})

test('wiring: la zona (polígono/subpolígono) se hereda de la fila a Planear mañana', () => {
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.ok(/rowZone/.test(m), 'la matriz pasa la zona de la fila')
  const cont = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.ok(/poly/.test(cont) && /sub/.test(cont), 'thread por query params poly/sub')
  assert.ok(/initialPolygonId/.test(cont) && /initialSubpolygonId/.test(cont), 'los pasa al tab')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/initialPolygonId/.test(tab) && /initialSubpolygonId/.test(tab), 'el tab acepta la zona heredada')
  assert.ok(/planear-zona-heredada/.test(tab) && /planear-cambiar-zona/.test(tab), 'muestra la zona como dato con opción de cambiar')
})

test('wiring: recursos son protagonista con estado honesto; relabel en lenguaje llano', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  // estado honesto: si no hay recursos NO se oculta el bloque (card de error + reintento)
  assert.ok(/planear-recursos-error/.test(tab), 'estado honesto de recursos, no se oculta')
  assert.ok(/resourcesEmpty/.test(tab))
  // relabel llano (adiós "Criterios de la propuesta"/"Polígono"/"Generar propuesta")
  assert.ok(/¿De qué zona propongo los clientes\?/.test(tab))
  assert.ok(/Sugerir clientes de la zona/.test(tab))
  assert.ok(!/Generar propuesta/.test(tab), 'ya no dice "Generar propuesta"')
})
