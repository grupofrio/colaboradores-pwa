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

function setSession() {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'session-token-test',
    odoo_api_key: 'api-key-test',
    odoo_employee_token: 'employee-token-test',
  }))
}

function collectFetchCalls() {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { data: { ok: true } })
  }
  return calls
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  setSession()
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

test('routes Iguala sales-history GET to Odoo with only its allowlisted filters', async () => {
  const calls = collectFetchCalls()

  await api(
    'GET',
    '/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50&warehouse_id=89&unexpected=value'
  )

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    '/odoo-api/pwa-admin/iguala-sales-history?date_from=2026-07-29&date_to=2026-07-30&search=S25375&page=2&page_size=50'
  )
  assert.equal(calls[0].url.includes('/api-n8n'), false)
  assert.equal(calls[0].options.headers['Api-Key'], undefined)
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-token-test')
})

test('does not route Iguala sales-tickets POST requests directly to Odoo', async () => {
  const calls = collectFetchCalls()

  await api('POST', '/pwa-admin/iguala-sales-tickets', { order_ids: [1] })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api-n8n/pwa-admin/iguala-sales-tickets')
  assert.equal(calls[0].url.includes('/odoo-api'), false)
})
