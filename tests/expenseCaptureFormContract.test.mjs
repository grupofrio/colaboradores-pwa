import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/modules/admin/forms/AdminGastosForm.jsx', import.meta.url),
  'utf8',
)

test('general expense form delegates to the fase 0 adapter and removes direct evidence attachment', () => {
  assert.match(source, /from ['"]\.\.\/expenseAccounting['"]/)
  assert.doesNotMatch(source, /attachExpense/)
  assert.doesNotMatch(source, /linked_model:\s*['"]hr\.expense['"]/)
  assert.match(source, /expenseMode === 'general'[\s\S]*createFase0Expense/)
})
