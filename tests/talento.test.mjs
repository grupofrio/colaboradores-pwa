import test from 'node:test'
import assert from 'node:assert/strict'
import {
  entitlementFromError,
  entitlementFromMe,
  forgetTalentRhEntitlement,
  hydrateTalentRhFromMe,
  readTalentRhAccess,
  resolveTalentRhRouteDecision,
  shouldFetchTalentMe,
} from '../src/modules/talento/access.js'
import { mapTalentError, TALENT_ERROR_MESSAGES, TALENT_SECTION_ENDPOINTS, classifyTalentStatus, mergeCapacitacionAndMe } from '../src/modules/talento/talentoApi.js'
import { getModuleById } from '../src/modules/registry.js'
import { isModuleVisibleForSession } from '../src/lib/navModel.js'

function sess(extra = {}) {
  return { employee_id: 1, session_token: 't', ...extra }
}

test('talent_rh: sesión inválida falla cerrada', () => {
  assert.equal(readTalentRhAccess(null).level, 'none')
  assert.equal(readTalentRhAccess({}).level, 'none')
  assert.equal(resolveTalentRhRouteDecision(null).type, 'login')
})

test('finding: RH Odoo sin direccion_general ve Talento tras /me', () => {
  const session = sess({ role: 'jefe_ruta' })
  assert.equal(session.role !== 'direccion_general', true)
  assert.equal(readTalentRhAccess(session).status, 'unknown')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), session), false)
  const hydrated = { ...session, ...entitlementFromMe({ talent_rh: true }) }
  assert.equal(readTalentRhAccess(hydrated).level, 'global')
  assert.equal(readTalentRhAccess(hydrated).reason, 'odoo_me')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), hydrated), true)
  assert.equal(resolveTalentRhRouteDecision(hydrated).type, 'allow')
})

test('direccion_general sin talent_rh backend no ve Talento', () => {
  const session = {
    ...sess({ role: 'direccion_general' }),
    ...entitlementFromMe({ talent_rh: false, can_access_rh: false }),
  }
  assert.equal(readTalentRhAccess(session).level, 'none')
  assert.equal(readTalentRhAccess(session).status, 'denied')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), session), false)
  assert.equal(resolveTalentRhRouteDecision(session).type, 'home')
})

test('empleado normal talent_rh false no ve Talento', () => {
  const session = {
    ...sess({ role: 'jefe_ruta' }),
    ...entitlementFromMe({ talent_rh: false }),
  }
  assert.equal(readTalentRhAccess(session).level, 'none')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), session), false)
})

test('entitlement loading/unknown no muestra contenido RH', () => {
  const unknown = sess({ role: 'direccion_general' })
  assert.equal(readTalentRhAccess(unknown).status, 'unknown')
  assert.equal(readTalentRhAccess(unknown).level, 'none')
  assert.equal(resolveTalentRhRouteDecision(unknown).type, 'loading')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), unknown), false)
  const loading = sess({ talent_rh_status: 'loading', talent_rh: false })
  assert.equal(readTalentRhAccess(loading).status, 'loading')
  assert.equal(readTalentRhAccess(loading).level, 'none')
  assert.equal(resolveTalentRhRouteDecision(loading).type, 'loading')
})

test('/pwa-talento/me 401 → sesión expirada', () => {
  const patch = entitlementFromError({ status: 401, code: 'no_session' })
  const session = { ...sess(), ...patch }
  assert.equal(readTalentRhAccess(session).status, 'expired')
  assert.equal(resolveTalentRhRouteDecision(session).type, 'login')
  assert.equal(readTalentRhAccess(session).level, 'none')
})

test('/pwa-talento/me 403 → denied', () => {
  const session = { ...sess(), ...entitlementFromError({ status: 403, code: 'talent_access_denied' }) }
  assert.equal(readTalentRhAccess(session).status, 'denied')
  assert.equal(resolveTalentRhRouteDecision(session).type, 'home')
})

test('network error no concede Talento', () => {
  const session = { ...sess({ role: 'direccion_general' }), ...entitlementFromError({ code: 'network' }) }
  assert.equal(readTalentRhAccess(session).status, 'error')
  assert.equal(readTalentRhAccess(session).level, 'none')
  assert.equal(resolveTalentRhRouteDecision(session).type, 'error')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), session), false)
})

test('refresh/direct /talento: bootstrap consulta /me y autoriza RH sin direccion_general', async () => {
  const stale = sess({
    role: 'auxiliar_admin',
    talent_rh: true,
    talent_rh_status: 'authorized',
  })
  const afterRefresh = forgetTalentRhEntitlement(stale)
  assert.equal(shouldFetchTalentMe(afterRefresh), true)
  assert.equal(resolveTalentRhRouteDecision(afterRefresh).type, 'loading')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), afterRefresh), false)
  let called = 0
  const hydrated = await hydrateTalentRhFromMe(async () => {
    called += 1
    return { ok: true, talent_rh: true, can_access_rh: true }
  }, afterRefresh)
  assert.equal(called, 1)
  assert.equal(readTalentRhAccess(hydrated).level, 'global')
  assert.equal(resolveTalentRhRouteDecision(hydrated).type, 'allow')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), hydrated), true)
})

test('frontend job_key no es autorización de Talento', () => {
  const session = sess({ role: 'direccion_general' })
  assert.notEqual(readTalentRhAccess(session).reason, 'job_key')
  assert.equal(readTalentRhAccess(session).level, 'none')
  assert.equal(isModuleVisibleForSession(getModuleById('talento'), session), false)
})

test('mi_capacitacion es universal', () => {
  const session = sess({ role: 'jefe_ruta' })
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
