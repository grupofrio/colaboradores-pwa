import test from 'node:test'
import assert from 'node:assert/strict'

import { readM2Access, scopeFindingsForAccess, M2_ALLOWED_JOB_KEYS, M2_ALLOWED_TOWER_STATUS } from '../src/modules/planeacion/m2/access.js'
import { applyFindingFilters, paginate, M2_DEFAULT_FILTERS } from '../src/modules/planeacion/m2/filters.js'
import { findingsToCsv, evidenceJson, executiveSummaryText, sanitizeForExport, M2_CSV_COLUMNS } from '../src/modules/planeacion/m2/exporters.js'
import { deriveM2 } from '../src/modules/planeacion/m2/deriveFindings.js'
import { applyLifecycle } from '../src/modules/planeacion/m2/lifecycle.js'
import { M2_FIXTURE_RUN } from '../src/modules/planeacion/m2/fixtures/realRun20260714.js'

const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const towerSession = (tower_status, role = 'supervisor_ventas') => s(role, { employee: { tower_status } })

// ── Matriz de acceso (fail-closed) ──────────────────────────────────────────
test('contrato de acceso v1: solo direccion_general y admin_plataforma', () => {
  assert.deepEqual([...M2_ALLOWED_JOB_KEYS], ['direccion_general'])
  assert.deepEqual([...M2_ALLOWED_TOWER_STATUS], ['admin_plataforma'])
})

test('direccion_general (x_job_key): acceso GLOBAL', () => {
  assert.deepEqual(readM2Access(s('direccion_general')), { level: 'global', reason: 'job_key_direccion_general' })
  // también vía additional_job_keys (roles efectivos)
  assert.equal(readM2Access(s('gerente_sucursal', { additional_job_keys: ['direccion_general'] })).level, 'global')
})

test('admin_plataforma (tower_status AUTORITATIVO): acceso GLOBAL', () => {
  assert.deepEqual(readM2Access(towerSession('admin_plataforma')), { level: 'global', reason: 'tower_admin_plataforma' })
})

test('DELIBERADO: supervisor_ventas con tower_status NO entra a M2 (no se copian reglas de Tower)', () => {
  assert.equal(readM2Access(towerSession('supervisor_ventas')).level, 'none')
})

test('roles sin autorización: gerente, jefe_ruta, auxiliar, torres, desconocido => none', () => {
  for (const role of ['gerente_sucursal', 'jefe_ruta', 'auxiliar_admin', 'operador_torres', 'supervisor_ventas', 'rol_marciano', '']) {
    assert.equal(readM2Access(s(role)).level, 'none', role)
  }
})

test('sesión inválida => none (aunque el payload traiga rol privilegiado)', () => {
  for (const bad of [null, undefined, {}, { role: 'direccion_general' },
    { employee_id: 1, role: 'direccion_general' },
    { employee_id: 1, session_token: 'x', exp: 1, role: 'direccion_general' },
    { employee: { tower_status: 'admin_plataforma' } }]) {
    assert.equal(readM2Access(bad).level, 'none')
    assert.equal(readM2Access(bad).reason === 'invalid_session' || readM2Access(bad).reason === 'not_authorized', true)
  }
})

test('tower_status mal-case o ajeno NO abre M2 (strict-case de la fuente autoritativa)', () => {
  for (const ts of ['ADMIN_PLATAFORMA', 'Admin_Plataforma', 'gerente_sucursal', '', null]) {
    assert.equal(readM2Access(towerSession(ts)).level, 'none', String(ts))
  }
})

test('scope: acceso none => CERO hallazgos (sin fuga cross-company); global => todo el agregado', () => {
  const findings = deriveM2(M2_FIXTURE_RUN).findings
  assert.deepEqual(scopeFindingsForAccess(findings, { level: 'none' }), [])
  assert.deepEqual(scopeFindingsForAccess(findings, null), [])
  assert.equal(scopeFindingsForAccess(findings, { level: 'global' }).length, findings.length)
})

// ── Filtros ──────────────────────────────────────────────────────────────────
const lifecycleFindings = () => {
  const derived = deriveM2(M2_FIXTURE_RUN)
  return applyLifecycle([{ report: M2_FIXTURE_RUN, findings: derived.findings }]).findings
}

