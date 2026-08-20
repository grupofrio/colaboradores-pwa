import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { api, ApiError } from '../src/lib/api.js'
import {
  cancelSaleOrder,
  getDefaultCustomer,
  getNightTodaySales,
  getPosCatalog,
  getPosProducts,
  getTodaySales,
  searchCustomers,
} from '../src/modules/admin/api.js'

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
    api_key: 'stale-api-key',
    gf_employee_token: 'employee-token-test',
    employee_id: 699,
    role: 'gerente_sucursal',
    company_id: 34,
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

test('supervisor customer list uses dedicated V2 catalog (not generic ORM)', async () => {
  setSession({ role: 'supervisor_ventas' })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    // Dedicated catalog: no get_records_sorted for res.partner.
    if (String(url).includes('get_records_sorted')) {
      return createJsonResponse(500, { error: 'generic ORM forbidden for customers list' })
    }

    // odooJson → /web/dataset/call_kw or similar JSON route shim; accept any odoo json post
    // that carries supervisor v2 customers path in params/args.
    const bodyStr = JSON.stringify(payload || {})
    if (bodyStr.includes('/gf/salesops/supervisor/v2/customers') || bodyStr.includes('customers')) {
      const data = payload?.params?.args?.[0]?.data || payload?.params?.kwargs?.data || payload?.data || {}
      const q = String(data.q || '')
      return createJsonResponse(200, {
        jsonrpc: '2.0',
        id: 1,
        result: {
          ok: true,
          status: 'ok',
          message: 'Customers',
          data: {
            customers: q.includes('migrado')
              ? [{ id: 77, name: 'Cliente Migrado IGU34', phone: false, email: false, latitude: false, longitude: false }]
              : [],
          },
        },
      })
    }

    // Fallback: many shims post to /odoo-api/json with route in body
    if (String(url).includes('/odoo-api') || String(url).includes('json')) {
      return createJsonResponse(200, {
        ok: true,
        status: 'ok',
        message: 'Customers',
        data: {
          customers: [{ id: 77, name: 'Cliente Migrado IGU34', phone: false, email: false, latitude: false, longitude: false }],
        },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('GET', '/pwa-supv/customers?q=migrado')
  assert.equal(result.ok, true)
  const rows = Array.isArray(result.data) ? result.data : (result.data?.customers || [])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 77)
  assert.equal(calls.some((c) => String(c.url).includes('get_records_sorted')), false)
})


test('today sales delegates employee scope to the Odoo backend endpoint', async () => {
  setSession({
    employee_id: 700,
    name: 'Angélica Jaimes',
    role: 'gerente_sucursal',
    company_id: 34,
    warehouse_id: 89,
  })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&date=2026-07-23') {
      return createJsonResponse(200, {
        ok: true,
        message: 'OK',
        data: {
          count: 1,
          items: [{
            id: 9001,
            name: 'S0001',
            customer: 'Cliente Iguala',
            total: 120,
            state: 'sale',
            date_order: '2026-05-22 09:30:00',
            warehouse_id: 89,
          }],
        },
      })
    }

    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('GET', '/pwa-admin/today-sales?warehouse_id=89&company_id=34&date=2026-07-23')

  const call = calls.find((entry) => entry.url.startsWith('/odoo-api/pwa-admin/today-sales'))
  assert.ok(call, 'today sales did not call the Odoo backend endpoint')
  assert.equal(call.options.headers['Api-Key'], undefined)
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.equal(
    calls.some((entry) => entry.payload?.params?.model === 'sale.order'),
    false,
    'today sales should not read sale.order through the generic endpoint',
  )
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].id, 9001)
})

test('night today sales sends only night intent for a cross-company warehouse session', async () => {
  setSession({ company_id: 1, warehouse_id: 89 })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/today-sales?night_pos=1') {
      return createJsonResponse(200, {
        ok: true,
        data: { items: [] },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await getNightTodaySales()

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.options.headers['Api-Key'], undefined)
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  const query = new URL(call.url, 'https://pwa.test').searchParams
  assert.equal(call.url, '/odoo-api/pwa-admin/today-sales?night_pos=1')
  assert.deepEqual([...query.keys()], ['night_pos'])
  assert.equal(query.get('night_pos'), '1')
  assert.equal(query.has('warehouse_id'), false)
  assert.equal(query.has('company_id'), false)
  assert.equal(query.has('date'), false)
  assert.equal(query.has('date_from'), false)
  assert.equal(query.has('date_to'), false)
})

test('admin today sales preserves session warehouse and company fallbacks', async () => {
  setSession({ company_id: 34, warehouse_id: 89 })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { ok: true, data: { items: [] } })
  }

  await getTodaySales()

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34',
  )
})

