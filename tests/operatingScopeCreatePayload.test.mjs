import test from 'node:test'
import assert from 'node:assert/strict'

import { createRequisition } from '../src/modules/admin/api.js'
import { groupOperatingScopesByPlaza } from '../src/modules/admin/adminService.js'

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

// Regresión: operating_plaza_id/operating_company_id son la excepción
// deliberada a la limpieza de campos de autoridad del cliente (ver
// requisitionScopeAuthority.test.mjs) — actores multi-compañía v2
// (gf_operating_scope) los necesitan para que Odoo pueda resolver la
// requisición, y el backend re-valida el par contra los grants reales del
// actor antes de crear el purchase.order.
test('requisition create keeps operating_plaza_id/operating_company_id (v2 multi-company actors)', async () => {
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
    operating_plaza_id: 1,
    operating_company_id: 35,
    lines: [{ product_id: 99, quantity: 100 }],
  })

  assert.deepEqual(requestBody.params, {
    name: 'Materia prima',
    sucursal_code: 'IGU',
    operating_plaza_id: 1,
    operating_company_id: 35,
    lines: [{ product_id: 99, quantity: 100 }],
  })
})

test('groupOperatingScopesByPlaza groups pairs by Plaza without cross-joining', () => {
  const scopes = [
    { plaza_id: 1, plaza_code: 'IGU', plaza_name: 'Iguala', company_id: 34, company_name: 'GLACIEM' },
    { plaza_id: 1, plaza_code: 'IGU', plaza_name: 'Iguala', company_id: 35, company_name: 'Fabricación' },
    { plaza_id: 11, plaza_code: 'GDL', plaza_name: 'Guadalajara', company_id: 34, company_name: 'GLACIEM' },
  ]

  const groups = groupOperatingScopesByPlaza(scopes)

  assert.equal(groups.length, 2)
  const iguala = groups.find(g => g.plazaId === 1)
  const gdl = groups.find(g => g.plazaId === 11)
  assert.deepEqual(iguala.companies.map(c => c.companyId), [34, 35])
  assert.deepEqual(gdl.companies.map(c => c.companyId), [34])
})

test('groupOperatingScopesByPlaza returns empty list for non-array input', () => {
  assert.deepEqual(groupOperatingScopesByPlaza(undefined), [])
  assert.deepEqual(groupOperatingScopesByPlaza(null), [])
})
