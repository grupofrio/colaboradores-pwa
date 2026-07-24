// KOLD OS · M6 — contrato del envelope, ejes, monedas, linaje, PII.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateM6Latest, validateM6Findings, validateM6Runs, scanPii,
  M6_CLASSIFICATIONS, M6_VERDICTS, M6_SEVERITIES, M6_LIFECYCLE_STATES,
  M6_GRANULARITIES, M6_UNIVERSE_IDS, M6_LIFECYCLE_STATES_UNSUPPORTED,
} from '../src/modules/caja-conciliacion/m6/contract.js'
import {
  M6_API_LATEST_FIXTURE, M6_API_FIXTURE_PROVENANCE,
} from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M6_API_LATEST_FIXTURE))
const F = M6_API_LATEST_FIXTURE

test('el fixture valida el contrato kold.os.m6.api/1', () => {
  const r = validateM6Latest(F)
  assert.equal(r.ok, true, `errores: ${(r.errors || []).join(' · ')}`)
})

// "PR existe" ≠ "backend desplegado" ≠ "API real probada" ≠ "runtime validado".
// Codex marcó que el body de #75 las confundía: decir "el backend no existe"
// cuando SÍ existe #210 es tan falso como decir que ya está listo. Sólo la
// primera es cierta hoy, y cada una se afirma por separado.
test('procedencia: el PR temporal EXISTE, pero nada más', () => {
  assert.equal(M6_API_FIXTURE_PROVENANCE.backend_status, 'TEMP_PR_OPEN_NOT_DEPLOYED')
  assert.match(M6_API_FIXTURE_PROVENANCE.backend_temp_pr, /GrupoFrio#210/)
  assert.match(M6_API_FIXTURE_PROVENANCE.backend_temp_pr, /no se mergea/)
  assert.equal(M6_API_FIXTURE_PROVENANCE.backend_deployed, false,
    'el PR existe; el backend NO está desplegado')
  assert.equal(M6_API_FIXTURE_PROVENANCE.real_api_tested, false,
    'la API real jamás ha sido probada: no existe endpoint desplegado')
  assert.equal(M6_API_FIXTURE_PROVENANCE.is_production_shell_run, false)
  assert.equal(M6_API_FIXTURE_PROVENANCE.measurement_method, 'xml_rpc_read_only')
  assert.ok(M6_API_FIXTURE_PROVENANCE.production_shell_run_blocked_by.length > 0)
})

test('linaje coherente CONSIGO MISMO: measuring_commit === run.auditor_build_sha', () => {
  assert.equal(M6_API_FIXTURE_PROVENANCE.measuring_commit, F.run.auditor_build_sha)
  assert.match(F.run.auditor_build_sha, /^[0-9a-f]{7,64}$/)
})

// La divergencia con el backend es ESPERADA y está declarada. No se persigue: el
// sello del backend volverá a cambiar al portar a grupofrio/gf, y alinearlo hoy
// daría una falsa sensación de cierre. Lo que NO se acepta es que quede tácita.
test('linaje divergente del backend: DECLARADO, no escondido', () => {
  const p = M6_API_FIXTURE_PROVENANCE
  assert.equal(p.lineage_status, 'expected_pre_migration_lineage_mismatch')
  assert.match(p.backend_current_seal, /^[0-9a-f]{7,64}$/)
  assert.notEqual(p.measuring_commit, p.backend_current_seal,
    'si coincidieran, el estado ya no sería "mismatch" y habría que reclasificarlo')
  assert.equal(p.lineage_resync_required_before_ready, true,
    'la divergencia NO bloquea la auditoría, pero SÍ bloquea Ready final')
  assert.match(p.contract_crosscheck, /35\/36/,
    'el contrato es 35/36 mientras el linaje no se resincronice: nunca 36/36')
})

test('evidencia NO formal declarada EN EL DATO (no en la prosa)', () => {
  assert.equal(F.run.is_production_shell_run, false)
  assert.equal(F.run.measurement_method, 'xml_rpc_read_only')
  assert.ok(Array.isArray(F.run.production_shell_run_blocked_by))
  assert.ok(F.run.production_shell_run_blocked_by.length > 0)
})

// ── LOS CUATRO EJES ─────────────────────────────────────────────────────────
test('los cuatro ejes tienen vocabularios DISJUNTOS', () => {
  const cls = new Set(M6_CLASSIFICATIONS)
  const ver = new Set(M6_VERDICTS)
  const sev = new Set(M6_SEVERITIES)
  const life = new Set(M6_LIFECYCLE_STATES)
  const inter = (a, b) => [...a].filter((x) => b.has(x))
  assert.deepEqual(inter(cls, ver), [], 'classification y verdict se solapan')
  assert.deepEqual(inter(sev, ver), [], 'severity y verdict se solapan')
  assert.deepEqual(inter(sev, cls), [], 'severity y classification se solapan')
  assert.deepEqual(inter(life, ver), [], 'lifecycle y verdict se solapan')
})

test('ningún eje se deriva de otro (si lo fuera, el mapa sería 1:1)', () => {
  const rr = F.rule_results
  const mapa = (a, b) => {
    const out = {}
    for (const r of rr) (out[r[a]] ||= new Set()).add(r[b])
    return out
  }
  assert.ok(Object.values(mapa('classification', 'severity')).some((v) => v.size > 1),
    'severity parece derivarse de classification')
  assert.ok(Object.values(mapa('severity', 'classification')).some((v) => v.size > 1),
    'classification parece derivarse de severity')
  assert.ok(Object.values(mapa('verdict', 'severity')).some((v) => v.size > 1),
    'severity parece derivarse de verdict')
})

test('status=RED NO es incumplimiento (bug 4 de M3)', () => {
  const rojos = F.rule_results.filter((r) => r.status === 'RED')
  assert.ok(rojos.length > 0, 'debe haber rojos en esta evidencia')
  for (const r of rojos) {
    assert.notEqual(r.verdict, 'incumplimiento',
      `${r.rule_code}: RED != incumplimiento sin umbral aprobado`)
  }
})

test('el summary publica los TRES ejes por separado', () => {
  const s = F.summary
  assert.ok(s.classification_rule_counts, 'falta el eje de clasificación')
  assert.ok(s.severity_rule_counts, 'falta el eje de severidad')
  assert.ok(!('exploratory_signal_rule_count' in s),
    'nombre de clasificación sobre un conteo de veredictos')
  const sumCls = Object.values(s.classification_rule_counts).reduce((a, b) => a + b, 0)
  const sumSev = Object.values(s.severity_rule_counts).reduce((a, b) => a + b, 0)
  const sumVer = s.definitive_incident_rule_count + s.warning_rule_count
    + s.anomaly_rule_count + s.compliant_rule_count + s.not_evaluable_rule_count
  assert.equal(sumCls, s.total_rules)
  assert.equal(sumSev, s.total_rules)
  assert.equal(sumVer, s.total_rules, 'los tres ejes leen las MISMAS reglas')
})

test('cero incumplimientos: ninguna regla tiene umbral aprobado en v1', () => {
  assert.equal(F.summary.definitive_incident_rule_count, 0)
  for (const r of F.rule_results) {
    if (r.verdict === 'incumplimiento') assert.ok(r.approved_threshold, r.rule_code)
  }
  assert.deepEqual(F.rule_results.filter((r) => r.approved_threshold).map((r) => r.rule_code), [])
})

test('el total es la suma exacta recomputada (drift se rechaza)', () => {
  const doc = clone()
  doc.summary.total_incidences += 2
  assert.equal(validateM6Latest(doc).ok, false)
})

test('un incumplimiento sin umbral aprobado se rechaza', () => {
  const doc = clone()
  const r = doc.rule_results.find((x) => x.verdict === 'riesgo')
  r.verdict = 'incumplimiento'
  r.approved_threshold = false
  assert.equal(validateM6Latest(doc).ok, false)
})

// ── MONEDA ──────────────────────────────────────────────────────────────────
test('multi-moneda detectada: MXN + USD en el scope', () => {
  assert.equal(F.capabilities.features.multi_currency_detected, true)
  assert.ok(F.run.scope.currency_ids.length >= 2, 'el scope declara varias monedas')
})

test('sin normalización NO hay total consolidado', () => {
  const f = F.capabilities.features
  assert.equal(f.currency_normalization_supported, false)
  assert.equal(f.exchange_rate_coverage, false)
  assert.equal(f.consolidated_global_total, false,
    'con varias monedas y sin tasa, un total global sería falso')
})

test('la regla de moneda declara el total NO evaluable', () => {
  const r = F.rule_results.find((x) => x.rule_code === 'M6-I-01')
  assert.ok(r, 'debe existir la regla de moneda')
  assert.equal(r.verdict, 'no_evaluable')
  assert.equal(r.classification, 'not_evaluable')
})

// ── HANDOFFS ────────────────────────────────────────────────────────────────
test('los handoffs JAMÁS son incumplimiento', () => {
  const hs = F.rule_results.filter((r) => r.category === 'handoffs')
  assert.ok(hs.length > 0, 'debe haber handoffs')
  for (const h of hs) assert.notEqual(h.verdict, 'incumplimiento', h.rule_code)
})

test('handoff M5→M6: lo físico NO es financiero', () => {
  assert.equal(F.capabilities.features.physical_to_financial_bridge, false)
  const r = F.rule_results.find((x) => x.rule_code === 'M6-H-04')
  assert.equal(r.verdict, 'no_evaluable')
})

test('handoff M1→M6: cash_pending es SEÑAL, no saldo', () => {
  assert.equal(F.capabilities.features.m1_cash_pending_reconciliation, false)
  assert.equal(F.rule_results.find((x) => x.rule_code === 'M6-H-01').verdict, 'no_evaluable')
})

// ── UNIVERSOS / CAMPOS FANTASMA ─────────────────────────────────────────────
test('todo universe_id del envelope pertenece al catálogo', () => {
  const known = new Set(M6_UNIVERSE_IDS)
  const used = new Set(F.rule_results.map((r) => r.universe_id))
  assert.ok(used.size > 0)
  for (const u of used) assert.ok(known.has(u), `universo desconocido: ${u}`)
})

test('un universe_id desconocido invalida el envelope', () => {
  const doc = clone()
  doc.rule_results[0].universe_id = 'universo_inventado'
  assert.equal(validateM6Latest(doc).ok, false)
})

test('SIN CAMPOS FANTASMA: cada query que la pantalla lee existe en metrics', () => {
  // La pantalla lee run.metrics[query][0][field]. Si la query no existe, el tile
  // no se renderiza — pero eso sería un hueco MUDO. Aquí se fija que las queries
  // que la UI espera SÍ vienen en el payload.
  const esperadas = ['invoice_metrics', 'payment_metrics', 'seller_cashbox_metrics',
    'cash_closing_metrics', 'branch_close_metrics', 'ar_aging_metrics',
    'reconciliation_metrics', 'bank_statement_metrics', 'currency_metrics']
  for (const q of esperadas) {
    assert.ok(Array.isArray(F.metrics[q]), `la query ${q} no viene en el payload`)
    assert.ok(F.metrics[q][0], `la query ${q} viene vacía`)
  }
})

test('el envelope NO trae un objeto kpis (por eso la UI lee metrics)', () => {
  // Documenta la brecha real del backend v1: no emite `kpis` con contrato (M5 sí).
  // La UI lee `metrics` y lo declara. Si algún día el backend emite `kpis`, este
  // test recuerda revisar la pantalla en vez de dejar dos fuentes conviviendo.
  assert.equal('kpis' in F, false,
    'si el backend ya emite kpis, migrar la pantalla y actualizar M6_KNOWN_LIMITATIONS')
})

// ── PII ─────────────────────────────────────────────────────────────────────
test('el envelope NO porta PII en ningún nivel', () => {
  assert.deepEqual(scanPii(F), [])
})

test('el scanner de PII detecta una clave sensible inyectada', () => {
  const doc = clone()
  doc.findings[0].partner_name = 'Cliente Ejemplo'
  assert.ok(scanPii(doc).length > 0, 'el scanner debe morder')
  assert.equal(validateM6Latest(doc).ok, false)
})

// ── FINDINGS / RUNS ─────────────────────────────────────────────────────────
test('findings: rejected_params es obligatorio (un filtro mudo es una mentira)', () => {
  const page = { schema_version: 'kold.os.m6.api/1', items: [], total: 0, page: 1,
    pages: 1, page_size: 25, rejected_params: [] }
  assert.equal(validateM6Findings(page).ok, true)
  const sin = { ...page }
  delete sin.rejected_params
  assert.equal(validateM6Findings(sin).ok, false)
})

test('findings: items no puede exceder page_size (paginación rota)', () => {
  const page = { schema_version: 'kold.os.m6.api/1', items: [1, 2, 3], total: 3,
    page: 1, pages: 1, page_size: 2, rejected_params: [] }
  assert.equal(validateM6Findings(page).ok, false)
})

test('runs: el historial jamás mezcla scope_key', () => {
  const ok = { schema_version: 'kold.os.m6.api/1', scope_key: 'a'.repeat(64),
    runs: [{ scope_key: 'a'.repeat(64) }], runs_count: 1 }
  assert.equal(validateM6Runs(ok).ok, true)
  const mixed = { ...ok, runs: [{ scope_key: 'b'.repeat(64) }] }
  assert.equal(validateM6Runs(mixed).ok, false)
})

test('schema desconocida => schema_mismatch, no se renderiza', () => {
  const doc = clone()
  doc.schema_version = 'kold.os.m6.api/99'
  const r = validateM6Latest(doc)
  assert.equal(r.ok, false)
  assert.equal(r.schema, 'unsupported')
})

test('granularidad v1: sólo aggregate', () => {
  assert.deepEqual([...M6_GRANULARITIES], ['aggregate'])
  assert.deepEqual(F.capabilities.granularities, ['aggregate'])
})

// ─── El fixture ESPEJA el contrato (hueco de cobertura que costó caro) ───────
//
// Al recortar `corrected` del enum, la suite siguió en verde con el fixture
// declarando `["new","persistent","corrected","recurrent"]`: NADA cruzaba
// capabilities contra las constantes del contrato. Un fixture que envejece en
// silencio es un demo que miente sobre el backend. Esto lo impide.

test('el fixture espeja EXACTAMENTE los cuatro ejes del contrato', () => {
  const pares = [
    ['classifications', M6_CLASSIFICATIONS],
    ['verdicts', M6_VERDICTS],
    ['severities', M6_SEVERITIES],
    ['lifecycle_states', M6_LIFECYCLE_STATES],
  ]
  assert.equal(pares.length, 4)
  for (const [clave, esperado] of pares) {
    assert.deepEqual(F.capabilities[clave], [...esperado],
      `capabilities.${clave} del fixture no espeja el contrato: el fixture envejeció`)
  }
})

test('el fixture espeja el catálogo de universos', () => {
  const usados = [...new Set((F.findings || []).map((f) => f.universe_id))]
  assert.ok(usados.length > 0, 'sin universos no hay nada que verificar: test vacuo')
  for (const u of usados) assert.ok(M6_UNIVERSE_IDS.includes(u), `universo desconocido: ${u}`)
})

test('corrected: el fixture lo declara NO soportado, con razón', () => {
  assert.ok(!('corrected' in F), 'el payload NO debe traer la clave `corrected`')
  assert.equal(F.capabilities.features.lifecycle_corrected_detection, false)
  assert.ok(!F.capabilities.lifecycle_states.includes('corrected'))
  const razon = F.capabilities.lifecycle_states_unsupported?.corrected
  assert.ok(razon && razon.length > 40, 'debe declarar POR QUÉ no se soporta')
  assert.match(razon, /Ausencia/)
})

test('corrected: el contrato del frontend espeja la ausencia declarada', () => {
  assert.ok(!M6_LIFECYCLE_STATES.includes('corrected'))
  assert.ok('corrected' in M6_LIFECYCLE_STATES_UNSUPPORTED)
  assert.deepEqual(
    Object.keys(M6_LIFECYCLE_STATES_UNSUPPORTED).sort(),
    Object.keys(F.capabilities.lifecycle_states_unsupported).sort(),
    'lo que el frontend cree no soportado debe ser lo que el backend declara')
})

test('los estados emitidos + los no soportados no se solapan', () => {
  for (const estado of Object.keys(M6_LIFECYCLE_STATES_UNSUPPORTED)) {
    assert.ok(!M6_LIFECYCLE_STATES.includes(estado),
      `${estado} no puede estar a la vez emitido y no soportado`)
  }
})

test('ningún hallazgo del fixture se declara corrected', () => {
  assert.ok(F.findings.length > 0, 'sin hallazgos el test sería vacuo')
  for (const f of F.findings) {
    assert.ok(M6_LIFECYCLE_STATES.includes(f.lifecycle_status),
      `lifecycle_status fuera del enum: ${f.lifecycle_status}`)
  }
})