test('today sales forwards supplied empty and malformed night intent for backend rejection', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { ok: true, data: { items: [] } })
  }

  await api('GET', '/pwa-admin/today-sales?warehouse_id=89&company_id=1&date=2026-07-24&night_pos=')
  await api('GET', '/pwa-admin/today-sales?warehouse_id=89&company_id=1&date=2026-07-24&night_pos=malformed')

  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/today-sales?night_pos=')
  assert.equal(
    calls[1].url,
    '/odoo-api/pwa-admin/today-sales?night_pos=malformed',
  )
})

test('sale detail delegates employee scope to the secured Odoo controller', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001') {
      return createJsonResponse(200, {
        ok: true,
        data: { id: 9001, name: 'S09001' },
      })
    }
    if (url === '/odoo-api/get_records') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 9001,
            name: 'S09001',
            partner_id: [44, 'Cliente'],
            amount_total: 100,
            order_line: [],
          }],
        },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('GET', '/pwa-admin/sale-detail?order_id=9001')

  const call = calls.find((entry) => entry.url === '/odoo-api/pwa-admin/sale-detail?order_id=9001')
  assert.ok(call, 'sale detail did not call the secured Odoo controller')
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.equal(calls.some((entry) => entry.url === '/odoo-api/get_records'), false)
  assert.equal(result.data.id, 9001)
})

test('sale cancel delegates authorization and cancellation to the secured Odoo controller', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      return createJsonResponse(200, {
        result: { ok: true, data: { id: 9001, state: 'cancel' } },
      })
    }
    if (url === '/odoo-api/api/create_update') {
      return createJsonResponse(200, { result: { success: true } })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const result = await api('POST', '/pwa-admin/sale-cancel', {
    order_id: 9001,
    reason: 'Captura duplicada',
  })

  const call = calls.find((entry) => entry.url === '/odoo-api/pwa-admin/sale-cancel')
  assert.ok(call, 'sale cancel did not call the secured Odoo controller')
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.deepEqual(call.payload.params, {
    order_id: 9001,
    reason: 'Captura duplicada',
  })
  assert.equal(calls.some((entry) => entry.url === '/odoo-api/api/create_update'), false)
  assert.equal(result.data.state, 'cancel')
})

test('night sale cancel sends only order_id and reason_code to the secured controller', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/sale-cancel') {
      return createJsonResponse(200, {
        result: { ok: true, data: { id: 9001, state: 'cancel' } },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await cancelSaleOrder(9001, { reasonCode: 'duplicate' })

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.options.headers['Api-Key'], undefined)
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.deepEqual(call.payload.params, {
    order_id: 9001,
    reason_code: 'duplicate',
  })
})

test('cancelSaleOrder rejects malformed option objects before transport', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { result: { ok: true } })
  }

  const inheritedReason = Object.create({ reasonCode: 'duplicate' })
  const malformedOptions = [
    {},
    { reasonCode: null },
    { reasonCode: {} },
    { reasonCode: 'unknown' },
    { reasonCode: ' duplicate ' },
    inheritedReason,
    [],
    new Date(0),
    new Map([['reasonCode', 'duplicate']]),
  ]

  for (const options of malformedOptions) {
    await assert.rejects(async () => cancelSaleOrder(9001, options))
    assert.deepEqual(calls, [])
  }
})

test('cancelSaleOrder accepts a null-prototype options object with an own canonical code', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: { ok: true, data: { id: 9001, state: 'cancel' } },
    })
  }

  const options = Object.create(null)
  options.reasonCode = 'out_of_stock'
  await cancelSaleOrder(9001, options)

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].payload.params, {
    order_id: 9001,
    reason_code: 'out_of_stock',
  })
})

test('cancelSaleOrder rejects accessor-backed reason codes before transport', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { result: { ok: true } })
  }

  let reads = 0
  const options = {}
  Object.defineProperty(options, 'reasonCode', {
    enumerable: true,
    get() {
      reads += 1
      return reads === 1 ? 'duplicate' : 'unknown'
    },
  })

  await assert.rejects(async () => cancelSaleOrder(9001, options))
  assert.equal(reads, 0)
  assert.deepEqual(calls, [])
})

