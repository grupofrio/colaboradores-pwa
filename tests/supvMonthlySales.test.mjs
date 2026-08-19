import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildEmployeeMonthlySalesFromRouteData,
  buildCedisMonthlySalesDomain,
  resolveEmployeeMonthlySalesActual,
  resolveMonthlySalesTarget,
  sumSaleOrderTotals,
} from '../src/modules/supervisor-ventas/monthSales.js'
import { getDayOverview } from '../src/modules/supervisor-ventas/supvService.js'

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

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(payload)
    },
  }
}

function setSession(session = {}) {
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'token-test',
    gf_employee_token: 'employee-token-test',
    employee_id: 699,
    role: 'supervisor_ventas',
    company_id: 34,
    warehouse_id: 89,
    x_analytic_account_id: [820, 'CEDIS Iguala'],
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

test('buildCedisMonthlySalesDomain filters sale orders by month and CEDIS warehouse', () => {
  assert.deepEqual(
    buildCedisMonthlySalesDomain({
      startMonth: '2026-06-01',
      endMonth: '2026-07-01',
      warehouseId: 89,
      companyId: 34,
    }),
    [
      ['state', 'in', ['sale', 'done']],
      ['date_order', '>=', '2026-06-01 00:00:00'],
      ['date_order', '<', '2026-07-01 00:00:00'],
      ['warehouse_id', '=', 89],
      ['company_id', '=', 34],
    ],
  )
})

test('sumSaleOrderTotals adds all valid monthly sale totals', () => {
  assert.equal(sumSaleOrderTotals([
    { amount_total: 120.5 },
    { amount_total: '379.50' },
    { amount_total: null },
  ]), 500)
})

test('resolveMonthlySalesTarget uses 1,800,000 as June target when Odoo has no target', () => {
  assert.equal(resolveMonthlySalesTarget([], '2026-06-07'), 1800000)
  assert.equal(resolveMonthlySalesTarget([{ sales_target: 0 }], '2026-06-07'), 1800000)
})

test('buildEmployeeMonthlySalesFromRouteData sums sale orders by route employee', () => {
  const byEmployee = buildEmployeeMonthlySalesFromRouteData({
    plans: [
      { id: 1, driver_employee_id: [10, 'Ruta 10'] },
      { id: 2, salesperson_employee_id: [11, 'Ruta 11'] },
    ],
    stops: [
      { route_plan_id: [1, 'PLAN/1'], sale_order_ids: [100, 101] },
      { route_plan_id: [2, 'PLAN/2'], sale_order_ids: [102] },
      { route_plan_id: [1, 'PLAN/1'], sale_order_ids: [100] },
    ],
    saleOrders: [
      { id: 100, amount_total: 1500 },
      { id: 101, amount_total: 500 },
      { id: 102, amount_total: 2500 },
    ],
  })

  assert.deepEqual(byEmployee, [
    { employee_id: 10, sales_actual: 2000, sales_count: 2 },
    { employee_id: 11, sales_actual: 2500, sales_count: 1 },
  ])
})

test('resolveEmployeeMonthlySalesActual prefers month summary employee sales over stale target actuals', () => {
  assert.equal(resolveEmployeeMonthlySalesActual(10, { sales_actual: 0 }, {
    employee_sales: [{ employee_id: 10, sales_actual: 2000 }],
  }), 2000)
})

test('getDayOverview uses monthly CEDIS sales total and per-driver sales instead of stale target actuals', async () => {
  setSession()

  globalThis.fetch = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : null
    const model = payload?.params?.model

    if (url === '/odoo-api/gf/salesops/supervisor/v2/team') {
      return jsonResponse({
        result: {
          status: 'ok',
          code: 'OK',
          data: [
            { id: 10, name: 'Ruta 10', barcode: '', job_id: false, x_job_key: 'jefe_ruta', warehouse_id: 0, image_128: false, phone: '' },
            { id: 11, name: 'Ruta 11', barcode: '', job_id: false, x_job_key: 'jefe_ruta', warehouse_id: 0, image_128: false, phone: '' },
          ],
        },
      })
    }

    if (url === '/odoo-api/gf/salesops/supervisor/v2/team-routes') {
      return jsonResponse({
        result: {
          status: 'ok',
          code: 'OK',
          data: [
            {
              id: 1,
              name: 'PLAN/1',
              date: '2026-06-07',
              route_id: [501, 'Ruta 10'],
              state: 'in_progress',
              driver_id: 10,
              driver: 'Ruta 10',
              salesperson_id: 0,
              salesperson: '',
              stops_total: 10,
              stops_done: 8,
              progress: 80,
              effectiveness: 0,
              load_sealed: false,
              departure_target: null,
              departure_real: null,
              departure_on_time: false,
              closure_time: null,
              reconciliation_id: null,
              reconciliation_name: '',
              force_close_reason: null,
            },
            {
              id: 2,
              name: 'PLAN/2',
              date: '2026-06-07',
              route_id: [502, 'Ruta 11'],
              state: 'in_progress',
              driver_id: 11,
              driver: 'Ruta 11',
              salesperson_id: 0,
              salesperson: '',
              stops_total: 10,
              stops_done: 9,
              progress: 90,
              effectiveness: 0,
              load_sealed: false,
              departure_target: null,
              departure_real: null,
              departure_on_time: false,
              closure_time: null,
              reconciliation_id: null,
              reconciliation_name: '',
              force_close_reason: null,
            },
          ],
        },
      })
    }

    if (url === '/odoo-api/gf/salesops/supervisor/v2/team-targets') {
      return jsonResponse({
        result: {
          status: 'ok',
          code: 'OK',
          data: [
            {
              id: 1,
              employee_id: [10, 'Ruta 10'],
              employee_name: 'Ruta 10',
              target_month: '2026-06-01',
              sales_target: 1000,
              collection_target: 0,
              sales_actual: 0,
              collection_actual: 0,
            },
            {
              id: 2,
              employee_id: [11, 'Ruta 11'],
              employee_name: 'Ruta 11',
              target_month: '2026-06-01',
              sales_target: 2000,
              collection_target: 0,
              sales_actual: 0,
              collection_actual: 0,
            },
          ],
        },
      })
    }

    if (url === '/odoo-api/gf/salesops/supervisor/v2/month-sales-summary') {
      return jsonResponse({
        result: {
          status: 'ok',
          code: 'OK',
          data: {
            start_month: '2026-06-01',
            end_month: '2026-07-01',
            warehouse_id: 89,
            company_id: 34,
            sales_count: 2,
            sales_actual: 4000,
            employee_sales: [
              { employee_id: 10, sales_actual: 1500, sales_count: 1 },
              { employee_id: 11, sales_actual: 2500, sales_count: 1 },
            ],
          },
        },
      })
    }

    // Liquidations / other overview helpers may still hit generic reads.
    if (url === '/odoo-api/get_records_sorted') {
      return jsonResponse({ result: { response: [] } })
    }

    throw new Error(`Unexpected request ${url}`)
  }

  const overview = await getDayOverview('2026-06-07')

  assert.equal(overview.total_sales_target, 3000)
  assert.equal(overview.total_sales_actual, 4000)
  assert.equal(overview.vendors.find((vendor) => vendor.id === 10).sales_actual, 1500)
  assert.equal(overview.vendors.find((vendor) => vendor.id === 11).sales_actual, 2500)
})
