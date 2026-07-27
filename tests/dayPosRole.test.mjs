import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getModuleById,
  isModuleVisibleForRoles,
} from '../src/modules/registry.js'
import {
  getHomeModulesForSession,
  getNavModules,
} from '../src/lib/navModel.js'
import { getEffectiveJobKeys } from '../src/lib/roleContext.js'

const session = (role, additional_job_keys = []) => ({
  employee_id: 801,
  session_token: 'day-pos-session',
  role,
  additional_job_keys,
})

const visibleIds = (items) => items.map((item) => item.id)

test('registry publishes one live standalone POS day module with the exact assignable role', () => {
  const module = getModuleById('pos_diurno')

  assert.ok(module)
  assert.equal(module.label, 'POS día')
  assert.equal(module.route, '/pos-diurno')
  assert.deepEqual(module.roles, ['pos_diurno'])
  assert.equal(module.status, 'live')
  assert.equal(module.icon, 'admin')
  assert.equal(module.navPriority, 10)
  assert.equal(module.showOnHome, true)
  assert.equal(module.showInNav, true)
  assert.equal(module.accessPolicy, undefined, 'no depende de nombres ni política nominal')
  assert.equal(module.towerGated, undefined)
  assert.equal(module.roleContextRoles, undefined, 'no requiere selector de nombre/rol contextual')
})

test('primary and additional pos_diurno see and enter only the day POS surface', () => {
  const module = getModuleById('pos_diurno')
  for (const current of [
    session('pos_diurno'),
    session('almacenista_entregas', ['pos_diurno']),
  ]) {
    const roles = getEffectiveJobKeys(current)
    assert.equal(isModuleVisibleForRoles(module, roles), true)
    assert.ok(visibleIds(getHomeModulesForSession(current)).includes('pos_diurno'))
    assert.ok(visibleIds(getNavModules(current)).includes('pos_diurno'))
    assert.ok(!visibleIds(getHomeModulesForSession(current)).includes('admin_sucursal'))
    assert.ok(!visibleIds(getNavModules(current)).includes('admin_sucursal'))
  }
})

test('unrelated, Hector-only, and admin-only sessions cannot see or enter POS day', () => {
  const module = getModuleById('pos_diurno')
  const denied = [
    session('almacenista_entregas'),
    session('hector_tapia'),
    session('auxiliar_admin'),
    session('gerente_sucursal'),
    session('direccion_general'),
  ]

  for (const current of denied) {
    assert.equal(isModuleVisibleForRoles(module, getEffectiveJobKeys(current)), false)
    assert.ok(!visibleIds(getHomeModulesForSession(current)).includes('pos_diurno'))
    assert.ok(!visibleIds(getNavModules(current)).includes('pos_diurno'))
  }
})
