import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M3_API_SCHEMA_VERSION, M3_SUPPORTED_SCHEMA_VERSIONS, classifySchemaVersion,
  validateM3Latest, validateM3Findings, isRunStale, M3_STALE_DAYS,
} from '../src/modules/ejecucion/m3/contract.js'
import { M3_API_LATEST_FIXTURE, M3_API_FIXTURE_PROVENANCE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M3_API_LATEST_FIXTURE))
const ruleOf = (doc, code) => doc.rule_results.find((r) => r.rule_code === code)

// ── Contrato base ───────────────────────────────────────────────────────────
test('fixture del envelope: VALIDA el contrato kold.os.m3.api/1', () => {
  const { ok, errors } = validateM3Latest(M3_API_LATEST_FIXTURE)
  assert.deepEqual(errors, [])
  assert.equal(ok, true)
  assert.equal(M3_API_LATEST_FIXTURE.schema_version, M3_API_SCHEMA_VERSION)
})

test('procedencia HONESTA: código real + números reales, pero NO corrida odoo-shell', () => {
  assert.equal(M3_API_FIXTURE_PROVENANCE.kind, 'real_code_generated_measured_aggregates')
  assert.match(M3_API_FIXTURE_PROVENANCE.business_numbers, /REALES/)
  assert.match(M3_API_FIXTURE_PROVENANCE.measurement_channel, /xmlrpc_readonly/)
  assert.equal(M3_API_FIXTURE_PROVENANCE.is_production_shell_run, false,
    'NO se afirma corrida productiva: está bloqueada y se declara por qué')
  assert.ok(M3_API_FIXTURE_PROVENANCE.production_shell_run_blocked_by)
  assert.equal(M3_API_LATEST_FIXTURE.run.environment, 'dev', 'el run es dev, sin fingir producción')
})

test('Track B: scope declara bordes explícitos y timezone', () => {
  const scope = M3_API_LATEST_FIXTURE.run.scope
  assert.equal(scope.window_start, '2026-04-16')
  assert.equal(scope.window_end_exclusive, '2026-07-15')
  assert.equal(scope.timezone, 'America/Mexico_City')
})

// ── Contrato epistémico (Track C) ───────────────────────────────────────────
test('cada rule_result declara clasificación, veredicto, universo, supuesto y umbral', () => {
  for (const r of M3_API_LATEST_FIXTURE.rule_results) {
    assert.ok(['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'].includes(r.classification), r.rule_code)
    assert.ok(['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'].includes(r.verdict), r.rule_code)
    assert.ok(r.universe, r.rule_code)
    assert.ok(r.business_assumption, r.rule_code)
    assert.ok(r.evidence_limitations, r.rule_code)
    assert.equal(typeof r.approved_threshold, 'boolean', r.rule_code)
    assert.ok(r.threshold_source, r.rule_code)
  }
})

test('CLAVE: exploratoria JAMÁS es incumplimiento; incumplimiento EXIGE umbral aprobado', () => {
  for (const r of M3_API_LATEST_FIXTURE.rule_results) {
    if (r.classification === 'exploratory') assert.notEqual(r.verdict, 'incumplimiento', r.rule_code)
    if (r.verdict === 'incumplimiento') assert.equal(r.approved_threshold, true, r.rule_code)
  }
  const lying = clone()
  lying.rule_results[0] = { ...lying.rule_results[0], classification: 'exploratory', verdict: 'incumplimiento' }
  assert.equal(validateM3Latest(lying).ok, false, 'el contrato rechaza la mentira')
  const noThreshold = clone()
  noThreshold.rule_results.find((r) => r.verdict === 'incumplimiento').approved_threshold = false
  assert.equal(validateM3Latest(noThreshold).ok, false)
})

// ── Los 6 incumplimientos DEFINITIVOS (lo único afirmable) ──────────────────
test('REAL definitivo: 171/349 rutas iniciadas y VENCIDAS sin cierre', () => {
  const r = ruleOf(M3_API_LATEST_FIXTURE, 'M3-F-01')
  assert.equal(r.verdict, 'incumplimiento')
  assert.equal(r.classification, 'definitive')
  assert.equal(r.numerator, 171)
  assert.equal(r.denominator, 349)
  assert.match(r.name, /vencida/i, 'wording Track E')
  assert.match(r.universe, /cutoff_date/)
})

