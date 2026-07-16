// KOLD OS · M5 — contrato del envelope (backend GrupoVeniu/GrupoFrio#205).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M5_API_SCHEMA_VERSION, classifySchemaVersion, validateM5Latest, validateM5Findings,
  validateM5Runs, isRunStale, M5_STALE_DAYS, scanForbiddenKeys,
  scanStaleUniverseFigures, M5_UNIVERSE_IDS, M5_STALE_UNIVERSE_FIGURES,
} from '../src/modules/inventario/m5/contract.js'
import { M5_API_LATEST_FIXTURE, M5_API_FIXTURE_PROVENANCE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M5_API_LATEST_FIXTURE))

test('fixture valida el contrato kold.os.m5.api/1', () => {
  const r = validateM5Latest(M5_API_LATEST_FIXTURE)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(M5_API_LATEST_FIXTURE.schema_version, M5_API_SCHEMA_VERSION)
})

test('procedencia: linaje al backend real, NO corrida formal', () => {
  assert.equal(M5_API_FIXTURE_PROVENANCE.backend_pr, 'GrupoVeniu/GrupoFrio#208')
  // Base contra la que se midió (origin/GrupoFrio al iniciar M5):
  assert.equal(M5_API_FIXTURE_PROVENANCE.audited_base, '7c461e56')
  assert.equal(M5_API_FIXTURE_PROVENANCE.is_production_shell_run, false)
  assert.equal(M5_API_LATEST_FIXTURE.run.is_production_shell_run, false)
  assert.equal(M5_API_LATEST_FIXTURE.run.evidence_classification,
    'pre_deployment_semantic_validation')
})

// Invariante A8: el SHA que la procedencia declara como "el código que midió"
// DEBE ser el mismo que el envelope reporta en run.auditor_build_sha. Si alguien
// regenera el fixture con otro build y olvida la procedencia (o al revés), el
// linaje queda mintiendo en silencio. Se compara, no se confía.
test('linaje coherente: measuring_commit === run.auditor_build_sha', () => {
  const declared = M5_API_FIXTURE_PROVENANCE.measuring_commit
  assert.match(declared, /^[0-9a-f]{40}$/, 'measuring_commit debe ser un SHA completo')
  assert.equal(M5_API_LATEST_FIXTURE.run.auditor_build_sha, declared,
    'la procedencia declara un build distinto al que emitió el envelope')
  assert.notEqual(declared, M5_API_FIXTURE_PROVENANCE.audited_ancestor,
    'el ancestro auditado no es el que produjo estas mediciones')
})

// ── Universo A5: el frontend RENDERIZA el universo del backend, no lo decide ──
test('M5-H-01: cobertura actual_kg con porcentaje derivado, no escrito', () => {
  const rule = M5_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M5-H-01')
  // Coherencia interna: pct DERIVADO de numerator/denominator (no se afirma la
  // cifra absoluta: otro run con otra ventana también debe validar).
  assert.ok(rule.numerator >= 0 && rule.denominator > 0)
  assert.equal(rule.pct, Math.round((rule.numerator / rule.denominator) * 10000) / 100)
  assert.equal(rule.universe_id, 'executed_stops_in_window')
  assert.equal(rule.verdict, 'riesgo')
})

test('M5-G-06 es una señal reportada acotada a conciliaciones FINALES', () => {
  // El titular de la v1 ("entregado > cargado con 0 refills ⇒ el flujo NO
  // cuadra") mezclaba conciliaciones ABIERTAS -- trabajo en curso -- con
  // FINALES. Medido por estado, la condición NO se cumple en las finales.
  // No se quema el veredicto: se fija la ESTRUCTURA y los límites declarados.
  const rule = M5_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M5-G-06')
  assert.equal(rule.classification, 'exploratory')
  assert.notEqual(rule.verdict, 'incumplimiento', 'una exploratoria jamás lo afirma')
  assert.ok([null, 0, 1].includes(rule.incidences),
    '1 = LA CONDICIÓN agregada, no un conteo de unidades')
  assert.equal(rule.universe_id, 'final_reconciliations_in_window')
  for (const token of ['aggregate_raw=true', 'uom_normalized=false',
    'physical_reconciliation_supported=false', 'reconciliation_state_scope=final']) {
    assert.ok(rule.evidence_limitations.includes(token), `G-06 debe declarar ${token}`)
  }
})