test('admin cancelSaleOrder keeps the legacy free-text transport contract', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: { ok: true, data: { id: 9002, state: 'cancel' } },
    })
  }

  await cancelSaleOrder(9002, 'Captura duplicada')

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].payload.params, {
    order_id: 9002,
    reason: 'Captura duplicada',
  })
})

test('cancelSaleOrder handles null as legacy empty text instead of options', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: { ok: true, data: { id: 9003, state: 'cancel' } },
    })
  }

  await cancelSaleOrder(9003, null)

  assert.deepEqual(calls[0].payload.params, {
    order_id: 9003,
    reason: '',
  })
})

test('sale cancellation never derives authorization identity from mutable cached employee_id', async () => {
  setSession({ employee_id: 999999 })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: { ok: true, data: { id: 9004, state: 'cancel' } },
    })
  }

  await cancelSaleOrder(9004, 'Error operativo')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.deepEqual(calls[0].payload.params, {
    order_id: 9004,
    reason: 'Error operativo',
  })
})

test('sale detail propagates a secured controller 403', async () => {
  setSession()

  globalThis.fetch = async (url) => {
    if (url === '/odoo-api/pwa-admin/sale-detail?order_id=9001') {
      return createJsonResponse(403, {
        code: 'forbidden',
        message: 'Venta fuera del alcance del empleado',
      })
    }
    return createJsonResponse(500, { message: `Unexpected ${url}` })
  }

  await assert.rejects(
    api('GET', '/pwa-admin/sale-detail?order_id=9001'),
    (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.code, 'forbidden')
      assert.equal(error.message, 'Venta fuera del alcance del empleado')
      return true
    },
  )
})

test('sale detail and cancel reject non-decimal or non-scalar ids before fetch', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return createJsonResponse(200, { ok: true })
  }

  const detail = await api('GET', '/pwa-admin/sale-detail?order_id=1e3')
  const cancellation = await api('POST', '/pwa-admin/sale-cancel', {
    order_id: true,
    reason: 'invalid',
  })

  assert.deepEqual(detail, { ok: false, error: 'order_id requerido' })
  assert.deepEqual(cancellation, { ok: false, error: 'order_id requerido' })
  assert.deepEqual(calls, [])
})

test('cached day-only omitted scope delegates catalog, customers, and default customer to live Odoo policy', async () => {
  setSession({
    role: 'pos_diurno',
    additional_job_keys: [],
  })

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, {
      ok: true,
      data: { products: [], customers: [] },
    })
  }

  await api('GET', '/pwa-admin/pos-products?warehouse_id=89&company_id=34')
  await api('GET', '/pwa-admin/customers?q=publico&company_id=34')
  await api('GET', '/pwa-admin/default-customer?company_id=34')

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&company_id=34',
    '/odoo-api/pwa-admin/customers?q=publico&company_id=34',
    '/odoo-api/pwa-admin/default-customer?company_id=34',
  ])
  assert.equal(
    calls.every((call) => call.options.headers['X-GF-Employee-Token'] === 'employee-token-test'),
    true,
  )
})

test('POS wrappers surface the real backend 403 revocation envelope', async () => {
  setSession({ role: 'pos_diurno', additional_job_keys: [] })
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return createJsonResponse(403, {
      ok: false,
      message: 'No tienes acceso al POS.',
      data: { code: 'pos_access_denied' },
    })
  }

  const reads = [
    () => getPosCatalog({ warehouseId: 89, companyId: 34 }),
    () => getPosProducts({ warehouseId: 89 }),
    () => searchCustomers('publico', 34),
    () => getDefaultCustomer(34),
  ]
  for (const read of reads) {
    await assert.rejects(read(), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 403)
      assert.equal(error.code, 'pos_access_denied')
      assert.equal(error.message, 'No tienes acceso al POS.')
      return true
    })
  }
  assert.deepEqual(calls, [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89',
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89',
    '/odoo-api/pwa-admin/customers?q=publico',
    '/odoo-api/pwa-admin/default-customer',
  ])
})

