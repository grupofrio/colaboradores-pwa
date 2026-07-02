import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { api } from '../src/lib/api.js'
import * as service from '../src/modules/supervisor-ventas/customerDeactivationService.js'

const originalLocalStorage = globalThis.localStorage
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

const SERVICE_EXPORTS = [
  'getCustomerDeactivationSummary',
  'getSugeyDeactivationQueue',
  'getAngelicaDeactivationQueue',
  'getCustomerDeactivationDetail',
  'verifyCustomerDeactivationAsSugey',
  'decideCustomerDeactivationAsAngelica',
]

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
    company_id: 34,
    ...session,
  }))
}

function collectFetchCalls(payload = { data: { ok: true } }) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, payload)
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

test('customer deactivation service exports all workflow functions', () => {
  for (const name of SERVICE_EXPORTS) {
    assert.equal(typeof service[name], 'function', `${name} should be exported`)
  }
})

test('customer deactivation service calls expected direct Odoo paths and unwraps data envelopes', async () => {
  const calls = collectFetchCalls({ data: { ok: true, rows: [1] } })

  assert.deepEqual(await service.getCustomerDeactivationSummary(), { ok: true, rows: [1] })
  assert.deepEqual(await service.getSugeyDeactivationQueue({ limit: 20, offset: 5, route: 'Centro', reason: 'closed' }), { ok: true, rows: [1] })
  assert.deepEqual(await service.getAngelicaDeactivationQueue({ limit: 10, offset: 0, route: 'Sur', reason: 'duplicate' }), { ok: true, rows: [1] })
  assert.deepEqual(await service.getCustomerDeactivationDetail(123), { ok: true, rows: [1] })
  assert.deepEqual(await service.verifyCustomerDeactivationAsSugey(123, { result: 'confirmed_not_exists' }), { ok: true, rows: [1] })
  assert.deepEqual(await service.decideCustomerDeactivationAsAngelica(123, { decision: 'approve' }), { ok: true, rows: [1] })

  assert.equal(new URL(calls[0].url, 'http://local').pathname, '/odoo-api/pwa-supv/customer-deactivation/summary')
  assert.equal(new URL(calls[1].url, 'http://local').pathname, '/odoo-api/pwa-supv/customer-deactivation/sugey')
  assert.equal(new URL(calls[2].url, 'http://local').pathname, '/odoo-api/pwa-supv/customer-deactivation/angelica')
  assert.equal(new URL(calls[3].url, 'http://local').pathname, '/odoo-api/pwa-supv/customer-deactivation/123')
  assert.equal(calls[4].url, '/odoo-api/pwa-supv/customer-deactivation/123/sugey-verify')
  assert.equal(calls[5].url, '/odoo-api/pwa-supv/customer-deactivation/123/angelica-decide')
})

test('customer deactivation direct API routes use odooHttp for GET and odooJson for POST decisions', async () => {
  const calls = collectFetchCalls({ ok: true })

  await api('GET', '/pwa-supv/customer-deactivation/summary')
  await api('GET', '/pwa-supv/customer-deactivation/sugey?limit=20&offset=5&route=Centro&reason=closed')
  await api('GET', '/pwa-supv/customer-deactivation/angelica?limit=10&offset=0&route=Sur&reason=duplicate')
  await api('GET', '/pwa-supv/customer-deactivation/123')
  await api('POST', '/pwa-supv/customer-deactivation/123/sugey-verify', { result: 'confirmed_not_exists' })
  await api('POST', '/pwa-supv/customer-deactivation/123/angelica-decide', { decision: 'approve' })

  assert.deepEqual(calls.map((call) => call.options.method), ['GET', 'GET', 'GET', 'GET', 'POST', 'POST'])
  assert.equal(calls.slice(0, 4).every((call) => call.options.body === undefined), true)
  assert.equal(JSON.parse(calls[4].options.body).params.result, 'confirmed_not_exists')
  assert.equal(JSON.parse(calls[5].options.body).params.decision, 'approve')

  const apiSource = fs.readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
  assert.match(apiSource, /odooHttp\('GET', '\/pwa-supv\/customer-deactivation\/summary'/)
  assert.match(apiSource, /odooHttp\('GET', '\/pwa-supv\/customer-deactivation\/sugey'/)
  assert.match(apiSource, /odooHttp\('GET', '\/pwa-supv\/customer-deactivation\/angelica'/)
  assert.match(apiSource, /odooHttp\('GET', cleanPath, \{ company_id: companyId \|\| undefined \}\)/)
  assert.match(apiSource, /odooJson\(cleanPath, body \|\| \{\}\)/)
})
