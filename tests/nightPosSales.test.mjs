import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPosCancelBlockMessage,
  getPosSaleStateLabel,
  normalizeNightPosSalesResponse,
  normalizeRestrictedPosSalesResponse,
} from '../src/modules/admin/nightPosSales.js'

test('normalizeRestrictedPosSalesResponse accepts direct arrays without mutating rows', () => {
  const input = [{ id: '9001', name: 'S09001', total: '120.50' }]
  const snapshot = structuredClone(input)

  const result = normalizeRestrictedPosSalesResponse(input)

  assert.equal(result[0].order_id, 9001)
  assert.equal(result[0].amount_total, 120.5)
  assert.deepEqual(input, snapshot)
  assert.notEqual(result, input)
  assert.notEqual(result[0], input[0])
})

test('normalizeNightPosSalesResponse remains a compatibility alias of the generic normalizer', () => {
  assert.equal(normalizeNightPosSalesResponse, normalizeRestrictedPosSalesResponse)
  assert.deepEqual(
    normalizeNightPosSalesResponse([{ id: 9006, name: 'COMPATIBLE' }]),
    normalizeRestrictedPosSalesResponse([{ id: 9006, name: 'COMPATIBLE' }]),
  )
})

test('normalizeNightPosSalesResponse supports nested and top-level collections with items precedence', () => {
  const item = { id: 9001, name: 'ITEM' }
  const order = { id: 9002, name: 'ORDER' }

  assert.equal(
    normalizeNightPosSalesResponse({ data: { items: [item] } })[0].name,
    'ITEM',
  )
  assert.equal(
    normalizeNightPosSalesResponse({ data: { orders: [order] } })[0].name,
    'ORDER',
  )
  assert.equal(
    normalizeNightPosSalesResponse({
      data: { items: [item], orders: [order] },
    })[0].name,
    'ITEM',
  )
  assert.equal(
    normalizeNightPosSalesResponse({ items: [item], orders: [order] })[0].name,
    'ITEM',
  )
})

test('normalizeNightPosSalesResponse supports direct data arrays and top-level orders', () => {
  assert.equal(
    normalizeNightPosSalesResponse({ data: [{ id: 9003, name: 'DATA_ARRAY' }] })[0].name,
    'DATA_ARRAY',
  )
  assert.equal(
    normalizeNightPosSalesResponse({ orders: [{ id: 9004, name: 'TOP_ORDER' }] })[0].name,
    'TOP_ORDER',
  )
})

test('normalizeNightPosSalesResponse returns an empty list for malformed shapes and rows', () => {
  for (const value of [
    null,
    undefined,
    {},
    { data: {} },
    { data: { items: 'invalid', orders: {} } },
    'invalid',
  ]) {
    assert.deepEqual(normalizeNightPosSalesResponse(value), [])
  }

  assert.deepEqual(
    normalizeNightPosSalesResponse([null, 'invalid', 44]),
    [],
  )
})

test('normalizeNightPosSalesResponse normalizes the current backend summary shape', () => {
  const input = {
    data: {
      items: [{
        order_id: '9001',
        name: 'S09001',
        partner_id: '44',
        partner_name: 'Cliente Iguala',
        warehouse_id: 89,
        company_id: 34,
        date_order: '2026-07-25 03:10:00',
        amount_total: '120.50',
        state: 'sale',
        can_cancel: true,
        cancel_block_code: null,
        internal_secret: 'must-not-survive',
      }],
    },
  }

  assert.deepEqual(normalizeNightPosSalesResponse(input), [{
    id: 9001,
    order_id: 9001,
    name: 'S09001',
    partner_id: 44,
    partner_name: 'Cliente Iguala',
    warehouse_id: 89,
    company_id: 34,
    date_order: '2026-07-25 03:10:00',
    amount_total: 120.5,
    total: 120.5,
    state: 'sale',
    can_cancel: true,
    cancel_block_code: null,
  }])
})

test('normalizeNightPosSalesResponse accepts m2o and legacy aliases without retaining aliases', () => {
  assert.deepEqual(normalizeNightPosSalesResponse([{
    order_id: 9002,
    folio: 'S09002',
    partner_id: ['45', 'Público noche'],
    warehouse_id: ['89', 'Iguala'],
    company_id: ['34', 'GLACIEM'],
    date: '2026-07-25 04:00:00',
    amount_total: 'invalid',
    state: null,
  }]), [{
    order_id: 9002,
    partner_id: 45,
    warehouse_id: 89,
    company_id: 34,
    amount_total: 0,
    state: '',
    id: 9002,
    name: 'S09002',
    partner_name: 'Público noche',
    date_order: '2026-07-25 04:00:00',
    total: 0,
    can_cancel: false,
    cancel_block_code: null,
  }])
})

