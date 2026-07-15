// KOLD OS · M4 — contrato del envelope (PROVISIONAL: backend congelado 978994c4).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M4_API_SCHEMA_VERSION, classifySchemaVersion, validateM4Latest, validateM4Findings,
  validateM4Runs, isRunStale, M4_STALE_DAYS, scanForbiddenKeys,
} from '../src/modules/ventas/m4/contract.js'
import { M4_API_LATEST_FIXTURE, M4_API_FIXTURE_PROVENANCE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))

test('fixture PROVISIONAL valida el contrato kold.os.m4.api/1', () => {
  const r = validateM4Latest(M4_API_LATEST_FIXTURE)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(M4_API_LATEST_FIXTURE.schema_version, M4_API_SCHEMA_VERSION)
})

test('procedencia: provisional, backend congelado declarado, NO corrida formal', () => {
  assert.equal(M4_API_FIXTURE_PROVENANCE.provisional, true)
  assert.equal(M4_API_FIXTURE_PROVENANCE.backend_frozen_commit,
    '978994c49baefac9da010580667ae89a8f7251d5')
  assert.equal(M4_API_FIXTURE_PROVENANCE.is_production_shell_run, false)
  assert.equal(M4_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.equal(M4_API_LATEST_FIXTURE.run.evidence_classification,
    'pre_deployment_semantic_validation')
})

test('metadata de evidencia obligatoria: ausente o null => inválido', () => {
  for (const key of ['is_production_shell_run', 'evidence_source', 'evidence_classification',
    'production_shell_run_blocked_by']) {
    const doc = clone()
    delete doc.run[key]
    assert.equal(validateM4Latest(doc).ok, false, `${key} ausente debe rechazarse`)
    const doc2 = clone()
    doc2.run[key] = null
    assert.equal(validateM4Latest(doc2).ok, false, `${key}=null debe rechazarse`)
  }
})

test('evidencia NO formal sin blocked_by => inválido; afirmar formal => inválido', () => {
  const sin = clone()
  sin.run.production_shell_run_blocked_by = []
  assert.equal(validateM4Latest(sin).ok, false)
  const finge = clone()
  finge.run.is_production_shell_run = true // sigue dev + XML-RPC + blockers
  assert.equal(validateM4Latest(finge).ok, false)
})

test('linaje: auditor_build_sha requerido; build_sha ambiguo rechazado', () => {
  assert.ok(M4_API_LATEST_FIXTURE.run.auditor_build_sha)
  assert.ok(!('build_sha' in M4_API_LATEST_FIXTURE.run))
  const legacy = clone()
  legacy.run.build_sha = 'abc1234'
  assert.equal(validateM4Latest(legacy).ok, false)
  const noAuditor = clone()
  delete noAuditor.run.auditor_build_sha
  assert.equal(validateM4Latest(noAuditor).ok, false)
})

test('ventana ABSOLUTA en scope: sin bordes o invertida => inválido', () => {
  const doc = clone()
  delete doc.run.scope.window_start
  assert.equal(validateM4Latest(doc).ok, false)
  const inv = clone()
  inv.run.scope.window_start = '2026-08-01'
  assert.equal(validateM4Latest(inv).ok, false)
})

test('scope flexible: otras compañías validan (no se hardcodean ids)', () => {
  const doc = clone()
  doc.run.scope.company_ids = [7, 99]
  assert.equal(validateM4Latest(doc).ok, true, 'el validador no fija compañías')
})

test('contrato epistémico en rule_results: invariantes fail-closed', () => {
  const exploratoryAsIncumplimiento = clone()
  const rr = exploratoryAsIncumplimiento.rule_results.find((r) => r.classification === 'exploratory')
  rr.verdict = 'incumplimiento'
  assert.equal(validateM4Latest(exploratoryAsIncumplimiento).ok, false)

  const sinUmbral = clone()
  const def = sinUmbral.rule_results.find((r) => r.verdict === 'incumplimiento')
  def.approved_threshold = false
  assert.equal(validateM4Latest(sinUmbral).ok, false)

  const noEvalConIncidencias = clone()
  const ne = noEvalConIncidencias.rule_results.find((r) => r.verdict === 'no_evaluable')
  ne.incidences = 7
  assert.equal(validateM4Latest(noEvalConIncidencias).ok, false)

  const sinUniverso = clone()
  sinUniverso.rule_results[0].universe = ''
  assert.equal(validateM4Latest(sinUniverso).ok, false)
})

test('summary: total DEBE ser la suma exacta recomputada de rule_results', () => {
  const doc = clone()
  doc.summary.total_incidences += 2 // el 7541-style drift se rechaza
  assert.equal(validateM4Latest(doc).ok, false)
  const doc2 = clone()
  doc2.summary.exploratory_signal_count += 1
  assert.equal(validateM4Latest(doc2).ok, false)
})

test('summary.unique_records_available debe ser false (incidencias ≠ únicos)', () => {
  const doc = clone()
  doc.summary.unique_records_available = true
  assert.equal(validateM4Latest(doc).ok, false)
})

test('findings portan contrato epistémico y NO contradicen a su regla', () => {
  for (const f of M4_API_LATEST_FIXTURE.findings) {
    for (const k of ['classification', 'verdict', 'universe', 'approved_threshold',
      'business_assumption', 'evidence_limitations', 'threshold_source']) {
      assert.ok(f[k] !== undefined && f[k] !== null, `${f.rule_code} sin ${k}`)
    }
  }
  const doc = clone()
  const f = doc.findings[0]
  const rule = doc.rule_results.find((r) => r.rule_code === f.rule_code)
  f.verdict = rule.verdict === 'riesgo' ? 'anomalia' : 'riesgo'
  const r = validateM4Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('contradice')))
})

