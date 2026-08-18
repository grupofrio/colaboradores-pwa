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
    odoo_api_key: 'api-key-test',
    odoo_employee_token: 'employee-token-test',
    employee_id: 717,
    company_id: 34,
    warehouse_id: 89,
    x_analytic_account_id: [901, 'CEDIS Iguala'],
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

const AUTHORITY_KEYS = [
  'employee_id', 'company_id', 'warehouse_id', 'analytic_account_id',
  'analytic_id', 'cedis_id', 'branch_config_id', 'employee_ref',
]

function assertNoAuthorityInPayload(params) {
  const meta = params.meta || {}
  const data = params.data || {}
  for (const key of AUTHORITY_KEYS) {
    assert.equal(Object.hasOwn(meta, key), false, `meta must not send ${key}`)
    assert.equal(Object.hasOwn(data, key), false, `data must not send ${key}`)
  }
}

test('supervisor team uses dedicated V2 endpoint without get_records_sorted/sudo', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const params = JSON.parse(options.body).params || {}
    calls.push({ url, params, headers: options.headers })
    return createJsonResponse(200, {
      result: {
        status: 'ok',
        code: 'OK',
        data: [{ id: 21, name: 'Ruta 21', barcode: '', job_id: false, x_job_key: 'jefe_ruta', warehouse_id: 0, image_128: false, phone: '' }],
      },
    })
  }

  const rows = await api('GET', '/pwa-supv/team')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 21)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/gf/salesops/supervisor/v2/team')
  assert.equal(calls[0].headers['X-GF-Employee-Token'], 'employee-token-test')
  assert.equal(calls[0].headers.Authorization, 'Bearer token-test')
  assertNoAuthorityInPayload(calls[0].params)
  assert.equal(calls.some((c) => c.url.endsWith('/get_records_sorted')), false)
})

test('supervisor team-routes uses dedicated V2 endpoint; date is functional only', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const params = JSON.parse(options.body).params || {}
    calls.push({ url, params })
    return createJsonResponse(200, {
      result: { status: 'ok', code: 'OK', data: [{ id: 800, name: 'PLAN/800', date: '2026-06-03' }] },
    })
  }

  const rows = await api('GET', '/pwa-supv/team-routes?date=2026-06-03')
  assert.equal(rows.length, 1)
  assert.equal(calls[0].url, '/odoo-api/gf/salesops/supervisor/v2/team-routes')
  assert.equal(calls[0].params.data.date, '2026-06-03')
  assertNoAuthorityInPayload(calls[0].params)
  assert.equal(calls.some((c) => c.url.endsWith('/get_records_sorted')), false)
})

test('supervisor route templates uses dedicated V2 endpoint without get_records_sorted/sudo', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const params = JSON.parse(options.body).params || {}
    calls.push({ url, params, headers: options.headers })
    return createJsonResponse(200, {
      result: {
        status: 'ok',
        code: 'OK',
        data: [{
          route_id: 700,
          route_name: 'Ruta Centro',
          warehouse_id: 89,
          warehouse_name: 'CEDIS Iguala',
          employee_id: 21,
          employee_name: 'Ruta 21',
          plan_id: 800,
          plan_name: 'PLAN/800',
          plan_state: 'draft',
          stops_total: 0,
          stops_done: 0,
          forecast_id: 900,
          forecast_state: 'draft',
          load_picking_id: null,
          load_sealed: false,
          date_target: '2026-06-03',
        }],
      },
    })
  }

  const rows = await api('GET', '/pwa-supv/route-templates?date_target=2026-06-03')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].route_id, 700)
  assert.equal(rows[0].forecast_id, 900)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/odoo-api/gf/salesops/supervisor/v2/route-templates')
  assert.equal(calls[0].params.data.date_target, '2026-06-03')
  assert.equal(calls[0].headers['X-GF-Employee-Token'], 'employee-token-test')
  assertNoAuthorityInPayload(calls[0].params)
  assert.equal(calls.some((c) => c.url.endsWith('/get_records_sorted')), false)
  assert.equal(JSON.stringify(calls[0].params).includes('"sudo"'), false)
})

