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
test('selected expense article is available to both render and submission', () => {
  const submitStart = source.indexOf('async function handleSubmit()')
  const selectedArticle = source.indexOf(
    'const selectedArticle = catalog.find((item) => item.product_id === Number(articleId))',
  )

  assert.ok(selectedArticle >= 0, 'the selected article is derived from the Fase 0 catalogue')
  assert.ok(selectedArticle < submitStart, 'render cannot depend on a submit-local variable')
  assert.match(source, /selectedArticle && \(/, 'conditional article fields render from the scoped selection')
  assert.match(source, /article:\s*selectedArticle/, 'submission sends the same selected article')
})