test('M5-G-08: el cuadre físico se declara NO EVALUABLE, no se insinúa', () => {
  const rule = M5_API_LATEST_FIXTURE.rule_results.find((r) => r.rule_code === 'M5-G-08')
  assert.ok(rule, 'la regla del cuadre físico debe existir para declararse inevaluable')
  assert.equal(rule.verdict, 'no_evaluable')
  assert.ok([null, 0].includes(rule.incidences), 'no_evaluable no aporta incidencias')
  assert.equal(M5_API_LATEST_FIXTURE.capabilities.features.physical_reconciliation, false)
})

test('señal reportada y cuadre físico son capabilities distintas', () => {
  // El blocker del RED: leer los totales del documento es posible; demostrar el
  // cuadre físico no lo es. Confundirlas fue el error de la v1.
  const f = M5_API_LATEST_FIXTURE.capabilities.features
  assert.equal(f.raw_reconciliation_signal, true)
  assert.equal(f.physical_reconciliation, false)
  assert.equal(f.uom_normalized_reconciliation, false)
})

test('ningún KPI numérico de "cuadre" cuando la capability es false', () => {
  assert.equal(M5_API_LATEST_FIXTURE.capabilities.features.physical_reconciliation, false)
  for (const key of Object.keys(M5_API_LATEST_FIXTURE.kpis)) {
    for (const banned of ['cuadre', 'balance', 'match_rate', 'physical_match']) {
      assert.ok(!key.toLowerCase().includes(banned), `${key}: un número ahí sería una conclusión`)
    }
  }
})

test('cero cifras del universo pre-A5 en TODO el envelope', () => {
  // 1,620 · 2,333 describían una población que ya no se mide: si vuelven, es
  // que alguien escribió el número del día a mano y la medición cambió debajo.
  assert.deepEqual(scanStaleUniverseFigures(M5_API_LATEST_FIXTURE), [])
  const blob = JSON.stringify(M5_API_LATEST_FIXTURE)
  for (const figure of ['1,620', '1620', '2,333', '2333']) {
    assert.ok(!blob.includes(figure), `${figure} sigue vivo en el envelope`)
  }
  // 69% solo puede aparecer si es un pct REAL calculado.
  const pcts = M5_API_LATEST_FIXTURE.rule_results.map((r) => r.pct).filter((p) => p != null)
  assert.ok(!pcts.includes(69), 'el 69% pre-A5 no es un resultado vigente')
})

test('toda suma de conciliación se declara REPORTADA y con su estado', () => {
  // Una suma de qty_* es lo que el documento DECLARA, no un hecho físico. Y
  // jamás mezcla estados: mezclarlos fue el origen del titular falso.
  const keys = Object.keys(M5_API_LATEST_FIXTURE.kpis).filter((k) => k.includes('reported_units'))
  assert.ok(keys.length >= 4, 'deben existir los totales reportados')
  for (const key of keys) {
    const kpi = M5_API_LATEST_FIXTURE.kpis[key]
    assert.match(kpi.caveat || '', /REPORTADA/,
      `${key}: una suma cruda sin declararse reportada es una afirmación de más`)
    assert.ok(key.startsWith('final_'), `${key}: todo total reportado declara su estado`)
  }
  for (const key of ['reconciliations_final', 'reconciliations_open']) {
    assert.ok(M5_API_LATEST_FIXTURE.kpis[key], `${key} debe emitirse por separado`)
  }
})

test('el mecanismo anti-cifras-obsoletas está armado (lista vacía por diseño)', () => {
  // M5 nace CON catálogo de universos: aún no hay "universo viejo" que vetar.
  // El mecanismo queda armado para el día que una corrección lo requiera.
  assert.deepEqual([...M5_STALE_UNIVERSE_FIGURES], [])
  assert.deepEqual(scanStaleUniverseFigures(M5_API_LATEST_FIXTURE), [])
})

test('todo universe_id del envelope es del catálogo; el pre-A5 se rechaza', () => {
  for (const r of M5_API_LATEST_FIXTURE.rule_results) {
    assert.ok(M5_UNIVERSE_IDS.includes(r.universe_id), `${r.rule_code}: ${r.universe_id}`)
    assert.ok(!r.universe.includes('customer_rank'), `${r.rule_code} describe el universo viejo`)
  }
  const doc = clone()
  doc.rule_results[0].universe_id = 'res_partner_customer_rank_gt_0'
  assert.equal(validateM5Latest(doc).ok, false, 'un universo desconocido debe rechazarse')
})

