import test from 'node:test'
import assert from 'node:assert/strict'

import { getModulesForRole } from '../src/modules/registry.js'

test('operador_koldcup sees KOLDCUP module', () => {
  const modules = getModulesForRole('operador_koldcup')

  assert.ok(modules.some((module) => module.id === 'koldcup' && module.route === '/koldcup'))
})

test('comprador modules declare isolated runtime capability gates', () => {
  const modules = getModulesForRole('comprador')
  const buyerModules = modules.filter((module) => module.roles?.includes('comprador'))
  assert.deepEqual(buyerModules.map((module) => module.id), ['compras_csc', 'requisiciones_multiempresa', 'gastos_multiempresa'])
  assert.deepEqual(buyerModules.map((module) => module.runtimeCapability), ['buyer_read', 'single_login_multi_company', 'expense_create'])
})
