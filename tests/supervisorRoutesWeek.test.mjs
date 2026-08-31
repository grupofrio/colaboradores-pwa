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
  collectUnmappedPlans, unmappedAttentionLevel, buildSharedPlanIndex, sharedPlanLabel,
  uniquePublishedPlanCount, assignmentLabel, sortUnmappedPlans, unmappedDateLabel,
  buildSharedPlanIndexByDate, planIdsFromCell,
  resolveTargetRouteId, assertSourcesZoneCompatible, MAX_OPERATIONAL_SOURCES,
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

// ── P1 unmapped + shared plan UX (A–G) + pre-review corrections ──────────────

const SHARED_PLAN_ID = 6926
const SHARED_PLAN_NAME = 'RPLAN/2026/00896'
const TODAY = '2026-08-19'
const TOMORROW = '2026-08-20'

function todaySharedRows() {
  const todayCell = {
    date: TODAY,
    has_plan: true,
    plan_id: SHARED_PLAN_ID,
    plan_ids: [SHARED_PLAN_ID],
    plan_name: SHARED_PLAN_NAME,
    plan_count: 1,
    assignment_state: 'published',
  }
  const emptyTomorrow = { plan_count: 0, plan_ids: [], has_plan: false, assignment_state: 'no_plan' }
  return [
    { key: 'SO:13', tipo: 'SO', id: 13, name: 'Recorridos Norte', days: [todayCell], tomorrow: emptyTomorrow },
    { key: 'SP:40', tipo: 'SP', id: 40, name: 'Iguala NORTE B', days: [todayCell], tomorrow: emptyTomorrow },
    { key: 'P:14', tipo: 'P', id: 14, name: 'Iguala NORTE', days: [todayCell], tomorrow: emptyTomorrow },
  ]
}

function sharedPlanRowsTomorrow() {
  const tomorrow = {
    plan_id: SHARED_PLAN_ID,
    plan_ids: [SHARED_PLAN_ID],
    plans_meta: [{ plan_id: SHARED_PLAN_ID, plan_name: SHARED_PLAN_NAME, state: 'published' }],
    plan_name: SHARED_PLAN_NAME,
    plan_count: 1,
    assignment_state: 'published',
    planning_readiness: 'published',
    assigned: true,
  }
  return [
    { key: 'SO:13', tipo: 'SO', id: 13, name: 'Recorridos Norte', tomorrow },
    { key: 'SP:40', tipo: 'SP', id: 40, name: 'Iguala NORTE B', tomorrow },
    { key: 'P:14', tipo: 'P', id: 14, name: 'Iguala NORTE', tomorrow },
  ]
}

test('P1-A TODAY: 6926 solo en hoy → badge en celdas de hoy', () => {
  const rows = todaySharedRows()
  const index = buildSharedPlanIndex(rows, { dateIso: TODAY, tomorrowIso: TOMORROW })
  assert.equal(index.get(SHARED_PLAN_ID).row_keys.length, 3)
  for (const row of rows) {
    const label = sharedPlanLabel(row, index, { dateIso: TODAY, tomorrowIso: TOMORROW })
    assert.match(label, /Ruta compartida · RPLAN\/2026\/00896/)
  }
})

test('P1-A TOMORROW: 6926 solo en hoy → sin badge falso en mañana', () => {
  const rows = todaySharedRows()
  const index = buildSharedPlanIndex(rows, { dateIso: TOMORROW, tomorrowIso: TOMORROW })
  for (const row of rows) {
    assert.equal(sharedPlanLabel(row, index, { dateIso: TOMORROW, tomorrowIso: TOMORROW }), null)
  }
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /sharedByDate\[cell\.date\]/)
  assert.doesNotMatch(m, /sharedLabel.*rowName/)
})

test('A: plan SO+SP+P → 3 filas + badge Ruta compartida (mañana)', () => {
  const rows = sharedPlanRowsTomorrow()
  assert.equal(rows.length, 3)
  const index = buildSharedPlanIndex(rows, { dateIso: TOMORROW, tomorrowIso: TOMORROW })
  assert.equal(index.get(SHARED_PLAN_ID).row_keys.length, 3)
  for (const row of rows) {
    assert.match(sharedPlanLabel(row, index, { dateIso: TOMORROW, tomorrowIso: TOMORROW }), /Ruta compartida · RPLAN/)
  }
})

test('B: 1 plan compartido en 3 filas => published unique = 1', () => {
  const rows = sharedPlanRowsTomorrow()
  const summary = deriveSummaryFromRows(rows, { total: 3 })
  assert.equal(summary.published, 1)
  assert.equal(uniquePublishedPlanCount({ unique_published_plans_tomorrow: 1 }, rows), 1)
})

