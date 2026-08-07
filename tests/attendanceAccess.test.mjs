import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  getModuleEntryDecisionForSession,
  isModuleVisibleForSession,
} from '../src/lib/navModel.js'

const attendanceAccess = await import('../src/modules/asistencias/access.js').catch(() => null)
const session = (employeeId, extra = {}) => ({
  employee_id: employeeId,
  session_token: 'valid.mobile.session',
  role: 'gerente_sucursal',
  ...extra,
})

test('attendance access: allowlist parser keeps unique positive integer employee IDs', () => {
  assert.ok(attendanceAccess, 'el helper de acceso de asistencias debe existir')

  const { parseAttendanceManagerIds } = attendanceAccess
  assert.deepEqual(
    parseAttendanceManagerIds('717, 34,717,1,0,-1,1.5,1e3,001,9007199254740992, 34'),
    [717, 34, 1],
  )
  assert.deepEqual(parseAttendanceManagerIds(''), [])
  assert.deepEqual(parseAttendanceManagerIds(null), [])
  assert.deepEqual(parseAttendanceManagerIds(['717']), [], 'solo acepta la cadena pública del ambiente')
})

test('attendance access: only employee 717 with a valid session gets local attendance access', () => {
  assert.ok(attendanceAccess, 'el helper de acceso de asistencias debe existir')

  const { readAttendanceAccess } = attendanceAccess
  assert.deepEqual(readAttendanceAccess(session(717), '717'), {
    level: 'manager',
    reason: 'employee_allowlist',
  })
  assert.deepEqual(readAttendanceAccess(session('717'), '717'), {
    level: 'manager',
    reason: 'employee_allowlist',
  })
  assert.deepEqual(readAttendanceAccess(session(718), '717'), {
    level: 'none',
    reason: 'employee_not_allowed',
  })

  for (const invalid of [
    null,
    {},
    { employee_id: 717 },
    session(717, { session_token: '  ' }),
    session(717, { exp: 1 }),
  ]) {
    assert.deepEqual(readAttendanceAccess(invalid, '717'), {
      level: 'none',
      reason: 'invalid_session',
    })
  }
})

test('attendance access: production-safe default keeps employee 717 visible when Vercel omits the variable', () => {
  assert.ok(attendanceAccess, 'el helper de acceso de asistencias debe existir')

  const { readAttendanceAccess } = attendanceAccess
  const accessSource = readFileSync(new URL('../src/modules/asistencias/access.js', import.meta.url), 'utf8')
  assert.match(accessSource, /VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS \?\? DEFAULT_ATTENDANCE_MANAGER_IDS/)
  assert.deepEqual(readAttendanceAccess(session(717)), {
    level: 'manager',
    reason: 'employee_allowlist',
  })
  assert.deepEqual(readAttendanceAccess(session(718)), {
    level: 'none',
    reason: 'employee_not_allowed',
  })
  assert.deepEqual(readAttendanceAccess(session(717), ''), {
    level: 'none',
    reason: 'employee_not_allowed',
  }, 'una variable explícita vacía desactiva el fallback')
})

test('attendance access: name, role, nested employee, or malformed IDs cannot grant access', () => {
  assert.ok(attendanceAccess, 'el helper de acceso de asistencias debe existir')

  const { readAttendanceAccess } = attendanceAccess
  const impersonationFields = {
    name: 'Angélica Jaimes Domínguez',
    role: 'attendance_manager',
    employee: { id: 717, employee_id: 717 },
  }

  assert.equal(readAttendanceAccess(session(718, impersonationFields), '717').level, 'none')
  assert.equal(readAttendanceAccess({ session_token: 'valid', ...impersonationFields }, '717').reason, 'invalid_session')

  for (const malformedId of ['0717', '717.0', '717foo', 717.5, -717, 0, { valueOf: () => 717 }]) {
    assert.equal(
      readAttendanceAccess(session(malformedId, impersonationFields), '717').reason,
      'invalid_session',
    )
  }
})

test('attendance access: attendance_manager policy drives home, nav, click, and fails closed when unknown', () => {
  const module = getModuleById('asistencias')
  assert.ok(module, 'el módulo asistencias debe existir en el registry')
  assert.equal(module.route, '/asistencias')
  assert.equal(module.accessPolicy, 'attendance_manager')
  assert.equal(module.status, 'live')
  assert.equal(module.showOnHome, true)
  assert.equal(module.showInNav, true)
  assert.equal(isModuleVisibleForRoles(module, ['gerente_sucursal', 'attendance_manager']), false)

  const allowed = session(717)
  const denied = session(718, { role: 'attendance_manager' })
  assert.equal(isModuleVisibleForSession(module, allowed, '717'), true, 'tarjeta y nav visibles')
  assert.equal(isModuleVisibleForSession(module, denied, '717'), false, 'rol no suplanta employee_id')
  assert.equal(getModuleEntryDecisionForSession(module, allowed, '717').type, 'direct', 'clic directo')
  assert.equal(getModuleEntryDecisionForSession(module, denied, '717').type, 'denied')

  const unknownPolicy = { ...module, accessPolicy: 'attendance_manager_typo' }
  assert.equal(isModuleVisibleForSession(unknownPolicy, allowed, '717'), false)
  assert.equal(getModuleEntryDecisionForSession(unknownPolicy, allowed, '717').type, 'denied')

  const navModel = readFileSync(new URL('../src/lib/navModel.js', import.meta.url), 'utf8')
  assert.match(navModel, /getVisibleModulesForSession[\s\S]*isModuleVisibleForSession/)
  assert.match(navModel, /getHomeModulesForSession[\s\S]*getVisibleModulesForSession/)
  assert.match(navModel, /getNavModules[\s\S]*getVisibleModulesForSession/)
})

test('attendance access: public deployment setting documents employee 717 as a UI-only gate', () => {
  const env = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  assert.match(env, /# UI-only allowlist; Odoo remains authoritative\. Production: employee 717\./)
  assert.match(env, /^VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS=717$/m)
})
