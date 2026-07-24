// KOLD OS · M7 — resolveM7Metric: NUEVE estados, ninguno silencioso.
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveM7Metric, M7_METRIC_STATES } from '../src/modules/rentabilidad-costos/m7/contract.js'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M7_API_LATEST_FIXTURE))
const SPEC = { query: 'sale_order_metrics', field: 'confirmed_count' }

test('ok: un campo presente devuelve su valor', () => {
  const r = resolveM7Metric(M7_API_LATEST_FIXTURE, SPEC)
  assert.equal(r.state, 'ok')
  assert.equal(typeof r.value, 'number')
})

test('field zero → muestra 0 (dato, no ausencia)', () => {
  const p = clone(); p.metrics.sale_order_metrics[0].confirmed_count = 0
  const r = resolveM7Metric(p, SPEC)
  assert.equal(r.state, 'ok'); assert.equal(r.value, 0)
})

test('field missing → contract_error VISIBLE', () => {
  const p = clone(); delete p.metrics.sale_order_metrics[0].confirmed_count
  const r = resolveM7Metric(p, SPEC)
  assert.equal(r.state, 'contract_error'); assert.equal(r.value, null)
  assert.match(r.reason, /no emite/)
})

test('field null nullable → not_evaluable', () => {
  const p = clone(); p.metrics.sale_order_metrics[0].confirmed_count = null
  const r = resolveM7Metric(p, { ...SPEC, nullable: true })
  assert.equal(r.state, 'not_evaluable')
})

test('field null NO nullable → contract_error', () => {
  const p = clone(); p.metrics.sale_order_metrics[0].confirmed_count = null
  assert.equal(resolveM7Metric(p, SPEC).state, 'contract_error')
})

test('capability false → capability_disabled', () => {
  const r = resolveM7Metric(M7_API_LATEST_FIXTURE, { ...SPEC, capability: 'gross_margin_observable' })
  assert.equal(r.state, 'capability_disabled')
  assert.match(r.reason, /gross_margin_observable/)
})

test('capability inexistente → contract_error (no se silencia como false)', () => {
  const r = resolveM7Metric(M7_API_LATEST_FIXTURE, { ...SPEC, capability: 'no_existe' })
  assert.equal(r.state, 'contract_error')
})

test('query omitida → metric_unavailable', () => {
  const p = clone(); delete p.metrics.sale_order_metrics
  assert.equal(resolveM7Metric(p, SPEC).state, 'metric_unavailable')
})

test('malformed type → malformed_metric', () => {
  const p = clone(); p.metrics.sale_order_metrics[0].confirmed_count = 'muchos'
  assert.equal(resolveM7Metric(p, SPEC).state, 'malformed_metric')
})

test('NaN/Infinity son malformados', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const p = clone(); p.metrics.sale_order_metrics[0].confirmed_count = bad
    assert.equal(resolveM7Metric(p, SPEC).state, 'malformed_metric', String(bad))
  }
})

test('backend unavailable', () => {
  for (const v of [null, undefined, 'x', 42, []]) {
    assert.equal(resolveM7Metric(v, SPEC).state, 'backend_unavailable')
  }
})

test('requiresConsolidation sin soporte → multi_currency_unconsolidated', () => {
  const r = resolveM7Metric(M7_API_LATEST_FIXTURE, { ...SPEC, requiresConsolidation: true })
  assert.equal(r.state, 'multi_currency_unconsolidated')
})

test('tile mal declarado (sin query/field) → contract_error', () => {
  assert.equal(resolveM7Metric(M7_API_LATEST_FIXTURE, { field: 'x' }).state, 'contract_error')
  assert.equal(resolveM7Metric(M7_API_LATEST_FIXTURE, {}).state, 'contract_error')
})

test('los estados son mutuamente distinguibles (8+ distintos)', () => {
  const base = clone()
  const sinQ = clone(); delete sinQ.metrics.sale_order_metrics
  const sinF = clone(); delete sinF.metrics.sale_order_metrics[0].confirmed_count
  const nulo = clone(); nulo.metrics.sale_order_metrics[0].confirmed_count = null
  const malo = clone(); malo.metrics.sale_order_metrics[0].confirmed_count = {}
  const estados = [
    resolveM7Metric(base, SPEC).state,
    resolveM7Metric(base, { ...SPEC, capability: 'gross_margin_observable' }).state,
    resolveM7Metric(base, { ...SPEC, requiresConsolidation: true }).state,
    resolveM7Metric(sinQ, SPEC).state,
    resolveM7Metric(nulo, { ...SPEC, nullable: true }).state,
    resolveM7Metric(sinF, SPEC).state,
    resolveM7Metric(malo, SPEC).state,
    resolveM7Metric(null, SPEC).state,
  ]
  assert.equal(new Set(estados).size, 8, `colapsaron estados: ${estados}`)
})

test('todo estado está declarado en M7_METRIC_STATES', () => {
  const casos = [
    resolveM7Metric(M7_API_LATEST_FIXTURE, SPEC),
    resolveM7Metric(null, SPEC),
    resolveM7Metric(M7_API_LATEST_FIXTURE, { query: '', field: '' }),
    resolveM7Metric(M7_API_LATEST_FIXTURE, { ...SPEC, requiresConsolidation: true }),
  ]
  for (const c of casos) assert.ok(M7_METRIC_STATES.includes(c.state), c.state)
})

test('ningún estado no-ok entrega un número pintable', () => {
  const sinF = clone(); delete sinF.metrics.sale_order_metrics[0].confirmed_count
  const malos = [
    resolveM7Metric(sinF, SPEC),
    resolveM7Metric(null, SPEC),
    resolveM7Metric(M7_API_LATEST_FIXTURE, { ...SPEC, capability: 'route_cost_observable' }),
  ]
  for (const r of malos) {
    assert.notEqual(r.state, 'ok')
    assert.equal(r.value, null)
    assert.ok(r.reason.length > 8)
  }
})
