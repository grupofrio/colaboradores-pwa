// KOLD OS · Etapa 0A — adaptadores PresentationMeta + frescura (lógica PURA).
// Verifica que cada adaptador lee el PATH correcto y que un campo ausente NO produce
// copy falso. Sin recalcular negocio.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readM1PresentationMeta, readM2PresentationMeta, readM3PresentationMeta,
  readM4PresentationMeta, readM5PresentationMeta, readM6PresentationMeta,
  PRESENTATION_META_READERS,
} from '../src/lib/presentationMeta/adapters.js'
import { parseAsOfMs, describeAge, freshnessView } from '../src/lib/freshness.js'
import { M2_API_LATEST_FIXTURE } from '../src/modules/planeacion/m2/fixtures/apiLatestFixture.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

// ── adaptadores leen paths reales ────────────────────────────────────────────
test('M6: mapea run.finished_at / scope rango / company_ids / measurement_method', () => {
  const m = readM6PresentationMeta(M6_API_LATEST_FIXTURE)
  const run = M6_API_LATEST_FIXTURE.run
  assert.equal(m.dataAsOf, run.finished_at)
  assert.equal(m.period.kind, 'range')
  assert.equal(m.period.start, run.scope.window_start)
  assert.deepEqual(m.companies, run.scope.company_ids)
  assert.equal(m.source, run.measurement_method)
  assert.equal(m.auditor, run.technical_state)
  assert.equal(m.status, M6_API_LATEST_FIXTURE.summary.overall_status)
})

test('M2: periodo es window_days (número), no rango', () => {
  const m = readM2PresentationMeta(M2_API_LATEST_FIXTURE)
  const run = M2_API_LATEST_FIXTURE.run
  assert.equal(m.period.kind, 'days')
  assert.equal(m.period.days, run.scope.window_days)
  assert.equal(m.dataAsOf, run.finished_at)
  assert.equal(m.auditor, run.technical_state)
})

test('M3 usa periodo days; M4/M5 usan rango (paridad de forma)', () => {
  assert.equal(readM3PresentationMeta(M2_API_LATEST_FIXTURE).period?.kind, 'days')
  const range = { run: { scope: { window_start: '2026-01-01', window_end_exclusive: '2026-02-01', company_ids: [34] } } }
  assert.equal(readM4PresentationMeta(range).period.kind, 'range')
  assert.equal(readM5PresentationMeta(range).period.kind, 'range')
})

test('M1 es el outlier: data.dataAsOf; sin periodo/company_ids/branchScope (no se inventa)', () => {
  const m = readM1PresentationMeta({ dataAsOf: '2026-07-17T16:03:00Z', branch_resolution_source: 'token' })
  assert.equal(m.dataAsOf, '2026-07-17T16:03:00Z')
  assert.equal(m.period, null)
  assert.deepEqual(m.companies, [])
  // el modelo top-level de M1 NO expone label de sucursal ⇒ null, jamás 'agregado'
  assert.equal(m.branchScope, null)
  assert.equal(m.technicalEvidence.branch_resolution_source, 'token')
})

// ── un campo ausente NO produce copy falso ───────────────────────────────────
test('payload vacío ⇒ nulls/[], jamás 0 ni fecha inventada', () => {
  for (const read of Object.values(PRESENTATION_META_READERS)) {
    const m = read({})
    assert.equal(m.dataAsOf, null)
    assert.deepEqual(m.companies, [])
    assert.equal(m.status, null)
    assert.equal(m.auditor, null)
  }
})

test('company_ids no-array ⇒ [] (no crashea, no inventa)', () => {
  const m = readM4PresentationMeta({ run: { scope: { company_ids: 'x' } } })
  assert.deepEqual(m.companies, [])
})

test('evidencia no formal ⇒ caveat de decisión en capa 1', () => {
  const m = readM3PresentationMeta({ run: { is_production_shell_run: false } })
  assert.ok(m.decisionCaveats.some((c) => /no formal/i.test(c)))
})

test('telemetría (run_id/queries) va a technicalEvidence, NO a capa 1', () => {
  const m = readM6PresentationMeta(M6_API_LATEST_FIXTURE)
  assert.ok('run_id' in m.technicalEvidence)
  assert.ok('executed_queries' in m.technicalEvidence)
  // el objeto de capa 1 (top-level) no expone run_id
  assert.equal(m.run_id, undefined)
})

// ── frescura pura ────────────────────────────────────────────────────────────
test('parseAsOfMs: ISO válido → ms; inválido → null', () => {
  assert.equal(typeof parseAsOfMs('2026-07-17T16:00:00Z'), 'number')
  assert.equal(parseAsOfMs('no-fecha'), null)
  assert.equal(parseAsOfMs(''), null)
  assert.equal(parseAsOfMs(null), null)
})

test('describeAge: min/horas/días', () => {
  const base = 1_700_000_000_000
  assert.match(describeAge(base, base + 30 * 60000).text, /30 min/)
  assert.match(describeAge(base, base + 3 * 3600000).text, /3 h/)
  assert.match(describeAge(base, base + 3 * 86400000).text, /3 días/)
  assert.match(describeAge(base, base + 10000).text, /instantes/)
})

test('freshnessView: en 0A siempre neutral/descriptivo (sin cadencia aprobada)', () => {
  const now = 1_700_000_000_000
  const v = freshnessView({ dataAsOf: new Date(now - 3 * 3600000).toISOString(), nowMs: now })
  assert.equal(v.level, 'neutral')
  assert.equal(v.evaluative, false)
  assert.match(v.label, /Datos medidos hace 3 h/)
})

test('freshnessView: con cadencia aprobada (futuro), evalúa stale', () => {
  const now = 1_700_000_000_000
  const v = freshnessView({ dataAsOf: new Date(now - 40 * 3600000).toISOString(), staleAfterHours: 30, nowMs: now })
  assert.equal(v.level, 'stale')
  assert.equal(v.evaluative, true)
})

test('freshnessView: corte no informado', () => {
  assert.equal(freshnessView({ dataAsOf: null, nowMs: 1 }).level, 'unknown')
})
