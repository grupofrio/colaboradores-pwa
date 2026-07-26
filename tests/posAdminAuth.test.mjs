import test from 'node:test'
import assert from 'node:assert/strict'

import { ApiError, api } from '../src/lib/api.js'
import { cancelSaleOrder, getNightTodaySales } from '../src/modules/admin/api.js'

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

function domainHasExactName(domain, name) {
  return domain.some((term) => (
    Array.isArray(term)
    && term[0] === 'name'
    && term[1] === '=ilike'
    && term[2] === name
  ))
}

function relationId(value) {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (rawValue === false || rawValue === null || rawValue === undefined) return false
  const numericValue = Number(rawValue)
  return Number.isFinite(numericValue) ? numericValue : rawValue
}

function normalizeDefaultCustomerPartner(partner) {
  if (!partner) return null
  const normalized = { ...partner }
  if (normalized.active === undefined) normalized.active = true
  if (normalized.company_id === undefined) normalized.company_id = [34, 'GLACIEM']
  if (normalized.x_analytic_un_id === undefined) {
    normalized.x_analytic_un_id = [201, '[IGU] Iguala']
  }
  return normalized
}

function partnerMatchesDefaultCustomerDomain(partner, domain = []) {
  if (!partner) return false
  const terms = domain.filter(Array.isArray)
  const requiredFields = ['active', 'x_analytic_un_id', 'company_id', 'name']
  if (!requiredFields.every((field) => terms.some((term) => term[0] === field))) {
    return false
  }

  return terms.every(([field, operator, expected]) => {
    if (field === 'active') {
      return operator === '=' && partner.active === expected
    }
    if (field === 'x_analytic_un_id') {
      const analyticId = relationId(partner.x_analytic_un_id)
      if (operator === '=') return analyticId === relationId(expected)
      if (operator === 'in' && Array.isArray(expected)) {
        return expected.some((id) => relationId(id) === analyticId)
      }
      return false
    }
    if (field === 'company_id') {
      return operator === '=' && relationId(partner.company_id) === relationId(expected)
    }
    if (field === 'name') {
      return operator === '=ilike'
        && String(partner.name || '').toLowerCase() === String(expected || '').toLowerCase()
    }
    return true
  })
}

function assertNightDefaultCustomerDomainContract(domains) {
  const nightDomains = domains.filter((domain) => (
    domainHasExactName(domain, 'VENTA PUBLICO IGUALA NOCHE')
  ))
  assert.equal(nightDomains.length > 0, true, 'night customer exact search was not issued')

  for (const domain of nightDomains) {
    assert.equal(
      domain.some((term) => (
        Array.isArray(term)
        && term[0] === 'active'
        && term[1] === '='
        && term[2] === true
      )),
      true,
      'night customer search did not require active=true',
    )
    assert.equal(
      domain.some((term) => (
        Array.isArray(term)
        && term[0] === 'x_analytic_un_id'
        && (
          (term[1] === '=' && relationId(term[2]) === 201)
          || (term[1] === 'in' && term[2].some((id) => relationId(id) === 201))
        )
      )),
      true,
      'night customer search did not include analytic unit 201',
    )
    assert.equal(
      domain.some((term) => (
        Array.isArray(term)
        && term[0] === 'company_id'
        && term[1] === '='
        && (relationId(term[2]) === 34 || relationId(term[2]) === false)
      )),
      true,
      'night customer search did not scope company_id to 34 or false',
    )
  }

  return nightDomains
}

function installDefaultCustomerFixture(partner) {
  const partnerDomains = []
  const normalizedPartner = normalizeDefaultCustomerPartner(partner)

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      const isIguala = params.domain.some((term) => (
        Array.isArray(term)
        && (
          (term[0] === 'code' && term[1] === '=' && term[2] === 'IGU')
          || (term[0] === 'name' && term[1] === 'ilike' && term[2] === 'Iguala')
        )
      ))
      return createJsonResponse(200, {
        result: {
          response: isIguala
            ? [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }]
            : [],
        },
      })
    }

    assert.equal(params.model, 'res.partner')
    partnerDomains.push(params.domain)
    const partnerMatches = partnerMatchesDefaultCustomerDomain(normalizedPartner, params.domain)
    return createJsonResponse(200, {
      result: { response: partnerMatches ? [normalizedPartner] : [] },
    })
  }

  return { partnerDomains }
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

