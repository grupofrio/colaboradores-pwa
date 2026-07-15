import test from 'node:test'
import assert from 'node:assert/strict'

import { stableFindingId, applyLifecycle } from '../src/modules/planeacion/m2/lifecycle.js'
import { deriveM2 } from '../src/modules/planeacion/m2/deriveFindings.js'
import { M2_FIXTURE_RUN } from '../src/modules/planeacion/m2/fixtures/realRun20260714.js'

const finding = (rule_code, extra = {}) => ({
  rule_code, status: 'RED', company_id: null, branch_id: null, entity_id: null, ...extra,
})
const run = (finished_at, findings) => ({ report: { finished_at }, findings })

// ── finding_id estable ───────────────────────────────────────────────────────
test('stableFindingId: determinista y sensible a regla/scope/entidad', () => {
  assert.equal(stableFindingId(finding('M2-A-01')), 'M2-A-01::global:all::aggregate')
  assert.equal(stableFindingId(finding('M2-A-01')), stableFindingId(finding('M2-A-01')))
  assert.notEqual(stableFindingId(finding('M2-A-01')), stableFindingId(finding('M2-B-01')))
  assert.notEqual(
    stableFindingId(finding('M2-A-01', { company_id: 34 })),
    stableFindingId(finding('M2-A-01', { company_id: 35 })),
  )
  assert.notEqual(
    stableFindingId(finding('M2-A-01', { entity_id: 101 })),
    stableFindingId(finding('M2-A-01', { entity_id: 102 })),
  )
})

// ── Matriz new / persistent / corrected / recurrent ─────────────────────────
test('primera corrida: todo hallazgo es new', () => {
  const { findings, corrected, run_count } = applyLifecycle([
    run('2026-07-14T22:00:00Z', [finding('M2-A-01'), finding('M2-B-01')]),
  ])
  assert.equal(run_count, 1)
  assert.equal(corrected.length, 0)
  assert.deepEqual(findings.map((f) => f.lifecycle_status), ['new', 'new'])
  assert.deepEqual(findings.map((f) => f.occurrence_count), [1, 1])
})

test('presente en corridas consecutivas => persistent (con first/last_seen)', () => {
  const { findings } = applyLifecycle([
    run('2026-07-07T22:00:00Z', [finding('M2-A-01')]),
    run('2026-07-14T22:00:00Z', [finding('M2-A-01')]),
  ])
  const f = findings.find((x) => x.rule_code === 'M2-A-01')
  assert.equal(f.lifecycle_status, 'persistent')
  assert.equal(f.occurrence_count, 2)
  assert.equal(f.first_seen_at, '2026-07-07T22:00:00Z')
  assert.equal(f.last_seen_at, '2026-07-14T22:00:00Z')
})

test('desaparece tras existir => corrected (con última evidencia conocida)', () => {
  const { findings, corrected } = applyLifecycle([
    run('2026-07-07T22:00:00Z', [finding('M2-D-01')]),
    run('2026-07-14T22:00:00Z', []),
  ])
  assert.equal(findings.length, 0)
  assert.equal(corrected.length, 1)
  assert.equal(corrected[0].lifecycle_status, 'corrected')
  assert.equal(corrected[0].last_seen_at, '2026-07-07T22:00:00Z')
  assert.equal(corrected[0].corrected_observed_at, '2026-07-14T22:00:00Z')
})

test('reaparece tras corregirse => recurrent', () => {
  const { findings } = applyLifecycle([
    run('2026-06-30T22:00:00Z', [finding('M2-C-03')]),
    run('2026-07-07T22:00:00Z', []),
    run('2026-07-14T22:00:00Z', [finding('M2-C-03')]),
  ])
  const f = findings.find((x) => x.rule_code === 'M2-C-03')
  assert.equal(f.lifecycle_status, 'recurrent')
  assert.equal(f.occurrence_count, 2)
  assert.equal(f.first_seen_at, '2026-06-30T22:00:00Z')
})

test('nuevo en la última corrida junto a persistentes: clasifica cada uno', () => {
  const { findings } = applyLifecycle([
    run('2026-07-07T22:00:00Z', [finding('M2-A-01')]),
    run('2026-07-14T22:00:00Z', [finding('M2-A-01'), finding('M2-F-01')]),
  ])
  assert.equal(findings.find((f) => f.rule_code === 'M2-A-01').lifecycle_status, 'persistent')
  assert.equal(findings.find((f) => f.rule_code === 'M2-F-01').lifecycle_status, 'new')
})

test('el orden de entrada NO importa: se ordena por finished_at', () => {
  const a = applyLifecycle([
    run('2026-07-14T22:00:00Z', [finding('M2-A-01')]),
    run('2026-07-07T22:00:00Z', [finding('M2-A-01')]),
  ])
  assert.equal(a.findings[0].lifecycle_status, 'persistent')
  assert.equal(a.findings[0].last_seen_at, '2026-07-14T22:00:00Z')
})

test('entradas corruptas: se ignoran sin lanzar (fail-safe)', () => {
  const { findings, run_count } = applyLifecycle([
    null, {}, { report: {}, findings: 'x' },
    run('2026-07-14T22:00:00Z', [finding('M2-A-01')]),
  ])
  assert.equal(run_count, 1)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].lifecycle_status, 'new')
})

// ── Integración con el fixture real ─────────────────────────────────────────
test('fixture real: única corrida => todos los hallazgos derivados son new', () => {
  const derived = deriveM2(M2_FIXTURE_RUN)
  const { findings, run_count } = applyLifecycle([{ report: M2_FIXTURE_RUN, findings: derived.findings }])
  assert.equal(run_count, 1)
  assert.equal(findings.length, derived.findings.length)
  assert.ok(findings.every((f) => f.lifecycle_status === 'new'))
  assert.ok(findings.every((f) => f.first_seen_at === M2_FIXTURE_RUN.finished_at))
  // RED primero (orden de severidad operativa)
  const statuses = findings.map((f) => f.status)
  const firstAmber = statuses.indexOf('AMBER')
  const lastRed = statuses.lastIndexOf('RED')
  assert.ok(firstAmber === -1 || lastRed < firstAmber, 'RED antes que AMBER')
})