test('supervisor route plan preview uses ensure + stops_preview (nunca sudo)', async () => {
  setSession()
  const calls = []

  globalThis.fetch = async (url, options = {}) => {
    const payload = JSON.parse(options.body)
    const params = payload.params || {}
    calls.push({ url, params })

    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/ensure') {
      return createJsonResponse(200, {
        result: { ok: true, data: { plan_id: 800, plan_name: 'PLAN/800', state: 'draft', stops_total: 1 } },
      })
    }

    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/stops_preview') {
      return createJsonResponse(200, {
        result: {
          ok: true,
          data: {
            route_plan_id: 800,
            stops: [
              { stop_id: 501, customer_id: 301, name: 'Abarrotes Sol', address: 'Centro 12', state: 'draft' },
            ],
          },
        },
      })
    }

    return createJsonResponse(200, { result: { response: [] } })
  }

  const response = await api('POST', '/pwa-supv/route-plan-preview-customers', {
    route_id: 16,
    date_target: '2026-06-03',
    polygon_id: 69,
    subpolygon_ids: [],
    channel_ids: [],
    visit_days: [],
    time_window_id: null,
    demand_classes: [],
  })

  assert.equal(response.data.route_plan_id, 800)
  assert.equal(response.data.customers.length, 1)
  assert.equal(response.data.customers[0].customer_id, 301)
  assert.equal(calls.some((call) => call.url.endsWith('/get_records_sorted') && call.params.model === 'gf.route.stop'), false)
  assert.equal(calls.some((call) => call.url.endsWith('/route_plan/stops_preview')), true)
})

test('supervisor route plan preview degrada a error honesto si stops_preview falla (sin sudo)', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const params = (JSON.parse(options.body).params) || {}
    calls.push({ url, params })
    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/ensure') {
      return createJsonResponse(200, { result: { ok: true, data: { plan_id: 800, state: 'draft', stops_total: 1 } } })
    }
    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/stops_preview') {
      return createJsonResponse(200, { result: { ok: false, code: 'FORBIDDEN', user_message: 'Plan fuera de tu sucursal.' } })
    }
    return createJsonResponse(200, { result: { response: [] } })
  }

  const response = await api('POST', '/pwa-supv/route-plan-preview-customers', {
    route_id: 16, date_target: '2026-06-03', polygon_id: 69,
    subpolygon_ids: [], channel_ids: [], visit_days: [], time_window_id: null, demand_classes: [],
  })

  assert.equal(response.ok, false)
  assert.equal(response.status, 'error')
  assert.equal(calls.some((call) => call.url.endsWith('/get_records_sorted') && call.params.model === 'gf.route.stop'), false)
})

test('supervisor route plan preview conserva un subpolígono único para route_plan/ensure', async () => {
  setSession()
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const params = (JSON.parse(options.body).params) || {}
    calls.push({ url, params })
    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/ensure') {
      return createJsonResponse(200, { result: { ok: true, data: { plan_id: 800, state: 'draft' } } })
    }
    if (url === '/odoo-api/gf/salesops/supervisor/v2/route_plan/stops_preview') {
      return createJsonResponse(200, { result: { ok: true, data: { route_plan_id: 800, stops: [] } } })
    }
    return createJsonResponse(200, { result: { response: [] } })
  }

  await api('POST', '/pwa-supv/route-plan-preview-customers', {
    route_id: 16, date_target: '2026-06-03', polygon_id: 69,
    subpolygon_ids: [71], channel_ids: [], visit_days: [], time_window_id: null, demand_classes: [],
  })

  const ensure = calls.find((call) => call.url.endsWith('/route_plan/ensure'))
  assert.equal(ensure.params.data.subpolygon_id, 71)
  assert.equal(Object.hasOwn(ensure.params.data, 'subpolygon_ids'), false)
})

test('supervisor route plan preview rechaza varios subpolígonos sin crear un plan ambiguo', async () => {
  setSession()
  globalThis.fetch = async () => {
    throw new Error('No debe llamar al backend si el alcance es ambiguo')
  }

  const response = await api('POST', '/pwa-supv/route-plan-preview-customers', {
    route_id: 16, date_target: '2026-06-03', polygon_id: 69,
    subpolygon_ids: [71, 72], channel_ids: [], visit_days: [], time_window_id: null, demand_classes: [],
  })

  assert.equal(response.ok, false)
  assert.equal(response.code, 'VALIDATION_ERROR')
  assert.match(response.message, /único subpolígono/i)
})

test('supervisor branch configs forbidden response degrades without throwing', async () => {
  setSession()

  globalThis.fetch = async (url) => {
    assert.equal(url, '/odoo-api/pwa-supv/branch-configs')
    return createJsonResponse(403, {
      ok: false,
      message: 'Usuario sin permisos para esta operacion.',
      data: { code: 'forbidden' },
    })
  }

  const response = await api('GET', '/pwa-supv/branch-configs')

  assert.equal(response.ok, false)
  assert.equal(response.data.code, 'forbidden')
  assert.deepEqual(response.data.branch_configs, [])
})
