import test from 'node:test'
import assert from 'node:assert/strict'

import { IDENTITY_GATE_IDS } from '../src/modules/admin/identityGates.js'

import {
  breakdownStateReducer,
  createInitialBreakdownState,
  createLatestRequestTracker,
  getMexicoDateKey,
  isPosBreakdownSession,
  isSelectableSalesDate,
  loadPosProductBreakdown,
  normalizePosProductBreakdown,
} from '../src/modules/admin/angyPosSalesBreakdown.js'

test('el desglose POS se decide por employee_id, no por el nombre', () => {
  // Medido en producción: "Angelica Jaimes Dominguez" tiene TRES fichas de
  // hr.employee vivas — 717 (cía 34), 2518 (cía 35), 2521 (cía 36).
  // El gate por nombre las aceptaba las tres sin distinguir compañía.
  for (const employeeId of IDENTITY_GATE_IDS.posBreakdown) {
    assert.equal(isPosBreakdownSession({ employee_id: employeeId }), true, String(employeeId))
  }
  assert.equal(isPosBreakdownSession({ employee: { id: IDENTITY_GATE_IDS.posBreakdown[0] } }), true)
})

test('un nombre que coincide YA NO abre el desglose POS', () => {
  for (const session of [
    { name: 'Angélica Jaimes Gómez' },
    { employee: { name: 'ANGELICA JAIMES' } },
    { display_name: 'Jaimes, Angélica López' },
  ]) {
    assert.equal(isPosBreakdownSession(session), false, JSON.stringify(session))
  }
})

test('el desglose POS falla cerrado sin employee_id válido', () => {
  assert.equal(isPosBreakdownSession({}), false)
  assert.equal(isPosBreakdownSession({ employee_id: 0 }), false)
  assert.equal(isPosBreakdownSession({ employee_id: 99999 }), false)
})

test('gets the Mexico City calendar date on both sides of the UTC midnight cutoff', () => {
  assert.equal(getMexicoDateKey(new Date('2026-07-25T05:30:00Z')), '2026-07-24')
  assert.equal(getMexicoDateKey(new Date('2026-07-25T06:30:00Z')), '2026-07-25')
})

test('allows today and historical dates while rejecting future and invalid dates', () => {
  assert.equal(isSelectableSalesDate('2026-07-24', '2026-07-24'), true)
  assert.equal(isSelectableSalesDate('2026-07-23', '2026-07-24'), true)
  assert.equal(isSelectableSalesDate('2026-07-25', '2026-07-24'), false)
  assert.equal(isSelectableSalesDate('24-07-2026', '2026-07-24'), false)
  assert.equal(isSelectableSalesDate('2026-02-30', '2026-07-24'), false)
  assert.equal(isSelectableSalesDate('0000-01-01', '2026-07-24'), false)
  assert.equal(isSelectableSalesDate(['2026-07-24'], '2026-07-24'), false)
})

test('normalizes product rows and backend product totals into camelCase numbers', () => {
  assert.deepEqual(
    normalizePosProductBreakdown({
      ok: true,
      data: {
        date: '2026-07-24',
        products: [{
          product_id: '10',
          sku: 'ROL-55',
          product_name: 'Rolito 5.5 kg',
          quantity: '3',
          amount_total: '360',
          weight_per_unit_kg: '5.5',
          weight_total_kg: '16.5',
          weight_configured: true,
        }],
        product_totals: {
          quantity: '3',
          amount_total: '360',
          weight_total_kg: '16.5',
          products_without_weight: '0',
        },
      },
    }),
    {
      date: '2026-07-24',
      products: [{
        productId: 10,
        sku: 'ROL-55',
        productName: 'Rolito 5.5 kg',
        quantity: 3,
        amountTotal: 360,
        weightPerUnitKg: 5.5,
        weightTotalKg: 16.5,
        weightConfigured: true,
      }],
      totals: {
        quantity: 3,
        amountTotal: 360,
        weightTotalKg: 16.5,
        productsWithoutWeight: 0,
      },
    },
  )
})

test('derives totals and product fallbacks when backend totals and weight are missing', () => {
  assert.deepEqual(
    normalizePosProductBreakdown({
      date: '2026-07-24',
      products: [{
        product_id: 11,
        sku: null,
        product_name: '',
        quantity: '4',
        amount_total: '100',
        weight_per_unit_kg: 'not-a-number',
        weight_total_kg: Infinity,
        weight_configured: false,
      }],
    }),
    {
      date: '2026-07-24',
      products: [{
        productId: 11,
        sku: '',
        productName: 'Producto',
        quantity: 4,
        amountTotal: 100,
        weightPerUnitKg: 0,
        weightTotalKg: 0,
        weightConfigured: false,
      }],
      totals: {
        quantity: 4,
        amountTotal: 100,
        weightTotalKg: 0,
        productsWithoutWeight: 1,
      },
    },
  )
})

test('surfaces an unsuccessful backend envelope message', () => {
  assert.throws(
    () => normalizePosProductBreakdown({ ok: false, message: 'Fecha invalida' }),
    /Fecha invalida/,
  )
})

test('creates and reduces breakdown loading, success, and error states', () => {
  const initial = createInitialBreakdownState('2026-07-24')
  assert.deepEqual(initial, {
    loading: true,
    error: '',
    result: {
      date: '2026-07-24',
      products: [],
      totals: {
        quantity: 0,
        amountTotal: 0,
        weightTotalKg: 0,
        productsWithoutWeight: 0,
      },
    },
  })

  const retainedResult = { ...initial.result, products: [{ productId: 10 }] }
  assert.deepEqual(
    breakdownStateReducer(
      { loading: false, error: 'anterior', result: retainedResult },
      { type: 'loading' },
    ),
    { loading: true, error: '', result: retainedResult },
  )

  const successResult = { ...initial.result, date: '2026-07-23' }
  assert.deepEqual(
    breakdownStateReducer(initial, { type: 'success', result: successResult }),
    { loading: false, error: '', result: successResult },
  )

  assert.deepEqual(
    breakdownStateReducer(
      { loading: true, error: '', result: retainedResult },
      { type: 'error', message: 'Sin conexion' },
    ),
    {
      loading: false,
      error: 'Sin conexion',
      result: retainedResult,
    },
  )
})

test('loads a scoped date exactly once and normalizes its response', async () => {
  const calls = []
  const result = await loadPosProductBreakdown({
    warehouseId: 7,
    companyId: 3,
    date: '2026-07-24',
    fetchSales: async (scope) => {
      calls.push(scope)
      return {
        data: {
          date: '2026-07-24',
          products: [],
        },
      }
    },
  })

  assert.deepEqual(calls, [{
    warehouseId: 7,
    companyId: 3,
    date: '2026-07-24',
  }])
  assert.deepEqual(result, {
    date: '2026-07-24',
    products: [],
    totals: {
      quantity: 0,
      amountTotal: 0,
      weightTotalKg: 0,
      productsWithoutWeight: 0,
    },
  })
})

test('marks every request except the latest one as stale', () => {
  const tracker = createLatestRequestTracker()
  const first = tracker.begin()
  const second = tracker.begin()

  assert.equal(tracker.isCurrent(first), false)
  assert.equal(tracker.isCurrent(second), true)
})