test('POS wrappers reject HTTP-200 failure envelopes before normalization', async () => {
  setSession({ role: 'pos_diurno', additional_job_keys: [] })
  const cases = [
    {
      read: () => getPosCatalog({ warehouseId: 89, companyId: 34 }),
      code: 'pos_pricelist_missing',
      message: 'No hay lista de precios configurada.',
    },
    {
      read: () => getPosProducts({ warehouseId: 89 }),
      code: 'pos_product_scope_missing',
      message: 'No hay alcance de productos configurado.',
    },
    {
      read: () => searchCustomers('publico', 34),
      code: 'pos_customer_scope_missing',
      message: 'No hay alcance de clientes configurado.',
    },
    {
      read: () => getDefaultCustomer(34),
      code: 'night_pos_default_customer_missing',
      message: 'No se encontró el cliente Venta Publico Iguala Noche.',
    },
  ]

  for (const testCase of cases) {
    globalThis.fetch = async () => createJsonResponse(200, {
      ok: false,
      message: testCase.message,
      data: { code: testCase.code },
    })
    await assert.rejects(testCase.read(), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 200)
      assert.equal(error.code, testCase.code)
      assert.equal(error.message, testCase.message)
      return true
    })
  }
})

test('authoritative POS reads have no unreachable direct-model implementation islands', () => {
  const source = readFileSync(
    new URL('../src/lib/api.js', import.meta.url),
    'utf8',
  )
  for (const obsoleteSymbol of [
    'getPosCatalogFromModels',
    'searchPosCustomersFromModels',
    'getDefaultPosCustomerFromModels',
    'shapePosCustomer',
    'readPosPricelist',
    'readPosProducts',
    'readPosPricelistItems',
    'selectPricelistItem',
    'applyPricelistItemPrice',
    'buildPosCustomerBaseDomains',
    'buildPosCustomerIdBaseDomains',
    'parsePosCustomerIdQuery',
    'readPosCustomerRows',
    'canAccessHectorNightPos',
  ]) {
    assert.doesNotMatch(source, new RegExp(`\\b${obsoleteSymbol}\\b`))
  }
  assert.match(source, /function resolvePosCustomerAnalyticUnitIds\(/)
  assert.match(source, /function listSupervisorCustomersFromModels\(/)
  assert.match(source, /function readSupervisorCustomerRows\(/)
})

test('forged cached admin or Hector identity cannot reroute a genuine day token to direct models', async () => {
  const forgedSessions = [
    {
      role: 'gerente_sucursal',
      additional_job_keys: [],
      name: 'Persona POS diurno',
    },
    {
      role: 'pos_diurno',
      additional_job_keys: ['gerente_sucursal'],
      name: 'Persona POS diurno',
    },
    {
      role: 'pos_diurno',
      additional_job_keys: [],
      name: 'Héctor Tapia',
    },
  ]
  const requestPaths = [
    '/pwa-admin/pos-products?warehouse_id=89&company_id=34',
    '/pwa-admin/customers?q=publico&company_id=34',
    '/pwa-admin/default-customer?company_id=34',
  ]

  for (const forgedSession of forgedSessions) {
    setSession({
      employee_id: 801,
      gf_employee_token: 'genuine-day-user-token',
      ...forgedSession,
    })
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      return createJsonResponse(403, {
        code: 'forbidden',
        message: 'No tienes acceso al POS diurno.',
      })
    }

    for (const path of requestPaths) {
      await assert.rejects(
        api('GET', path),
        (error) => error.status === 403 && error.code === 'forbidden',
      )
    }

    assert.deepEqual(calls.map((call) => call.url), requestPaths.map((path) => `/odoo-api${path}`))
    assert.equal(
      calls.every((call) => call.options.headers['X-GF-Employee-Token'] === 'genuine-day-user-token'),
      true,
    )
    assert.equal(calls.some((call) => call.url.includes('/get_records')), false)
  }
})

test('omitted-scope admin and Hector reads also delegate policy selection to Odoo', async () => {
  const cachedSessions = [
    { role: 'gerente_sucursal', name: 'Angélica Jaimes' },
    { role: 'almacenista_entregas', name: 'Héctor Tapia' },
  ]
  const requestPaths = [
    '/pwa-admin/pos-products?warehouse_id=89&company_id=34',
    '/pwa-admin/customers?q=publico&company_id=34',
    '/pwa-admin/default-customer?company_id=34',
  ]

  for (const cachedSession of cachedSessions) {
    setSession(cachedSession)
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options })
      return createJsonResponse(200, { ok: true, data: { products: [], customers: [] } })
    }

    for (const path of requestPaths) await api('GET', path)

    assert.deepEqual(calls.map((call) => call.url), requestPaths.map((path) => `/odoo-api${path}`))
    assert.equal(calls.some((call) => call.url.includes('/get_records')), false)
  }
})