test('normalizeNightPosSalesResponse falls back from invalid primary ids to valid aliases', () => {
  assert.deepEqual(normalizeNightPosSalesResponse([{
    order_id: 'invalid',
    id: '9005',
    name: 'S09005',
    partner_id: 'invalid',
    customer_id: ['45', 'Público noche'],
  }]), [{
    id: 9005,
    order_id: 9005,
    name: 'S09005',
    partner_id: 45,
    partner_name: 'Público noche',
    warehouse_id: null,
    company_id: null,
    date_order: null,
    amount_total: 0,
    total: 0,
    state: '',
    can_cancel: false,
    cancel_block_code: null,
  }])
})

test('normalizeNightPosSalesResponse accepts only finite numeric totals', () => {
  const validTotals = [
    [120.5, 120.5],
    ['120.50', 120.5],
    [' -4.5 ', -4.5],
    ['.5', 0.5],
    ['1e2', 100],
  ]
  for (const [value, expected] of validTotals) {
    const [row] = normalizeNightPosSalesResponse([{ id: 9001, amount_total: value }])
    assert.equal(row.amount_total, expected, String(value))
    assert.equal(row.total, expected, String(value))
  }

  for (const value of [
    true,
    false,
    [],
    [12],
    {},
    Infinity,
    -Infinity,
    NaN,
    '',
    '   ',
    'Infinity',
    '0x10',
  ]) {
    const [row] = normalizeNightPosSalesResponse([{ id: 9001, amount_total: value }])
    assert.equal(row.amount_total, 0, String(value))
    assert.equal(row.total, 0, String(value))
  }
})

test('normalizeNightPosSalesResponse accepts only nonempty primitive date strings', () => {
  const [valid] = normalizeNightPosSalesResponse([{
    id: 9001,
    date_order: ' 2026-07-25 03:10:00 ',
  }])
  assert.equal(valid.date_order, '2026-07-25 03:10:00')

  for (const value of [[], {}, 44, true, new String('2026-07-25 03:10:00'), '', '   ']) {
    const [row] = normalizeNightPosSalesResponse([{ id: 9001, date_order: value }])
    assert.equal(row.date_order, null, String(value))
  }
})

test('getPosSaleStateLabel returns stable Spanish labels and a safe unknown fallback', () => {
  assert.equal(getPosSaleStateLabel('sale'), 'Activa')
  assert.equal(getPosSaleStateLabel('done'), 'Cerrada')
  assert.equal(getPosSaleStateLabel('cancel'), 'Cancelada')
  assert.equal(getPosSaleStateLabel('draft'), 'Desconocida')
  assert.equal(getPosSaleStateLabel(null), 'Desconocida')
})

test('getPosSaleStateLabel safely rejects prototype keys and hostile coercion', () => {
  const hostile = { toString() { throw new Error('must not coerce') } }

  for (const state of ['constructor', '__proto__', hostile]) {
    assert.equal(getPosSaleStateLabel(state), 'Desconocida')
  }
})

test('getPosCancelBlockMessage maps actionable block codes exactly', () => {
  assert.equal(
    getPosCancelBlockMessage('manager_required'),
    'Esta venta requiere autorización de un gerente.',
  )
  assert.equal(
    getPosCancelBlockMessage('already_cancelled'),
    'Esta venta ya está cancelada.',
  )
  assert.equal(
    getPosCancelBlockMessage('closed'),
    'Esta venta está cerrada y requiere reversión manual.',
  )
  assert.equal(
    getPosCancelBlockMessage('invalid_state'),
    'Esta venta no se puede cancelar en su estado actual.',
  )
})

test('getPosCancelBlockMessage hides privacy block details and unknown codes', () => {
  for (const code of ['not_owner', 'out_of_scope', 'not_today', 'unexpected', '', null]) {
    const message = getPosCancelBlockMessage(code)
    assert.equal(message, 'Esta venta no se puede cancelar.')
    assert.doesNotMatch(message, /propiet|emplead|alcance|fecha|hoy/i)
  }
})

test('getPosCancelBlockMessage safely rejects prototype keys and hostile coercion', () => {
  const hostile = { toString() { throw new Error('must not coerce') } }

  for (const code of ['constructor', '__proto__', hostile]) {
    assert.equal(getPosCancelBlockMessage(code), 'Esta venta no se puede cancelar.')
  }
})
