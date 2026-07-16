// KOLD OS · M4 — contrato del envelope (backend GrupoVeniu/GrupoFrio#205).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M4_API_SCHEMA_VERSION, classifySchemaVersion, validateM4Latest, validateM4Findings,
  validateM4Runs, canonicalizeM4Latest, isRunStale, M4_STALE_DAYS, scanForbiddenKeys,
  scanPreA5Figures, M4_UNIVERSE_IDS,
} from '../src/modules/ventas/m4/contract.js'
import { M4_API_LATEST_FIXTURE, M4_API_FIXTURE_PROVENANCE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))
const findingsPage = ({
  items = [], total = items.length, page = 1, pages = Math.max(1, Math.ceil(total / 25)),
  pageSize = 25, runId = M4_API_LATEST_FIXTURE.run.run_id, ...overrides
} = {}) => ({
  ok: true,
  schema_version: M4_API_SCHEMA_VERSION,
  run_id: runId,
  total,
  page,
  pages,
  page_size: pageSize,
  items,
  applied_scope: { level: 'global' },
  applied_filters: {},
  rejected_params: [],
  read_only: true,
  ...overrides,
})

const uniqueFinding = (index) => {
  const finding = JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE.findings[0]))
  finding.finding_id = finding.finding_id.replace(/::[0-9a-f]{64}::/, `::${index.toString(16).padStart(64, '0')}::`)
  return finding
}

const runsEnvelope = (runs = []) => ({
  ok: true,
  schema_version: M4_API_SCHEMA_VERSION,
  runs,
  applied_scope: { level: 'global' },
  read_only: true,
})

const runMeta = (overrides = {}) => {
  const run = M4_API_LATEST_FIXTURE.run
  return {
    run_id: run.run_id,
    status: run.status,
    environment: run.environment,
    finished_at: run.finished_at,
    ingested_at: new Date(Date.parse(run.finished_at) + 1000).toISOString(),
    manifest_sha256: run.manifest_sha256,
    evidence_sha256: run.evidence_sha256,
    auditor_build_sha: run.auditor_build_sha,
    contract_build_sha: run.contract_build_sha,
    is_production_shell_run: run.is_production_shell_run,
    production_shell_run_blocked_by: [...run.production_shell_run_blocked_by],
    evidence_source: run.evidence_source,
    evidence_classification: run.evidence_classification,
    findings_count: M4_API_LATEST_FIXTURE.findings.length,
    ...overrides,
  }
}

test('fixture valida el contrato kold.os.m4.api/1', () => {
  const r = validateM4Latest(M4_API_LATEST_FIXTURE)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(M4_API_LATEST_FIXTURE.schema_version, M4_API_SCHEMA_VERSION)
})

test('latest acepta el incidence_semantics literal emitido por Odoo', () => {
  const doc = clone()
  for (const item of doc.findings) {
    item.incidence_semantics = 'Incidencias detectadas, NO entidades únicas.'
  }
  const result = validateM4Latest(doc)
  assert.equal(result.ok, true, result.errors.join('\n'))
})

test('latest rechaza campos desconocidos en toda capa exportable', () => {
  const probes = [
    ['envelope', (doc) => { doc.comment = 'Juan Pérez' }],
    ['metrics', (doc) => { doc.metrics.comment = { customer_note: 'Juan Pérez' } }],
    ['metric row', (doc) => { doc.metrics.order_metrics[0].comment = 'Juan Pérez' }],
    ['kpi', (doc) => { doc.kpis.confirmed_orders.comment = 'Juan Pérez' }],
    ['rule_result', (doc) => { doc.rule_results[0].comment = 'Juan Pérez' }],
    ['summary', (doc) => { doc.summary.comment = 'Juan Pérez' }],
    ['capabilities', (doc) => { doc.capabilities.comment = 'Juan Pérez' }],
    ['capability feature', (doc) => { doc.capabilities.features.comment = 'Juan Pérez' }],
    ['history', (doc) => { doc.history.comment = 'Juan Pérez' }],
    ['run', (doc) => { doc.run.comment = 'Juan Pérez' }],
    ['run.scope', (doc) => { doc.run.scope.comment = 'Juan Pérez' }],
    ['applied_scope', (doc) => { doc.applied_scope.comment = 'Juan Pérez' }],
  ]
  for (const [label, mutate] of probes) {
    const doc = clone()
    mutate(doc)
    assert.equal(validateM4Latest(doc).ok, false, `${label} desconocido fue aceptado`)
  }
})