test('REAL definitivo: 3,695 paradas sin resolver · 81 conciliaciones draft SOBRE RUTA CERRADA', () => {
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-B-01').numerator, 3695)
  const rec = ruleOf(M3_API_LATEST_FIXTURE, 'M3-D-01')
  assert.equal(rec.numerator, 81, 'NO 267: borradores de rutas abiertas son legítimos')
  assert.equal(rec.verdict, 'incumplimiento')
  assert.match(rec.universe, /EXCLUYE/)
})

test('REAL definitivo: 79 cierres incompletos · 79 sin conciliar · 21 publicadas nunca iniciadas', () => {
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-F-03').numerator, 79)
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-F-04').numerator, 79)
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-A-07').numerator, 21)
})

test('exactamente 6 incumplimientos definitivos (antes afirmaba 20)', () => {
  const definitive = M3_API_LATEST_FIXTURE.rule_results.filter((r) => r.verdict === 'incumplimiento')
  assert.deepEqual(definitive.map((r) => r.rule_code).sort(),
    ['M3-A-07', 'M3-B-01', 'M3-D-01', 'M3-F-01', 'M3-F-03', 'M3-F-04'])
})

// ── Reclasificadas: lo que ya NO se afirma ─────────────────────────────────
test('Track D1/K: cajas = observación cruda (NO "cortes"); corte real = gf.branch.daily.close 6/12', () => {
  const cash = ruleOf(M3_API_LATEST_FIXTURE, 'M3-F-07')
  assert.equal(cash.verdict, 'anomalia')
  assert.equal(cash.classification, 'exploratory')
  assert.ok(!/corte/i.test(cash.name), 'el nombre ya no dice "corte"')
  const close = ruleOf(M3_API_LATEST_FIXTURE, 'M3-F-05')
  assert.equal(close.numerator, 6)
  assert.equal(close.denominator, 12)
  assert.equal(close.verdict, 'anomalia', 'cobertura de 1 sucursal: no concluye')
})

test('Track D4: no-venta sin motivo = brecha de INSTRUMENTACIÓN (el modelo no lo exige)', () => {
  const r = ruleOf(M3_API_LATEST_FIXTURE, 'M3-C-01')
  assert.equal(r.verdict, 'riesgo')
  assert.equal(r.classification, 'caveated')
  assert.match(r.name, /instrumentación/i)
  assert.match(r.business_assumption, /NO asume incumplimiento del operador/)
})

test('Track G/I/J: salida tarde, duración y GPS son ANOMALÍAS sin umbral aprobado', () => {
  for (const code of ['M3-A-06', 'M3-B-06', 'M3-B-07', 'M3-B-08']) {
    const r = ruleOf(M3_API_LATEST_FIXTURE, code)
    assert.equal(r.verdict, 'anomalia', code)
    assert.equal(r.approved_threshold, false, code)
  }
  assert.match(ruleOf(M3_API_LATEST_FIXTURE, 'M3-A-06').threshold_source, /NINGUNO aprobado/)
  assert.match(ruleOf(M3_API_LATEST_FIXTURE, 'M3-B-06').business_assumption, /geocódigo/i)
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-A-06').denominator, 336, 'solo rutas con objetivo')
})

test('Track F: km/checklist son ADOPCIÓN de un flujo nuevo, no incumplimiento', () => {
  for (const code of ['M3-A-04', 'M3-F-02']) {
    const r = ruleOf(M3_API_LATEST_FIXTURE, code)
    assert.equal(r.verdict, 'anomalia', code)
    assert.match(r.name, /adopción/i, code)
  }
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-A-03').denominator, 44, 'universo = rutas CON checklist')
})

test('Track D3/M/N/O: refill no atribuible · incidentes sin lifecycle · off-route observación · plan-real sin cobertura', () => {
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-D-03').verdict, 'no_evaluable')
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-E-02').verdict, 'anomalia')
  const off = ruleOf(M3_API_LATEST_FIXTURE, 'M3-H-01')
  assert.equal(off.verdict, 'anomalia')
  assert.match(off.name, /fuera del plan/i)
  assert.ok(!/incumplimiento/i.test(off.name))
  assert.equal(ruleOf(M3_API_LATEST_FIXTURE, 'M3-H-02').verdict, 'no_evaluable')
})

