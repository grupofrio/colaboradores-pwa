import { isValidAuthenticatedSession } from '../../lib/session.js'
import { getEffectiveJobKeys } from '../../lib/roleContext.js'

/**
 * UX gate only. Odoo revalida /pwa-talento/rh/*.
 * Dirección entra por job key. Otros RH solo si /me marcó talent_rh.
 */
export function readTalentRhAccess(session) {
  if (!isValidAuthenticatedSession(session)) {
    return { level: 'none', reason: 'invalid_session' }
  }
  if (session.talent_rh === true) {
    return { level: 'global', reason: 'odoo_me' }
  }
  const keys = getEffectiveJobKeys(session)
  if (keys.includes('direccion_general')) {
    return { level: 'global', reason: 'job_key' }
  }
  return { level: 'none', reason: 'not_talent_rh' }
}