test('default customer domain fixture requires the active scope term', async () => {
  installDefaultCustomerFixture({
    id: 62001,
    name: 'VENTA PUBLICO IGUALA NOCHE',
  })

  const response = await globalThis.fetch('/odoo-api/get_records_sorted', {
    body: JSON.stringify({
      params: {
        model: 'res.partner',
        domain: [
          ['x_analytic_un_id', '=', 201],
          ['company_id', '=', 34],
          ['name', '=ilike', 'VENTA PUBLICO IGUALA NOCHE'],
        ],
      },
    }),
  })
  const payload = await response.json()

  assert.deepEqual(payload.result.response, [])
})

test('default customer domain fixture matches every applicable domain term', async () => {
  const partner = {
    id: 62001,
    name: 'VENTA PUBLICO IGUALA NOCHE',
  }
  installDefaultCustomerFixture(partner)

  const readPartners = async (domain) => {
    const response = await globalThis.fetch('/odoo-api/get_records_sorted', {
      body: JSON.stringify({
        params: { model: 'res.partner', domain },
      }),
    })
    return (await response.json()).result.response
  }
  const validDomain = [
    ['active', '=', true],
    ['x_analytic_un_id', '=', 201],
    ['company_id', '=', 34],
    ['name', '=ilike', 'venta publico iguala noche'],
  ]

  const validRows = await readPartners(validDomain)
  assert.deepEqual(validRows.map((row) => row.id), [62001])
  assert.deepEqual(validRows[0].company_id, [34, 'GLACIEM'])
  assert.deepEqual(validRows[0].x_analytic_un_id, [201, '[IGU] Iguala'])
  assert.deepEqual(await readPartners([
    ...validDomain.filter((term) => term[0] !== 'x_analytic_un_id'),
    ['x_analytic_un_id', 'in', [999]],
  ]), [])
  assert.deepEqual(await readPartners([
    ...validDomain.filter((term) => term[0] !== 'company_id'),
    ['company_id', '=', false],
  ]), [])
})

test('default customer domain fixture rejects inactive partners through active domain matching', async () => {
  installDefaultCustomerFixture({
    id: 62001,
    name: 'VENTA PUBLICO IGUALA NOCHE',
    active: false,
  })

  const response = await globalThis.fetch('/odoo-api/get_records_sorted', {
    body: JSON.stringify({
      params: {
        model: 'res.partner',
        domain: [
          ['active', '=', true],
          ['x_analytic_un_id', 'in', [201, 301]],
          ['company_id', '=', 34],
          ['name', '=ilike', 'VENTA PUBLICO IGUALA NOCHE'],
        ],
      },
    }),
  })
  const payload = await response.json()

  assert.deepEqual(payload.result.response, [])
})

