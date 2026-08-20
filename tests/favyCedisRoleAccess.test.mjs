import test from 'node:test'
import assert from 'node:assert/strict'
import { getModulesForRoles } from '../src/modules/registry.js'

function hasFavy(roles) {
  return getModulesForRoles(roles).some((module) => module.id === 'favy_cedis')
}

test('FAVY CEDIS is visible only to its dedicated role', () => {
  assert.equal(hasFavy(['favy_cedis']), true)
  assert.equal(hasFavy(['almacenista_entregas']), false)
  assert.equal(hasFavy(['auxiliar_produccion']), false)
})