test('el numerador nunca excede su denominador (A4 dividía archivados entre activos)', () => {
  for (const r of M5_API_LATEST_FIXTURE.rule_results) {
    if (r.numerator == null || r.denominator == null || r.denominator === 0) continue
    assert.ok(r.numerator <= r.denominator, `${r.rule_code}: ${r.numerator} de ${r.denominator}`)
  }
  const doc = clone()
  const f = doc.findings[0]
  f.numerator = (f.denominator || 1) + 1
  assert.equal(validateM5Latest(doc).ok, false, 'un numerador que no cabe debe rechazarse')
})

test('/latest y /findings describen el MISMO universo', () => {
  const rules = new Map(M5_API_LATEST_FIXTURE.rule_results.map((r) => [r.rule_code, r]))
  for (const f of M5_API_LATEST_FIXTURE.findings) {
    const rule = rules.get(f.rule_code)
    assert.equal(f.universe_id, rule.universe_id, `${f.rule_code}: findings vs latest`)
    assert.equal(f.universe, rule.universe, f.rule_code)
  }
  const doc = clone()
  doc.findings[0].universe_id = 'leads_in_scope'
  assert.equal(validateM5Latest(doc).ok, false, 'un hallazgo no puede cambiar de universo')
})

test('metadata de evidencia obligatoria: ausente o null => inválido', () => {
  for (const key of ['is_production_shell_run', 'evidence_source', 'evidence_classification',
    'production_shell_run_blocked_by']) {
    const doc = clone()
    delete doc.run[key]
    assert.equal(validateM5Latest(doc).ok, false, `${key} ausente debe rechazarse`)
    const doc2 = clone()
    doc2.run[key] = null
    assert.equal(validateM5Latest(doc2).ok, false, `${key}=null debe rechazarse`)
  }
})

test('evidencia NO formal sin blocked_by => inválido; afirmar formal => inválido', () => {
  const sin = clone()
  sin.run.production_shell_run_blocked_by = []
  assert.equal(validateM5Latest(sin).ok, false)
  const finge = clone()
  finge.run.is_production_shell_run = true // sigue dev + XML-RPC + blockers
  assert.equal(validateM5Latest(finge).ok, false)
})

test('linaje: auditor_build_sha requerido; build_sha ambiguo rechazado', () => {
  assert.ok(M5_API_LATEST_FIXTURE.run.auditor_build_sha)
  assert.ok(!('build_sha' in M5_API_LATEST_FIXTURE.run))
  const legacy = clone()
  legacy.run.build_sha = 'abc1234'
  assert.equal(validateM5Latest(legacy).ok, false)
  const noAuditor = clone()
  delete noAuditor.run.auditor_build_sha
  assert.equal(validateM5Latest(noAuditor).ok, false)
})

test('ventana ABSOLUTA en scope: sin bordes o invertida => inválido', () => {
  const doc = clone()
  delete doc.run.scope.window_start
  assert.equal(validateM5Latest(doc).ok, false)
  const inv = clone()
  inv.run.scope.window_start = '2026-08-01'
  assert.equal(validateM5Latest(inv).ok, false)
})

test('scope flexible: otras compañías validan (no se hardcodean ids)', () => {
  const doc = clone()
  doc.run.scope.company_ids = [7, 99]
  assert.equal(validateM5Latest(doc).ok, true, 'el validador no fija compañías')
})

test('contrato epistémico en rule_results: invariantes fail-closed', () => {
  const exploratoryAsIncumplimiento = clone()
  const rr = exploratoryAsIncumplimiento.rule_results.find((r) => r.classification === 'exploratory')
  rr.verdict = 'incumplimiento'
  assert.equal(validateM5Latest(exploratoryAsIncumplimiento).ok, false)

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
  assert.equal(validateM5Latest(sinUmbral).ok, false)

  const noEvalConIncidencias = clone()
  const ne = noEvalConIncidencias.rule_results.find((r) => r.verdict === 'no_evaluable')
  ne.incidences = 7
  assert.equal(validateM5Latest(noEvalConIncidencias).ok, false)

  const sinUniverso = clone()
  sinUniverso.rule_results[0].universe = ''
  assert.equal(validateM5Latest(sinUniverso).ok, false)
})

