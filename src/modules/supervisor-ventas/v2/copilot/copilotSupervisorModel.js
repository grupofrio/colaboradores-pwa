import { getModuleRouteDecisionForSession } from '../../../../lib/navModel.js'

export const SUPERVISOR_COPILOT_MODULE_ID = 'copiloto_supervisor'

export const SUPERVISOR_COPILOT_HREF_ALLOWLIST = Object.freeze([
  '/equipo',
  '/equipo/rutas',
  '/equipo/rutas/planear',
  '/equipo/clientes',
  '/equipo/prospectos',
  '/equipo/pendientes',
  '/equipo/radar',
])

export function isAllowedSupervisorCopilotHref(href) {
  const path = String(href || '').split('?')[0].split('#')[0]
  return SUPERVISOR_COPILOT_HREF_ALLOWLIST.includes(path)
}

export function unwrapSupervisorCopilotPayload(payload) {
  if (payload && (payload.ok === false || String(payload.status || '').toLowerCase() === 'error')) {
    const err = new Error(payload.user_message || payload.message || 'El copiloto no está disponible.')
    err.code = payload.error || payload.code || 'ERROR'
    err.status = payload.status_code || payload.http_status || 200
    err.payload = payload
    throw err
  }
  if (payload && payload.ok === true && payload.data !== undefined) return payload.data
  return payload
}

export function supervisorCopilotEnabledFromLivePayload(data) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data)
}

export function resolveSupervisorCopilotTabVisible(capabilitiesPromise) {
  return Promise.resolve(capabilitiesPromise)
    .then((data) => supervisorCopilotEnabledFromLivePayload(data))
    .catch(() => false)
}

export function isSupervisorCopilotModuleAllowed(session) {
  return getModuleRouteDecisionForSession(SUPERVISOR_COPILOT_MODULE_ID, session) === 'allow'
}

export function resolveSupervisorCopilotTabVisibleForSession(session, loadCapabilities) {
  if (!isSupervisorCopilotModuleAllowed(session)) return Promise.resolve(false)
  if (typeof loadCapabilities !== 'function') return Promise.resolve(false)

  try {
    return resolveSupervisorCopilotTabVisible(loadCapabilities())
  } catch {
    return Promise.resolve(false)
  }
}
