import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M2_API_SCHEMA_VERSION, M2_SUPPORTED_SCHEMA_VERSIONS, classifySchemaVersion,
  validateM2Latest, validateM2Findings, isRunStale, M2_STALE_DAYS,
} from '../src/modules/planeacion/m2/contract.js'
import { M2_API_LATEST_FIXTURE, M2_API_FIXTURE_PROVENANCE } from '../src/modules/planeacion/m2/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M2_API_LATEST_FIXTURE))
const ruleOf = (doc, code) => doc.rule_results.find((r) => r.rule_code === code)

// ── El fixture (generado por código REAL) valida el contrato completo ───────
test('fixture del envelope: VALIDA el contrato kold.os.m2.api/1', () => {
  const { ok, errors } = validateM2Latest(M2_API_LATEST_FIXTURE)
  assert.deepEqual(errors, [])
  assert.equal(ok, true)
  assert.equal(M2_API_LATEST_FIXTURE.schema_version, M2_API_SCHEMA_VERSION)
})

test('procedencia: generado por código real; manifest = hash de producción; NO es evidencia productiva', () => {
  assert.equal(M2_API_FIXTURE_PROVENANCE.kind, 'real_code_generated')
  assert.equal(M2_API_FIXTURE_PROVENANCE.production_manifest_sha256_match, true)
  assert.equal(M2_API_LATEST_FIXTURE.run.manifest_sha256,
    '0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c')
  assert.equal(M2_API_FIXTURE_PROVENANCE.is_production_evidence, false)
  assert.notEqual(M2_API_LATEST_FIXTURE.run.evidence_sha256,
    M2_API_FIXTURE_PROVENANCE.production_evidence_sha256, 'jamás suplanta el hash real')
})

// ── Cifras REPORTADAS del run real (derivadas por el core backend) ──────────
test('REPORTADO en el envelope: territorio 293/484=60.54% · solver 424/484=87.6% · capacidad 144 · vehículo 133', () => {
  const doc = M2_API_LATEST_FIXTURE
  const territory = ruleOf(doc, 'M2-A-01')
  assert.equal(territory.numerator, 293); assert.equal(territory.denominator, 484)
  assert.equal(territory.pct, 60.54); assert.equal(territory.status, 'RED')
  const solver = ruleOf(doc, 'M2-B-01')
  assert.equal(solver.numerator, 424); assert.equal(solver.pct, 87.6); assert.equal(solver.status, 'RED')
  assert.equal(ruleOf(doc, 'M2-C-02').numerator, 144)
  assert.equal(ruleOf(doc, 'M2-C-01').numerator, 133)
  assert.equal(ruleOf(doc, 'M2-C-03').numerator, 30)
  assert.equal(ruleOf(doc, 'M2-C-04').numerator, 29)
})

test('REPORTADO: 37/39=94.87% sin carga · 46 sin snapshot · 21 sin stops · 48 sin almacén · 10 semanal', () => {
  const doc = M2_API_LATEST_FIXTURE
  const load = ruleOf(doc, 'M2-D-01')
  assert.equal(load.numerator, 37); assert.equal(load.denominator, 39); assert.equal(load.pct, 94.87)
  assert.equal(ruleOf(doc, 'M2-D-02').numerator, 46)
  assert.equal(ruleOf(doc, 'M2-D-03').numerator, 21)
  assert.equal(ruleOf(doc, 'M2-D-04').numerator, 48)
  assert.equal(ruleOf(doc, 'M2-D-05').numerator, 10)
})

test('REPORTADO: cobertura 56.82% RED · confianza 0.6667 RED · 2202 fallback · 192 warnings · actual_kg 16.56%', () => {
  const doc = M2_API_LATEST_FIXTURE
  assert.equal(ruleOf(doc, 'M2-E-01').pct, 56.82)
  assert.equal(ruleOf(doc, 'M2-E-01').status, 'RED')
  assert.equal(ruleOf(doc, 'M2-E-02').pct, 0.6667)
  assert.equal(ruleOf(doc, 'M2-E-02').status, 'RED')
  assert.equal(ruleOf(doc, 'M2-E-03').numerator, 2202)
  assert.equal(ruleOf(doc, 'M2-E-04').numerator, 192)
  const actual = ruleOf(doc, 'M2-F-01')
  assert.equal(actual.numerator, 7026); assert.equal(actual.denominator, 42421); assert.equal(actual.pct, 16.56)
})

test('summary del backend: RED operativo con auditor PASS · 13 rojas · 3 ámbar · incidencias ≠ registros únicos', () => {
  const { run, summary } = M2_API_LATEST_FIXTURE
  assert.equal(run.status, 'PASS')
  assert.equal(run.technical_state, 'PASS')
  assert.equal(summary.overall_status, 'RED')
  assert.equal(summary.rules_fail, 13)
  assert.equal(summary.rules_warning, 3)
  assert.equal(summary.rules_not_evaluable, 3)
  assert.equal(summary.total_incidences, 39004)
  assert.equal(summary.unique_records_available, false, 'el contrato declara que NO hay entidades únicas')
})

