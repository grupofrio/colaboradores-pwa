import { isValidAuthenticatedSession } from '../../lib/session.js'

/**
 * Entitlement RH de Talento.
 *
 * Fuente de verdad:
 *   grupo Odoo (hr_recruitment.user / manager, o allowlist + flag)
 *   → GET /pwa-talento/me { talent_rh }
 *   → session.talent_rh + session.talent_rh_status
 *   → guard / navegación
 *
 * `direccion_general` NO autoriza Talento. Tampoco un boolean persistido
 * sin status `authorized` de esta hidratación.
 */
export function forgetTalentRhEntitlement(session) {
  if (!session || typeof session !== 'object') return session
  const next = { ...session }
  delete next.talent_rh
  delete next.talent_rh_status
  return next
}

export function entitlementFromMe(me) {
  const rh = me?.talent_rh === true || me?.can_access_rh === true
  if (rh) {
    return { talent_rh: true, talent_rh_status: 'authorized' }
  }
  return { talent_rh: false, talent_rh_status: 'denied' }
}

export function entitlementFromError(err) {
  const status = err?.status
  const code = err?.code
  if (status === 401 || code === 'no_session' || code === 'invalid_employee_token') {
    return { talent_rh: false, talent_rh_status: 'expired' }
  }
  if (status === 403 || code === 'talent_access_denied') {
    return { talent_rh: false, talent_rh_status: 'denied' }
  }
  return { talent_rh: false, talent_rh_status: 'error' }
}

export function shouldFetchTalentMe(session) {
  if (!isValidAuthenticatedSession(session)) return false
  const status = session.talent_rh_status
  return !status || status === 'unknown'
}

export async function hydrateTalentRhFromMe(fetchMeImpl, session) {
  if (!shouldFetchTalentMe(session)) return session
  try {
    const me = await fetchMeImpl()
    return { ...session, ...entitlementFromMe(me) }
  } catch (err) {
    return { ...session, ...entitlementFromError(err) }
  }
}

export function readTalentRhAccess(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session', status: 'denied' }
  }
  const status = session.talent_rh_status || 'unknown'
  if (status === 'unknown' || status === 'loading') {
    return { level: 'none', reason: status, status }
  }
  if (status === 'error') {
    return { level: 'none', reason: 'error', status: 'error' }
  }
  if (status === 'expired') {
    return { level: 'none', reason: 'expired', status: 'expired' }
  }
  if (status === 'authorized' && session.talent_rh === true) {
    return { level: 'global', reason: 'odoo_me', status: 'authorized' }
  }
  return { level: 'none', reason: 'not_talent_rh', status: 'denied' }
}

export function resolveTalentRhRouteDecision(session) {
  if (!isValidAuthenticatedSession(session)) return { type: 'login' }
  const access = readTalentRhAccess(session)
  if (access.status === 'expired') return { type: 'login' }
  if (access.status === 'unknown' || access.status === 'loading') return { type: 'loading' }
  if (access.status === 'error') return { type: 'error' }
  if (access.level === 'global') return { type: 'allow' }
  return { type: 'home' }
}