test('P1-B: 2 planes distintos en 1 fila => published unique = 2', () => {
  const tomorrow = {
    plan_count: 2,
    plan_ids: [7001, 7002],
    plans_meta: [
      { plan_id: 7001, plan_name: 'RPLAN/A', state: 'published' },
      { plan_id: 7002, plan_name: 'RPLAN/B', state: 'published' },
    ],
    assignment_state: 'published',
    planning_readiness: 'published',
  }
  const rows = [{ key: 'P:14', tipo: 'P', id: 14, name: 'Iguala NORTE', tomorrow }]
  assert.equal(uniquePublishedPlanCount(null, rows), 2)
})

test('P1-B: 2 planes, uno compartido con otra fila => unique = 2', () => {
  const sharedTomorrow = {
    plan_count: 1,
    plan_ids: [7001],
    plans_meta: [{ plan_id: 7001, state: 'published', plan_name: 'RPLAN/S' }],
    assignment_state: 'published',
    planning_readiness: 'published',
  }
  const dualTomorrow = {
    plan_count: 2,
    plan_ids: [7001, 7002],
    plans_meta: [
      { plan_id: 7001, state: 'published', plan_name: 'RPLAN/S' },
      { plan_id: 7002, state: 'published', plan_name: 'RPLAN/T' },
    ],
    assignment_state: 'published',
    planning_readiness: 'published',
  }
  const rows = [
    { key: 'SP:40', tipo: 'SP', id: 40, name: 'Norte B', tomorrow: sharedTomorrow },
    { key: 'P:14', tipo: 'P', id: 14, name: 'Norte', tomorrow: dualTomorrow },
  ]
  assert.equal(uniquePublishedPlanCount(null, rows), 2)
})

test('C: plan published sin match aparece en unmapped_plans', () => {
  const orphan = {
    plan_id: 6930,
    plan_name: 'RPLAN/2026/00900',
    date: '2026-08-19',
    state: 'published',
    assignment_state: 'published',
    route: { id: 15, name: 'MANUEL CRUZ ARMENTA' },
    vehicle: { id: 10, name: 'NP300' },
    salesperson: { id: 682, name: 'MANUEL CRUZ ARMENTA' },
  }
  const data = { rows: [{ key: 'SO:13', tipo: 'SO', id: 13, name: 'Recorridos Norte', tomorrow: {} }], unmapped_plans: [orphan] }
  const list = collectUnmappedPlans(data)
  assert.equal(list.length, 1)
  assert.equal(list[0].plan_id, 6930)
  assert.equal(unmappedAttentionLevel(list[0]), 'high')
})

test('D: unmapped NO crea fila operativa SO/SP/P', () => {
  const data = {
    rows: [{ key: 'SO:13', tipo: 'SO', id: 13, name: 'Recorridos Norte', tomorrow: { assignment_state: 'no_plan' } }],
    unmapped_plans: [{ plan_id: 6930, state: 'published', route: { name: 'X' } }],
  }
  assert.equal(data.rows.length, 1)
  assert.equal(collectUnmappedPlans(data).length, 1)
  assert.ok(!data.rows.some((r) => r.tipo === 'unmapped'))
})

test('E: plan draft unmapped usa severidad menor', () => {
  const draft = { plan_id: 99, state: 'draft', assignment_state: 'unassigned' }
  assert.equal(unmappedAttentionLevel(draft), 'low')
  assert.equal(unmappedAttentionLevel({ state: 'published' }), 'high')
})

test('F: sin unmapped → UI sin alerta (regresión)', () => {
  const data = { rows: sharedPlanRowsTomorrow(), unmapped_plans: [] }
  assert.equal(collectUnmappedPlans(data).length, 0)
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /UnmappedPlansAlert/)
  assert.match(m, /if \(!items\.length\) return null/)
  assert.match(m, /Hay rutas que no están ligadas a un plan operativo/)
})

test('P2: unmapped muestra fecha y orden hoy → mañana → resto', () => {
  const items = sortUnmappedPlans([
    { plan_id: 3, date: '2026-08-18' },
    { plan_id: 1, date: TODAY },
    { plan_id: 2, date: TOMORROW },
  ], { todayIso: TODAY, tomorrowIso: TOMORROW })
  assert.deepEqual(items.map((i) => i.plan_id), [1, 2, 3])
  assert.match(unmappedDateLabel(TODAY, { todayIso: TODAY, tomorrowIso: TOMORROW }), /^Hoy ·/)
  assert.match(unmappedDateLabel(TOMORROW, { todayIso: TODAY, tomorrowIso: TOMORROW }), /^Mañana ·/)
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /unmappedDateLabel/)
  assert.match(m, /sortUnmappedPlans/)
})

test('G: scope — unmapped solo viene del backend branch-scoped (contrato)', () => {
  const data = {
    rows: [],
    unmapped_plans: [{ plan_id: 1, date: '2026-08-19', route: { name: 'Local' } }],
    data_notes: { scope: 'branch_config_id == 29' },
  }
  assert.equal(collectUnmappedPlans(data).length, 1)
  const api = src('modules/supervisor-ventas/api.js')
  assert.match(api, /routes-week/)
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.doesNotMatch(m, /unmapped_plans.*filter.*branch/)
  assert.match(m, /collectUnmappedPlans/)
})