test('granularidad honesta: aggregate con ids => inválido', () => {
  const doc = clone()
  doc.findings[0].branch_id = 29
  assert.equal(validateM4Latest(doc).ok, false)
})

test('PII: clave sensible en cualquier nivel => envelope RECHAZADO', () => {
  for (const bad of ['customer_name', 'phone', 'email', 'vat_number', 'street', 'salesperson_name']) {
    const doc = clone()
    doc.findings[0][bad] = 'x'
    const r = validateM4Latest(doc)
    assert.equal(r.ok, false, `${bad} debe rechazarse`)
    assert.ok(r.errors.some((e) => e.includes('sensibles')), bad)
  }
  assert.deepEqual(scanForbiddenKeys(M4_API_LATEST_FIXTURE), [], 'el fixture está limpio')
})

test('schema_version: soportada / futura / ausente => controlado', () => {
  assert.equal(classifySchemaVersion(M4_API_LATEST_FIXTURE), 'supported')
  assert.equal(classifySchemaVersion({ schema_version: 'kold.os.m4.api/9' }), 'unsupported')
  assert.equal(classifySchemaVersion({}), 'missing')
  const doc = clone()
  doc.schema_version = 'kold.os.m4.api/9'
  const r = validateM4Latest(doc)
  assert.equal(r.ok, false)
  assert.equal(r.schema, 'unsupported')
})

test('validateM4Findings y validateM4Runs: forma mínima + PII', () => {
  const page = {
    ok: true, schema_version: M4_API_SCHEMA_VERSION,
    total: 2, page: 1, pages: 1, page_size: 10,
    items: [], rejected_params: ['employee_id'],
  }
  assert.equal(validateM4Findings(page).ok, true)
  assert.equal(validateM4Findings({ ...page, items: undefined }).ok, false)
  assert.equal(validateM4Findings({ ...page, items: [{ customer_name: 'x' }] }).ok, false)

  const runs = { ok: true, schema_version: M4_API_SCHEMA_VERSION, runs: [] }
  assert.equal(validateM4Runs(runs).ok, true)
  assert.equal(validateM4Runs({ ...runs, runs: undefined }).ok, false)
})

test('STALE se recomputa client-side (no se confía ciegamente en el server)', () => {
  const run = M4_API_LATEST_FIXTURE.run
  const fresh = new Date(Date.parse(run.finished_at) + 3600_000).toISOString()
  assert.equal(isRunStale(run, fresh), false)
  const staleDate = new Date(Date.parse(run.finished_at) + (M4_STALE_DAYS + 1) * 86400_000).toISOString()
  assert.equal(isRunStale(run, staleDate), true)
  assert.equal(M4_API_LATEST_FIXTURE.stale, false)
})

test('los números NO se afirman en el contrato: solo coherencia interna', () => {
  // El validador no fija los totales actuales (14078 etc.): otro run con otros
  // números pero coherente DEBE validar. (No hardcodear resultados.)
  const doc = clone()
  for (const r of doc.rule_results) {
    if (r.verdict === 'riesgo' && Number.isInteger(r.incidences)) { r.incidences += 5; break }
  }
  const sum = (v) => doc.rule_results.filter((x) => x.verdict === v)
    .reduce((a, x) => a + (Number.isFinite(Number(x.incidences)) ? Number(x.incidences) : 0), 0)
  doc.summary.warning_count = sum('riesgo')
  doc.summary.total_incidences = sum('incumplimiento') + sum('riesgo') + sum('anomalia')
  // findings deben seguir sin contradecir (no tocamos findings: la regla tocada
  // puede no tener finding; si lo tiene, sincronizamos)
  for (const f of doc.findings) {
    const rule = doc.rule_results.find((r) => r.rule_code === f.rule_code)
    if (rule) { f.verdict = rule.verdict; f.classification = rule.classification }
  }
  assert.equal(validateM4Latest(doc).ok, true, 'otros números coherentes validan')
})