test('admin catalog wrapper preserves authoritative backend products and pricelist', async () => {
  setSession({ role: 'gerente_sucursal', name: 'Angélica Jaimes' })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, {
      ok: true,
      data: {
        company_id: 34,
        warehouse_id: 89,
        pricelist_id: 81,
        pricelist_name: 'Iguala Mostrador',
        products: [{ id: 7, name: 'Bolsa hielo', price: 77.77, stock: 12 }],
      },
    })
  }

  const catalog = await getPosCatalog({
    warehouseId: 89,
    companyId: 34,
    partnerId: 61000,
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&partner_id=61000',
  ])
  assert.deepEqual(catalog, {
    pricelist_id: 81,
    pricelist_name: 'Iguala Mostrador',
    products: [{ id: 7, name: 'Bolsa hielo', price: 77.77, stock: 12 }],
  })
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-token-test')
})

test('Hector catalog wrapper keeps the same authoritative product response contract', async () => {
  setSession({ role: 'almacenista_entregas', name: 'Héctor Tapia' })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, {
      ok: true,
      data: {
        pricelist_id: [92, 'Iguala Noche'],
        products: [{ id: 8, name: 'Hielo noche', price: 91.5, stock: 4 }],
      },
    })
  }

  const catalog = await getPosCatalog({
    warehouseId: 89,
    companyId: 34,
    partnerId: 62001,
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&partner_id=62001',
  ])
  assert.deepEqual(catalog, {
    pricelist_id: 92,
    pricelist_name: 'Iguala Noche',
    products: [{ id: 8, name: 'Hielo noche', price: 91.5, stock: 4 }],
  })
  assert.equal(calls.some((call) => call.url.includes('/get_records')), false)
})

test('admin customer wrapper preserves rank-zero and contact-field results from authoritative policy', async () => {
  setSession({ role: 'gerente_sucursal', name: 'Angélica Jaimes' })
  const expected = {
    ok: true,
    message: 'OK',
    data: [{
      id: 61100,
      name: 'Contacto Nuevo IGU34',
      email: 'nuevo@example.test',
      phone: '7331002000',
      mobile: '7331002001',
      vat: 'NUEVO61100',
      ref: 'REF61100',
      is_company: false,
      pricelist_id: 81,
      pricelist_name: 'Iguala',
    }],
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  const response = await searchCustomers('nuevo', 34)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/customers?q=nuevo',
  ])
  assert.deepEqual(response, expected)
  assert.equal(calls[0].options.headers['X-GF-Employee-Token'], 'employee-token-test')
})

test('Hector customer wrapper preserves legacy Iguala results from authoritative policy', async () => {
  setSession({ role: 'almacenista_entregas', name: 'Héctor Tapia' })
  const expected = {
    ok: true,
    message: 'OK',
    data: [{
      id: 61200,
      name: 'Cliente legado IGU',
      email: '',
      phone: '7332003000',
      mobile: '',
      vat: '',
      ref: 'LEGACY61200',
      is_company: false,
      pricelist_id: 92,
      pricelist_name: 'Iguala Noche',
    }],
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  const response = await searchCustomers('legado', 34)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/customers?q=legado',
  ])
  assert.deepEqual(response, expected)
  assert.equal(calls.some((call) => call.url.includes('/get_records')), false)
})

test('customer wrapper preserves exact ID query and authoritative response fields', async () => {
  setSession({ role: 'gerente_sucursal', name: 'Angélica Jaimes' })
  const expected = {
    ok: true,
    message: 'OK',
    data: [{
      id: 61100,
      name: 'Cliente ID 61100',
      email: '',
      phone: '',
      mobile: '',
      vat: '',
      ref: '',
      is_company: false,
      pricelist_id: 81,
      pricelist_name: 'Lista cliente',
    }],
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  const response = await searchCustomers('ID: 61100', 34)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/customers?q=ID%3A+61100',
  ])
  assert.deepEqual(response, expected)
})

test('Angelica default-customer wrapper preserves the exact daytime customer', async () => {
  setSession({ role: 'gerente_sucursal', name: 'Angélica Jaimes' })
  const expected = {
    ok: true,
    message: 'OK',
    data: {
      id: 61000,
      name: 'VENTA PUBLICO IGUALA',
      pricelist_id: 81,
      pricelist_name: 'Iguala',
    },
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  const response = await getDefaultCustomer(34)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/default-customer',
  ])
  assert.deepEqual(response, expected)
})

