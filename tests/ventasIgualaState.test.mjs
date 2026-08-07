import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_SELECTED_TICKETS,
  buildSalesHistoryPath,
  getIgualaSalesTickets,
  normalizeSalesHistory,
  normalizeSalesTickets,
} from '../src/modules/ventas-iguala/salesHistoryApi.js'
import {
  isSelectionAtLimit,
  selectedAmount,
  toggleOrderSelection,
  togglePageSelection,
} from '../src/modules/ventas-iguala/salesHistoryState.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) { return Object.hasOwn(store, key) ? store[key] : null },
    setItem(key, value) { store[key] = String(value) },
  }
}

function setSession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({ session_token: 'test-token' }))
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() { return payload },
    async text() { return JSON.stringify(payload) },
  }
}

function historyOrder(overrides = {}) {
  return {
    id: 25375,
    folio: 'S25375',
    ordered_at: '2026-07-30T07:57:27-06:00',
    customer: { id: 10, name: 'VENTA PUBLICO IGUALA NOCHE' },
    responsible_employee: { id: 717, name: 'Angélica Jaimes' },
    payment: { method: 'cash', label: 'Efectivo', amount: 320, breakdown: [] },
    currency: 'MXN',
    amount_total: 320,
    state: 'sale',
    lines: [{ product_id: 100, product_name: 'Producto', quantity: 2, unit_price: 160, line_total: 320 }],
    ...overrides,
  }
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('buildSalesHistoryPath serializes only the approved history filters', () => {
  assert.equal(
    buildSalesHistoryPath({
      dateFrom: '2026-07-29',
      dateTo: '2026-07-30',
      search: 'S25375',
      page: 2,
      warehouseId: 76,
      companyId: 34,
      analyticId: 9,
      employeeId: 717,
    }),
    '/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50',
  )
})

test('normalizeSalesHistory accepts direct and wrapped envelopes with safe optional values', () => {
  const rawOrder = historyOrder({
    amount_total: 'not-money',
    payment: {
      method: 'mixed',
      label: 'Pago mixto',
      amount: 'also-not-money',
      breakdown: [
        { method: 'cash', label: 'Efectivo', amount: 200 },
        { method: 'card', label: 'Tarjeta', amount: 'invalid' },
      ],
    },
    lines: undefined,
  })
  const direct = normalizeSalesHistory({ timezone: 'America/Mexico_City', orders: [rawOrder] })
  const wrapped = normalizeSalesHistory({ ok: true, data: { timezone: 'America/Mexico_City', orders: [rawOrder] } })

  for (const result of [direct, wrapped]) {
    assert.equal(result.timezone, 'America/Mexico_City')
    assert.equal(result.orders[0].ordered_at, '2026-07-30T07:57:27-06:00')
    assert.equal(result.orders[0].amount_total, 0)
    assert.deepEqual(result.orders[0].lines, [])
    assert.deepEqual(result.orders[0].payment.breakdown, [
      { method: 'cash', label: 'Efectivo', amount: 200 },
    ])
    assert.equal(result.orders[0].payment.amount, 0)
  }
})

test('normalizeSalesHistory rejects coercible IDs and money while discarding malformed optional entries', () => {
  const result = normalizeSalesHistory({ orders: [
    historyOrder({ id: true }),
    historyOrder({ id: '25376' }),
    historyOrder({ id: [25377] }),
    historyOrder({
      id: 25378,
      amount_total: true,
      payment: {
        method: 'mixed',
        label: 'Pago mixto',
        amount: '320',
        breakdown: [
          { method: 'cash', label: 'Efectivo', amount: 200 },
          null,
          ['card', 'Tarjeta', 120],
          { method: 'card', label: 'Tarjeta', amount: '120' },
        ],
      },
      lines: [
        { product_id: 100, product_name: 'Producto', quantity: 2, unit_price: 160, line_total: 320 },
        null,
        ['linea'],
        { product_id: 101, product_name: 'Inválida', quantity: true, unit_price: 10, line_total: 10 },
      ],
    }),
  ] })

  assert.deepEqual(result.orders.map((order) => order.id), [25378])
  assert.equal(result.orders[0].amount_total, 0)
  assert.equal(result.orders[0].payment.amount, 0)
  assert.deepEqual(result.orders[0].payment.breakdown, [
    { method: 'cash', label: 'Efectivo', amount: 200 },
  ])
  assert.deepEqual(result.orders[0].lines, [
    { product_id: 100, product_name: 'Producto', quantity: 2, unit_price: 160, line_total: 320 },
  ])
})

test('selection stores unique order snapshots and preserves their numeric total across page changes', () => {
  const first = toggleOrderSelection([], historyOrder({ amount_total: 320, customer: { name: 'ignored' } }))
  const second = togglePageSelection(first, [
    historyOrder({ id: 25376, amount_total: 145.5 }),
    historyOrder({ id: 25377, amount_total: 'invalid' }),
  ], true)
  const deselected = toggleOrderSelection(second, historyOrder({ id: 25375, amount_total: 9999 }))

  assert.deepEqual(first, [{ id: 25375, amount_total: 320 }])
  assert.deepEqual(second, [
    { id: 25375, amount_total: 320 },
    { id: 25376, amount_total: 145.5 },
    { id: 25377, amount_total: 0 },
  ])
  assert.equal(selectedAmount(second), 465.5)
  assert.deepEqual(deselected, [
    { id: 25376, amount_total: 145.5 },
    { id: 25377, amount_total: 0 },
  ])
})

test('selection caps at one hundred display-order snapshots', () => {
  const selected = Array.from({ length: MAX_SELECTED_TICKETS }, (_, index) => ({ id: index + 1, amount_total: index }))
  assert.equal(isSelectionAtLimit(selected), true)
  assert.deepEqual(toggleOrderSelection(selected, historyOrder({ id: 101, amount_total: 1 })), selected)
  assert.deepEqual(togglePageSelection(selected, [historyOrder({ id: 101, amount_total: 1 })], true), selected)
})

test('selection ignores coercible non-number IDs and amounts', () => {
  const selected = togglePageSelection([], [
    historyOrder({ id: true, amount_total: 1 }),
    historyOrder({ id: '7', amount_total: 2 }),
    historyOrder({ id: [8], amount_total: 3 }),
    historyOrder({ id: 9, amount_total: '4' }),
  ], true)

  assert.deepEqual(selected, [{ id: 9, amount_total: 0 }])
})

test('getIgualaSalesTickets rejects oversized, duplicate, and invalid IDs before an API call', async () => {
  setSession()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return jsonResponse({ data: { ok: true, data: { tickets: [] } } })
  }

  for (const ids of [Array.from({ length: 101 }, (_, index) => index + 1), [1, 1], [1, 0], [1, '2']]) {
    await assert.rejects(
      () => getIgualaSalesTickets(ids),
      (error) => error?.code === 'invalid_batch_ticket_contract',
    )
  }
  assert.equal(calls, 0)
})

