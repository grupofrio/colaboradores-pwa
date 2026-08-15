import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildExpenseCatalogPath,
  buildFase0ExpensePayload,
} from '../src/modules/admin/expenseAccounting.js'

test('expense catalogue path requires the company warehouse and capture date', () => {
  assert.equal(
    buildExpenseCatalogPath({
      companyId: 34,
      warehouseId: 89,
      date: '2026-08-15',
    }),
    '/pwa-admin/expense-catalog?company_id=34&warehouse_id=89&date=2026-08-15',
  )
  assert.throws(() => buildExpenseCatalogPath({ companyId: 34, warehouseId: 89 }))
})

test('fase 0 payload contains only operational expense facts', () => {
  assert.deepEqual(
    buildFase0ExpensePayload({
      article: {
        product_id: 55,
        allowed_operations: ['purchase'],
        allowed_asset_kinds: [],
        requires_asset: false,
      },
      name: 'Papelería',
      amount: 200,
      quantity: 1,
      date: '2026-08-15',
      operation: 'purchase',
      attachmentId: 91,
      company_id: 34,
      warehouse_id: 89,
      analytic_distribution: { 820: 100 },
      payment_mode: 'own_account',
    }),
    {
      product_id: 55,
      name: 'Papelería',
      total_amount: 200,
      quantity: 1,
      date: '2026-08-15',
      operation: 'purchase',
      attachment_id: 91,
    },
  )
})

test('fase 0 payload rejects an asset article without its allowed kind', () => {
  assert.throws(
    () => buildFase0ExpensePayload({
      article: {
        product_id: 55,
        allowed_operations: [],
        allowed_asset_kinds: ['vehicle'],
        requires_asset: true,
      },
      name: 'Llanta',
      amount: 1500,
      quantity: 1,
      date: '2026-08-15',
    }),
    /activo/i,
  )
})