test('wiring: alerta unmapped + copy operativo en Mis planes de mañana', () => {
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /rw-unmapped-alert/)
  assert.match(m, /rw-unmapped-item/)
  assert.match(m, /Fecha:/)
  assert.match(m, /Vendedor/)
  assert.match(m, /Unidad/)
  assert.match(m, /uniquePublishedPlanCount/)
  assert.match(m, /data-shared/)
})

// ── P1 multi-plan fail-closed: routeId + zone compatibility ──────────────────

test('MAX_OPERATIONAL_SOURCES=2 contractual (aligned backend MAX_SOURCES)', () => {
  assert.equal(MAX_OPERATIONAL_SOURCES, 2)
  const model = src('modules/supervisor-ventas/v2/planear/routesWeekModel.js')
  assert.match(model, /MAX_SOURCES\s*=\s*2|backend MAX_SOURCES/)
})

test('resolveTargetRouteId: 1 source / shared / none / conflict fail-closed', () => {
  assert.deepEqual(resolveTargetRouteId([{ routeId: 7 }]), { routeId: 7, error: null })
  assert.deepEqual(
    resolveTargetRouteId([{ routeId: 7 }, { routeId: 7 }]),
    { routeId: 7, error: null },
  )
  assert.deepEqual(resolveTargetRouteId([{ routeId: 0 }, {}]), { routeId: 0, error: null })
  const conflict = resolveTargetRouteId([{ routeId: 7 }, { routeId: 9 }])
  assert.equal(conflict.routeId, 0)
  assert.match(conflict.error, /rutas distintas/i)
  // Nunca silencioso first-find
  const mis = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.doesNotMatch(mis, /sources\.find\(\(s\) => s\.routeId\)\?\.routeId/)
  assert.match(mis, /resolveTargetRouteId/)
})

test('assertSourcesZoneCompatible: 1 source + 2 compatible OK', () => {
  assert.equal(assertSourcesZoneCompatible([{ tipo: 'SP', id: 39, polygon: { id: 26 } }]).ok, true)
  const compat = assertSourcesZoneCompatible([
    { tipo: 'SP', id: 39, polygon: { id: 26 } },
    { tipo: 'SP', id: 40, polygon: { id: 26 } },
  ])
  assert.equal(compat.ok, true)
  assert.equal(compat.error, null)
  const zone = zoneFromSources([
    { tipo: 'SP', id: 39, polygon: { id: 26 } },
    { tipo: 'SO', id: 15 },
  ])
  assert.equal(zone.subpolygonId, 39)
  assert.equal(zone.polygonId, 26)
  assert.equal(zone.segmentId, 15)
  assert.equal(assertSourcesZoneCompatible([
    { tipo: 'SP', id: 39, polygon: { id: 26 } },
    { tipo: 'SO', id: 15 },
  ]).ok, true)
})

test('assertSourcesZoneCompatible: polygon / sub-parent conflict fail-closed', () => {
  const polyConflict = assertSourcesZoneCompatible([
    { tipo: 'P', id: 26 },
    { tipo: 'P', id: 27 },
  ])
  assert.equal(polyConflict.ok, false)
  assert.match(polyConflict.error, /polígonos distintos/i)

  const subConflict = assertSourcesZoneCompatible([
    { tipo: 'SP', id: 39, polygon: { id: 26 } },
    { tipo: 'SP', id: 40, polygon: { id: 27 } },
  ])
  assert.equal(subConflict.ok, false)

  const segParentsConflict = assertSourcesZoneCompatible([
    { tipo: 'SO', id: 15, polygon: { id: 26 } },
    { tipo: 'SO', id: 16, polygon: { id: 27 } },
  ])
  assert.equal(segParentsConflict.ok, false)

  // Segmentos sin padre conocido: OK (no inventar conflicto)
  assert.equal(assertSourcesZoneCompatible([
    { tipo: 'SO', id: 15 },
    { tipo: 'SO', id: 16 },
  ]).ok, true)
})

test('resolveArmarZone: no hibrida sources incompatibles', () => {
  const bad = resolveArmarZone({ src: 'P:26,P:27' })
  assert.equal(bad.polygonId, 0)
  assert.equal(bad.subpolygonId, 0)
  assert.match(bad.zoneError || '', /polígonos/i)
  const good = resolveArmarZone({ src: 'SP:39@P:26,SP:40@P:26' })
  assert.equal(good.polygonId, 26)
  assert.ok(!good.zoneError)
})

test('wiring: MisRutasManana assert zona + routeId antes de goArmar; matriz setea selectError', () => {
  const mis = src('modules/supervisor-ventas/v2/planear/MisRutasManana.jsx')
  assert.match(mis, /assertSourcesZoneCompatible/)
  assert.match(mis, /resolveTargetRouteId/)
  assert.match(mis, /zoneCheck\.error/)
  const m = src('modules/supervisor-ventas/v2/planear/RutasMananaMatriz.jsx')
  assert.match(m, /setSelectError\(err\)/)
  assert.match(m, /const err = onArmarSources\(selected\)/)
})