test('latest rechaza valores arbitrarios en toda metadata renderizada o exportada', () => {
  const probes = [
    ['run.environment', (doc) => { doc.run.environment = 'Juan Perez' }],
    ['run.scope.timezone', (doc) => { doc.run.scope.timezone = 'Juan/Perez' }],
    ['run.executed_queries', (doc) => { doc.run.executed_queries[0] = 'customer_juan_perez' }],
    ['run.skipped_queries', (doc) => { doc.run.skipped_queries = ['customer_juan_perez'] }],
    ['capabilities.required_query_ids', (doc) => { doc.capabilities.required_query_ids[0] = 'customer_juan_perez' }],
    ['capabilities.optional_query_ids', (doc) => { doc.capabilities.optional_query_ids = ['customer_juan_perez'] }],
    ['capabilities.granularities', (doc) => { doc.capabilities.granularities = ['customer'] }],
    ['capabilities.classifications', (doc) => { doc.capabilities.classifications[0] = 'customer_juan_perez' }],
    ['capabilities.verdicts', (doc) => { doc.capabilities.verdicts[0] = 'customer_juan_perez' }],
    ['capabilities.features', (doc) => { doc.capabilities.features.history = false }],
    ['metrics.module_status.name', (doc) => { doc.metrics.module_status[0].name = 'juan_perez' }],
    ['metrics.module_status.state', (doc) => { doc.metrics.module_status[0].state = 'juan_perez' }],
    ['metrics.module_status.version', (doc) => { doc.metrics.module_status[0].version = 'juan_perez' }],
    ['metrics.schema_catalog.table', (doc) => { doc.metrics.schema_catalog[0].table_name = 'juan_perez' }],
    ['metrics.schema_catalog.column', (doc) => { doc.metrics.schema_catalog[0].column_name = 'juan_perez' }],
    ['metrics.order_state', (doc) => { doc.metrics.order_state_metrics[0].state = 'juan_perez' }],
    ['kpi.universe', (doc) => { doc.kpis.confirmed_orders.universe = 'Pedidos de Juan Perez' }],
    ['kpi.source_model', (doc) => { doc.kpis.confirmed_orders.source_model = 'juan.perez' }],
    ['kpi.source_fields', (doc) => { doc.kpis.confirmed_orders.source_fields = ['juan_perez'] }],
    ['kpi.caveat', (doc) => { doc.kpis.confirmed_orders.caveat = 'Revisado por Juan Perez' }],
    ['kpi.data_as_of', (doc) => { doc.kpis.confirmed_orders.data_as_of = '2026-07-14T09:00:00Z' }],
    ['summary.overall_status', (doc) => { doc.summary.overall_status = 'Juan Perez' }],
    ['summary count', (doc) => { doc.summary.rules_pass = 'Juan Perez' }],
    ['corrected.finding_key', (doc) => {
      doc.corrected = [{
        finding_key: 'Juan Perez', rule_code: doc.findings[0].rule_code,
        lifecycle_status: 'corrected', first_seen_at: doc.run.finished_at,
        last_seen_at: doc.run.finished_at, occurrence_count: 1,
      }]
    }],
  ]
  for (const [label, mutate] of probes) {
    const doc = clone()
    mutate(doc)
    assert.equal(validateM4Latest(doc).ok, false, `${label} arbitrario fue aceptado`)
  }
})

test('coverage y caveat de KPI son opcionales, pero si vienen respetan el contrato canónico', () => {
  for (const field of ['coverage', 'caveat']) {
    const doc = clone()
    delete doc.kpis.confirmed_orders[field]
    const result = validateM4Latest(doc)
    assert.equal(result.ok, true, `${field} omitido debe ser válido: ${result.errors.join('\n')}`)
  }

  const badCoverage = clone()
  badCoverage.kpis.confirmed_orders.coverage = 'Juan Perez'
  assert.equal(validateM4Latest(badCoverage).ok, false)

  const outOfRangeCoverage = clone()
  outOfRangeCoverage.kpis.confirmed_orders.coverage = 101
  assert.equal(validateM4Latest(outOfRangeCoverage).ok, false)

  const badCaveat = clone()
  badCaveat.kpis.confirmed_orders.caveat = 'Confirmado por Juan Perez'
  assert.equal(validateM4Latest(badCaveat).ok, false)
})