test('pos catalog loads from model reads without requiring the strict admin endpoint', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'stock.warehouse') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 89,
            company_id: [34, 'GLACIEM'],
            lot_stock_id: [1519, 'CIGU/Existencias'],
          }],
        },
      })
    }
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'product.pricelist') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 105,
            name: 'Mostrador Iguala',
            display_name: 'Mostrador Iguala',
          }],
        },
      })
    }
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'product.product') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 901,
            display_name: 'Bolsa hielo 5 kg',
            list_price: 85,
            barcode: '750000000001',
            weight: 5,
            sale_ok: true,
            available_in_pos: true,
          }],
        },
      })
    }
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'stock.quant') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 701,
            product_id: [901, 'Bolsa hielo 5 kg'],
            quantity: 10,
            reserved_quantity: 2,
          }],
        },
      })
    }
    if (url === '/odoo-api/get_records_sorted' && payload?.params?.model === 'product.pricelist.item') {
      return createJsonResponse(200, { result: { response: [] } })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  const catalog = await api('GET', '/pwa-admin/pos-products?warehouse_id=89&company_id=34')

  assert.equal(calls.some((call) => call.url === '/odoo-api/pwa-admin/pos-products'), false)
  const productCall = calls.find((call) => call.payload?.params?.model === 'product.product')
  assert.deepEqual(productCall.payload.params.fields, [
    'id',
    'display_name',
    'name',
    'list_price',
    'lst_price',
    'barcode',
    'weight',
    'sale_ok',
    'available_in_pos',
    'categ_id',
    'product_tmpl_id',
  ])
  assert.deepEqual(
    calls.map((call) => call.payload?.params?.model).filter(Boolean),
    ['stock.warehouse', 'product.pricelist', 'product.product', 'stock.quant', 'product.pricelist.item'],
  )
  assert.deepEqual(catalog, {
    ok: true,
    message: 'OK',
    data: {
      company_id: 34,
      warehouse_id: 89,
      pricelist_id: 105,
      pricelist_name: 'Mostrador Iguala',
      products: [{
        id: 901,
        name: 'Bolsa hielo 5 kg',
        price: 85,
        price_unit: 85,
        stock: 8,
        barcode: '750000000001',
        weight: 5,
        sale_ok: true,
        available_in_pos: true,
      }],
    },
  })
})

test('pos catalog reads pricelists with domains accepted by get_records_sorted', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    assert.equal(params.domain.includes('|'), false, `${params.model} used an OR domain`)

    if (params.model === 'stock.warehouse') {
      return createJsonResponse(200, {
        result: { response: [{ id: 89, company_id: [34, 'GLACIEM'], lot_stock_id: [1519, 'CIGU/Existencias'] }] },
      })
    }
    if (params.model === 'product.pricelist') {
      return createJsonResponse(200, {
        result: { response: [{ id: 105, name: 'Mostrador Iguala', display_name: 'Mostrador Iguala' }] },
      })
    }
    if (params.model === 'product.product') {
      return createJsonResponse(200, { result: { response: [] } })
    }
    return createJsonResponse(200, { result: { response: [] } })
  }

  await api('GET', '/pwa-admin/pos-products?warehouse_id=89&company_id=34')

  const pricelistCall = calls.find((call) => call.payload?.params?.model === 'product.pricelist')
  assert.deepEqual(pricelistCall.payload.params.domain, [['company_id', '=', 34]])
})

test('pos catalog applies fixed prices from the selected customer pricelist', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'stock.warehouse') {
      return createJsonResponse(200, {
        result: { response: [{ id: 89, company_id: [34, 'GLACIEM'], lot_stock_id: [1519, 'CIGU/Existencias'] }] },
      })
    }
    if (params.model === 'res.partner') {
      return createJsonResponse(200, {
        result: { response: [{ id: 61100, property_product_pricelist: [81, 'Especial cliente'] }] },
      })
    }
    if (params.model === 'product.pricelist') {
      return createJsonResponse(200, {
        result: { response: [{ id: 81, name: 'Especial cliente', display_name: 'Especial cliente' }] },
      })
    }
    if (params.model === 'product.product') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 901,
            display_name: 'Bolsa hielo 5 kg',
            product_tmpl_id: [501, 'Bolsa hielo 5 kg'],
            categ_id: [77, 'Bolsa'],
            list_price: 85,
            barcode: '750000000001',
            weight: 5,
            sale_ok: true,
            available_in_pos: true,
          }],
        },
      })
    }
    if (params.model === 'stock.quant') {
      return createJsonResponse(200, { result: { response: [] } })
    }
    if (params.model === 'product.pricelist.item') {
      assert.deepEqual(params.domain, [['pricelist_id', '=', 81]])
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 7001,
            pricelist_id: [81, 'Especial cliente'],
            applied_on: '1_product',
            product_tmpl_id: [501, 'Bolsa hielo 5 kg'],
            min_quantity: 1,
            compute_price: 'fixed',
            fixed_price: 70,
          }],
        },
      })
    }
    return createJsonResponse(500, { error: `Unexpected model ${params.model}` })
  }

  const catalog = await api('GET', '/pwa-admin/pos-products?warehouse_id=89&company_id=34&partner_id=61100')

  assert.equal(calls.some((call) => call.payload?.params?.model === 'product.pricelist.item'), true)
  assert.equal(catalog.data.pricelist_id, 81)
  assert.equal(catalog.data.pricelist_name, 'Especial cliente')
  assert.equal(catalog.data.products[0].price, 70)
  assert.equal(catalog.data.products[0].price_unit, 70)
})

