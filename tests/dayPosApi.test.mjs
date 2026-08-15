import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as adminApi from '../src/modules/admin/api.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    clear() {
      store = {}
    },
  }
}

function createJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload)
    },
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'day-session',
    api_key: 'api-key',
    gf_employee_token: 'employee-token',
    employee_id: 801,
    role: 'pos_diurno',
    company_id: 34,
    warehouse_id: 89,
    ...session,
  }))
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {}, addEventListener() {} }
  setSession()
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test.after(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('day wrappers preserve the exact query and JSON transport contract', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (options.method === 'POST') {
      return createJsonResponse(200, { result: { ok: true, data: {} } })
    }
    return createJsonResponse(200, { ok: true, data: { products: [], items: [] } })
  }

  await adminApi.getPosCatalog({
    warehouseId: 89,
    companyId: 34,
    partnerId: 61000,
    posScope: 'day',
  })
  await adminApi.getPosProducts({ warehouseId: 89, posScope: 'day' })
  await adminApi.searchCustomers('publico', 34, { posScope: 'day' })
  await adminApi.getDefaultCustomer(34, { posScope: 'day' })
  await adminApi.getDayTodaySales()
  await adminApi.getSaleOrder(9001, { posScope: 'day' })
  await adminApi.createSaleOrder({
    warehouse_id: 89,
    partner_id: 61000,
    payment_method: 'cash',
    lines: [{ product_id: 7, qty: 1, price_unit: 20 }],
    pos_scope: 'day',
  })
  await adminApi.cancelSaleOrder(9001, {
    reasonCode: 'duplicate',
    posScope: 'day',
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&partner_id=61000&pos_scope=day',
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&pos_scope=day',
    '/odoo-api/pwa-admin/customers?q=publico&pos_scope=day',
    '/odoo-api/pwa-admin/default-customer?pos_scope=day',
    '/odoo-api/pwa-admin/today-sales?pos_scope=day',
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=day',
    '/odoo-api/pwa-admin/sale-create',
    '/odoo-api/pwa-admin/sale-cancel',
  ])
  assert.deepEqual(calls[6].payload.params, {
    warehouse_id: 89,
    partner_id: 61000,
    payment_method: 'cash',
    lines: [{ product_id: 7, qty: 1, price_unit: 20 }],
    pos_scope: 'day',
  })
  assert.deepEqual(calls[7].payload.params, {
    order_id: 9001,
    reason_code: 'duplicate',
    pos_scope: 'day',
  })
  for (const call of calls) {
    assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token')
  }
})

test('public wrappers reject malformed, inherited, and accessor-backed scopes before transport', async () => {
  const calls = []
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return createJsonResponse(200, { result: { ok: true } })
  }

  const inherited = Object.create({ posScope: 'day' })
  const accessor = {}
  let reads = 0
  Object.defineProperty(accessor, 'posScope', {
    enumerable: true,
    get() {
      reads += 1
      return 'day'
    },
  })

  const invalidOptions = [
    { posScope: '' },
    { posScope: ' day ' },
    { posScope: 'night' },
    { posScope: [] },
    { posScope: {} },
    inherited,
    accessor,
  ]
  for (const options of invalidOptions) {
    assert.throws(() => adminApi.getSaleOrder(9001, options), TypeError)
    assert.throws(() => adminApi.getDefaultCustomer(34, options), TypeError)
    assert.throws(() => adminApi.searchCustomers('x', 34, options), TypeError)
  }

  assert.equal(reads, 0)
  assert.deepEqual(calls, [])
})

test('sale create validates only own data scope properties without invoking accessors', async () => {
  const calls = []
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return createJsonResponse(200, { result: { ok: true } })
  }

  const inherited = Object.create({ pos_scope: 'day' })
  inherited.warehouse_id = 89
  const accessor = { warehouse_id: 89 }
  let reads = 0
  Object.defineProperty(accessor, 'pos_scope', {
    enumerable: true,
    get() {
      reads += 1
      return 'day'
    },
  })

  for (const data of [
    { pos_scope: ' day ' },
    { pos_scope: [] },
    { night_pos: true },
    { night_pos: ' 1 ' },
    inherited,
    accessor,
  ]) {
    assert.throws(() => adminApi.createSaleOrder(data), TypeError)
  }

  assert.equal(reads, 0)
  assert.deepEqual(calls, [])
})

test('day printing stays on the shared ticket and QZ path', () => {
  const screenTicket = readFileSync(
    new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url),
    'utf8',
  )
  const adminFiles = [
    '../src/modules/admin/ScreenPOS.jsx',
    '../src/modules/admin/forms/AdminPosForm.jsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

  assert.match(screenTicket, /printTicketViaQz/)
  assert.match(screenTicket, /flow = ADMIN_POS_FLOW/)
  assert.doesNotMatch(`${screenTicket}\n${adminFiles}`, /printDay|DayPrinter|dayPrinter/)
})