// ── Track P: total = suma exacta de sus partes ──────────────────────────────
test('summary desglosado: 6 definitivos · 8 riesgos · 12 anomalías · 9 no evaluables · 4 cumplen', () => {
  const s = M3_API_LATEST_FIXTURE.summary
  assert.equal(s.definitive_incident_rule_count, 6)
  assert.equal(s.warning_rule_count, 8)
  assert.equal(s.exploratory_signal_rule_count, 12)
  assert.equal(s.not_evaluable_rule_count, 9)
  assert.equal(s.compliant_rule_count, 4)
  assert.equal(s.total_incidences,
    s.definitive_incident_count + s.warning_count + s.exploratory_signal_count,
    'el total DEBE ser la suma exacta de su desglose')
  assert.equal(s.definitive_incident_count, 4126)
  assert.equal(s.unique_records_available, false)
  const lying = clone()
  lying.summary.total_incidences = 99999
  assert.equal(validateM3Latest(lying).ok, false, 'el contrato rechaza un total que no cuadra')
})

// ── Track H: universo declarado + sensibilidad ──────────────────────────────
test('cumplimiento de visita: 58.78% (rutas iniciadas), con universo y sensibilidad', () => {
  const vc = M3_API_LATEST_FIXTURE.kpis.visit_compliance
  assert.equal(vc.universe, 'started_routes')
  assert.equal(vc.value_pct, 58.78, 'NO 29.35%: aquel universo incluía planes nunca iniciados')
  assert.ok(vc.rationale)
  assert.equal(vc.sensitivity.all_active_stops.value_pct, 39.95)
  assert.equal(vc.sensitivity.published_plus.value_pct, 52.19)
  assert.equal(vc.sensitivity.closed_routes.value_pct, 53.17)
  assert.equal(vc.excluded.draft_route_stops, 4544)
  const noUniverse = clone()
  delete noUniverse.kpis.visit_compliance.universe
  assert.equal(validateM3Latest(noUniverse).ok, false)
})

test('Track O: coverage publicado; offline NO afirma cero', () => {
  const k = M3_API_LATEST_FIXTURE.kpis
  assert.equal(k.coverage.expected_distance_pct, 4.49)
  assert.equal(k.offline_events_pending, null, 'sin telemetría NO se inventa 0')
  assert.ok(k.offline_events_note)
})

// ── Granularidad honesta ────────────────────────────────────────────────────
test('granularidad: branch con branch_id real; aggregate sin IDs; mentir = error', () => {
  const branchFindings = M3_API_LATEST_FIXTURE.findings.filter((f) => f.granularity === 'branch')
  assert.ok(branchFindings.length >= 1)
  for (const f of branchFindings) {
    assert.equal(f.rule_code, 'M3-A-07')
    assert.ok(Number.isInteger(f.branch_id))
  }
  for (const f of M3_API_LATEST_FIXTURE.findings) {
    if (f.granularity === 'aggregate') {
      assert.equal(f.branch_id, null, f.rule_code)
      assert.equal(f.entity_id, null, f.rule_code)
    }
    assert.equal(f.owner_status, 'unassigned')
  }
  const lyingAggregate = clone()
  lyingAggregate.findings.find((f) => f.granularity === 'aggregate').branch_id = 29
  assert.equal(validateM3Latest(lyingAggregate).ok, false)
  const lyingBranch = clone()
  lyingBranch.findings.find((f) => f.granularity === 'branch').branch_id = null
  assert.equal(validateM3Latest(lyingBranch).ok, false)
})

// ── Versionado / rechazos / stale ───────────────────────────────────────────
test('schema_version: soportada / futura => error controlado / campos extra OK', () => {
  assert.deepEqual([...M3_SUPPORTED_SCHEMA_VERSIONS], ['kold.os.m3.api/1'])
  assert.equal(classifySchemaVersion(M3_API_LATEST_FIXTURE), 'supported')
  const future = clone(); future.schema_version = 'kold.os.m3.api/9'
  const res = validateM3Latest(future)
  assert.equal(res.ok, false)
  assert.equal(res.schema, 'unsupported')
  const extended = clone()
  extended.future_field = { x: 1 }
  extended.capabilities.optional_query_ids = [...extended.capabilities.optional_query_ids, 'future_query']
  assert.equal(validateM3Latest(extended).ok, true)
})

