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

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'web-session-token',
    odoo_employee_token: 'employee-mobile-token',
    employee_id: 730,
    warehouse_id: 89,
    company_id: 34,
    ...session,
  }))
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

test('gf/logistics api employee routes use employee bearer auth instead of legacy employee header', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, {
      result: {
        ok: true,
        data: [],
      },
    })
  }

  await api('GET', '/pwa-pt/pending-transfers?warehouse_id=89')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/gf/logistics/api/employee/pt_transfer/pending')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer employee-mobile-token')
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], undefined)
})
