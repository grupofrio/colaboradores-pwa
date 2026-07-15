import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { readM3Access, scopeFindingsForAccess, M3_ALLOWED_JOB_KEYS, M3_ALLOWED_TOWER_STATUS } from '../src/modules/ejecucion/m3/access.js'
import { applyFindingFilters, paginate, M3_DEFAULT_FILTERS } from '../src/modules/ejecucion/m3/filters.js'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, planVsRealText, sanitizeForExport,
  neutralizeCsvCell, csvCell, exportFilename, M3_CSV_COLUMNS,
} from '../src/modules/ejecucion/m3/exporters.js'
import { isM3DemoAllowed } from '../src/modules/ejecucion/m3/demoGate.js'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const towerSession = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const FINDINGS = M3_API_LATEST_FIXTURE.findings

// ── Matriz de acceso (Fase 10, fail-closed) ──────────────────────────────────
test('contrato v1: direccion_general y su proyección admin_plataforma', () => {
  assert.deepEqual([...M3_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.deepEqual([...M3_ALLOWED_TOWER_STATUS], ['admin_plataforma'])
})

test('direccion_general: GLOBAL (primario y vía additional_job_keys)', () => {
  assert.deepEqual(readM3Access(s('direccion_general')), { level: 'global', reason: 'job_key_direccion_general' })
  assert.equal(readM3Access(s('gerente_sucursal', { additional_job_keys: ['direccion_general'] })).level, 'global')
})

test('admin_plataforma (tower_status): GLOBAL', () => {
  assert.deepEqual(readM3Access(towerSession('admin_plataforma')), { level: 'global', reason: 'tower_admin_plataforma' })
})

test('DELIBERADO Fase 10: chofer/jefe_ruta NO acceden al observatorio ejecutivo', () => {
  for (const role of ['jefe_ruta', 'auxiliar_ruta', 'operador_barra', 'almacenista_entregas']) {
    assert.equal(readM3Access(s(role)).level, 'none', role)
  }
})

test('DELIBERADO: supervisor_ventas NO hereda de Tower · gerente_sucursal = none v1 (S/N pendiente)', () => {
  assert.equal(readM3Access(towerSession('supervisor_ventas')).level, 'none')
  assert.equal(readM3Access(s('supervisor_ventas')).level, 'none')
  assert.equal(readM3Access(s('gerente_sucursal')).level, 'none')
})

test('sesión inválida => none aunque el payload traiga rol privilegiado', () => {
  for (const bad of [null, undefined, {}, { role: 'direccion_general' },
    { employee_id: 1, session_token: 'x', exp: 1, role: 'direccion_general' },
    { employee: { tower_status: 'admin_plataforma' } }]) {
    assert.equal(readM3Access(bad).level, 'none')
  }
})

test('tower_status mal-case o ajeno NO abre M3 (strict-case)', () => {
  for (const ts of ['ADMIN_PLATAFORMA', 'Admin_Plataforma', 'gerente_sucursal', '', null]) {
    assert.equal(readM3Access(towerSession(ts)).level, 'none', String(ts))
  }
})

test('scope: none => cero hallazgos (sin fuga); global => todo', () => {
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, { level: 'none' }), [])
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, null), [])
  assert.equal(scopeFindingsForAccess(FINDINGS, { level: 'global' }).length, FINDINGS.length)
})

// ── Demo gate ────────────────────────────────────────────────────────────────
test('demo gate: DEV sí · Preview con VITE_ENABLE_M3_DEMO sí · producción NO', () => {
  assert.equal(isM3DemoAllowed({ DEV: true }), true)
  assert.equal(isM3DemoAllowed({ DEV: false, VITE_ENABLE_M3_DEMO: 'true' }), true)
  assert.equal(isM3DemoAllowed({ DEV: false, PROD: true }), false)
  assert.equal(isM3DemoAllowed({ DEV: false, VITE_ENABLE_M3_DEMO: '1' }), false)
  assert.equal(isM3DemoAllowed(null), false)
})

// ── Filtros locales (semántica del contrato) ─────────────────────────────────
test('filtros: categoría/sucursal/granularidad/severidad/búsqueda/fechas', () => {
  const cierre = applyFindingFilters(FINDINGS, { category: 'cierre' })
  assert.ok(cierre.length >= 4 && cierre.every((f) => f.category === 'cierre'))
  const branch29 = applyFindingFilters(FINDINGS, { branch_id: '29' })
  assert.equal(branch29.length, 1)
  assert.equal(branch29[0].rule_code, 'M3-A-07')
  const branch = applyFindingFilters(FINDINGS, { granularity: 'branch' })
  assert.equal(branch.length, 2)
  const high = applyFindingFilters(FINDINGS, { severity: 'high' })
  assert.ok(high.every((f) => f.severity === 'high'))
  const search = applyFindingFilters(FINDINGS, { search: 'caja' })
  assert.ok(search.some((f) => f.rule_code === 'M3-F-05'))
  assert.equal(applyFindingFilters(FINDINGS, { date_from: '2026-07-16' }).length, 0)
  assert.deepEqual(applyFindingFilters(null, M3_DEFAULT_FILTERS), [])
})