test('pos catalog prefers customer pricelist_id over property_product_pricelist', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'stock.warehouse') {
      return createJsonResponse(200, {
        result: { response: [{ id: 89, company_id: [34, 'GLACIEM'], lot_stock_id: [1519, 'CIGU/Existencias'] }] },
      })
    }
    if (params.model === 'res.partner') {
      return createJsonResponse(200, {
        result: {
          response: [{
            id: 51183,
            property_product_pricelist: [1, 'Predeterminado (MXN)'],
            pricelist_id: [92, 'IGUALA LEYVAS (MXN)'],
          }],
        },
      })
    }
    if (params.model === 'product.pricelist') {
      return createJsonResponse(200, {
        result: { response: [{ id: 92, name: 'IGUALA LEYVAS (MXN)', display_name: 'IGUALA LEYVAS (MXN)' }] },
      })
    }
    if (params.model === 'product.product') {
      return createJsonResponse(200, { result: { response: [] } })
    }
    if (params.model === 'stock.quant') {
      return createJsonResponse(200, { result: { response: [] } })
    }
    if (params.model === 'product.pricelist.item') {
      assert.deepEqual(params.domain, [['pricelist_id', '=', 92]])
      return createJsonResponse(200, { result: { response: [] } })
    }
    return createJsonResponse(500, { error: `Unexpected model ${params.model}` })
  }

  const catalog = await api('GET', '/pwa-admin/pos-products?warehouse_id=89&company_id=34&partner_id=51183')

  assert.equal(catalog.data.pricelist_id, 92)
  assert.equal(catalog.data.pricelist_name, 'IGUALA LEYVAS (MXN)')
})