test('getIgualaSalesTickets posts only the requested order IDs', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return jsonResponse({ ok: true, data: { tickets: [
      historyOrder({ order_id: 9, id: undefined }),
      historyOrder({ order_id: 7, id: undefined }),
    ] } })
  }

  const tickets = await getIgualaSalesTickets([7, 9])

  assert.deepEqual(tickets.map((ticket) => ticket.order_id), [7, 9])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api-n8n/pwa-admin/iguala-sales-tickets')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { order_ids: [7, 9] })
})

test('normalizeSalesTickets keeps requested positive IDs in request order and fails atomically on missing or duplicate tickets', () => {
  const tickets = normalizeSalesTickets({ ok: true, data: {
    tickets: [
      historyOrder({ order_id: 9, id: undefined, amount_total: 'invalid', lines: undefined }),
      historyOrder({ order_id: 7, id: undefined, payment: undefined }),
    ],
  } }, [7, 9])

  assert.deepEqual(tickets.map((ticket) => ticket.order_id), [7, 9])
  assert.equal(tickets[1].amount_total, 0)
  assert.deepEqual(tickets[1].lines, [])
  assert.deepEqual(tickets[0].payment.breakdown, [])

  for (const payload of [
    { tickets: [historyOrder({ order_id: 7, id: undefined })] },
    { tickets: [historyOrder({ order_id: 7, id: undefined }), historyOrder({ order_id: 7, id: undefined })] },
  ]) {
    assert.throws(
      () => normalizeSalesTickets(payload, [7, 9]),
      (error) => error?.code === 'invalid_batch_ticket_contract',
    )
  }
})

test('normalizeSalesTickets preserves printable batch lines without product IDs', () => {
  const tickets = normalizeSalesTickets({
    tickets: [
      historyOrder({
        order_id: 7,
        id: undefined,
        lines: [
          { product_name: 'Bolsa de hielo', quantity: 2, unit_price: 160, line_total: 320 },
        ],
      }),
    ],
  }, [7])

  assert.deepEqual(tickets[0].lines, [
    { product_id: 0, product_name: 'Bolsa de hielo', quantity: 2, unit_price: 160, line_total: 320 },
  ])
})

test('normalizeSalesTickets fails atomically when ticket IDs are coercible non-number values', () => {
  for (const orderId of [true, '7', [7]]) {
    assert.throws(
      () => normalizeSalesTickets({ tickets: [historyOrder({ order_id: orderId, id: undefined })] }, [7]),
      (error) => error?.code === 'invalid_batch_ticket_contract',
    )
  }
})
