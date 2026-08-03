import test from 'node:test'
import assert from 'node:assert/strict'

import { api } from '../src/lib/api.js'
import { getUnitTrack } from '../src/modules/supervisor-ventas/api.js'

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
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    odoo_api_key: 'api-key-test',
    employee_id: 717,
    warehouse_id: 89,
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

test('supervisor unit track uses the V2 JSON-RPC endpoint with supervisor metadata', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { result: { ok: true, data: { plan_id: 800 } } })
  }

  const response = await api('GET', '/pwa-supv/unit-track?plan_id=800&date=2026-08-03')

  assert.equal(response.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/gf/salesops/supervisor/v2/unit-track')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-test')
  assert.equal(calls[0].options.headers['Api-Key'], 'api-key-test')
  const payload = JSON.parse(calls[0].options.body)
  assert.equal(payload.params.data.plan_id, 800)
  assert.equal(payload.params.data.date, '2026-08-03')
  assert.equal(payload.params.meta.employee_id, 717)
  assert.equal(payload.params.meta.warehouse_id, 89)
  assert.equal(payload.params.meta.tz, 'America/Mexico_City')
})

test('supervisor unit track rejects invalid raw plan IDs without fetching', async () => {
  setSession()
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    throw new Error('invalid unit track request must not fetch')
  }

  for (const planId of ['0', '1e2', '0x10', '800.0', '9007199254740992']) {
    const response = await api('GET', `/pwa-supv/unit-track?plan_id=${planId}`)
    assert.deepEqual(response, {
      ok: false,
      data: { code: 'VALIDATION_ERROR' },
      message: 'plan_id requerido',
    })
  }
  assert.equal(fetchCount, 0)
})

test('supervisor unit track rejects non-GET requests without fetching', async () => {
  setSession()
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    throw new Error('non-GET unit track request must not fetch')
  }

  await assert.rejects(
    () => api('POST', '/pwa-supv/unit-track?plan_id=800'),
    (error) => error?.code === 'method_not_allowed' && error?.status === 405,
  )
  assert.equal(fetchCount, 0)
})

test('getUnitTrack normalizes the plan number and forwards an optional date only when provided', async () => {
  setSession()
  const payloads = []
  globalThis.fetch = async (_url, options = {}) => {
    payloads.push(JSON.parse(options.body))
    return createJsonResponse(200, { result: { ok: true, data: {} } })
  }

  await getUnitTrack('00800', '2026-08-03')
  await getUnitTrack(800)

  assert.equal(payloads.length, 2)
  assert.equal(payloads[0].params.data.plan_id, 800)
  assert.equal(payloads[0].params.data.date, '2026-08-03')
  assert.equal(payloads[1].params.data.plan_id, 800)
  assert.equal(Object.hasOwn(payloads[1].params.data, 'date'), false)
})
