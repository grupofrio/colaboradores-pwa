// Supervisor V2 · matriz semanal de cumplimiento ("Mis rutas de mañana").
// (a) modelo puro routesWeekModel; (b) cableado de fuente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  weekdayLabel, toneWord, cellLabel, tomorrowSummary, rowName, rowRouteId, rowZone, typeLabel,
  executiveSummary, actionPhrase, pendingBreakdown, formatCount, toggleOperationalSelection,
  filterMatrixRows, isReadyTomorrow, encodeSourcesParam, decodeSourcesParam, zoneFromSources,
  resolveArmarZone, canEnsureRoutePlan, deriveSummaryFromRows, cellAssignmentLine, cellAssignAttr,
  countGlyph,
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

test('P1-2: el preview del plan usa stops_preview y NO cae a sudo', () => {
  const lib = src('lib/api.js')
  const start = lib.indexOf("/pwa-supv/route-plan-preview-customers")
  assert.ok(start > 0, 'existe el shim de preview')
  // Bloque hasta el siguiente handler (route-plan-save-draft).
  const end = lib.indexOf('/pwa-supv/route-plan-save-draft', start)
  const block = lib.slice(start, end > 0 ? end : start + 4000)
  assert.ok(/route_plan\/stops_preview/.test(block), 'usa el endpoint seguro stops_preview')
  assert.ok(!/sudo:\s*1/.test(block), 'sin fallback sudo:1 en el preview (P1-2)')
  assert.ok(!/readModelSorted\('gf\.route\.stop'/.test(block), 'sin read ORM directo de paradas')
  assert.ok(/ok: false/.test(block) && /No se pudieron cargar las paradas/.test(block), 'degrada a error honesto')
})

test('wiring: SO hereda el segmento (query param seg) al armar', () => {
  const cont = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.ok(/seg/.test(cont) && /initialSegmentId/.test(cont), 'thread del segmento')
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.ok(/initialSegmentId/.test(tab), 'el tab acepta el segmento heredado')
})

test('selector de segmento deja explícito que vacío no filtra', () => {
  const tab = src('modules/supervisor-ventas/v2/planear/PlanearMananaTab.jsx')
  assert.match(tab, /<option value="">Ninguno \(sin filtro de segmento\)<\/option>/)
  assert.doesNotMatch(tab, /<option value="">Todos<\/option>/)
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

test('resumen ejecutivo: counts dinámicos y null ≠ 0', () => {
  const empty = executiveSummary({ counts: { total: 0, SO: 0, SP: 0, P: 0 }, rows: [], summary: {
    total_operational_plans: 0, ready_tomorrow: 0, pending_tomorrow: 0,
    no_plan_tomorrow: 0, incomplete_resources_tomorrow: 0, blocked_tomorrow: 0,
    week_rows_with_missing_route: 0, weekly_coverage_pct: null,
  } })
  assert.equal(empty.total, 0)
  assert.equal(empty.coverage, null)
  assert.equal(actionPhrase(empty), 'No hay planes operativos.')
  assert.equal(formatCount(null), 'Sin dato')

  const fifteen = executiveSummary({
    counts: { total: 15, SO: 5, SP: 8, P: 2 },
    summary: {
      total_operational_plans: 15, ready_tomorrow: 9, pending_tomorrow: 6,
      no_plan_tomorrow: 3, incomplete_resources_tomorrow: 2, blocked_tomorrow: 1,
      to_assign_tomorrow: 5, to_prepare_tomorrow: 1,
      week_rows_with_missing_route: 3, weekly_coverage_pct: 78,
      SO: 5, SP: 8, P: 2,
    },
  })
  assert.equal(fifteen.total, 15)
  assert.equal(fifteen.pending, 6)
  assert.equal(fifteen.toAssign, 5)
  assert.equal(fifteen.toPrepare, 1)
  assert.equal(actionPhrase(fifteen), 'Te faltan 5 por asignar y 1 por dejar completamente preparados.')
  assert.ok(pendingBreakdown(fifteen).some((p) => p.text.includes('por asignar')))
  assert.ok(pendingBreakdown(fifteen).some((p) => p.text.includes('completamente preparado')))

  const n = executiveSummary({ counts: { total: 2, SO: 2, SP: 0, P: 0 }, rows: [{}, {}] })
  assert.equal(n.total, 2)
})

test('selección 1–2: no sustituye al intentar 3', () => {
  const a = { tipo: 'SO', id: 1, name: 'A', key: 'SO:1' }
  const b = { tipo: 'SP', id: 2, name: 'B', key: 'SP:2' }
  const c = { tipo: 'P', id: 3, name: 'C', key: 'P:3' }
  const one = toggleOperationalSelection([], a)
  assert.equal(one.selected.length, 1)
  const two = toggleOperationalSelection(one.selected, b)
  assert.equal(two.selected.length, 2)
  assert.equal(two.error, null)
  const three = toggleOperationalSelection(two.selected, c)
  assert.equal(three.selected.length, 2)
  assert.match(three.error, /No puedes combinar más de 2/)
  const off = toggleOperationalSelection(two.selected, a)
  assert.equal(off.selected.length, 1)
})

test('filtros de matriz: SO/SP/P y pendientes', () => {
  const rows = [
    { tipo: 'SO', tomorrow: { assignment_state: 'assigned', planning_readiness: 'ready_to_publish' }, days: [{ has_plan: true }] },
    { tipo: 'SP', tomorrow: { assignment_state: 'no_plan' }, days: [{ has_plan: false }] },
    { tipo: 'P', tomorrow: { assignment_state: 'unassigned' }, days: [{ has_plan: true }] },
  ]
  assert.equal(filterMatrixRows(rows, 'SO').length, 1)
  assert.equal(filterMatrixRows(rows, 'pending_tomorrow').length, 2)
  assert.equal(filterMatrixRows(rows, 'ready_tomorrow').length, 1)
  assert.equal(filterMatrixRows(rows, 'week_gaps').length, 1)
})

test('assigned ≠ ready_to_publish', () => {
  const assigned = { tomorrow: { assignment_state: 'assigned', planning_readiness: 'needs_snapshot' } }
  const ready = { tomorrow: { assignment_state: 'assigned', planning_readiness: 'ready_to_publish' } }
  const published = { tomorrow: { assignment_state: 'published', planning_readiness: 'published' } }
  assert.equal(isReadyTomorrow(assigned), false)
  assert.equal(isReadyTomorrow(ready), true)
  assert.equal(isReadyTomorrow(published), true)
})

test('wiring: resumen + filtros + selección en la matriz', () => {
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /rw-filter-pending_tomorrow/)
  assert.match(m, /Armar una ruta/)
  assert.match(m, /rw-select/)
  assert.match(m, /actionPhrase/)
})

test('P0-03: polígono sobrevive roundtrip SP + poly gana sobre src', () => {
  const row = { tipo: 'SP', id: 39, key: 'SP:39', polygon: { id: 26 }, name: 'Norte' }
  const encoded = encodeSourcesParam([row])
  assert.match(encoded, /SP:39/)
  assert.match(encoded, /P:26/)
  const decoded = decodeSourcesParam(encoded)
  const zone = zoneFromSources(decoded)
  assert.equal(zone.subpolygonId, 39)
  assert.equal(zone.polygonId, 26)
  const won = resolveArmarZone({ poly: '26', sub: '39', seg: '', src: 'SP:39' })
  assert.equal(won.polygonId, 26)
  assert.equal(won.subpolygonId, 39)
  assert.equal(canEnsureRoutePlan({ polygonId: 0, subpolygonId: 0, segmentId: 0, sources: [] }), false)
  assert.equal(canEnsureRoutePlan({ polygonId: 26, sources: [] }), true)
  assert.equal(canEnsureRoutePlan({
    polygonId: 0, subpolygonId: 0, segmentId: 0, sources: [{ tipo: 'SP', id: 39 }],
  }), false)
})

test('P1-04: pre-contrato null ≠ 0 y breakdown sin doble conteo', () => {
  const pre = deriveSummaryFromRows([
    { tipo: 'SO', id: 1, tomorrow: { plan_count: 1 }, days: [{ has_plan: true }] },
    { tipo: 'SP', id: 2, tomorrow: {}, days: [{ has_plan: false }] },
  ])
  assert.equal(pre.published, null)
  assert.equal(pre.readyToPublish, null)
  assert.equal(pre.ready, null)
  assert.equal(formatCount(pre.published), 'Sin dato')
  assert.equal(cellAssignmentLine({ has_plan: true }), '')
  assert.equal(cellAssignAttr({ has_plan: true }), 'unknown')
  assert.notEqual(cellAssignAttr({ has_plan: true }), 'no_plan')
  assert.equal(countGlyph(null), '○')
  assert.equal(countGlyph(0, { zeroGood: true }), '✓')
  assert.equal(countGlyph(3, { zeroGood: true }), '⚠')
  const bd = pendingBreakdown({ toAssign: 5, toPrepare: 1, noPlan: 3, incomplete: 2, blocked: 1 })
  const texts = bd.map((p) => p.text).join(' ')
  assert.ok(texts.includes('por asignar'))
  assert.ok(!texts.includes('todavía no tiene'))
  assert.ok(!texts.includes('completar recursos'))
})