test('procedencia: linaje al backend real, NO corrida formal', () => {
  assert.equal(M4_API_FIXTURE_PROVENANCE.backend_pr, 'GrupoVeniu/GrupoFrio#205')
  // El commit que Codex auditó queda registrado como ancestro, no como origen.
  assert.equal(M4_API_FIXTURE_PROVENANCE.audited_ancestor,
    '978994c49baefac9da010580667ae89a8f7251d5')
  assert.equal(M4_API_FIXTURE_PROVENANCE.is_production_shell_run, false)
  assert.equal(M4_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.equal(M4_API_LATEST_FIXTURE.run.evidence_classification,
    'pre_deployment_semantic_validation')
})

// Invariante A8: el SHA que la procedencia declara como "el código que midió"
// DEBE ser el mismo que el envelope reporta en run.auditor_build_sha. Si alguien
// regenera el fixture con otro build y olvida la procedencia (o al revés), el
// linaje queda mintiendo en silencio. Se compara, no se confía.
test('linaje coherente: measuring_commit === run.auditor_build_sha', () => {
  const declared = M4_API_FIXTURE_PROVENANCE.measuring_commit
  assert.match(declared, /^[0-9a-f]{40}$/, 'measuring_commit debe ser un SHA completo')
  assert.equal(M4_API_LATEST_FIXTURE.run.auditor_build_sha, declared,
    'la procedencia declara un build distinto al que emitió el envelope')
  assert.notEqual(declared, M4_API_FIXTURE_PROVENANCE.audited_ancestor,
    'el ancestro auditado no es el que produjo estas mediciones')
})

// ── Universo A5: el frontend RENDERIZA el universo del backend, no lo decide ──
test('M4-F-01: 78 de 584 con el porcentaje matemáticamente correcto', () => {
  const rule = M4_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M4-F-01')
  assert.equal(rule.numerator, 78)
  assert.equal(rule.denominator, 584)
  // El pct se DERIVA: no se cree el texto, se recalcula.
  assert.equal(rule.pct, Math.round((78 / 584) * 10000) / 100)
  assert.equal(rule.observed_value, '78 de 584 (13.36%)')
  assert.equal(rule.universe_id, 'active_commercial_customer_roots_in_scope')
})

test('M4-A-04: 168 de 752 — los archivados no se dividen entre los activos', () => {
  const rule = M4_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M4-A-04')
  assert.equal(rule.numerator, 168)
  assert.equal(rule.denominator, 752, 'el denominador es el superconjunto, no los 584 activos')
  assert.equal(rule.pct, Math.round((168 / 752) * 10000) / 100)
  assert.equal(rule.observed_value, '168 de 752 (22.34%)')
  assert.equal(rule.universe_id, 'commercial_customer_roots_in_scope')
})

test('cero cifras del universo pre-A5 en TODO el envelope', () => {
  // 1,620 · 2,333 describían una población que ya no se mide: si vuelven, es
  // que alguien escribió el número del día a mano y la medición cambió debajo.
  assert.deepEqual(scanPreA5Figures(M4_API_LATEST_FIXTURE), [])
  const blob = JSON.stringify(M4_API_LATEST_FIXTURE)
  for (const figure of ['1,620', '1620', '2,333', '2333']) {
    assert.ok(!blob.includes(figure), `${figure} sigue vivo en el envelope`)
  }
  // 69% solo puede aparecer si es un pct REAL calculado.
  const pcts = M4_API_LATEST_FIXTURE.rule_results.map((r) => r.pct).filter((p) => p != null)
  assert.ok(!pcts.includes(69), 'el 69% pre-A5 no es un resultado vigente')
})

test('customer_rank solo vive donde es una CONDICIÓN, nunca como universo', () => {
  // `customer_rank` no está prohibido en el envelope: M4-D-02 mide precisamente
  // "pedidos a un partner con customer_rank<=0", y los KPIs declaran el campo
  // real que leen. Lo prohibido es que describa la POBLACIÓN — ahí significaba
  // el universo pre-A5 de 2,333.
  for (const r of M4_API_LATEST_FIXTURE.rule_results) {
    assert.ok(!r.universe.includes('customer_rank'),
      `${r.rule_code}: customer_rank en el universo = población pre-A5`)
  }
  for (const f of M4_API_LATEST_FIXTURE.findings) {
    assert.ok(!f.universe.includes('customer_rank'), `${f.rule_code}: idem en el hallazgo`)
  }
  for (const [key, kpi] of Object.entries(M4_API_LATEST_FIXTURE.kpis)) {
    assert.ok(!String(kpi.universe).includes('customer_rank'), `kpis.${key}: idem`)
  }
  // Y sigue vivo donde SÍ corresponde: la regla que lo mide.
  const d02 = M4_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M4-D-02')
  assert.ok(d02.business_assumption.includes('customer_rank'),
    'M4-D-02 mide customer_rank: debe poder nombrarlo en su supuesto')
  assert.equal(d02.universe_id, 'confirmed_orders_in_window',
    'su universo es el PEDIDO; customer_rank es la condición')
})

test('el envelope con una cifra pre-A5 se RECHAZA', () => {
  const doc = clone()
  const f = doc.rule_results.find((r) => r.rule_code === 'M4-F-01')
  f.evidence_limitations = "1620/2333 (69%) sin compra en 180d; sin definición aprobada."
  const r = validateM4Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('pre-A5')), JSON.stringify(r.errors))
})

