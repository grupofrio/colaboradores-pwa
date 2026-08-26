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
    employee_id: 586,
    warehouse_id: 89,
    company_id: 34,
    role: 'operador_rolito',
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

test('operator-close usa Odoo directo con token de empleado y no cae a n8n legacy', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, {
      ok: true,
      closed: true,
      employee_id: 586,
    })
  }

  const result = await api('POST', '/api/production/shift/operator-close', {
    shift_id: 233,
    role: 'operador_rolito',
    employee_id: 586,
    closed_at: '2026-08-26T19:00:00.000Z',
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/api/production/shift/operator-close')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer web-session-token')
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-mobile-token')
  assert.equal(calls[0].url.startsWith('/api-n8n'), false)
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    shift_id: 233,
    role: 'operador_rolito',
    employee_id: 586,
    closed_at: '2026-08-26T19:00:00.000Z',
  })
  assert.deepEqual(result, {
    ok: true,
    closed: true,
    employee_id: 586,
  })
})
