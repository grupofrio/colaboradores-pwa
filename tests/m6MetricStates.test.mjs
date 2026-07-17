// KOLD OS · M6 — los tiles NO se callan.
//
// Codex marcó como riesgo que el tile devolviera `null` ante un campo faltante:
// aunque el validador del envelope sea fuerte, un componente que se evapora
// esconde una incompatibilidad de contrato. Un tile ausente se lee como "aquí no
// había nada que ver".
//
// Estos tests fijan los SEIS estados y, sobre todo, que sean DISTINGUIBLES entre
// sí: el valor de todo esto está en que "no puedo medirlo" nunca se confunda con
// "medí y da cero".
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveM6Metric, M6_METRIC_STATES,
} from '../src/modules/caja-conciliacion/m6/contract.js'
import {
  M6_API_LATEST_FIXTURE,
} from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const clone = () => JSON.parse(JSON.stringify(M6_API_LATEST_FIXTURE))
const SPEC = { query: 'payment_metrics', field: 'unreconciled_count' }

// ─── el caso feliz, y el 0 que NO es un vacío ────────────────────────────────

test('ok: un campo presente devuelve su valor', () => {
  const r = resolveM6Metric(M6_API_LATEST_FIXTURE, SPEC)
  assert.equal(r.state, 'ok')
  assert.equal(typeof r.value, 'number')
})

test('field zero → muestra 0: cero es un DATO, no una ausencia', () => {
  const p = clone()
  p.metrics.payment_metrics[0].unreconciled_count = 0
  const r = resolveM6Metric(p, SPEC)
  assert.equal(r.state, 'ok', 'un 0 medido debe renderizarse, no desaparecer')
  assert.equal(r.value, 0)
})

// ─── los seis estados de Codex ───────────────────────────────────────────────

test('field missing → contract_error VISIBLE (no null, no 0, no oculto)', () => {
  const p = clone()
  delete p.metrics.payment_metrics[0].unreconciled_count
  const r = resolveM6Metric(p, SPEC)
  assert.equal(r.state, 'contract_error')
  assert.equal(r.value, null)
  assert.match(r.reason, /no emite/)
  assert.match(r.reason, /payment_metrics\.unreconciled_count/)
})

test('field null permitido → not_evaluable ("No evaluable", con razón)', () => {
  const p = clone()
  p.metrics.payment_metrics[0].unreconciled_count = null
  const r = resolveM6Metric(p, { ...SPEC, nullable: true })
  assert.equal(r.state, 'not_evaluable')
  assert.equal(r.value, null)
  assert.match(r.reason, /nullable/)
})

test('field null NO permitido → contract_error: un requerido en null es un error', () => {
  const p = clone()
  p.metrics.payment_metrics[0].unreconciled_count = null
  const r = resolveM6Metric(p, SPEC)
  assert.equal(r.state, 'contract_error')
  assert.match(r.reason, /requerido/)
})

test('capability false → capability_disabled con la capability nombrada', () => {
  const r = resolveM6Metric(M6_API_LATEST_FIXTURE,
    { ...SPEC, capability: 'consolidated_global_total' })
  assert.equal(r.state, 'capability_disabled')
  assert.match(r.reason, /consolidated_global_total/)
  assert.match(r.reason, /false/)
})

test('capability true → no bloquea', () => {
  const r = resolveM6Metric(M6_API_LATEST_FIXTURE,
    { ...SPEC, capability: 'payments' })
  assert.equal(r.state, 'ok')
})

test('query omitted → metric_unavailable (cobertura parcial), no cero', () => {
  const p = clone()
  delete p.metrics.payment_metrics
  const r = resolveM6Metric(p, SPEC)
  assert.equal(r.state, 'metric_unavailable')
  assert.match(r.reason, /cobertura parcial/)
})

test('query sin filas → metric_unavailable', () => {
  const p = clone()
  p.metrics.payment_metrics = []
  assert.equal(resolveM6Metric(p, SPEC).state, 'metric_unavailable')
})

test('malformed type → malformed_metric, nombrando el tipo recibido', () => {
  const p = clone()
  p.metrics.payment_metrics[0].unreconciled_count = 'muchos'
  const r = resolveM6Metric(p, SPEC)
  assert.equal(r.state, 'malformed_metric')
  assert.match(r.reason, /número finito/)
  assert.match(r.reason, /string/)
})