test('todo universe_id del envelope es del catálogo; el pre-A5 se rechaza', () => {
  for (const r of M4_API_LATEST_FIXTURE.rule_results) {
    assert.ok(M4_UNIVERSE_IDS.includes(r.universe_id), `${r.rule_code}: ${r.universe_id}`)
    assert.ok(!r.universe.includes('customer_rank'), `${r.rule_code} describe el universo viejo`)
  }
  const doc = clone()
  doc.rule_results[0].universe_id = 'res_partner_customer_rank_gt_0'
  assert.equal(validateM4Latest(doc).ok, false, 'un universo desconocido debe rechazarse')
})

test('el numerador nunca excede su denominador (A4 dividía archivados entre activos)', () => {
  for (const r of M4_API_LATEST_FIXTURE.rule_results) {
    if (r.numerator == null || r.denominator == null || r.denominator === 0) continue
    assert.ok(r.numerator <= r.denominator, `${r.rule_code}: ${r.numerator} de ${r.denominator}`)
  }
  const doc = clone()
  const f = doc.findings[0]
  f.numerator = (f.denominator || 1) + 1
  assert.equal(validateM4Latest(doc).ok, false, 'un numerador que no cabe debe rechazarse')
})

test('/latest y /findings describen el MISMO universo', () => {
  const rules = new Map(M4_API_LATEST_FIXTURE.rule_results.map((r) => [r.rule_code, r]))
  for (const f of M4_API_LATEST_FIXTURE.findings) {
    const rule = rules.get(f.rule_code)
    assert.equal(f.universe_id, rule.universe_id, `${f.rule_code}: findings vs latest`)
    assert.equal(f.universe, rule.universe, f.rule_code)
  }
  const doc = clone()
  doc.findings[0].universe_id = 'leads_in_scope'
  assert.equal(validateM4Latest(doc).ok, false, 'un hallazgo no puede cambiar de universo')
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

  // El fixture real tiene CERO incumplimientos (tras la inspección A6 ninguna
  // regla puede afirmarlo con esta evidencia), así que el invariante se prueba
  // FABRICANDO uno: un incumplimiento sin umbral aprobado debe rechazarse
  // aunque el backend hoy no emita ninguno.
  assert.equal(clone().rule_results.filter((r) => r.verdict === 'incumplimiento').length, 0,
    'la evidencia v1 no prueba ningún incumplimiento definitivo')
  const sinUmbral = clone()
  const rule = sinUmbral.rule_results.find((r) => r.classification === 'definitive')
  rule.verdict = 'incumplimiento'
  rule.approved_threshold = false
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
  const page = findingsPage({ items: [], total: 0 })
  assert.equal(validateM4Findings(page).ok, true)
  assert.equal(validateM4Findings({ ...page, rejected_params: ['employee_id'] }).ok, false)
  assert.equal(validateM4Findings({ ...page, items: undefined }).ok, false)
  assert.equal(validateM4Findings({ ...page, items: [{ customer_name: 'x' }] }).ok, false)

  const runs = runsEnvelope([])
  assert.equal(validateM4Runs(runs).ok, true)
  assert.equal(validateM4Runs({ ...runs, runs: undefined }).ok, false)
})

test('validateM4Findings valida cada hallazgo agregado con contrato epistémico completo', () => {
  const doc = clone()
  const valid = doc.findings[0]
  const context = { ruleResults: doc.rule_results, run: doc.run }
  const page = findingsPage({ items: [valid] })
  assert.equal(validateM4Findings(page, context).ok, true)

  for (const mutate of [
    (f) => { f.granularity = 'customer'; f.entity_id = 42; f.entity_reference = 'Cliente 42' },
    (f) => { f.classification = 'exploratory'; f.verdict = 'incumplimiento' },
    (f) => { f.classification = 'caveated'; f.verdict = 'anomalia' },
    (f) => { delete f.confidence },
    (f) => { f.entity_reference = 'cliente@example.com' },
    (f) => { f.entity_reference = '+52 55 1234 5678' },
    (f) => { f.entity_reference = 'RFC ABCD010203EF4' },
  ]) {
    const malicious = JSON.parse(JSON.stringify(page))
    mutate(malicious.items[0])
    assert.equal(validateM4Findings(malicious, context).ok, false)
  }
})

