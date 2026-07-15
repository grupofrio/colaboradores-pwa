import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { readM2Access, scopeFindingsForAccess, M2_ALLOWED_JOB_KEYS, M2_ALLOWED_TOWER_STATUS } from '../src/modules/planeacion/m2/access.js'
import { applyFindingFilters, paginate, M2_DEFAULT_FILTERS } from '../src/modules/planeacion/m2/filters.js'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, sanitizeForExport,
  neutralizeCsvCell, csvCell, exportFilename, M2_CSV_COLUMNS,
} from '../src/modules/planeacion/m2/exporters.js'
import { isM2DemoAllowed } from '../src/modules/planeacion/m2/demoGate.js'
import { M2_API_LATEST_FIXTURE } from '../src/modules/planeacion/m2/fixtures/apiLatestFixture.js'

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const towerSession = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })
const FINDINGS = M2_API_LATEST_FIXTURE.findings

// ── Matriz de acceso (fail-closed, alineada con el backend) ──────────────────
test('contrato de acceso v1: solo direccion_general y su proyección admin_plataforma', () => {
  assert.deepEqual([...M2_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.deepEqual([...M2_ALLOWED_TOWER_STATUS], ['admin_plataforma'])
})

test('direccion_general (x_job_key): acceso GLOBAL (también vía additional_job_keys)', () => {
  assert.deepEqual(readM2Access(s('direccion_general')), { level: 'global', reason: 'job_key_direccion_general' })
  assert.equal(readM2Access(s('gerente_sucursal', { additional_job_keys: ['direccion_general'] })).level, 'global')
})

test('admin_plataforma (tower_status = proyección de direccion_general): acceso GLOBAL', () => {
  assert.deepEqual(readM2Access(towerSession('admin_plataforma')), { level: 'global', reason: 'tower_admin_plataforma' })
})

test('DELIBERADO: supervisor_ventas con tower_status NO entra (no hereda de Tower)', () => {
  assert.equal(readM2Access(towerSession('supervisor_ventas')).level, 'none')
})

test('roles sin autorización => none (fail-closed)', () => {
  for (const role of ['gerente_sucursal', 'jefe_ruta', 'auxiliar_admin', 'operador_torres', 'supervisor_ventas', 'rol_x', '']) {
    assert.equal(readM2Access(s(role)).level, 'none', role)
  }
})

test('sesión inválida => none aunque el payload traiga rol privilegiado', () => {
  for (const bad of [null, undefined, {}, { role: 'direccion_general' },
    { employee_id: 1, role: 'direccion_general' },
    { employee_id: 1, session_token: 'x', exp: 1, role: 'direccion_general' },
    { employee: { tower_status: 'admin_plataforma' } }]) {
    assert.equal(readM2Access(bad).level, 'none')
  }
})

test('tower_status mal-case o ajeno NO abre M2 (strict-case)', () => {
  for (const ts of ['ADMIN_PLATAFORMA', 'Admin_Plataforma', 'gerente_sucursal', '', null]) {
    assert.equal(readM2Access(towerSession(ts)).level, 'none', String(ts))
  }
})

test('scope: none => cero hallazgos (sin fuga); global => todo', () => {
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, { level: 'none' }), [])
  assert.deepEqual(scopeFindingsForAccess(FINDINGS, null), [])
  assert.equal(scopeFindingsForAccess(FINDINGS, { level: 'global' }).length, FINDINGS.length)
})

// ── Demo gate (B2): JAMÁS en producción ──────────────────────────────────────
test('demo gate: DEV sí · Preview con VITE_ENABLE_M2_DEMO sí · producción NO', () => {
  assert.equal(isM2DemoAllowed({ DEV: true }), true)
  assert.equal(isM2DemoAllowed({ DEV: false, VITE_ENABLE_M2_DEMO: 'true' }), true)
  assert.equal(isM2DemoAllowed({ DEV: false, PROD: true }), false, 'build productivo => demo IGNORADO')
  assert.equal(isM2DemoAllowed({ DEV: false, VITE_ENABLE_M2_DEMO: 'false' }), false)
  assert.equal(isM2DemoAllowed({ DEV: false, VITE_ENABLE_M2_DEMO: '1' }), false, "solo 'true' literal")
  assert.equal(isM2DemoAllowed(null), false)
  assert.equal(isM2DemoAllowed({}), false)
})

// ── Filtros locales (misma semántica del contrato del backend) ───────────────
test('filtros: categoría/severidad/estado/entidad/área/búsqueda/fechas', () => {
  const territorio = applyFindingFilters(FINDINGS, { category: 'territorio' })
  assert.ok(territorio.length >= 1 && territorio.every((f) => f.category === 'territorio'))
  const amber = applyFindingFilters(FINDINGS, { status: 'AMBER' })
  assert.ok(amber.length >= 1 && amber.every((f) => f.status === 'AMBER'))
  const weekly = applyFindingFilters(FINDINGS, { entity_type: 'weekly_plan_line' })
  assert.ok(weekly.every((f) => f.entity_type === 'weekly_plan_line'))
  const search = applyFindingFilters(FINDINGS, { search: 'm2-d-01' })
  assert.equal(search.length, 1)
  assert.equal(applyFindingFilters(FINDINGS, { date_from: '2026-07-15' }).length, 0)
  assert.equal(applyFindingFilters(FINDINGS, { date_from: '2026-07-14', date_to: '2026-07-14' }).length, FINDINGS.length)
  assert.deepEqual(applyFindingFilters(null, M2_DEFAULT_FILTERS), [])
})

