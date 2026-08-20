import test from 'node:test'
import assert from 'node:assert/strict'

import { api } from '../src/lib/api.js'

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
    removeItem(key) {
      delete store[key]
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
    async json() {
      return payload
    },
  }
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    employee_id: 717,
    company_id: 34,
  }))
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('expense create sends allowed amounts without employee identity or payment_mode', async () => {
  const calls = []

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url === '/odoo-api/pwa-admin/expense-create') {
      return createJsonResponse(200, {
        result: { ok: true, data: { id: 123 } },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await api('POST', '/pwa-admin/expense-create', {
    name: 'dddd',
    date: '2026-05-12',
    company_id: 34,
    quantity: 1,
    total_amount: 10,
    description: 'zzz',
    product_id: 55,
  })

  const controllerCall = calls.find((call) => call.url === '/odoo-api/pwa-admin/expense-create')
  assert.ok(controllerCall, 'expected authenticated expense controller call')

  const dict = controllerCall.payload?.params
  assert.ok(dict, 'expected JSON-RPC controller params')
  assert.equal(dict.name, 'dddd')
  assert.equal('employee_id' in dict, false)
  assert.equal('payment_mode' in dict, false)
  assert.equal(dict.company_id, 34)
  assert.equal(dict.quantity, 1)
  assert.equal(dict.total_amount, 10)
  assert.equal('unit_amount' in dict, false)
  assert.equal('account_id' in dict, false)
  assert.equal(dict.product_id, 55)
})