test('paginación /findings acepta first/middle/last/empty coherentes', () => {
  const context = {
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run: M4_API_LATEST_FIXTURE.run,
  }
  const rows = Array.from({ length: 5 }, (_, index) => uniqueFinding(index + 1))
  const valid = [
    findingsPage({ items: rows.slice(0, 2), total: 5, page: 1, pages: 3, pageSize: 2 }),
    findingsPage({ items: rows.slice(2, 4), total: 5, page: 2, pages: 3, pageSize: 2 }),
    findingsPage({ items: rows.slice(4), total: 5, page: 3, pages: 3, pageSize: 2 }),
    findingsPage({ items: [], total: 0, page: 1, pages: 1, pageSize: 25 }),
  ]
  for (const page of valid) {
    const result = validateM4Findings(page, context)
    assert.equal(result.ok, true, result.errors.join('\n'))
  }
})

test('paginación /findings rechaza ids duplicados y rangos incoherentes', () => {
  const context = {
    ruleResults: M4_API_LATEST_FIXTURE.rule_results,
    run: M4_API_LATEST_FIXTURE.run,
  }
  const one = uniqueFinding(1)
  const two = uniqueFinding(2)
  const cases = [
    ['finding_id duplicado', findingsPage({ items: [one, one], total: 2, pageSize: 2 })],
    ['items > page_size', findingsPage({ items: [one, two], total: 2, pageSize: 1, pages: 2 })],
    ['page cero', findingsPage({ items: [], total: 0, page: 0, pages: 1 })],
    ['pages cero', findingsPage({ items: [], total: 0, page: 1, pages: 0 })],
    ['pages != ceil', findingsPage({ items: [one], total: 3, page: 1, pages: 1, pageSize: 2 })],
    ['page > pages', findingsPage({ items: [], total: 2, page: 2, pages: 1, pageSize: 2 })],
    ['middle incompleta', findingsPage({ items: [one], total: 5, page: 2, pages: 3, pageSize: 2 })],
    ['last excede remanente', findingsPage({ items: [one, two], total: 3, page: 2, pages: 2, pageSize: 2 })],
    ['empty con page distinta de 1', findingsPage({ items: [], total: 0, page: 2, pages: 1 })],
  ]
  for (const [label, page] of cases) {
    assert.equal(validateM4Findings(page, context).ok, false, `aceptó ${label}`)
  }
})

test('todos los findings canónicos del fixture pasan con el catálogo runtime', () => {
  const doc = clone()
  const page = findingsPage({ items: doc.findings, pageSize: 100 })
  const result = validateM4Findings(page, { ruleResults: doc.rule_results, run: doc.run })
  assert.equal(result.ok, true, result.errors.join('\n'))
})

test('contrato completo: todo campo UI/export requerido falla cerrado si falta', () => {
  const required = [
    'finding_id', 'rule_code', 'category', 'severity', 'status', 'granularity',
    'title', 'description', 'entity_type', 'entity_id', 'entity_reference',
    'observed_value', 'expected_rule', 'numerator', 'denominator', 'pct',
    'incidences', 'incidence_semantics', 'responsible_area', 'owner_status',
    'recommended_action', 'classification', 'verdict', 'confidence',
    'universe_id', 'universe', 'business_assumption', 'evidence_limitations',
    'approved_threshold', 'threshold_source', 'lifecycle_status',
    'occurrence_count', 'first_seen_at', 'last_seen_at', 'source_model',
    'source_timestamp', 'evidence_reference',
  ]
  const evidenceRequired = [
    'query_id', 'evidence_fields', 'evidence_sha256', 'manifest_sha256',
    'auditor_build_sha', 'contract_build_sha', 'evidence_source',
    'evidence_classification', 'is_production_shell_run',
  ]
  const doc = clone()
  const context = { ruleResults: doc.rule_results, run: doc.run }
  const pageFor = (finding) => ({
    ok: true, schema_version: M4_API_SCHEMA_VERSION,
    total: 1, page: 1, pages: 1, page_size: 25,
    items: [finding], rejected_params: [],
  })
  for (const field of required) {
    const finding = JSON.parse(JSON.stringify(doc.findings[0]))
    delete finding[field]
    assert.equal(validateM4Findings(pageFor(finding), context).ok, false, `aceptó sin ${field}`)
  }
  for (const field of evidenceRequired) {
    const finding = JSON.parse(JSON.stringify(doc.findings[0]))
    delete finding.evidence_reference[field]
    assert.equal(validateM4Findings(pageFor(finding), context).ok, false,
      `aceptó evidence_reference sin ${field}`)
  }
})

