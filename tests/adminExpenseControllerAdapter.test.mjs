import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAdminExpenseControllerPayload,
  normalizeTodayExpensesControllerResponse,
} from '../src/modules/admin/adminExpenseControllerAdapter.js'

test('AdminGastosForm adapts controller expense create and today response without client identity', () => {
  const payload = buildAdminExpenseControllerPayload({
    name: 'Papelería', total_amount: 125, quantity: 1,
    company_id: 34, warehouse_id: 94, employee_id: 717,
    payment_mode: 'company_account', analytic_distribution: { 818: 100 },
  })
  const expenses = normalizeTodayExpensesControllerResponse({
    ok: true,
    data: { expenses: [{ expense_id: 9, name: 'Papelería', total_amount: 125 }] },
  })

  assert.deepEqual(payload, {
    name: 'Papelería', total_amount: 125, quantity: 1,
    company_id: 34, warehouse_id: 94,
    payment_mode: 'company_account', analytic_distribution: { 818: 100 },
  })
  assert.equal('employee_id' in payload, false)
  assert.deepEqual(expenses, [{ expense_id: 9, name: 'Papelería', total_amount: 125 }])
})
