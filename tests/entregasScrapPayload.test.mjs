import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createScrap } from '../src/modules/entregas/entregasService.js'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const SCREEN_MERMA_PATH = path.join(TEST_DIR, '..', 'src', 'modules', 'entregas', 'ScreenMerma.jsx')

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
    session_token: 'token-test',
    gf_employee_token: 'employee-token-test',
    employee_id: 730,
    warehouse_id: 89,
    company_id: 35,
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

test('createScrap sends only human intent from entregas service while BFF fills session context', async () => {
  setSession({ employee_id: 812, warehouse_id: 94 })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/gf/logistics/api/employee/warehouse_scrap/create') {
      return createJsonResponse(200, {
        ok: true,
        data: {
          scrap_id: 551,
          product_id: 501,
          scrap_qty: 3.5,
        },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await createScrap({
    productId: 501,
    qty: 3.5,
    reasonId: 7,
    notes: 'Bolsa rota en carga',
  })

  const backendCall = calls.find((call) => call.url === '/odoo-api/gf/logistics/api/employee/warehouse_scrap/create')
  assert.ok(backendCall, 'debe llamar al endpoint backend canonico de merma')
  assert.deepEqual(backendCall.payload?.params, {
    warehouse_id: 94,
    employee_id: 812,
    product_id: 501,
    scrap_qty: 3.5,
    reason_id: 7,
    notes: 'Bolsa rota en carga',
    lot_id: null,
  })
  assert.equal(backendCall.payload?.jsonrpc, '2.0')
  assert.equal(backendCall.payload?.method, 'call')
  assert.equal(result.ok, true)
})

test('ScreenMerma calls createScrap with human intent only', () => {
  const source = fs.readFileSync(SCREEN_MERMA_PATH, 'utf8')
  const start = source.indexOf('const result = await createScrap(')
  assert.notEqual(start, -1, 'debe existir la llamada createScrap en ScreenMerma')

  const snippet = source.slice(start, start + 260)
  assert.match(snippet, /createScrap\(\s*\{/)
  assert.match(snippet, /productId:\s*selectedProduct\.product_id/)
  assert.match(snippet, /qty/)
  assert.match(snippet, /reasonId:\s*selectedReason\.id/)
  assert.match(snippet, /notes:\s*notes\.trim\(\)\s*\|\|\s*undefined/)
  assert.doesNotMatch(snippet, /warehouseId/)
  assert.doesNotMatch(snippet, /employeeId/)
})
