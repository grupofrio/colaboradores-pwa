// Supervisor V2 · matriz semanal de cumplimiento ("Mis rutas de mañana").
// (a) modelo puro routesWeekModel; (b) cableado de fuente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  weekdayLabel, toneWord, cellLabel, tomorrowSummary, rowName, rowRouteId, rowZone, typeLabel,
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

test('rowName: el PLAN OPERATIVO (name del backend); NUNCA nombre de vendedor', () => {
  assert.equal(rowName({ tipo: 'SP', name: 'Iguala NORTE A', route: { name: 'MANUEL CRUZ ARMENTA' } }), 'Iguala NORTE A')
  assert.equal(rowName({ tipo: 'SO', name: 'Pozolerias' }), 'Pozolerias')
  assert.equal(rowName({ tipo: 'P', name: 'Taxco' }), 'Taxco')
})

test('typeLabel: tipo en palabra', () => {
  assert.equal(typeLabel('SO'), 'Segmento operativo')
  assert.equal(typeLabel('SP'), 'Subpolígono')
  assert.equal(typeLabel('P'), 'Polígono')
})

test('rowRouteId / rowZone: ruta para asignar + herencia por tipo', () => {
  assert.equal(rowRouteId({ route: { id: 7 } }), 7)
  assert.equal(rowRouteId({}), 0)
  // SP hereda subpolígono + su polígono
  assert.deepEqual(rowZone({ tipo: 'SP', id: 39, polygon: { id: 26 } }), { subpolygonId: 39, polygonId: 26, segmentId: 0 })
  // P hereda polígono
  assert.deepEqual(rowZone({ tipo: 'P', id: 26 }), { subpolygonId: 0, polygonId: 26, segmentId: 0 })
  // SO hereda segmento
  assert.deepEqual(rowZone({ tipo: 'SO', id: 15 }), { subpolygonId: 0, polygonId: 0, segmentId: 15 })
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

test('rename: "Mis planes de mañana" + columna "Plan operativo" + chip de tipo', () => {
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.ok(/Mis planes de mañana/.test(m), 'encabezado renombrado')
  assert.ok(/Plan operativo/i.test(m), 'header de columna renombrado')
  assert.ok(/rw-tipo/.test(m) && /TypeChip/.test(m), 'chip de tipo por fila')
  const reg = src('modules/registry.js')
  assert.ok(/Mis planes de mañana/.test(reg) && /shortLabel: 'Planes'/.test(reg), 'registry renombrado')
})

test('wiring: SO hereda el segmento (query param seg) al armar', () => {
  const cont = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.ok(/seg/.test(cont) && /initialSegmentId/.test(cont), 'thread del segmento')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/initialSegmentId/.test(tab), 'el tab acepta el segmento heredado')
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
