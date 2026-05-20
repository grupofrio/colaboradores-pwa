import test from 'node:test'
import assert from 'node:assert/strict'

import { api, ApiError } from '../src/lib/api.js'

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
    api_key: 'api-key-test',
    gf_employee_token: 'employee-token-test',
    employee_id: 699,
    role: 'gerente_sucursal',
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

test('iguala stock loads from model reads without requiring the strict admin endpoint', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'gf.production.material') {
      return createJsonResponse(200, {
        result: {
          response: [
            {
              id: 501,
              name: 'MP BOLSA LAURITA ROLITO (13KG)',
              product_id: [901, 'MP BOLSA LAURITA ROLITO (13KG)'],
            },
          ],
        },
      })
    }
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'stock.quant') {
      return createJsonResponse(200, {
        result: {
          response: [
            {
              id: 701,
              product_id: [901, 'MP BOLSA LAURITA ROLITO (13KG)'],
              quantity: 24,
            },
          ],
        },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const stock = await api('GET', '/pwa-admin/traspaso-mp/iguala-stock')

  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, '/odoo-api/get_records_sorted')
  assert.equal(calls[0].payload.params.model, 'gf.production.material')
  assert.deepEqual(calls[0].payload.params.domain, [
    ['active', '=', true],
    ['applies_to_rolito', '=', true],
    ['name', 'ilike', 'MP BOLSA LAURITA ROLITO'],
  ])
  assert.equal(calls[1].url, '/odoo-api/get_records_sorted')
  assert.equal(calls[1].payload.params.model, 'stock.quant')
  assert.deepEqual(stock, {
    location_id: 1172,
    location_name: 'PIGU/MP-IGUALA',
    products: [
      {
        product_id: 901,
        product_name: 'MP BOLSA LAURITA ROLITO (13KG)',
        material_id: 501,
        material_name: 'MP BOLSA LAURITA ROLITO (13KG)',
        uom: 'Units',
        qty_available: 24,
      },
    ],
  })
})

test('iguala transfer posts directly to the Odoo admin controller', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: {
        ok: true,
        message: 'Traspaso realizado',
        data: {
          issue_id: 88,
          qty: 3,
        },
      },
    })
  }

  const result = await api('POST', '/pwa-admin/traspaso-mp/iguala-transfer', {
    product_id: 901,
    qty: 3,
    notes: 'Entrega gerente',
    issued_by: 699,
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/traspaso-mp/iguala-transfer')
  assert.equal(calls[0].options.headers['Api-Key'], 'api-key-test')
  assert.equal(calls[0].payload.params.product_id, 901)
  assert.equal(calls[0].payload.params.qty, 3)
  assert.deepEqual(result, {
    ok: true,
    message: 'Traspaso realizado',
    data: {
      issue_id: 88,
      qty: 3,
    },
  })
})

test('direct Odoo admin API key rejection is treated as an expired session', async () => {
  setSession({ api_key: 'stale-api-key' })

  const events = []
  globalThis.window = {
    dispatchEvent(event) {
      events.push(event.type)
    },
  }
  globalThis.fetch = async () => createJsonResponse(200, {
    ok: false,
    message: 'API key requerida.',
    data: {},
  })

  await assert.rejects(
    api('POST', '/pwa-admin/traspaso-mp/iguala-transfer', {
      product_id: 901,
      qty: 3,
      notes: 'Entrega gerente',
      issued_by: 699,
    }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 401)
      assert.equal(error.code, 'no_session')
      assert.equal(error.message, 'API key requerida.')
      return true
    },
  )
  assert.deepEqual(events, ['gf:session-expired'])
})