test('paginación defensiva: clamps y defaults', () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ i }))
  assert.equal(paginate(items, 3, 10).items.length, 3)
  assert.equal(paginate(items, 99, 10).page, 3)
  assert.equal(paginate(items, -5, 10).page, 1)
  assert.equal(paginate([], 1, 10).pages, 1)
})

// ── CSV injection (B7) ───────────────────────────────────────────────────────
test('neutralizeCsvCell: fórmulas y controles iniciales quedan neutralizados', () => {
  assert.equal(neutralizeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(neutralizeCsvCell('+CMD'), "'+CMD")
  assert.equal(neutralizeCsvCell('-1+2'), "'-1+2")
  assert.equal(neutralizeCsvCell('@HYPERLINK'), "'@HYPERLINK")
  assert.equal(neutralizeCsvCell('\tx'), "'\tx")
  assert.equal(neutralizeCsvCell('\nx'), "'\nx")
  assert.equal(neutralizeCsvCell('\rx'), "'\rx")
  assert.equal(neutralizeCsvCell('texto normal'), 'texto normal')
  assert.equal(neutralizeCsvCell('número 5'), 'número 5')
  assert.equal(neutralizeCsvCell('ñandú Ünicode ✓'), 'ñandú Ünicode ✓')
})

test('csvCell: neutraliza ANTES de escapar; comillas y saltos siguen escapados', () => {
  assert.equal(csvCell('=1+1'), "'=1+1")
  assert.equal(csvCell('=a,"b"'), '"\'=a,""b"""', 'neutralizado y luego RFC-4180')
  assert.equal(csvCell('línea1\nlínea2'), 'línea1 línea2', 'saltos internos a espacio')
  assert.equal(csvCell(null), '')
})

test('findingsToCsv: payload hostil no produce celdas ejecutables', () => {
  const hostile = [{
    finding_id: '=2+5', rule_code: '+CMD|calc', category: '-neg', severity: '@at',
    status: 'RED', granularity: 'aggregate', lifecycle_status: 'new',
    title: '\t tab-start', entity_type: 'x', entity_reference: '=HYPERLINK("http://evil")',
    observed_value: 'ok', expected_rule: 'r', numerator: 1, denominator: 2, pct: 50,
    incidences: 1, company_id: null, branch_id: null, responsible_area: 'a',
    owner_status: 'unassigned', first_seen_at: 'x', last_seen_at: 'y',
    occurrence_count: 1, source_model: 'm', source_timestamp: 't',
  }]
  const csv = findingsToCsv(hostile)
  const dataLine = csv.split('\n')[1]
  assert.ok(!/(^|,)[=+\-@]/.test(dataLine), `ninguna celda inicia con carácter de fórmula: ${dataLine}`)
  assert.ok(dataLine.includes("'=2+5"))
  assert.ok(csv.split('\n')[0] === M2_CSV_COLUMNS.join(','))
})

test('exportFilename: STALE y DEMO van en el NOMBRE del archivo (B10)', () => {
  assert.equal(exportFilename('m2_findings', 'csv'), 'm2_findings.csv')
  assert.equal(exportFilename('m2_findings', 'csv', { stale: true }), 'm2_findings_STALE.csv')
  assert.equal(exportFilename('m2_findings', 'csv', { demo: true, stale: true }), 'm2_findings_DEMO_STALE.csv')
})

test('exporters: revokeObjectURL presente (sin fugas de blobs)', () => {
  const src = readFileSync(new URL('../src/modules/planeacion/m2/exporters.js', import.meta.url), 'utf8')
  assert.match(src, /URL\.revokeObjectURL\(url\)/)
})

// ── Sanitización de exportación ──────────────────────────────────────────────
test('sanitizeForExport: claves sensibles fuera, credenciales [REDACTED]', () => {
  const dirty = {
    ok: 1, api_key: 'sk-123',
    nested: { employee_name: 'X', keep: 'yes', note: 'token: abc123' },
    list: ['Bearer abcdef', 'normal'],
  }
  const clean = sanitizeForExport(dirty)
  assert.equal(clean.api_key, undefined)
  assert.equal(clean.nested.employee_name, undefined)
  assert.equal(clean.nested.keep, 'yes')
  assert.equal(clean.nested.note, '[REDACTED]')
  assert.equal(clean.list[0], '[REDACTED]')
})

test('evidencia JSON y resumen: metadata STALE/DEMO + semántica de incidencias', () => {
  const stalePayload = { ...JSON.parse(JSON.stringify(M2_API_LATEST_FIXTURE)), stale: true, age_days: 9 }
  const json = JSON.parse(evidenceJson(stalePayload))
  assert.equal(json.exported_schema, 'kold.os.m2.export/1')
  assert.equal(json.export_meta.stale, true)
  assert.equal(json.export_meta.age_days, 9)
  const text = executiveSummaryText(stalePayload, { demo: true })
  assert.ok(text.includes('CORRIDA STALE'))
  assert.ok(text.includes('MODO DEMO'))
  assert.ok(text.includes('Incidencias detectadas : 39004'))
  assert.ok(text.includes('NO son entidades únicas'))
  assert.ok(text.includes('M2 observa, no corrige'))
})
