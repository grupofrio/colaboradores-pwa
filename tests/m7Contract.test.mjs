// KOLD OS · M7 — contrato del envelope, ejes, nivel L1, DAG, linaje, PII.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateM7Latest, validateM7Findings, validateM7Runs, scanPii, lineageState,
  M7_CLASSIFICATIONS, M7_VERDICTS, M7_SEVERITIES, M7_LIFECYCLE_STATES,
  M7_LIFECYCLE_STATES_UNSUPPORTED, M7_UNIVERSE_IDS, M7_PROFITABILITY_LEVELS,
  M7_CAPABILITY_DAG, M7_API_SCHEMA_VERSION,
} from '../src/modules/rentabilidad-costos/m7/contract.js'
import {
  M7_API_LATEST_FIXTURE, M7_API_FIXTURE_PROVENANCE,
} from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M7_API_LATEST_FIXTURE))
const F = M7_API_LATEST_FIXTURE

test('el fixture valida el contrato kold.os.m7.api/1', () => {
  const r = validateM7Latest(F)
  assert.equal(r.ok, true, `errores: ${(r.errors || []).join(' · ')}`)
})

test('nivel derivado = L1_observable_revenue (única verdad hoy)', () => {
  assert.equal(F.capabilities.profitability_level_reached, 'L1_observable_revenue')
  assert.ok(M7_PROFITABILITY_LEVELS.includes(F.capabilities.profitability_level_reached))
})

test('procedencia: PR temporal, no desplegado, no formal, pre-migración', () => {
  const p = M7_API_FIXTURE_PROVENANCE
  assert.match(p.backend_temp_pr, /GrupoFrio#211/)
  assert.equal(p.backend_deployed, false)
  assert.equal(p.real_api_tested, false)
  assert.equal(p.is_production_shell_run, false)
  assert.equal(p.lineage_status, 'pre_migration_lineage')
  assert.equal(p.reseal_required, true)
  assert.equal(p.backend_content_commit, '88c09f49f916c1596aa0f4b1ab62c5625a41c981')
})

test('los cuatro ejes tienen vocabularios DISJUNTOS', () => {
  const sets = [new Set(M7_CLASSIFICATIONS), new Set(M7_VERDICTS),
    new Set(M7_SEVERITIES), new Set(M7_LIFECYCLE_STATES)]
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const inter = [...sets[i]].filter((x) => sets[j].has(x))
      assert.deepEqual(inter, [])
    }
  }
})

test('corrected NO está en el enum; declarado ausente con razón', () => {
  assert.ok(!M7_LIFECYCLE_STATES.includes('corrected'))
  assert.ok('corrected' in M7_LIFECYCLE_STATES_UNSUPPORTED)
  assert.match(M7_LIFECYCLE_STATES_UNSUPPORTED.corrected, /Ausencia/)
})

test('status=RED NO es incumplimiento; 0 incumplimientos en v1', () => {
  assert.equal(F.summary.definitive_incident_rule_count, 0)
  for (const r of F.rule_results) {
    if (r.verdict === 'incumplimiento') assert.ok(r.approved_threshold, r.rule_code)
  }
})

test('la nota de incidencias incluye "pesos" (Codex)', () => {
  const note = F.summary.total_incidences_note
  assert.match(note, /registros únicos/)
  assert.match(note, /pesos/)
  assert.match(note, /pérdida económica/)
})

test('total_incidences = suma exacta recomputada', () => {
  const doc = clone()
  doc.summary.total_incidences += 5
  assert.equal(validateM7Latest(doc).ok, false)
})

// ── BLOCKER L2: el fixture no puede afirmar margen sin COGS histórico ────────
test('gross_margin false; historical_cogs false (L1 es techo)', () => {
  const f = F.capabilities.features
  assert.equal(f.gross_margin_observable, false)
  assert.equal(f.historical_cogs_observable, false)
  assert.equal(f.consolidated_profitability_supported, false)
})

test('L2 declarado sin COGS histórico se RECHAZA', () => {
  const doc = clone()
  doc.capabilities.profitability_level_reached = 'L2_observable_gross_margin'
  assert.equal(validateM7Latest(doc).ok, false)
})

test('historical_sales_cost_match_count = null (jamás 0)', () => {
  assert.equal(F.capabilities.historical_sales_cost_match_count, null)
  assert.equal(F.capabilities.historical_sales_cost_match_pct, null)
  assert.equal(F.capabilities.historical_sales_cost_match_denominator, 728)
  const doc = clone()
  doc.capabilities.historical_sales_cost_match_count = 0
  assert.equal(validateM7Latest(doc).ok, false, 'un 0 en vez de null debe rechazarse')
})

// ── capability_requirements (DAG) ────────────────────────────────────────────
test('capability_requirements: cada capability fuerte tiene contrato', () => {
  const reqs = F.capability_requirements
  assert.ok(reqs)
  for (const cap of Object.keys(M7_CAPABILITY_DAG)) {
    assert.ok(reqs[cap], cap)
    for (const k of ['enabled', 'prerequisites', 'unmet_requirements']) {
      assert.ok(k in reqs[cap], `${cap}.${k}`)
    }
  }
})

test('ninguna capability fuerte está habilitada y todas tienen unmet', () => {
  for (const [cap, r] of Object.entries(F.capability_requirements)) {
    assert.equal(r.enabled, false, cap)
    assert.ok(r.unmet_requirements.length > 0, cap)
  }
})

// ── moneda ───────────────────────────────────────────────────────────────────
test('multi-moneda detectada; sin normalización ni consolidación', () => {
  const f = F.capabilities.features
  assert.equal(f.multi_currency_detected, true)
  assert.equal(f.currency_normalization_supported, false)
  assert.equal(f.consolidated_profitability_supported, false)
  assert.ok(F.run.scope.currency_ids.length >= 2)
})

// ── linaje ───────────────────────────────────────────────────────────────────
test('linaje pre-migración, no formal, re-sellado requerido', () => {
  const lin = lineageState(F)
  assert.equal(lin.is_production_shell_run, false)
  assert.equal(lin.pre_migration, true)
  assert.equal(lin.reseal_required, true)
  assert.equal(lin.mismatch, false)
})

// ── PII ──────────────────────────────────────────────────────────────────────
test('cero PII en el fixture', () => {
  assert.deepEqual(scanPii(F), [])
})

test('un partner_name inyectado se detecta', () => {
  const doc = clone()
  doc.findings[0].partner_name = 'Cliente X'
  assert.ok(scanPii(doc).length > 0)
  assert.equal(validateM7Latest(doc).ok, false)
})

// ── findings / runs ──────────────────────────────────────────────────────────
test('validateM7Findings exige rejected_params y paginación', () => {
  const ok = validateM7Findings({ schema_version: M7_API_SCHEMA_VERSION, items: [],
    total: 0, page: 1, pages: 1, page_size: 25, rejected_params: [] })
  assert.equal(ok.ok, true)
  const bad = validateM7Findings({ schema_version: M7_API_SCHEMA_VERSION, items: [],
    total: 0, page: 1, pages: 1, page_size: 25 })
  assert.equal(bad.ok, false)
})

test('schema desconocido => unsupported', () => {
  const r = validateM7Latest({ schema_version: 'kold.os.m7.api/999' })
  assert.equal(r.schema, 'unsupported')
})

test('universos del fixture dentro del catálogo', () => {
  const used = [...new Set(F.findings.map((f) => f.universe_id))]
  assert.ok(used.length > 0)
  for (const u of used) assert.ok(M7_UNIVERSE_IDS.includes(u), u)
})