test('paginación defensiva: clamps y defaults', () => {
  const items = Array.from({ length: 28 }, (_, i) => ({ i }))
  assert.equal(paginate(items, 3, 10).items.length, 8)
  assert.equal(paginate(items, 99, 10).page, 3)
  assert.equal(paginate(items, -5, 10).page, 1)
})

// ── CSV injection ────────────────────────────────────────────────────────────
test('neutralizeCsvCell: fórmulas y controles neutralizados', () => {
  assert.equal(neutralizeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(neutralizeCsvCell('+CMD'), "'+CMD")
  assert.equal(neutralizeCsvCell('-1+2'), "'-1+2")
  assert.equal(neutralizeCsvCell('@HYPERLINK'), "'@HYPERLINK")
  assert.equal(neutralizeCsvCell('\tx'), "'\tx")
  assert.equal(neutralizeCsvCell('\nx'), "'\nx")
  assert.equal(neutralizeCsvCell('texto ñormal ✓'), 'texto ñormal ✓')
})

test('findingsToCsv: payload hostil no produce celdas ejecutables', () => {
  const hostile = [{
    finding_id: '=2+5', rule_code: '+CMD|calc', category: '-neg', severity: '@at',
    status: 'RED', granularity: 'aggregate', lifecycle_status: 'new', title: '\ttab',
    branch_id: null, branch_code: null, route_id: null, plan_id: null,
    entity_type: 'x', entity_reference: '=HYPERLINK("http://evil")', observed_value: 'ok',
    expected_rule: 'r', numerator: 1, denominator: 2, pct: 50, incidences: 1,
    responsible_area: 'a', owner_status: 'unassigned', first_seen_at: 'x',
    last_seen_at: 'y', occurrence_count: 1, source_model: 'm', source_timestamp: 't',
  }]
  const csv = findingsToCsv(hostile)
  const dataLine = csv.split('\n')[1]
  assert.ok(!/(^|,)[=+\-@]/.test(dataLine), `sin celdas de fórmula: ${dataLine}`)
  assert.equal(csv.split('\n')[0], M3_CSV_COLUMNS.join(','))
})

test('exportFilename: STALE/DEMO en el nombre · revokeObjectURL presente', () => {
  assert.equal(exportFilename('m3_findings', 'csv'), 'm3_findings.csv')
  assert.equal(exportFilename('m3_findings', 'csv', { stale: true, demo: true }), 'm3_findings_DEMO_STALE.csv')
  const src = readFileSync(new URL('../src/modules/ejecucion/m3/exporters.js', import.meta.url), 'utf8')
  assert.match(src, /URL\.revokeObjectURL\(url\)/)
})

test('sanitizeForExport: claves sensibles fuera, credenciales [REDACTED]', () => {
  const clean = sanitizeForExport({
    ok: 1, api_key: 'sk-123', nested: { employee_name: 'X', keep: 'yes', note: 'token: abc123' },
  })
  assert.equal(clean.api_key, undefined)
  assert.equal(clean.nested.employee_name, undefined)
  assert.equal(clean.nested.note, '[REDACTED]')
})

test('resumen ejecutivo y plan-vs-real: metadata honesta + números reales', () => {
  const stalePayload = { ...JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE)), stale: true, age_days: 9 }
  const text = executiveSummaryText(stalePayload, { demo: true })
  assert.ok(text.includes('CORRIDA STALE'))
  assert.ok(text.includes('MODO DEMO'))
  assert.ok(text.includes('M3 está funcionando y detectó incumplimientos'))
  assert.ok(text.includes('NO entidades únicas'))
  assert.ok(/INCUMPLIMIENTOS definitivos/i.test(text), 'el resumen desglosa por veredicto')
  assert.ok(/ANOMAL[IÍ]AS exploratorias/i.test(text), 'separa anomalías de incumplimientos')
  assert.ok(text.includes('suma exacta del desglose'), 'el total declara que es suma de partes')
  assert.ok(text.includes('M3 observa, no corrige'))
  const pvr = planVsRealText(M3_API_LATEST_FIXTURE)
  assert.ok(pvr.includes('COMPARACIÓN PLAN VS REAL'))
  assert.ok(pvr.includes('971'), 'visitas fuera del plan (ventana acotada)')
  assert.ok(pvr.includes('terminaron en VENTA'), 'off-route no se presenta como incumplimiento')
  assert.ok(pvr.includes('M3-H-02'))
  assert.ok(/COBERTURA/.test(pvr), 'publica la cobertura antes de concluir')
  assert.ok(pvr.includes('Sensibilidad por universo'), 'Track H en el export')
  assert.ok(/no inventados/.test(pvr))
  const json = JSON.parse(evidenceJson(stalePayload))
  assert.equal(json.exported_schema, 'kold.os.m3.export/1')
  assert.equal(json.export_meta.stale, true)
})
