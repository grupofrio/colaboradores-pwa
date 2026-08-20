import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAccessNightPos,
  canAccessHectorNightPos,
} from '../src/modules/admin/nightPosAccess.js'
import { IDENTITY_GATE_IDS } from '../src/modules/admin/identityGates.js'
import {
  getHomeModulesForSession,
  getModuleEntryDecisionForSession,
} from '../src/lib/navModel.js'
import { getModuleById } from '../src/modules/registry.js'

// 728 = "Hector Tapia Avino" en producción (hr.employee, compañía 34), medido
// 2026-08-07. El gate anterior comparaba el NOMBRE de la sesión; ahora compara
// `employee_id`, que emite el servidor al iniciar sesión.
const NIGHT_POS_EMPLOYEE_ID = IDENTITY_GATE_IDS.nightPos[0]

const BASE_SESSION = {
  employee_id: NIGHT_POS_EMPLOYEE_ID,
  session_token: 'h.p.s',
  role: 'almacenista_entregas',
}
const ids = (modules) => modules.map((module) => module.id)

test('el acceso se decide por employee_id, no por el nombre de la sesión', () => {
  assert.equal(canAccessNightPos(BASE_SESSION), true)
  // El id manda aunque el nombre no diga nada.
  assert.equal(canAccessNightPos({ ...BASE_SESSION, name: '' }), true)
  assert.equal(canAccessNightPos({ ...BASE_SESSION, employee: { id: NIGHT_POS_EMPLOYEE_ID } }), true)
  // El alias viejo sigue resolviendo al mismo gate.
  assert.equal(canAccessHectorNightPos(BASE_SESSION), true)
})

test('un nombre que coincide YA NO abre la puerta', () => {
  // Este era el agujero: cualquier empleado llamado así entraba. Ahora el
  // nombre es irrelevante y sin el id correcto se falla cerrado.
  for (const name of ['Héctor Tapia', 'HECTOR TAPIA', 'Héctor Manuel Tapia Gómez']) {
    assert.equal(
      canAccessNightPos({ ...BASE_SESSION, employee_id: 99999, name }),
      false,
      name,
    )
  }
})

test('falla cerrado sin employee_id o sin credenciales de sesión', () => {
  assert.equal(canAccessNightPos({ ...BASE_SESSION, employee_id: 0 }), false)
  assert.equal(canAccessNightPos({ ...BASE_SESSION, employee_id: undefined }), false)
  assert.equal(canAccessNightPos({ ...BASE_SESSION, employee_id: '728abc' }), false)
  // Sesión sin token: la validación de sesión sigue siendo el primer candado.
  assert.equal(canAccessNightPos({ employee_id: NIGHT_POS_EMPLOYEE_ID }), false)
})

test('pos_nocturno existe y solo aparece para el employee_id autorizado', () => {
  const module = getModuleById('pos_nocturno')
  const allowed = { ...BASE_SESSION }
  const other = { ...BASE_SESSION, employee_id: 99999 }

  assert.ok(module)
  assert.equal(module.route, '/pos-nocturno')
  assert.ok(ids(getHomeModulesForSession(allowed)).includes('pos_nocturno'))
  assert.ok(!ids(getHomeModulesForSession(other)).includes('pos_nocturno'))
  assert.deepEqual(
    getModuleEntryDecisionForSession(module, allowed),
    { type: 'direct', compatibleRoles: [], selectedRole: '' },
  )
  assert.deepEqual(
    getModuleEntryDecisionForSession(module, other),
    { type: 'denied', compatibleRoles: [], selectedRole: '' },
  )
})

test('el POS nocturno no arrastra Admin Sucursal', () => {
  const homeIds = ids(getHomeModulesForSession(BASE_SESSION))

  assert.ok(homeIds.includes('pos_nocturno'))
  assert.ok(!homeIds.includes('admin_sucursal'))
})