test('pos customer search splits text search into safe simple domains', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      return createJsonResponse(200, {
        result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
      })
    }

    assert.equal(params.model, 'res.partner')
    assert.equal(params.domain.includes('|'), false, 'customer search used an OR domain')
    assert.equal(
      params.domain.some((term) => Array.isArray(term) && term[0] === 'display_name'),
      false,
      'customer search used display_name in the domain',
    )

    const hasNameSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'name' && term[1] === 'ilike' && term[2] === 'pala'
    ))
    return createJsonResponse(200, {
      result: {
        response: hasNameSearch
          ? [{ id: 44, name: 'Palapa Centro', customer_rank: 1, property_product_pricelist: [105, 'Mostrador'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-admin/customers?q=pala&company_id=34')

  assert.equal(calls.length > 1, true)
  assert.deepEqual(result, {
    ok: true,
    message: 'OK',
    data: [{
      id: 44,
      name: 'Palapa Centro',
      email: '',
      phone: '',
      mobile: '',
      vat: '',
      ref: '',
      is_company: false,
      pricelist_id: 105,
      pricelist_name: 'Mostrador',
    }],
  })
})

test('pos customer search filters customers to the Iguala analytic unit', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      return createJsonResponse(200, {
        result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
      })
    }

    assert.equal(params.model, 'res.partner')
    assert.equal(
      params.domain.some((term) => (
        Array.isArray(term) && term[0] === 'x_analytic_un_id' && term[1] === '=' && term[2] === 201
      )),
      true,
      'customer search did not include the Iguala analytic unit filter',
    )

    const hasNameSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'name' && term[1] === 'ilike' && term[2] === 'wing'
    ))
    return createJsonResponse(200, {
      result: {
        response: hasNameSearch
          ? [{ id: 44, name: 'Wing Cliente', x_analytic_un_id: [201, '[IGU] Iguala'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-admin/customers?q=wing&company_id=34')

  assert.equal(
    calls.some((call) => call.payload?.params?.model === 'account.analytic.account'),
    true,
  )
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].id, 44)
})

test('pos customer search includes IGU34 branch customers after branch migration', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      const domain = params.domain || []
      const codeTerm = domain.find((term) => Array.isArray(term) && term[0] === 'code')
      const nameTerm = domain.find((term) => Array.isArray(term) && term[0] === 'name')
      if (codeTerm?.[2] === 'IGU34' || nameTerm?.[2] === 'IGU34') {
        return createJsonResponse(200, {
          result: { response: [{ id: 301, name: '[IGU34] Iguala 34', code: 'IGU34' }] },
        })
      }
      if (codeTerm?.[2] === 'IGU' || nameTerm?.[2] === 'Iguala') {
        return createJsonResponse(200, {
          result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
        })
      }
      return createJsonResponse(200, { result: { response: [] } })
    }

    assert.equal(params.model, 'res.partner')
    assert.equal(params.domain.includes('|'), false, 'customer search used an OR domain')

    const analyticTerm = params.domain.find((term) => Array.isArray(term) && term[0] === 'x_analytic_un_id')
    assert.deepEqual(
      analyticTerm,
      ['x_analytic_un_id', 'in', [301, 201]],
      'customer search did not include IGU34 and IGU analytic units',
    )

    const hasNameSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'name' && term[1] === 'ilike' && term[2] === 'migrado'
    ))
    return createJsonResponse(200, {
      result: {
        response: hasNameSearch
          ? [{ id: 77, name: 'Cliente Migrado IGU34', x_analytic_un_id: [301, '[IGU34] Iguala 34'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-admin/customers?q=migrado&company_id=34')

  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].id, 77)
})

test('supervisor customer search includes IGU34 and legacy IGU customers after branch migration', async () => {
  setSession({ role: 'supervisor_ventas' })

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      const domain = params.domain || []
      const codeTerm = domain.find((term) => Array.isArray(term) && term[0] === 'code')
      const nameTerm = domain.find((term) => Array.isArray(term) && term[0] === 'name')
      if (codeTerm?.[2] === 'IGU34' || nameTerm?.[2] === 'IGU34') {
        return createJsonResponse(200, {
          result: { response: [{ id: 301, name: '[IGU34] Iguala 34', code: 'IGU34' }] },
        })
      }
      if (codeTerm?.[2] === 'IGU' || nameTerm?.[2] === 'Iguala') {
        return createJsonResponse(200, {
          result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
        })
      }
      return createJsonResponse(200, { result: { response: [] } })
    }

    assert.equal(params.model, 'res.partner')
    const analyticTerm = params.domain.find((term) => Array.isArray(term) && term[0] === 'x_analytic_un_id')
    assert.deepEqual(
      analyticTerm,
      ['x_analytic_un_id', 'in', [301, 201]],
      'supervisor customer search did not include IGU34 and IGU analytic units',
    )

    const hasNameSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'name' && term[1] === 'ilike' && term[2] === 'migrado'
    ))
    return createJsonResponse(200, {
      result: {
        response: hasNameSearch
          ? [{ id: 77, name: 'Cliente Migrado IGU34', x_analytic_un_id: [301, '[IGU34] Iguala 34'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-supv/customers?q=migrado')

  assert.equal(result.data.customers.length, 1)
  assert.equal(result.data.customers[0].id, 77)
})

test('pos customer search includes new contacts without customer_rank', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      return createJsonResponse(200, {
        result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
      })
    }

    assert.equal(params.model, 'res.partner')
    assert.equal(
      params.domain.some((term) => Array.isArray(term) && term[0] === 'customer_rank'),
      false,
      'customer search should not require customer_rank',
    )

    const hasNameSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'name' && term[1] === 'ilike' && term[2] === 'nuevo'
    ))
    return createJsonResponse(200, {
      result: {
        response: hasNameSearch
          ? [{ id: 61100, name: 'Contacto Nuevo', customer_rank: 0, x_analytic_un_id: [201, '[IGU] Iguala'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-admin/customers?q=nuevo&company_id=34')

  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].id, 61100)
})

test('pos customer search includes phone, mobile, email, vat and ref fields', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      return createJsonResponse(200, {
        result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
      })
    }

    return createJsonResponse(200, { result: { response: [] } })
  }

  await api('GET', '/pwa-admin/customers?q=6110&company_id=34')

  const searchedFields = new Set()
  for (const call of calls) {
    const domain = call.payload?.params?.domain || []
    for (const term of domain) {
      if (Array.isArray(term) && term[1] === 'ilike' && term[2] === '6110') {
        searchedFields.add(term[0])
      }
    }
  }

  assert.deepEqual(
    [...searchedFields].sort(),
    ['email', 'mobile', 'name', 'phone', 'ref', 'vat'],
  )
})

test('pos customer search can find a customer by exact Odoo id', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, payload })

    if (url !== '/odoo-api/get_records_sorted') {
      return createJsonResponse(500, { error: `Unexpected ${url}` })
    }

    const params = payload?.params || {}
    if (params.model === 'account.analytic.account') {
      return createJsonResponse(200, {
        result: { response: [{ id: 201, name: '[IGU] Iguala', code: 'IGU' }] },
      })
    }

    assert.equal(params.model, 'res.partner')
    assert.equal(params.domain.includes('|'), false, 'customer id search used an OR domain')

    const isExactIdSearch = params.domain.some((term) => (
      Array.isArray(term) && term[0] === 'id' && term[1] === '=' && term[2] === 61100
    ))
    return createJsonResponse(200, {
      result: {
        response: isExactIdSearch
          ? [{ id: 61100, name: 'Cliente ID 61100', property_product_pricelist: [81, 'Lista cliente'] }]
          : [],
      },
    })
  }

  const result = await api('GET', '/pwa-admin/customers?q=ID:%2061100&company_id=34')

  assert.equal(
    calls.some((call) => call.payload?.params?.domain?.some((term) => (
      Array.isArray(term) && term[0] === 'id' && term[1] === '=' && term[2] === 61100
    ))),
    true,
  )
  assert.deepEqual(result, {
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
  })
})

