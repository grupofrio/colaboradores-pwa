// KOLD OS · M7 — escalera económica y DAG de capabilities.
// L1 es el techo hoy; ninguna capability fuerte se habilita, y la presencia del
// costo estándar ACTUAL nunca desbloquea margen/COGS.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  M7_CAPABILITY_DAG, M7_PROFITABILITY_LEVELS, resolveM7Metric,
} from '../src/modules/rentabilidad-costos/m7/contract.js'
import { M7_LEVEL_LADDER } from '../src/modules/rentabilidad-costos/m7/m7Meta.js'
import { M7_API_LATEST_FIXTURE } from '../src/modules/rentabilidad-costos/m7/fixtures/apiLatestFixture.js'

const F = M7_API_LATEST_FIXTURE
const clone = () => JSON.parse(JSON.stringify(F))
const STRONG = Object.keys(M7_CAPABILITY_DAG)

test('nivel alcanzado = L1 y es el segundo peldaño de la escalera', () => {
  assert.equal(F.capabilities.profitability_level_reached, 'L1_observable_revenue')
  const idx = M7_PROFITABILITY_LEVELS.indexOf('L1_observable_revenue')
  assert.equal(idx, 1, 'L0 debajo, L2..L6 arriba')
})

test('la escalera cubre los 7 niveles en orden y sin barra de progreso %', () => {
  assert.equal(M7_LEVEL_LADDER.length, 7)
  assert.deepEqual(M7_LEVEL_LADDER.map((l) => l.id), M7_PROFITABILITY_LEVELS)
  // L2 declara explícitamente que el costo estándar ACTUAL no lo habilita.
  const l2 = M7_LEVEL_LADDER.find((l) => l.id === 'L2_observable_gross_margin')
  assert.match(l2.desc, /standard_price actual NO lo habilita/)
})

test('cada capability fuerte del DAG está bloqueada, con prereqs y unmet', () => {
  assert.ok(STRONG.length >= 6)
  for (const cap of STRONG) {
    const r = F.capability_requirements[cap]
    assert.ok(r, `sin contrato: ${cap}`)
    assert.equal(r.enabled, false, `${cap} no debería estar habilitada`)
    assert.equal(F.capabilities.features[cap], false, `feature ${cap}`)
    assert.ok(r.prerequisites.length > 0, `${cap} sin prerequisites`)
    assert.ok(r.unmet_requirements.length > 0, `${cap} sin unmet`)
  }
})

test('los prerequisites del fixture COINCIDEN con el DAG declarado', () => {
  for (const [cap, prereqs] of Object.entries(M7_CAPABILITY_DAG)) {
    const got = F.capability_requirements[cap].prerequisites
    for (const p of prereqs) assert.ok(got.includes(p), `${cap} debe requerir ${p}`)
  }
})

test('gross_margin exige compatibilidades (moneda/UOM/fecha/granularidad/compañía)', () => {
  const r = F.capability_requirements.gross_margin_observable
  for (const c of ['historical_cost_currency_compatible', 'historical_cost_uom_compatible',
    'historical_cost_date_basis_compatible', 'cost_revenue_granularity_compatible',
    'historical_cost_same_company']) {
    assert.ok(r.compatibility_requirements.includes(c), `falta compat ${c}`)
    assert.ok(r.unmet_requirements.includes(c), `compat no cumplida debe estar en unmet: ${c}`)
  }
})

test('el DAG es un orden parcial: net → operating → contribution → gross', () => {
  // Cada nivel superior nombra al inferior como prerequisito.
  assert.ok(M7_CAPABILITY_DAG.net_profit_observable.includes('operating_profit_observable'))
  assert.ok(M7_CAPABILITY_DAG.operating_profit_observable.includes('contribution_margin_observable'))
  assert.ok(M7_CAPABILITY_DAG.contribution_margin_observable.includes('gross_margin_observable'))
  assert.ok(M7_CAPABILITY_DAG.gross_margin_observable.includes('historical_cogs_observable'))
})

// ── el bypass que NO debe existir ────────────────────────────────────────────
test('costo estándar ACTUAL presente NO habilita gross_margin', () => {
  const doc = clone()
  // Aunque today's standard price estuviera en TODAS las líneas…
  doc.metrics.sales_lines_current_cost_presence[0].with_current_standard_price_count = 728
  doc.metrics.sales_lines_current_cost_presence[0].without_current_standard_price_count = 0
  doc.capabilities.features.current_standard_cost_presence = true
  // …gross_margin sigue en false: no hay COGS histórico ni match.
  const r = resolveM7Metric(doc, {
    query: 'sales_lines_current_cost_presence', field: 'with_current_standard_price_count',
    capability: 'gross_margin_observable',
  })
  assert.equal(r.state, 'capability_disabled')
})

test('un tile de margen se apaga aunque haya ingreso observable', () => {
  const r = resolveM7Metric(F, {
    query: 'invoice_revenue_by_currency', field: 'untaxed_total',
    capability: 'gross_margin_observable',
  })
  assert.equal(r.state, 'capability_disabled')
  assert.equal(r.value, null)
})

test('revenue_observable SÍ está activo (L1 real)', () => {
  assert.equal(F.capabilities.features.revenue_observable, true)
  const r = resolveM7Metric(F, {
    query: 'invoice_revenue_by_currency', field: 'untaxed_total',
    capability: 'revenue_observable',
  })
  assert.equal(r.state, 'ok')
})