test('contrato completo: enums, fechas, ids y coherencia dinámica son cerrados', () => {
  const doc = clone()
  const context = { ruleResults: doc.rule_results, run: doc.run }
  const pageFor = (finding) => ({
    ok: true, schema_version: M4_API_SCHEMA_VERSION,
    total: 1, page: 1, pages: 1, page_size: 25,
    items: [finding], rejected_params: [],
  })
  const mutations = [
    ['rule_code desconocido', (f) => { f.rule_code = 'M4-Z-99' }],
    ['severity', (f) => { f.severity = 'critical' }],
    ['category', (f) => { f.category = 'personas' }],
    ['status', (f) => { f.status = 'BLUE' }],
    ['classification', (f) => { f.classification = 'personal' }],
    ['verdict', (f) => { f.verdict = 'tal_vez' }],
    ['confidence', (f) => { f.confidence = 'certain' }],
    ['granularity', (f) => { f.granularity = 'customer' }],
    ['entity_type', (f) => { f.entity_type = 'person' }],
    ['lifecycle_status', (f) => { f.lifecycle_status = 'old' }],
    ['owner_status', (f) => { f.owner_status = 'Juan Pérez' }],
    ['first_seen_at', (f) => { f.first_seen_at = 'ayer' }],
    ['last_seen_at', (f) => { f.last_seen_at = '16/07/2026' }],
    ['source_timestamp', (f) => { f.source_timestamp = 'ahora' }],
    ['finding_id', (f) => { f.finding_id = 'Juan Pérez' }],
    ['observed_value', (f) => { f.observed_value = 'Cliente Juan Pérez' }],
    ['numerator', (f) => { f.numerator += 1 }],
    ['evidence query', (f) => { f.evidence_reference.query_id = 'people_lookup' }],
  ]
  for (const [label, mutate] of mutations) {
    const finding = JSON.parse(JSON.stringify(doc.findings[0]))
    mutate(finding)
    assert.equal(validateM4Findings(pageFor(finding), context).ok, false, `aceptó ${label}`)
  }
})

test('copy visible: solo catálogo y plantilla aggregate; free-text/PII falla cerrado', () => {
  const doc = clone()
  const context = { ruleResults: doc.rule_results, run: doc.run }
  const pageFor = (finding) => ({
    ok: true, schema_version: M4_API_SCHEMA_VERSION,
    total: 1, page: 1, pages: 1, page_size: 25,
    items: [finding], rejected_params: [],
  })
  for (const [field, value] of [
    ['title', 'Cliente Juan Pérez requiere seguimiento'],
    ['description', 'Revisar pedido de María Hernández'],
    ['entity_reference', 'Juan Pérez'],
    ['expected_rule', 'Llamar a Pedro mañana'],
    ['responsible_area', 'Responsable: Ana López'],
    ['recommended_action', 'Contactar a Carlos Ruiz'],
    ['business_assumption', 'La cuenta pertenece a Laura Gómez'],
    ['evidence_limitations', 'Confirmado por Roberto Díaz'],
    ['threshold_source', 'Aprobó Patricia Sánchez'],
    ['title', 'cliente@example.com'],
    ['description', '+52 55 1234 5678'],
    ['description', 'RFC ABCD010203EF4'],
  ]) {
    const finding = JSON.parse(JSON.stringify(doc.findings[0]))
    finding[field] = value
    assert.equal(validateM4Findings(pageFor(finding), context).ok, false,
      `aceptó free-text en ${field}: ${value}`)
  }

  const generic = JSON.parse(JSON.stringify(doc.findings[0]))
  generic.comment_line = 'Juan Pérez aprobó esta cuenta'
  assert.equal(validateM4Findings(pageFor(generic), context).ok, false,
    'campo genérico extra podría filtrarse al JSON')

  const nested = JSON.parse(JSON.stringify(doc.findings[0]))
  nested.evidence_reference.reviewer = 'María Hernández'
  assert.equal(validateM4Findings(pageFor(nested), context).ok, false,
    'evidencia extra no catalogada podría filtrar PII')
})

test('latest también rechaza copy de finding que no viene del catálogo', () => {
  for (const field of ['title', 'description']) {
    const doc = clone()
    doc.findings[0][field] = 'Juan Pérez'
    assert.equal(validateM4Latest(doc).ok, false, `latest aceptó ${field} arbitrario`)
  }
})

test('observed_value solo admite plantillas agregadas aun si latest y finding coinciden', () => {
  const doc = clone()
  const finding = doc.findings[0]
  const rule = doc.rule_results.find((item) => item.rule_code === finding.rule_code)
  finding.observed_value = 'Cliente Juan Pérez con saldo pendiente'
  rule.observed_value = finding.observed_value
  assert.equal(validateM4Latest(doc).ok, false, 'copy dinámico arbitrario no puede viajar como observado')
})

