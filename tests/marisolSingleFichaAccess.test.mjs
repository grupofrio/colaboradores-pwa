import test from 'node:test'
import assert from 'node:assert/strict'

import { getModuleById } from '../src/modules/registry.js'
import { isModuleVisibleForSession } from '../src/lib/navModel.js'
import { createMultiCompanyRequisition } from '../src/modules/compras/multiCompanyRequisitionApi.js'
import { createMultiCompanyExpense } from '../src/modules/compras/multiCompanyExpenseApi.js'

const validSession = {
  employee_id: 694,
  session_token: 'server-issued-token',
  role: 'comprador',
}

const marisolCapabilities = {
  ready: true,
  allowed: ['buyer_read', 'single_login_multi_company', 'expense_create'],
  scopes: [{ operating_company_id: 34, operating_plaza_id: 9, label: 'Glaciem / Iguala' }],
}

test('runtime capabilities are required for each sensitive buyer module', () => {
  const compras = getModuleById('compras_csc')
  const requisiciones = getModuleById('requisiciones_multiempresa')
  const gastos = getModuleById('gastos_multiempresa')

  assert.equal(isModuleVisibleForSession(compras, validSession, { ready: false }), false)
  assert.equal(isModuleVisibleForSession(requisiciones, validSession, { ready: false }), false)
  assert.equal(isModuleVisibleForSession(gastos, validSession, { ready: false }), false)
  assert.equal(isModuleVisibleForSession(compras, validSession, marisolCapabilities), true)
  assert.equal(isModuleVisibleForSession(requisiciones, validSession, marisolCapabilities), true)
  assert.equal(isModuleVisibleForSession(gastos, validSession, marisolCapabilities), true)
  assert.equal(isModuleVisibleForSession(compras, validSession, { ready: true, allowed: [] }), false)
})

test('multi-company transports keep authority fields out of requisitions and expenses', async () => {
  const requisition = createMultiCompanyRequisition({ operating_company_id: 35, operating_plaza_id: 8 }, {
    partner_id: 9,
    name: 'Hielo',
    lines: [{ product_id: 11, quantity: 2 }],
    employee_id: 694,
    warehouse_id: 10,
    actor_id: 4,
    self_approval_bypass: true,
  })
  const expense = createMultiCompanyExpense({ operating_company_id: 36, operating_plaza_id: 9 }, {
    name: 'Caseta',
    total_amount: 123,
    employee_id: 694,
    warehouse_id: 10,
    approval_state: 'approved',
  })

  assert.deepEqual(requisition, {
    operating_company_id: 35,
    operating_plaza_id: 8,
    partner_id: 9,
    name: 'Hielo',
    lines: [{ product_id: 11, quantity: 2 }],
  })
  assert.deepEqual(expense, { operating_company_id: 36, operating_plaza_id: 9, name: 'Caseta', total_amount: 123 })
})