test('granularidad honesta: todos los hallazgos v1 son aggregate y SIN ids', () => {
  for (const finding of M2_API_LATEST_FIXTURE.findings) {
    assert.equal(finding.granularity, 'aggregate')
    assert.equal(finding.company_id, null)
    assert.equal(finding.branch_id, null)
    assert.equal(finding.entity_id, null)
    assert.equal(finding.owner_status, 'unassigned')
  }
  assert.equal(M2_API_LATEST_FIXTURE.capabilities.features.branch_dimension, false)
  assert.equal(M2_API_LATEST_FIXTURE.capabilities.features.entity_detail, false)
})

// ── schema_version explícito (B8) ────────────────────────────────────────────
test('schema_version: soportada / futura => error CONTROLADO / ausente', () => {
  assert.deepEqual([...M2_SUPPORTED_SCHEMA_VERSIONS], ['kold.os.m2.api/1'])
  assert.equal(classifySchemaVersion(M2_API_LATEST_FIXTURE), 'supported')
  const future = clone(); future.schema_version = 'kold.os.m2.api/9'
  assert.equal(classifySchemaVersion(future), 'unsupported')
  const res = validateM2Latest(future)
  assert.equal(res.ok, false)
  assert.equal(res.schema, 'unsupported', 'la UI distingue versión futura de payload corrupto')
  const missing = clone(); delete missing.schema_version
  assert.equal(classifySchemaVersion(missing), 'missing')
})

test('campos adicionales compatibles NO rompen; queries nuevas llegan por capabilities', () => {
  const extended = clone()
  extended.future_field = { anything: true }
  extended.run.future_run_field = 'x'
  extended.capabilities.optional_query_ids = ['future_query_x']
  const { ok, errors } = validateM2Latest(extended)
  assert.deepEqual(errors, [])
  assert.equal(ok, true)
})

// ── Rechazos fail-closed ─────────────────────────────────────────────────────
test('rechaza: no-objeto, ok!=true, run/summary/findings malformados', () => {
  assert.equal(validateM2Latest(null).ok, false)
  assert.equal(validateM2Latest([]).ok, false)
  const notOk = clone(); notOk.ok = false
  assert.equal(validateM2Latest(notOk).ok, false)
  const badRun = clone(); badRun.run.status = 'MAYBE'
  assert.equal(validateM2Latest(badRun).ok, false)
  const badHash = clone(); badHash.run.evidence_sha256 = 'zz'
  assert.equal(validateM2Latest(badHash).ok, false)
  const badSummary = clone(); badSummary.summary.total_incidences = -1
  assert.equal(validateM2Latest(badSummary).ok, false)
  const uniqueLie = clone(); uniqueLie.summary.unique_records_available = true
  assert.equal(validateM2Latest(uniqueLie).ok, false, 'v1 no puede afirmar registros únicos')
})

test('rechaza hallazgo aggregate CON ids (mentira de granularidad) y claves sensibles', () => {
  const lying = clone()
  lying.findings[0].entity_id = 12345
  assert.equal(validateM2Latest(lying).ok, false)
  const leaky = clone()
  leaky.findings[0].partner_name = 'X'
  assert.equal(validateM2Latest(leaky).ok, false)
})

// ── B9: scope flexible ────────────────────────────────────────────────────────
test('scope flexible: otras compañías autorizadas validan (no se fija 1,34,35,36)', () => {
  const other = clone()
  other.run.scope.company_ids = [7, 42]
  assert.equal(validateM2Latest(other).ok, true)
  const badIds = clone()
  badIds.run.scope.company_ids = [0]
  assert.equal(validateM2Latest(badIds).ok, false, 'forma sí se valida')
})

// ── /findings ────────────────────────────────────────────────────────────────
test('validateM2Findings: acepta respuesta bien formada y rechaza malformadas', () => {
  const good = {
    ok: true, schema_version: M2_API_SCHEMA_VERSION, run_id: 'r', total: 2, page: 1,
    pages: 1, page_size: 25, items: [], applied_scope: { level: 'global' },
    applied_filters: {}, rejected_params: [], read_only: true,
  }
  assert.equal(validateM2Findings(good).ok, true)
  assert.equal(validateM2Findings({ ...good, schema_version: 'kold.os.m2.api/9' }).schema, 'unsupported')
  assert.equal(validateM2Findings({ ...good, total: -1 }).ok, false)
  assert.equal(validateM2Findings({ ...good, items: 'x' }).ok, false)
  assert.equal(validateM2Findings({ ...good, rejected_params: 'x' }).ok, false)
})

// ── STALE (B10) ──────────────────────────────────────────────────────────────
test('stale: recomputación defensiva client-side coincide con el umbral', () => {
  const run = M2_API_LATEST_FIXTURE.run
  assert.equal(isRunStale(run, '2026-07-15T00:00:00Z'), false)
  const staleDate = new Date(Date.parse(run.finished_at) + (M2_STALE_DAYS + 1) * 86400000).toISOString()
  assert.equal(isRunStale(run, staleDate), true)
  assert.equal(M2_API_LATEST_FIXTURE.stale, false, 'el fixture llega vigente')
})