test('rechaza: no-objeto, ok!=true, run/kpis malformados, claves sensibles', () => {
  assert.equal(validateM3Latest(null).ok, false)
  const notOk = clone(); notOk.ok = false
  assert.equal(validateM3Latest(notOk).ok, false)
  const badRun = clone(); badRun.run.technical_state = 'MAYBE'
  assert.equal(validateM3Latest(badRun).ok, false)
  const noKpis = clone(); delete noKpis.kpis
  assert.equal(validateM3Latest(noKpis).ok, false)
  const uniqueLie = clone(); uniqueLie.summary.unique_records_available = true
  assert.equal(validateM3Latest(uniqueLie).ok, false)
  const leaky = clone(); leaky.findings[0].partner_name = 'X'
  assert.equal(validateM3Latest(leaky).ok, false)
})

test('scope flexible: otras compañías validan; forma sí se exige', () => {
  const other = clone(); other.run.scope.company_ids = [7, 42]
  assert.equal(validateM3Latest(other).ok, true)
  const bad = clone(); bad.run.scope.company_ids = [0]
  assert.equal(validateM3Latest(bad).ok, false)
})

test('validateM3Findings: bien formada OK; malformadas rechazadas', () => {
  const good = {
    ok: true, schema_version: M3_API_SCHEMA_VERSION, run_id: 'r', total: 2, page: 1,
    pages: 1, page_size: 25, items: [], applied_scope: { level: 'global' },
    applied_filters: {}, rejected_params: [], read_only: true,
  }
  assert.equal(validateM3Findings(good).ok, true)
  assert.equal(validateM3Findings({ ...good, schema_version: 'kold.os.m3.api/9' }).schema, 'unsupported')
  assert.equal(validateM3Findings({ ...good, total: -1 }).ok, false)
  assert.equal(validateM3Findings({ ...good, rejected_params: 'x' }).ok, false)
})

test('stale: recomputación defensiva client-side', () => {
  const run = M3_API_LATEST_FIXTURE.run
  assert.equal(isRunStale(run, '2026-07-16T00:00:00Z'), false)
  const staleDate = new Date(Date.parse(run.finished_at) + (M3_STALE_DAYS + 1) * 86400000).toISOString()
  assert.equal(isRunStale(run, staleDate), true)
  assert.equal(M3_API_LATEST_FIXTURE.stale, false)
})

// ── Codex ronda 2 §1/§2: metadata de evidencia y linaje de build ─────────────
// El silencio NUNCA puede leerse como "corrida formal": si el envelope no
// declara su honestidad, se rechaza.

test('§1 fixture NO formal con metadata completa => VÁLIDO', () => {
  const r = validateM3Latest(M3_API_LATEST_FIXTURE)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  const run = M3_API_LATEST_FIXTURE.run
  assert.equal(run.is_production_shell_run, false)
  assert.equal(run.evidence_source, 'xml_rpc_read_only_measurements')
  assert.equal(run.evidence_classification, 'pre_deployment_semantic_validation')
  assert.deepEqual([...run.production_shell_run_blocked_by].sort(),
    ['module_not_deployed', 'production_shell_unavailable', 'ssh_key_not_registered'])
})

test('§1 fixture NO formal SIN blocked_by => INVÁLIDO', () => {
  const doc = clone()
  doc.run.production_shell_run_blocked_by = []
  const r = validateM3Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('production_shell_run_blocked_by')))
})

test('§1 envelope que AFIRMA production sin evidencia formal => INVÁLIDO', () => {
  // Miente en la bandera pero sigue siendo dev + XML-RPC + con bloqueadores.
  const doc = clone()
  doc.run.is_production_shell_run = true
  const r = validateM3Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.length, 'no puede declararse formal')
})

