import test from 'node:test'
import assert from 'node:assert/strict'

import { createRequisition } from '../src/modules/admin/api.js'

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

function localStorageMock() {
  const values = new Map()
  return {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

test.beforeEach(() => {
  globalThis.localStorage = localStorageMock()
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'session-token',
    api_key: 'api-key',
    employee_id: 717,
    company_id: 35,
    warehouse_id: 76,
    gf_employee_token: 'employee-token',
  }))
  globalThis.window = { dispatchEvent() {} }
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

test('requisition create removes client authority fields before calling Odoo', async () => {
  let requestBody
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/odoo-api/pwa-admin/requisition-create')
    requestBody = JSON.parse(options.body)
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ jsonrpc: '2.0', result: { ok: true } }) },
    }
  }

  await createRequisition({
    name: 'Materia prima',
    company_id: 35,
    warehouse_id: 76,
    employee_id: 717,
    sucursal_code: 'IGU',
    lines: [{ product_id: 99, quantity: 100 }],
  })

  assert.deepEqual(requestBody.params, {
    name: 'Materia prima',
    sucursal_code: 'IGU',
    lines: [{ product_id: 99, quantity: 100 }],
  })
})