test('NaN e Infinity son malformados, no números', () => {
  for (const malo of [NaN, Infinity, -Infinity]) {
    const p = clone()
    p.metrics.payment_metrics[0].unreconciled_count = malo
    assert.equal(resolveM6Metric(p, SPEC).state, 'malformed_metric', String(malo))
  }
})

test('backend unavailable → backend_unavailable', () => {
  for (const vacio of [null, undefined, 'texto', 42, []]) {
    assert.equal(resolveM6Metric(vacio, SPEC).state, 'backend_unavailable',
      JSON.stringify(vacio))
  }
})

// ─── lo que hace que todo esto valga: son DISTINGUIBLES ──────────────────────

test('los seis estados son mutuamente distinguibles', () => {
  const base = clone()
  const sinQuery = clone(); delete sinQuery.metrics.payment_metrics
  const sinCampo = clone(); delete sinCampo.metrics.payment_metrics[0].unreconciled_count
  const nulo = clone(); nulo.metrics.payment_metrics[0].unreconciled_count = null
  const malo = clone(); malo.metrics.payment_metrics[0].unreconciled_count = {}

  const estados = [
    resolveM6Metric(base, SPEC).state,
    resolveM6Metric(base, { ...SPEC, capability: 'consolidated_global_total' }).state,
    resolveM6Metric(sinQuery, SPEC).state,
    resolveM6Metric(nulo, { ...SPEC, nullable: true }).state,
    resolveM6Metric(sinCampo, SPEC).state,
    resolveM6Metric(malo, SPEC).state,
    resolveM6Metric(null, SPEC).state,
  ]
  assert.deepEqual(estados, [
    'ok', 'capability_disabled', 'metric_unavailable', 'not_evaluable',
    'contract_error', 'malformed_metric', 'backend_unavailable',
  ], 'si dos casos colapsan en el mismo estado, el tile vuelve a callar')
  assert.equal(new Set(estados).size, 7, 'los siete casos deben ser distintos')
})

test('todo estado devuelto está declarado en M6_METRIC_STATES', () => {
  const casos = [
    resolveM6Metric(M6_API_LATEST_FIXTURE, SPEC),
    resolveM6Metric(null, SPEC),
    resolveM6Metric(M6_API_LATEST_FIXTURE, { query: '', field: '' }),
  ]
  assert.ok(casos.length > 0)
  for (const c of casos) assert.ok(M6_METRIC_STATES.includes(c.state), c.state)
})

test('ningún estado distinto de ok trae un valor numérico que la UI pueda pintar', () => {
  const sinCampo = clone()
  delete sinCampo.metrics.payment_metrics[0].unreconciled_count
  const malos = [
    resolveM6Metric(sinCampo, SPEC),
    resolveM6Metric(null, SPEC),
    resolveM6Metric(M6_API_LATEST_FIXTURE, { ...SPEC, capability: 'deposit_model' }),
  ]
  assert.ok(malos.length > 0)
  for (const r of malos) {
    assert.notEqual(r.state, 'ok')
    assert.equal(r.value, null, 'un estado no-ok jamás entrega un número')
    assert.ok(r.reason.length > 10, 'todo estado no-ok debe explicar por qué')
  }
})

test('una capability inexistente es un error de contrato, no un "no disponible"', () => {
  const r = resolveM6Metric(M6_API_LATEST_FIXTURE,
    { ...SPEC, capability: 'capability_que_no_existe' })
  assert.equal(r.state, 'contract_error',
    'preguntar por una capability inexistente NO puede silenciarse como false')
})

test('un tile mal declarado (sin query o field) es contract_error', () => {
  assert.equal(resolveM6Metric(M6_API_LATEST_FIXTURE, { field: 'x' }).state, 'contract_error')
  assert.equal(resolveM6Metric(M6_API_LATEST_FIXTURE, { query: 'x' }).state, 'contract_error')
  assert.equal(resolveM6Metric(M6_API_LATEST_FIXTURE, {}).state, 'contract_error')
})