test('default customer uses the Iguala night customer for Hector', async () => {
  setSession({
    employee_id: 730,
    name: 'Héctor Tapia',
    role: 'almacenista_entregas',
  })
  const fixture = installDefaultCustomerFixture({
    id: 62001,
    name: 'VENTA PUBLICO IGUALA NOCHE',
    property_product_pricelist: [92, 'Iguala Noche'],
    x_analytic_un_id: [201, '[IGU] Iguala'],
  })

  const result = await api('GET', '/pwa-admin/default-customer?company_id=34')

  assert.equal(result.data.id, 62001)
  assert.equal(result.data.name, 'VENTA PUBLICO IGUALA NOCHE')
  assert.equal(result.data.pricelist_id, 92)
  assertNightDefaultCustomerDomainContract(fixture.partnerDomains)
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA NOCHE')),
    true,
  )
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA')),
    false,
  )
})

test('default customer keeps the Iguala daytime customer for Angelica', async () => {
  setSession({
    employee_id: 700,
    name: 'Angélica Jaimes',
    role: 'gerente_sucursal',
  })
  const fixture = installDefaultCustomerFixture({
    id: 61000,
    name: 'VENTA PUBLICO IGUALA',
    property_product_pricelist: [81, 'Iguala'],
    x_analytic_un_id: [201, '[IGU] Iguala'],
  })

  const result = await api('GET', '/pwa-admin/default-customer?company_id=34')

  assert.equal(result.data.id, 61000)
  assert.equal(result.data.name, 'VENTA PUBLICO IGUALA')
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA')),
    true,
  )
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA NOCHE')),
    false,
  )
})