test('fechas ISO con calendario imposible fallan cerrado', () => {
  const doc = clone()
  doc.findings[0].last_seen_at = '2026-99-40T09:00:00Z'
  assert.equal(validateM4Latest(doc).ok, false)
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
  // El validador no fija los totales actuales: otro run con otros
  // números pero coherente DEBE validar. (No hardcodear resultados.)
  const doc = clone()
  let changedRule
  for (const r of doc.rule_results) {
    if (r.verdict === 'riesgo' && Number.isInteger(r.incidences)) {
      r.incidences += 5
      changedRule = r
      break
    }
  }
  const sum = (v) => doc.rule_results.filter((x) => x.verdict === v)
    .reduce((a, x) => a + (Number.isFinite(Number(x.incidences)) ? Number(x.incidences) : 0), 0)
  doc.summary.warning_count = sum('riesgo')
  doc.summary.total_incidences = sum('incumplimiento') + sum('riesgo') + sum('anomalia')
  // findings deben seguir sin contradecir (no tocamos findings: la regla tocada
  // puede no tener finding; si lo tiene, sincronizamos)
  for (const f of doc.findings) {
    const rule = doc.rule_results.find((r) => r.rule_code === f.rule_code)
    if (rule) {
      f.verdict = rule.verdict
      f.classification = rule.classification
      if (rule === changedRule) f.incidences = rule.incidences
    }
  }
  assert.equal(validateM4Latest(doc).ok, true, 'otros números coherentes validan')
})

test('summary coincide campo por campo con rule_results y se exporta derivado', () => {
  const numericFields = [
    'total_rules', 'definitive_incident_rule_count', 'warning_rule_count',
    'exploratory_signal_rule_count', 'not_evaluable_rule_count', 'compliant_rule_count',
    'definitive_incident_count', 'warning_count', 'exploratory_signal_count',
    'total_incidences', 'rules_pass', 'rules_warning', 'rules_fail',
    'rules_not_evaluable',
  ]
  for (const field of numericFields) {
    const doc = clone()
    doc.summary[field] += 1
    assert.equal(validateM4Latest(doc).ok, false, `summary.${field} aceptó drift`)
  }
  for (const [field, value] of [
    ['overall_status', 'GREEN'],
    ['unique_records_available', true],
  ]) {
    const doc = clone()
    doc.summary[field] = value
    assert.equal(validateM4Latest(doc).ok, false, `summary.${field} aceptó drift`)
  }

  const doc = clone()
  const canonical = canonicalizeM4Latest(doc)
  assert.deepEqual(canonical.summary, doc.summary)
  assert.notEqual(canonical.summary, doc.summary)
})

test('/runs exige contrato exacto y devuelve solo metadata canónica', () => {
  const valid = runsEnvelope([runMeta()])
  assert.equal(validateM4Runs(valid).ok, true)

  const mutations = [
    ['top extra', (doc) => { doc.operator = 'Juan Perez' }],
    ['run extra', (doc) => { doc.runs[0].note = 'Juan Perez' }],
    ['PII email', (doc) => { doc.runs[0].email = 'persona@example.com' }],
    ['PII name', (doc) => { doc.runs[0].name = 'Juan Perez' }],
    ['status', (doc) => { doc.runs[0].status = 'STALE' }],
    ['environment', (doc) => { doc.runs[0].environment = 'qa' }],
    ['finished_at', (doc) => { doc.runs[0].finished_at = 'ayer' }],
    ['ingested_at', (doc) => { doc.runs[0].ingested_at = '16/07/2026' }],
    ['manifest hash', (doc) => { doc.runs[0].manifest_sha256 = 'abc' }],
    ['build hash', (doc) => { doc.runs[0].auditor_build_sha = 'not-a-sha' }],
    ['future finish', (doc) => {
      doc.runs[0].ingested_at = new Date(Date.parse(doc.runs[0].finished_at) - 1).toISOString()
    }],
    ['unordered list', (doc) => {
      const older = runMeta({
        run_id: '1'.repeat(64),
        finished_at: new Date(Date.parse(doc.runs[0].finished_at) - 1000).toISOString(),
        ingested_at: doc.runs[0].finished_at,
      })
      doc.runs = [older, doc.runs[0]]
    }],
  ]
  for (const [label, mutate] of mutations) {
    const doc = JSON.parse(JSON.stringify(valid))
    mutate(doc)
    assert.equal(validateM4Runs(doc).ok, false, `/runs aceptó ${label}`)
  }
})

