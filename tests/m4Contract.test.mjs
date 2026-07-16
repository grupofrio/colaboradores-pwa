// KOLD OS · M4 — contrato del envelope (backend GrupoVeniu/GrupoFrio#205).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M4_API_SCHEMA_VERSION, classifySchemaVersion, validateM4Latest, validateM4Findings,
  validateM4Runs, isRunStale, M4_STALE_DAYS, scanForbiddenKeys,
  scanPreA5Figures, M4_UNIVERSE_IDS,
} from '../src/modules/ventas/m4/contract.js'
import { M4_API_LATEST_FIXTURE, M4_API_FIXTURE_PROVENANCE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M4_API_LATEST_FIXTURE))

test('fixture valida el contrato kold.os.m4.api/1', () => {
  const r = validateM4Latest(M4_API_LATEST_FIXTURE)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(M4_API_LATEST_FIXTURE.schema_version, M4_API_SCHEMA_VERSION)
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
  // El validador no fija los totales actuales: otro run con otros
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
