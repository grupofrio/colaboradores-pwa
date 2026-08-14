import test from 'node:test'
import assert from 'node:assert/strict'

import { getDashboardData } from '../src/modules/admin/adminService.js'

test('admin dashboard retains controller-wrapped expenses in the Hub KPI', async () => {
  const dashboard = await getDashboardData(
    { warehouseId: 94, companyId: 34 },
    {
      getTodaySales: async () => [],
      getTodayExpenses: async () => ({
        ok: true,
        data: { expenses: [{ expense_id: 7, company_id: 34, total_amount: 321 }] },
      }),
    },
  )

  assert.equal(dashboard.expenses.length, 1)
  assert.equal(dashboard.kpis.gastosHoy.count, 1)
  assert.equal(dashboard.kpis.gastosHoy.total, 321)
})
