import test from 'node:test'
import assert from 'node:assert/strict'

import { getFuelRoutes, createFuelExpense } from '../src/modules/admin/api.js'

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

function response(payload) {
  return { ok: true, status: 200, async text() { return JSON.stringify(payload) } }
}

test.beforeEach(() => {
  globalThis.localStorage = { getItem: () => JSON.stringify({ session_token: 'fuel-token', employee_id: 55 }) }
  globalThis.window = { dispatchEvent() {} }
})
test.afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

test('fuel API uses the scoped route endpoints and only date in route query', async () => {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return response({ ok: true, data: { routes: [] } })
  }
  await getFuelRoutes('2026-08-05')
  assert.equal(calls[0].url, '/odoo-api/pwa-admin/fuel-routes?date=2026-08-05')
  assert.equal(calls[0].options.method, 'GET')
})

test('fuel expense create sends functional fields and no client scope ids', async () => {
  let sent
  globalThis.fetch = async (_url, options = {}) => {
    sent = JSON.parse(options.body)
    return response({ ok: true, data: { expense_id: 44 } })
  }
  await createFuelExpense({
    name: 'Gasolina', total_amount: 250, quantity: 1, date: '2026-08-05',
    payment_mode: 'company_account', route_plan_id: 91,
    company_id: 9, warehouse_id: 8, employee_id: 7,
  })
  const payload = sent.params || sent
  assert.equal(payload.route_plan_id, 91)
  assert.equal(payload.company_id, undefined)
  assert.equal(payload.warehouse_id, undefined)
  assert.equal(payload.employee_id, undefined)
})