test('filtros: categoría, severidad, estado, entidad, área y búsqueda', () => {
  const findings = lifecycleFindings()
  const territorio = applyFindingFilters(findings, { category: 'territorio' })
  assert.ok(territorio.length >= 1 && territorio.every((f) => f.category === 'territorio'))
  const amber = applyFindingFilters(findings, { status: 'AMBER' })
  assert.ok(amber.every((f) => f.status === 'AMBER'))
  const high = applyFindingFilters(findings, { severity: 'high' })
  assert.ok(high.every((f) => f.severity === 'high'))
  const weekly = applyFindingFilters(findings, { entity_type: 'weekly_plan_line' })
  assert.ok(weekly.length >= 1 && weekly.every((f) => f.entity_type === 'weekly_plan_line'))
  const flota = applyFindingFilters(findings, { responsible_area: 'Operaciones / Flota' })
  assert.ok(flota.length >= 1 && flota.every((f) => f.responsible_area === 'Operaciones / Flota'))
  const search = applyFindingFilters(findings, { search: 'm2-d-01' })
  assert.equal(search.length, 1)
  assert.equal(search[0].rule_code, 'M2-D-01')
})

test('filtros: rango de fechas sobre última detección', () => {
  const findings = lifecycleFindings()
  assert.equal(applyFindingFilters(findings, { date_from: '2026-07-15' }).length, 0, 'después del corte')
  assert.equal(applyFindingFilters(findings, { date_to: '2026-07-13' }).length, 0, 'antes del corte')
  assert.equal(applyFindingFilters(findings, { date_from: '2026-07-14', date_to: '2026-07-14' }).length, findings.length)
})

test('filtros: combinación sin resultados y entradas corruptas => lista vacía (fail-safe)', () => {
  const findings = lifecycleFindings()
  assert.deepEqual(applyFindingFilters(findings, { category: 'territorio', status: 'AMBER' }), [])
  assert.deepEqual(applyFindingFilters(null, M2_DEFAULT_FILTERS), [])
  assert.deepEqual(applyFindingFilters([null, undefined], M2_DEFAULT_FILTERS), [])
})

// ── Paginación ───────────────────────────────────────────────────────────────
test('paginación: tamaños, límites y páginas fuera de rango se ajustan', () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ i }))
  const p1 = paginate(items, 1, 10)
  assert.equal(p1.items.length, 10); assert.equal(p1.pages, 3); assert.equal(p1.total, 23)
  const p3 = paginate(items, 3, 10)
  assert.equal(p3.items.length, 3)
  assert.equal(paginate(items, 99, 10).page, 3, 'clamp alto')
  assert.equal(paginate(items, -5, 10).page, 1, 'clamp bajo')
  assert.equal(paginate([], 1, 10).pages, 1)
  assert.equal(paginate(items, 1, 0).page_size > 0, true, 'pageSize inválido usa default')
})

// ── Exportadores (sanitización defensa-en-profundidad) ──────────────────────
test('CSV: columnas del contrato + una fila por hallazgo, con escaping', () => {
  const findings = lifecycleFindings()
  const csv = findingsToCsv(findings)
  const lines = csv.split('\n')
  assert.equal(lines[0], M2_CSV_COLUMNS.join(','))
  assert.equal(lines.length, findings.length + 1)
  assert.ok(csv.includes('M2-A-01'))
})

test('sanitizeForExport: claves sensibles fuera, credenciales redactadas', () => {
  const dirty = {
    ok: 1,
    api_key: 'sk-123',
    nested: { employee_name: 'X', keep: 'yes', note: 'token: abc123' },
    list: ['Bearer abcdef', 'normal'],
  }
  const clean = sanitizeForExport(dirty)
  assert.equal(clean.api_key, undefined)
  assert.equal(clean.nested.employee_name, undefined)
  assert.equal(clean.nested.keep, 'yes')
  assert.equal(clean.nested.note, '[REDACTED]')
  assert.equal(clean.list[0], '[REDACTED]')
  assert.equal(clean.list[1], 'normal')
})

test('JSON de evidencia y resumen ejecutivo: se generan y conservan trazabilidad', () => {
  const derived = deriveM2(M2_FIXTURE_RUN)
  const lifecycle = applyLifecycle([{ report: M2_FIXTURE_RUN, findings: derived.findings }])
  const json = evidenceJson(M2_FIXTURE_RUN, { summary: derived.summary, findings: lifecycle.findings })
  const parsed = JSON.parse(json)
  assert.equal(parsed.exported_schema, 'kold.tower.m2.export/1')
  assert.equal(parsed.run.manifest_sha256, M2_FIXTURE_RUN.manifest_sha256)
  assert.equal(parsed.derived.findings.length, lifecycle.findings.length)
  const text = executiveSummaryText(M2_FIXTURE_RUN, { summary: derived.summary, findings: lifecycle.findings })
  assert.ok(text.includes('PLANEACIÓN Y READINESS'))
  assert.ok(text.includes('ESTADO TÉCNICO DEL AUDITOR : PASS'))
  assert.ok(text.includes('ESTADO OPERATIVO DE DATOS  : RED'))
  assert.ok(text.includes('M2 está funcionando y detectó incumplimientos'))
  assert.ok(text.includes('M2 observa, no corrige'))
})
