import test from 'node:test'
import assert from 'node:assert/strict'

import {
  M2_QUERY_IDS, M2_STALE_DAYS, validateM2Report, technicalStateFor, metricRows,
} from '../src/modules/planeacion/m2/contract.js'
import { M2_FIXTURE_RUN } from '../src/modules/planeacion/m2/fixtures/realRun20260714.js'

const clone = () => JSON.parse(JSON.stringify(M2_FIXTURE_RUN))

// ── Manifiesto cerrado: exactamente las 13 queries del auditor ──────────────
test('el contrato conoce exactamente las 13 queries del manifiesto del auditor', () => {
  assert.equal(M2_QUERY_IDS.length, 13)
  assert.deepEqual([...M2_QUERY_IDS].sort(), [...new Set(M2_QUERY_IDS)].sort(), 'sin duplicados')
  for (const id of ['scope_validation', 'capacity_metrics', 'solver_evidence_metrics',
    'territory_load_handoff_metrics', 'weekly_plan_metrics', 'handoff_metrics',
    'snapshot_metrics', 'forecast_metrics', 'history_metrics']) {
    assert.ok(M2_QUERY_IDS.includes(id), id)
  }
})

test('el fixture de reconstrucción VALIDA el contrato completo', () => {
  const { ok, errors } = validateM2Report(M2_FIXTURE_RUN)
  assert.deepEqual(errors, [])
  assert.equal(ok, true)
})

test('fixture: 13/13 ejecutadas, 0 omitidas, contrato producción 3/3', () => {
  assert.equal(M2_FIXTURE_RUN.executed_queries.length, 13)
  assert.deepEqual(M2_FIXTURE_RUN.skipped_queries, [])
  assert.equal(M2_FIXTURE_RUN.duration_ms, 342)
  assert.deepEqual(M2_FIXTURE_RUN.production_contract,
    { contract_satisfied: true, database_match: true, scope_exact: true })
  assert.deepEqual(M2_FIXTURE_RUN.scope.company_ids, [1, 34, 35, 36])
  assert.equal(M2_FIXTURE_RUN.scope.window_days, 90)
})

// ── Rechazos fail-closed ─────────────────────────────────────────────────────
test('rechaza: no-objeto, status inválido, guardas no booleanas', () => {
  assert.equal(validateM2Report(null).ok, false)
  assert.equal(validateM2Report([]).ok, false)
  assert.equal(validateM2Report('x').ok, false)
  const badStatus = clone(); badStatus.status = 'OK'
  assert.equal(validateM2Report(badStatus).ok, false)
  const badGuard = clone(); badGuard.write_blocked = 'true'
  assert.equal(validateM2Report(badGuard).ok, false)
})

test('rechaza hashes malformados y build_sha inválido', () => {
  for (const key of ['manifest_sha256', 'evidence_sha256', 'run_id_sha256']) {
    const doc = clone(); doc[key] = 'ZZZ'
    assert.equal(validateM2Report(doc).ok, false, key)
  }
  const doc = clone(); doc.build_sha = 'xyz'
  assert.equal(validateM2Report(doc).ok, false)
})

test('rechaza queries desconocidas, duplicadas o manifiesto incompleto', () => {
  const unknown = clone(); unknown.executed_queries = [...unknown.executed_queries, 'evil_query']
  assert.equal(validateM2Report(unknown).ok, false)
  const dup = clone(); dup.executed_queries = [...dup.executed_queries, 'capacity_metrics']
  assert.equal(validateM2Report(dup).ok, false)
  const missing = clone(); missing.executed_queries = missing.executed_queries.slice(0, 5)
  assert.equal(validateM2Report(missing).ok, false, 'las 13 deben estar ejecutadas u omitidas')
  const skipped = clone()
  skipped.executed_queries = skipped.executed_queries.slice(0, 12)
  skipped.skipped_queries = [{ query_id: skipped.executed_queries.includes('territory_load_handoff_metrics') ? 'capacity_metrics' : 'territory_load_handoff_metrics', reason: 'required_schema_unavailable' }]
  // cobertura completa ejecutadas+omitidas => puede validar (si la omitida es la que falta)
  const cover = new Set([...skipped.executed_queries, ...skipped.skipped_queries.map((s) => s.query_id)])
  assert.equal(validateM2Report(skipped).ok, cover.size === 13)
})

test('rechaza métricas con claves sensibles (espejo del sanitizador del auditor)', () => {
  const doc = clone()
  doc.metrics.capacity_metrics = [{ ...doc.metrics.capacity_metrics[0], employee_name: 'X' }]
  assert.equal(validateM2Report(doc).ok, false)
  const doc2 = clone()
  doc2.metrics.capacity_metrics = [{ ...doc2.metrics.capacity_metrics[0], api_key: 'k' }]
  assert.equal(validateM2Report(doc2).ok, false)
})

test('rechaza métricas no escalares y scope malformado', () => {
  const doc = clone()
  doc.metrics.capacity_metrics = [{ plan_count: { nested: true } }]
  assert.equal(validateM2Report(doc).ok, false)
  const badScope = clone(); badScope.scope.company_ids = [0]
  assert.equal(validateM2Report(badScope).ok, false)
  const badWindow = clone(); badWindow.scope.window_days = 0
  assert.equal(validateM2Report(badWindow).ok, false)
})

test('producción exige contrato 3/3 y scope exacto 1,34,35,36', () => {
  const noPc = clone(); delete noPc.production_contract
  assert.equal(validateM2Report(noPc).ok, false)
  const badPc = clone(); badPc.production_contract.scope_exact = false
  assert.equal(validateM2Report(badPc).ok, false)
  const badCompanies = clone(); badCompanies.scope.company_ids = [1, 34]
  assert.equal(validateM2Report(badCompanies).ok, false)
  const badBranches = clone(); badBranches.scope.branch_ids = [29]
  assert.equal(validateM2Report(badBranches).ok, false)
  const badWindow = clone(); badWindow.scope.window_days = 120
  assert.equal(validateM2Report(badWindow).ok, false)
})

// ── Estado técnico: PASS / FAIL / STALE / UNAVAILABLE ───────────────────────
test('estado técnico: PASS reciente, STALE viejo, FAIL con guardas rotas, UNAVAILABLE sin doc', () => {
  assert.equal(technicalStateFor(M2_FIXTURE_RUN, '2026-07-15T00:00:00Z'), 'PASS')
  const staleDate = new Date(Date.parse(M2_FIXTURE_RUN.finished_at) + (M2_STALE_DAYS + 1) * 86400000).toISOString()
  assert.equal(technicalStateFor(M2_FIXTURE_RUN, staleDate), 'STALE')
  const failed = clone(); failed.status = 'FAIL'
  assert.equal(technicalStateFor(failed, '2026-07-15T00:00:00Z'), 'FAIL')
  const noRollback = clone(); noRollback.rollback_confirmed = false
  assert.equal(technicalStateFor(noRollback, '2026-07-15T00:00:00Z'), 'FAIL')
  assert.equal(technicalStateFor(null, '2026-07-15T00:00:00Z'), 'UNAVAILABLE')
  assert.equal(technicalStateFor({ garbage: true }, '2026-07-15T00:00:00Z'), 'UNAVAILABLE')
})

test('metricRows: devuelve filas o null (nunca lanza)', () => {
  assert.equal(metricRows(M2_FIXTURE_RUN, 'capacity_metrics').length, 1)
  assert.equal(metricRows(M2_FIXTURE_RUN, 'no_existe'), null)
  assert.equal(metricRows(null, 'capacity_metrics'), null)
})