test('§1 metadata ausente o null => INVÁLIDO (nunca se asume formal)', () => {
  for (const key of ['is_production_shell_run', 'evidence_source', 'evidence_classification',
    'production_shell_run_blocked_by']) {
    for (const bad of [null, undefined]) {
      const doc = clone()
      doc.run[key] = bad
      assert.equal(validateM3Latest(doc).ok, false, `${key}=${bad} debe rechazarse`)
    }
    const missing = clone()
    delete missing.run[key]
    assert.equal(validateM3Latest(missing).ok, false, `${key} ausente debe rechazarse`)
  }
})

test('§1 blocker desconocido => INVÁLIDO (enum cerrado)', () => {
  const doc = clone()
  doc.run.production_shell_run_blocked_by = ['se_nos_hizo_tarde']
  assert.equal(validateM3Latest(doc).ok, false)
})

test('§2 linaje: auditor_build_sha requerido; build_sha ambiguo RECHAZADO', () => {
  assert.equal(M3_API_LATEST_FIXTURE.run.auditor_build_sha,
    '9c709b47b3075b0e3e36b0acc3799b571ed15fe3')
  assert.equal(M3_API_LATEST_FIXTURE.run.contract_build_sha, null)
  assert.ok(!('build_sha' in M3_API_LATEST_FIXTURE.run), 'el sello ambiguo quedó retirado')

  const legacy = clone()
  legacy.run.build_sha = 'eee896f359acda99622c6d176570af972e853741'
  assert.equal(validateM3Latest(legacy).ok, false, 'build_sha suelto ya no se acepta')

  const noAuditor = clone()
  delete noAuditor.run.auditor_build_sha
  assert.equal(validateM3Latest(noAuditor).ok, false)
})

test('§2 la procedencia declara el MISMO build que midió el envelope', () => {
  assert.equal(M3_API_FIXTURE_PROVENANCE.auditor_build_sha,
    M3_API_LATEST_FIXTURE.run.auditor_build_sha)
  assert.equal(M3_API_FIXTURE_PROVENANCE.is_production_shell_run, false)
})

// ── §4: /findings no puede degradar a /latest ────────────────────────────────
test('§4 todo finding porta el contrato epistémico', () => {
  for (const f of M3_API_LATEST_FIXTURE.findings) {
    for (const k of ['classification', 'verdict', 'universe', 'approved_threshold',
      'business_assumption', 'evidence_limitations', 'threshold_source', 'confidence']) {
      assert.ok(f[k] != null, `${f.rule_code} sin ${k}`)
    }
  }
})

test('§4 finding exploratorio como incumplimiento => envelope RECHAZADO', () => {
  const doc = clone()
  doc.findings[0].classification = 'exploratory'
  doc.findings[0].verdict = 'incumplimiento'
  assert.equal(validateM3Latest(doc).ok, false)
})

test('§4 finding incumplimiento sin umbral aprobado => RECHAZADO', () => {
  const doc = clone()
  const f = doc.findings.find((x) => x.verdict === 'incumplimiento')
  f.approved_threshold = false
  assert.equal(validateM3Latest(doc).ok, false)
})

test('§4 finding que CONTRADICE a su rule_result => RECHAZADO', () => {
  const doc = clone()
  const f = doc.findings[0]
  const rule = doc.rule_results.find((r) => r.rule_code === f.rule_code)
  f.verdict = rule.verdict === 'riesgo' ? 'anomalia' : 'riesgo'
  const r = validateM3Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('contradice')))
})

test('§3 el summary del fixture es la suma exacta por veredicto', () => {
  const { rule_results: rr, summary: s } = M3_API_LATEST_FIXTURE
  const sum = (v) => rr.filter((r) => r.verdict === v)
    .reduce((a, r) => a + (Number(r.incidences) || 0), 0)
  assert.equal(s.definitive_incident_count, sum('incumplimiento'))
  assert.equal(s.warning_count, sum('riesgo'))
  assert.equal(s.exploratory_signal_count, sum('anomalia'))
  assert.equal(sum('cumple'), 0)
  assert.equal(sum('no_evaluable'), 0)
  // Número final demostrado (ver M3_RULE_CATALOG §Totales).
  assert.equal(s.exploratory_signal_count, 7543)
  assert.equal(s.total_incidences, 15681)
})