test('summary: total DEBE ser la suma exacta recomputada de rule_results', () => {
  const doc = clone()
  doc.summary.total_incidences += 2 // el 7541-style drift se rechaza
  assert.equal(validateM5Latest(doc).ok, false)
  const doc2 = clone()
  doc2.summary.exploratory_signal_count += 1
  assert.equal(validateM5Latest(doc2).ok, false)
})

test('summary.unique_records_available debe ser false (incidencias ≠ únicos)', () => {
  const doc = clone()
  doc.summary.unique_records_available = true
  assert.equal(validateM5Latest(doc).ok, false)
})

test('findings portan contrato epistémico y NO contradicen a su regla', () => {
  for (const f of M5_API_LATEST_FIXTURE.findings) {
    for (const k of ['classification', 'verdict', 'universe', 'approved_threshold',
      'business_assumption', 'evidence_limitations', 'threshold_source']) {
      assert.ok(f[k] !== undefined && f[k] !== null, `${f.rule_code} sin ${k}`)
    }
  }
  const doc = clone()
  const f = doc.findings[0]
  const rule = doc.rule_results.find((r) => r.rule_code === f.rule_code)
  f.verdict = rule.verdict === 'riesgo' ? 'anomalia' : 'riesgo'
  const r = validateM5Latest(doc)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('contradice')))
})

test('granularidad honesta: aggregate con ids => inválido', () => {
  const doc = clone()
  doc.findings[0].branch_id = 29
  assert.equal(validateM5Latest(doc).ok, false)
})

test('PII: clave sensible en cualquier nivel => envelope RECHAZADO', () => {
  for (const bad of ['customer_name', 'phone', 'email', 'vat_number', 'street', 'salesperson_name']) {
    const doc = clone()
    doc.findings[0][bad] = 'x'
    const r = validateM5Latest(doc)
    assert.equal(r.ok, false, `${bad} debe rechazarse`)
    assert.ok(r.errors.some((e) => e.includes('sensibles')), bad)
  }
  assert.deepEqual(scanForbiddenKeys(M5_API_LATEST_FIXTURE), [], 'el fixture está limpio')
})

test('schema_version: soportada / futura / ausente => controlado', () => {
  assert.equal(classifySchemaVersion(M5_API_LATEST_FIXTURE), 'supported')
  assert.equal(classifySchemaVersion({ schema_version: 'kold.os.m5.api/9' }), 'unsupported')
  assert.equal(classifySchemaVersion({}), 'missing')
  const doc = clone()
  doc.schema_version = 'kold.os.m5.api/9'
  const r = validateM5Latest(doc)
  assert.equal(r.ok, false)
  assert.equal(r.schema, 'unsupported')
})

test('validateM5Findings y validateM5Runs: forma mínima + PII', () => {
  const page = {
    ok: true, schema_version: M5_API_SCHEMA_VERSION,
    total: 2, page: 1, pages: 1, page_size: 10,
    items: [], rejected_params: ['employee_id'],
  }
  assert.equal(validateM5Findings(page).ok, true)
  assert.equal(validateM5Findings({ ...page, items: undefined }).ok, false)
  assert.equal(validateM5Findings({ ...page, items: [{ customer_name: 'x' }] }).ok, false)

  const runs = { ok: true, schema_version: M5_API_SCHEMA_VERSION, runs: [] }
  assert.equal(validateM5Runs(runs).ok, true)
  assert.equal(validateM5Runs({ ...runs, runs: undefined }).ok, false)
})

test('STALE se recomputa client-side (no se confía ciegamente en el server)', () => {
  const run = M5_API_LATEST_FIXTURE.run
  const fresh = new Date(Date.parse(run.finished_at) + 3600_000).toISOString()
  assert.equal(isRunStale(run, fresh), false)
  const staleDate = new Date(Date.parse(run.finished_at) + (M5_STALE_DAYS + 1) * 86400_000).toISOString()
  assert.equal(isRunStale(run, staleDate), true)
  assert.equal(M5_API_LATEST_FIXTURE.stale, false)
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
  assert.equal(validateM5Latest(doc).ok, true, 'otros números coherentes validan')
})
