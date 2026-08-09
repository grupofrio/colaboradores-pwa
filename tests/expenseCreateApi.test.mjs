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
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    employee_id: 717,
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

test('one-ficha expenses delegate today and create to secured Odoo routes with the exact scope pair', async () => {
  setSession({ odoo_employee_token: 'employee-token' })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { result: { ok: true, data: {} } })
  }

  await api('GET', '/pwa-admin/today-expenses?operating_company_id=35&operating_plaza_id=8')
  await api('POST', '/pwa-admin/expense-create', {
    operating_company_id: 35,
    operating_plaza_id: 8,
    name: 'Caseta',
    total_amount: 120,
  })

  assert.equal(calls[0].url, '/odoo-api/pwa-admin/today-expenses?operating_company_id=35&operating_plaza_id=8')
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[1].url, '/odoo-api/pwa-admin/expense-create')
  assert.equal(calls[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[1].options.body).params, {
    operating_company_id: 35,
    operating_plaza_id: 8,
    name: 'Caseta',
    total_amount: 120,
  })
  assert.equal(calls.some((call) => call.url === '/odoo-api/api/create_update'), false)
})

test('legacy admin expenses remain functional through the Odoo controller', async () => {
  setSession({ warehouse_id: 94 })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { result: { id: 903, response: [] } })
  }

  await api('GET', '/pwa-admin/today-expenses?company_id=34&warehouse_id=94')
  await api('POST', '/pwa-admin/expense-create', {
    company_id: 34, warehouse_id: 94, name: 'Gasto administrativo', total_amount: 50,
  })

  assert.equal(calls[0].url, '/odoo-api/pwa-admin/today-expenses?company_id=34&warehouse_id=94')
  assert.equal(calls[1].url, '/odoo-api/pwa-admin/expense-create')
  assert.equal(calls.some((call) => call.url === '/odoo-api/get_records_sorted'), false)
  assert.equal(calls.some((call) => call.url === '/odoo-api/api/create_update'), false)
})

test('missing or partial one-ficha scope never reaches a sudo model adapter', async () => {
  setSession({ role: 'comprador', employee_id: 694, odoo_employee_token: 'canonical-token' })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(403, { error: { message: 'Alcance one-ficha incompleto' } })
  }

  await assert.rejects(
    api('GET', '/pwa-admin/today-expenses?operating_company_id=35'),
  )
  await assert.rejects(
    api('POST', '/pwa-admin/expense-create', { operating_plaza_id: 8, name: 'Denegado', total_amount: 10 }),
  )

  assert.equal(calls[0].url, '/odoo-api/pwa-admin/today-expenses?operating_company_id=35')
  assert.equal(calls[1].url, '/odoo-api/pwa-admin/expense-create')
  assert.equal(calls.some((call) => call.url === '/odoo-api/get_records_sorted'), false)
  assert.equal(calls.some((call) => call.url === '/odoo-api/api/create_update'), false)
})

test('expense create omits account_id when the user did not select one explicitly', async () => {
  setSession()
  const controllerCalls = []

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    if (url === '/odoo-api/pwa-admin/expense-create') {
      controllerCalls.push({ params: payload.params, headers: options.headers })
      return createJsonResponse(200, { result: { ok: true, data: { id: 901 } } })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await api('POST', '/pwa-admin/expense-create', {
    name: 'Gasolina',
    date: '2026-05-13',
    company_id: 34,
    payment_mode: 'company_account',
    quantity: 1,
    total_amount: 300,
    description: 'Carga de unidad',
  })

  assert.equal(controllerCalls.length, 1)
  assert.equal(Object.hasOwn(controllerCalls[0].params, 'account_id'), false)
  assert.equal(Object.hasOwn(controllerCalls[0].params, 'employee_id'), false)
  assert.equal(controllerCalls[0].headers.Authorization, 'Bearer token-test')
})

test('expense create omits invalid account_id values instead of falling back to a hardcoded account', async () => {
  setSession()
  const controllerCalls = []

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    if (url === '/odoo-api/pwa-admin/expense-create') {
      controllerCalls.push(payload.params)
      return createJsonResponse(200, { result: { ok: true, data: { id: 902 } } })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await api('POST', '/pwa-admin/expense-create', {
    name: 'Casetas',
    date: '2026-05-13',
    company_id: 34,
    payment_mode: 'company_account',
    quantity: 1,
    total_amount: 120,
    description: 'Traslado',
    account_id: 0,
  })

  assert.equal(controllerCalls.length, 1)
  assert.equal(Object.hasOwn(controllerCalls[0], 'account_id'), false)
  assert.equal(Object.hasOwn(controllerCalls[0], 'employee_id'), false)
})

test('expense create omits positive legacy account_id values until an account selector exists', async () => {
  setSession()
  const controllerCalls = []

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    if (url === '/odoo-api/pwa-admin/expense-create') {
      controllerCalls.push(payload.params)
      return createJsonResponse(200, { result: { ok: true, data: { id: 903 } } })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await api('POST', '/pwa-admin/expense-create', {
    name: 'Refacciones',
    date: '2026-05-13',
    company_id: 34,
    payment_mode: 'company_account',
    quantity: 1,
    total_amount: 500,
    description: 'Compra autorizada',
    account_id: 445,
  })

  assert.equal(controllerCalls.length, 1)
  assert.equal(Object.hasOwn(controllerCalls[0], 'account_id'), false)
  assert.equal(Object.hasOwn(controllerCalls[0], 'employee_id'), false)
})
