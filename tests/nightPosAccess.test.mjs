import test from 'node:test'
import assert from 'node:assert/strict'

import { canAccessHectorNightPos } from '../src/modules/admin/nightPosAccess.js'
import {
  getHomeModulesForSession,
  getModuleEntryDecisionForSession,
} from '../src/lib/navModel.js'
import { getModuleById } from '../src/modules/registry.js'

const BASE_SESSION = {
  employee_id: 730,
  session_token: 'h.p.s',
  role: 'almacenista_entregas',
}
const ids = (modules) => modules.map((module) => module.id)

test('reconoce la identidad nominal de Héctor Tapia en los candidatos admitidos', () => {
  for (const session of [
    { ...BASE_SESSION, name: 'Héctor Tapia' },
    { ...BASE_SESSION, display_name: 'HECTOR TAPIA' },
    { ...BASE_SESSION, name: 'Héctor Manuel Tapia Gómez' },
    { ...BASE_SESSION, employee: { name: 'Hector Tapia' } },
  ]) {
    assert.equal(canAccessHectorNightPos(session), true)
  }
})

test('falla cerrado ante nombres parciales, distintos o sesión sin credenciales', () => {
  for (const name of ['Héctor', 'Héctor Pérez', 'Juan Tapia', 'Héctor Tapiazo']) {
    assert.equal(canAccessHectorNightPos({ ...BASE_SESSION, name }), false, name)
  }

  assert.equal(canAccessHectorNightPos({ name: 'Héctor Tapia' }), false)
})

test('pos_nocturno existe, solo aparece a Héctor y su entrada usa la política nominal', () => {
  const module = getModuleById('pos_nocturno')
  const hectorSession = { ...BASE_SESSION, name: 'Héctor Tapia' }
  const otherSession = { ...BASE_SESSION, name: 'Juan Tapia' }

  assert.ok(module)
  assert.equal(module.route, '/pos-nocturno')
  assert.ok(ids(getHomeModulesForSession(hectorSession)).includes('pos_nocturno'))
  assert.ok(!ids(getHomeModulesForSession(otherSession)).includes('pos_nocturno'))
  assert.deepEqual(
    getModuleEntryDecisionForSession(module, hectorSession),
    { type: 'direct', compatibleRoles: [], selectedRole: '' },
  )
  assert.deepEqual(
    getModuleEntryDecisionForSession(module, otherSession),
    { type: 'denied', compatibleRoles: [], selectedRole: '' },
  )
})

test('Héctor ve POS nocturno pero no Admin Sucursal', () => {
  const homeIds = ids(getHomeModulesForSession({ ...BASE_SESSION, name: 'Héctor Tapia' }))

  assert.ok(homeIds.includes('pos_nocturno'))
  assert.ok(!homeIds.includes('admin_sucursal'))
})
