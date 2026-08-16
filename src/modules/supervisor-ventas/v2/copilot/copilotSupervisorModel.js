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
