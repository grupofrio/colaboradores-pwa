import { isValidAuthenticatedSession } from '../../lib/session.js'
import { getEffectiveJobKeys } from '../../lib/roleContext.js'

/**
 * UX gate only. Odoo revalida /pwa-talento/rh/*.
 * Dirección entra por job key en frontend; el backend exige grupo de
 * reclutamiento o (job_key allowlist + pwa_talent_enabled).
 * CEDIS vacío en Odoo = cero candidatos (fail-closed). No se decide aquí.
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
