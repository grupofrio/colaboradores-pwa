import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  normalizeTodayExpensesControllerResponse,
  sumTodayExpensesControllerResponse,
} from '../src/modules/admin/adminExpenseControllerAdapter.js'

const root = new URL('..', import.meta.url)
const readSource = (path) => readFileSync(new URL(path, root), 'utf8')
const controllerEnvelope = {
  ok: true,
  data: {
    expenses: [
      { id: 1, total_amount: 125.5, amount: 1 },
      { id: 2, amount: 20 },
    ],
  },
}

test('mobile cash closing consumes the controller expense envelope and total_amount', () => {
  const expenses = normalizeTodayExpensesControllerResponse(controllerEnvelope)
  assert.deepEqual(expenses, controllerEnvelope.data.expenses)
  assert.equal(sumTodayExpensesControllerResponse(controllerEnvelope), 145.5)

  const source = readSource('src/modules/admin/ScreenCierreCaja.jsx')
  assert.match(source, /normalizeTodayExpensesControllerResponse\(e\)/)
  assert.match(source, /sumTodayExpensesControllerResponse\(expenses\)/)
})

test('mobile admin panel counts expenses from the controller envelope', () => {
  assert.equal(normalizeTodayExpensesControllerResponse(controllerEnvelope).length, 2)

  const source = readSource('src/modules/admin/ScreenAdminPanel.jsx')
  assert.match(source, /normalizeTodayExpensesControllerResponse\(expenses\)/)
})

test('activity feed consumes controller envelope expenses', () => {
  assert.deepEqual(normalizeTodayExpensesControllerResponse(controllerEnvelope), controllerEnvelope.data.expenses)

  const source = readSource('src/modules/admin/components/ActivityFeed.jsx')
  assert.match(source, /expenses:\s*normalizeTodayExpensesControllerResponse\(expensesRaw\)/)
})
