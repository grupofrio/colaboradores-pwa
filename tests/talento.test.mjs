import test from 'node:test'
import assert from 'node:assert/strict'
import { readTalentRhAccess } from '../src/modules/talento/access.js'
import { mapTalentError, TALENT_ERROR_MESSAGES, TALENT_SECTION_ENDPOINTS, classifyTalentStatus, mergeCapacitacionAndMe } from '../src/modules/talento/talentoApi.js'
import { getModuleById } from '../src/modules/registry.js'
import { isModuleVisibleForSession } from '../src/lib/navModel.js'

test('talent_rh: sesión inválida falla cerrada', () => {
  assert.equal(readTalentRhAccess(null).level, 'none')
  assert.equal(readTalentRhAccess({}).level, 'none')
})

test('talent_rh: direccion_general ve Talento', () => {
  const session = { employee_id: 1, session_token: 't', role: 'direccion_general' }
  assert.equal(readTalentRhAccess(session).level, 'global')
  const mod = getModuleById('talento')
  assert.equal(isModuleVisibleForSession(mod, session), true)
})

test('talent_rh: jefe_ruta no ve Talento RH', () => {
  const session = { employee_id: 2, session_token: 't', role: 'jefe_ruta' }
  assert.equal(readTalentRhAccess(session).level, 'none')
  const mod = getModuleById('talento')
  assert.equal(isModuleVisibleForSession(mod, session), false)
})

test('mi_capacitacion es universal', () => {
  const session = { employee_id: 3, session_token: 't', role: 'jefe_ruta' }
  const mod = getModuleById('mi_capacitacion')
  assert.ok(mod)
  assert.equal(isModuleVisibleForSession(mod, session), true)
  assert.equal(mod.showInNav, false)
})

test('mapTalentError no filtra PII', () => {
  assert.equal(mapTalentError('talent_access_denied'), TALENT_ERROR_MESSAGES.talent_access_denied)
  assert.ok(!mapTalentError('x').includes('@'))
})

test('cada sección Talento tiene endpoint Odoo', () => {
  const expected = {
    Home: 'GET /pwa-talento/rh/inbox',
    Pipeline: 'GET /pwa-talento/rh/pipeline',
    Pendientes: 'GET /pwa-talento/rh/worklist',
    Vacantes: 'GET /pwa-talento/rh/vacancies',
    Requisiciones: 'GET /pwa-talento/rh/requisitions',
    Entrevistas: 'GET /pwa-talento/rh/interviews',
    'Candidato 360': 'GET /pwa-talento/rh/applicants/<id>',
    Analytics: 'GET /pwa-talento/rh/analytics',
    'Mi capacitación': 'GET /api/colaborador/capacitacion',
  }
  assert.deepEqual(TALENT_SECTION_ENDPOINTS, expected)
})

test('classifyTalentStatus: expirada vs unauthorized vs error', () => {
  assert.equal(classifyTalentStatus({ code: 'no_session' }), 'expired')
  assert.equal(classifyTalentStatus({ code: 'invalid_employee_token' }), 'expired')
  assert.equal(classifyTalentStatus({ code: 'talent_access_denied' }), 'unauthorized')
  assert.equal(classifyTalentStatus({ code: 'network' }), 'offline')
  assert.equal(classifyTalentStatus({ code: 'internal_error' }), 'error')
})

test('frontend job_key no es autorización: access.js es UX', () => {
  const session = { employee_id: 9, session_token: 't', role: 'direccion_general' }
  assert.equal(readTalentRhAccess(session).reason, 'job_key')
  assert.ok(readTalentRhAccess(session).level === 'global')
})

test('mergeCapacitacionAndMe no deja que cap tape /me', () => {
  const cap = { status: 'fulfilled', value: { academy: 'on', passport: { pendientes: [] } } }
  const me = {
    status: 'fulfilled',
    value: { operating: { released_to_operate: true }, induction: [{ id: 1, name: 'Kit' }] },
  }
  const merged = mergeCapacitacionAndMe(cap, me)
  assert.equal(merged.data.operating.released_to_operate, true)
  assert.equal(merged.data.induction[0].name, 'Kit')
  assert.equal(merged.data.academy, 'on')
})