test('missing Hector night default customer rejects without daytime fallback', async () => {
  setSession({
    employee_id: 730,
    name: 'Héctor Tapia',
    role: 'almacenista_entregas',
  })
  const fixture = installDefaultCustomerFixture({
    id: 61000,
    name: 'VENTA PUBLICO IGUALA',
    property_product_pricelist: [81, 'Iguala'],
    x_analytic_un_id: [201, '[IGU] Iguala'],
  })

  await assert.rejects(
    api('GET', '/pwa-admin/default-customer?company_id=34'),
    (error) => {
      assert.equal(error instanceof ApiError, true)
      assert.equal(error.status, 404)
      assert.equal(error.code, 'night_pos_default_customer_missing')
      assert.equal(error.message, 'No se encontró el cliente Venta Publico Iguala Noche.')
      return true
    },
  )
  assertNightDefaultCustomerDomainContract(fixture.partnerDomains)
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA')),
    false,
  )
})

test('inactive Hector night default customer is treated as missing', async () => {
  setSession({
    employee_id: 730,
    name: 'Héctor Tapia',
    role: 'almacenista_entregas',
  })
  const fixture = installDefaultCustomerFixture({
    id: 62001,
    name: 'VENTA PUBLICO IGUALA NOCHE',
    active: false,
    property_product_pricelist: [92, 'Iguala Noche'],
    x_analytic_un_id: [201, '[IGU] Iguala'],
  })

  await assert.rejects(
    api('GET', '/pwa-admin/default-customer?company_id=34'),
    (error) => {
      assert.equal(error instanceof ApiError, true)
      assert.equal(error.status, 404)
      assert.equal(error.code, 'night_pos_default_customer_missing')
      return true
    },
  )
  assertNightDefaultCustomerDomainContract(fixture.partnerDomains)
  assert.equal(
    fixture.partnerDomains.some((domain) => domainHasExactName(domain, 'VENTA PUBLICO IGUALA')),
    false,
  )
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
  assert.equal(call.options.headers['Api-Key'], 'stale-api-key')
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.equal(
    calls.some((entry) => entry.payload?.params?.model === 'sale.order'),
    false,
    'today sales should not read sale.order through the generic endpoint',
  )
  assert.equal(result.data.items.length, 1)
  assert.equal(result.data.items[0].id, 9001)
})

test('night today sales sends the night intent without any date filters', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    calls.push({ url, options, payload })

    if (url === '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&night_pos=1') {
      return createJsonResponse(200, {
        ok: true,
        data: { items: [] },
      })
    }
    return createJsonResponse(500, { error: `Unexpected ${url}` })
  }

  await getNightTodaySales({ warehouseId: 89, companyId: 34 })

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.options.headers['Api-Key'], 'stale-api-key')
  assert.equal(call.options.headers['X-GF-Employee-Token'], 'employee-token-test')
  const query = new URL(call.url, 'https://pwa.test').searchParams
  assert.deepEqual([...query.keys()], ['warehouse_id', 'company_id', 'night_pos'])
  assert.equal(query.get('night_pos'), '1')
  assert.equal(query.has('date'), false)
  assert.equal(query.has('date_from'), false)
  assert.equal(query.has('date_to'), false)
})

test('today sales forwards supplied empty and malformed night intent for backend rejection', async () => {
  setSession()

  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return createJsonResponse(200, { ok: true, data: { items: [] } })
  }

  await api('GET', '/pwa-admin/today-sales?warehouse_id=89&night_pos=')
  await api('GET', '/pwa-admin/today-sales?warehouse_id=89&night_pos=malformed')

  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&night_pos=')
  assert.equal(
    calls[1].url,
    '/odoo-api/pwa-admin/today-sales?warehouse_id=89&company_id=34&night_pos=malformed',
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
    employee_id: 699,
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
  assert.equal(call.options.headers['Api-Key'], 'stale-api-key')
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
    employee_id: 699,
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
    employee_id: 699,
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