test('lifecycle corrected valida catálogo, unicidad y cronología, y deriva corrected_at', () => {
  const current = Date.parse(M4_API_LATEST_FIXTURE.run.finished_at)
  const previous = new Date(current - 60_000).toISOString()
  const validCorrection = {
    finding_key: M4_API_LATEST_FIXTURE.findings[0].finding_id,
    rule_code: M4_API_LATEST_FIXTURE.findings[0].rule_code,
    lifecycle_status: 'corrected',
    first_seen_at: previous,
    last_seen_at: previous,
    occurrence_count: 1,
  }
  const validDoc = clone()
  validDoc.history = {
    runs_count: 2,
    previous_finished_at: previous,
    latest_finished_at: validDoc.run.finished_at,
  }
  validDoc.corrected = [validCorrection]
  assert.equal(validateM4Latest(validDoc).ok, true)
  const canonical = canonicalizeM4Latest(validDoc)
  assert.equal(canonical.corrected[0].corrected_at, validDoc.run.finished_at)
  assert.equal(validateM4Latest(canonical).ok, true, 'la forma canónica debe revalidar')
  assert.deepEqual(canonicalizeM4Latest(canonical), canonical, 'canonicalizar dos veces es idempotente')

  const canonicalInput = JSON.parse(JSON.stringify(validDoc))
  canonicalInput.corrected[0].corrected_at = canonicalInput.run.finished_at
  assert.equal(validateM4Latest(canonicalInput).ok, true, 'corrected_at exacto es válido')

  const mutations = [
    ['entity_type', (doc) => {
      doc.corrected[0].finding_key = doc.corrected[0].finding_key.replace('::customer:aggregate', '::order:aggregate')
    }],
    ['duplicate key', (doc) => { doc.corrected.push({ ...doc.corrected[0] }) }],
    ['last_seen after previous', (doc) => { doc.corrected[0].last_seen_at = doc.run.finished_at }],
    ['first_seen after last_seen', (doc) => {
      doc.corrected[0].first_seen_at = doc.run.finished_at
    }],
    ['unknown lifecycle field', (doc) => { doc.corrected[0].operator = 'Juan Perez' }],
    ['corrected_at before current', (doc) => {
      doc.corrected[0].corrected_at = doc.history.previous_finished_at
    }],
    ['corrected_at after current', (doc) => {
      doc.corrected[0].corrected_at = new Date(Date.parse(doc.run.finished_at) + 1).toISOString()
    }],
    ['corrected_at invalid', (doc) => { doc.corrected[0].corrected_at = 'hoy' }],
  ]
  for (const [label, mutate] of mutations) {
    const doc = JSON.parse(JSON.stringify(validDoc))
    mutate(doc)
    assert.equal(validateM4Latest(doc).ok, false, `corrected aceptó ${label}`)
  }
})

test('cronología latest acepta bordes y rechaza inversiones de run/history', () => {
  const boundary = clone()
  boundary.run.finished_at = boundary.run.started_at
  boundary.run.ingested_at = boundary.run.finished_at
  boundary.history.latest_finished_at = boundary.run.finished_at
  for (const kpi of Object.values(boundary.kpis)) kpi.data_as_of = boundary.run.finished_at
  for (const finding of boundary.findings) {
    finding.first_seen_at = boundary.run.finished_at
    finding.last_seen_at = boundary.run.finished_at
    finding.source_timestamp = boundary.run.finished_at
    finding.evidence_reference = { ...finding.evidence_reference }
  }
  assert.equal(validateM4Latest(boundary).ok, true, 'started=finished=ingested debe ser válido')

  const mutations = [
    ['started after finished', (doc) => { doc.run.started_at = new Date(Date.parse(doc.run.finished_at) + 1).toISOString() }],
    ['finished after ingested', (doc) => { doc.run.ingested_at = new Date(Date.parse(doc.run.finished_at) - 1).toISOString() }],
    ['latest mismatch', (doc) => { doc.history.latest_finished_at = doc.run.started_at }],
    ['previous equals current', (doc) => {
      doc.history.runs_count = 2
      doc.history.previous_finished_at = doc.run.finished_at
    }],
    ['previous overlaps current run', (doc) => {
      doc.history.runs_count = 2
      doc.history.previous_finished_at = new Date(Date.parse(doc.run.started_at) + 100).toISOString()
    }],
    ['previous absent with history', (doc) => {
      doc.history.runs_count = 2
      doc.history.previous_finished_at = null
    }],
    ['finding last_seen after current run', (doc) => {
      doc.findings[0].last_seen_at = new Date(Date.parse(doc.run.finished_at) + 1).toISOString()
    }],
  ]
  for (const [label, mutate] of mutations) {
    const doc = clone()
    mutate(doc)
    assert.equal(validateM4Latest(doc).ok, false, `cronología aceptó ${label}`)
  }
})