test('Hector default-customer wrapper preserves the exact night customer', async () => {
  setSession({ role: 'almacenista_entregas', name: 'Héctor Tapia' })
  const expected = {
    ok: true,
    message: 'OK',
    data: {
      id: 62001,
      name: 'VENTA PUBLICO IGUALA NOCHE',
      pricelist_id: 92,
      pricelist_name: 'Iguala Noche',
    },
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  const response = await getDefaultCustomer(34)

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/default-customer',
  ])
  assert.deepEqual(response, expected)
  assert.equal(calls.some((call) => call.url.includes('/get_records')), false)
})

test('Hector default-customer wrapper surfaces structured missing failure without day fallback', async () => {
  setSession({ role: 'almacenista_entregas', name: 'Héctor Tapia' })
  const expected = {
    ok: false,
    message: 'No se encontró el cliente Venta Publico Iguala Noche.',
    data: { code: 'night_pos_default_customer_missing' },
  }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, expected)
  }

  await assert.rejects(getDefaultCustomer(34), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 200)
    assert.equal(error.code, 'night_pos_default_customer_missing')
    assert.equal(error.message, expected.message)
    return true
  })

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/default-customer',
  ])
})

test('direct proxy forwards malformed and conflicting query intents for backend rejection', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(403, {
      code: 'forbidden',
      message: 'Modo de POS inválido.',
    })
  }

  for (const path of [
    '/pwa-admin/pos-products?warehouse_id=89&pos_scope=unknown',
    '/pwa-admin/customers?q=x&pos_scope=%20day%20',
    '/pwa-admin/default-customer?company_id=34&pos_scope=',
    '/pwa-admin/today-sales?pos_scope=day&night_pos=1',
    '/pwa-admin/sale-detail?order_id=9001&pos_scope=unknown',
  ]) {
    await assert.rejects(api('GET', path), (error) => error.status === 403)
  }

  assert.deepEqual(calls.map((call) => call.url), [
    '/odoo-api/pwa-admin/pos-products?warehouse_id=89&pos_scope=unknown',
    '/odoo-api/pwa-admin/customers?q=x&pos_scope=+day+',
    '/odoo-api/pwa-admin/default-customer?company_id=34&pos_scope=',
    '/odoo-api/pwa-admin/today-sales?pos_scope=day&night_pos=1',
    '/odoo-api/pwa-admin/sale-detail?order_id=9001&pos_scope=unknown',
  ])
})

test('direct proxy rejects duplicate POS intent keys as a local conflict before transport', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return createJsonResponse(200, { ok: true, data: {} })
  }

  for (const path of [
    '/pwa-admin/pos-products?pos_scope=day&pos_scope=unknown',
    '/pwa-admin/customers?q=x&night_pos=1&night_pos=malformed',
    '/pwa-admin/today-sales?pos_scope=day&pos_scope=unknown',
    '/pwa-admin/sale-detail?order_id=9001&night_pos=1&night_pos=malformed',
  ]) {
    await assert.rejects(
      api('GET', path),
      (error) => {
        assert.equal(error.status, 400)
        assert.equal(error.code, 'pos_intent_conflict')
        return true
      },
    )
  }

  assert.deepEqual(calls, [])
})

test('direct sale create preserves simultaneous own day and night intent in Odoo JSON params', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })
    return createJsonResponse(200, {
      result: { ok: false, code: 'forbidden', message: 'No puedes combinar modos de POS.' },
    })
  }

  await api('POST', '/pwa-admin/sale-create', {
    warehouse_id: 89,
    partner_id: 61000,
    payment_method: 'cash',
    lines: [{ product_id: 7, qty: 1, price_unit: 20 }],
    pos_scope: 'day',
    night_pos: '1',
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/sale-create')
  assert.deepEqual(calls[0].payload.params, {
    warehouse_id: 89,
    partner_id: 61000,
    payment_method: 'cash',
    lines: [{ product_id: 7, qty: 1, price_unit: 20 }],
    pos_scope: 'day',
    night_pos: '1',
  })
})

test('direct sale cancel never drops simultaneous scope intent', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })
    return createJsonResponse(200, { result: { ok: false, code: 'forbidden' } })
  }

  await api('POST', '/pwa-admin/sale-cancel', {
    order_id: 9001,
    reason_code: 'duplicate',
    pos_scope: 'day',
    night_pos: '1',
  })

  assert.deepEqual(calls[0], {
    url: '/odoo-api/pwa-admin/sale-cancel',
    payload: {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        order_id: 9001,
        reason_code: 'duplicate',
        pos_scope: 'day',
        night_pos: '1',
      },
      id: calls[0].payload.id,
    },
  })
})
