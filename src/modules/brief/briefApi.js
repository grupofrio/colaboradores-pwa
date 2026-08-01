// ─── Brief del día — cliente HTTP (Fase B) ───────────────────────────────────
// CONTRATO con n8n (workflow W_BRIEF_AIDA, id FBgvKJZVUyq7yA66):
//
//   GET /api-n8n/brief-aida
//   Header: X-GF-Employee-Token: <session.odoo_employee_token>
//   200 text/html  → documento autocontenido (dark dashboard, ~32KB)
//   401            → token ausente / vencido / revocado
//   403            → token válido pero el rol del empleado no está autorizado
//
// La PWA NO manda employee_id, rol ni sucursal. No serían prueba de nada: el
// `session_token` que vive en localStorage es un JWT alg:"none" fabricado en el
// navegador (ver ScreenLogin.buildLocalSessionToken), así que su payload es una
// auto-declaración, no una credencial. La ÚNICA prueba de identidad que la PWA
// posee es el gf_employee_token, que Odoo emitió en el sign-in y que el endpoint
// valida contra gf.employee.mobile.session. De ese empleado —y solo de él— el
// backend deriva rol y sucursal.
//
// Módulo PURO (sin React) para poder testearse con node:test.

export const BRIEF_PATH = '/api-n8n/brief-aida'

// Techo defensivo: el brief pesa ~32KB. Si algún día llega algo de otro orden de
// magnitud, no lo montamos en memoria — preferimos declarar el fallo.
export const MAX_BRIEF_BYTES = 2 * 1024 * 1024

// Estados posibles del resultado. Cada uno tiene su propia salida en la UI: no
// se colapsan en un "error" genérico porque no se resuelven igual.
//   ok           → HTML listo para montar
//   bypass       → sesión de bypass admin: NO tiene gf_employee_token
//   no_session   → sesión sin token de empleado (o inválida)
//   unauthorized → 401: el backend rechazó el token
//   forbidden    → 403: identidad válida, rol no autorizado
//   unavailable  → red caída, 5xx, respuesta con forma inesperada
export const BRIEF_STATE = Object.freeze({
  OK: 'ok',
  BYPASS: 'bypass',
  NO_SESSION: 'no_session',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  UNAVAILABLE: 'unavailable',
})

/** Token de empleado emitido por Odoo en el sign-in. Fail-closed: '' si falta. */
export function readEmployeeToken(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return ''
  const token = session.odoo_employee_token || session.gf_employee_token || ''
  return typeof token === 'string' ? token.trim() : ''
}

/** ¿Es una sesión de bypass admin (mock local, sin credencial real)? */
export function isBypassSession(session) {
  return Boolean(session) && typeof session === 'object' && session._bypass === true
}

function fail(state, reason, status = 0) {
  return { state, html: '', reason, status }
}

/**
 * Pide el brief al endpoint autenticado.
 *
 * No lanza: devuelve SIEMPRE { state, html, reason, status } para que la
 * pantalla decida qué mostrar. Un throw aquí terminaría como pantalla en blanco.
 */
export async function fetchBriefHtml({ session, fetchImpl, signal } = {}) {
  // El bypass admin se revisa ANTES que el token: esas sesiones se fabrican en
  // el cliente (buildMockSession) y nunca tuvieron gf_employee_token, así que
  // reportarlas como "sesión vencida" mandaría a re-loguearse a alguien que ya
  // está dentro. El mensaje correcto es "entra con tu PIN real".
  if (isBypassSession(session)) return fail(BRIEF_STATE.BYPASS, 'bypass_session')

  const token = readEmployeeToken(session)
  if (!token) return fail(BRIEF_STATE.NO_SESSION, 'missing_employee_token')

  const doFetch = fetchImpl || (typeof globalThis !== 'undefined' ? globalThis.fetch : null)
  if (typeof doFetch !== 'function') return fail(BRIEF_STATE.UNAVAILABLE, 'no_fetch')

  let res
  try {
    res = await doFetch(BRIEF_PATH, {
      method: 'GET',
      headers: {
        'X-GF-Employee-Token': token,
        Accept: 'text/html',
      },
      signal,
      cache: 'no-store',
      credentials: 'omit',
    })
  } catch (err) {
    if (err?.name === 'AbortError') return fail(BRIEF_STATE.UNAVAILABLE, 'aborted')
    return fail(BRIEF_STATE.UNAVAILABLE, 'network')
  }

  const status = Number(res?.status) || 0
  if (status === 401) return fail(BRIEF_STATE.UNAUTHORIZED, 'unauthorized', status)
  if (status === 403) return fail(BRIEF_STATE.FORBIDDEN, 'forbidden', status)
  if (!res?.ok) return fail(BRIEF_STATE.UNAVAILABLE, 'http_error', status)

  // Un 200 con JSON es un error disfrazado (n8n responde 200 por defecto en
  // varias rutas de fallo). Si no es HTML, no lo montamos.
  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase()
  if (!contentType.includes('text/html')) {
    return fail(BRIEF_STATE.UNAVAILABLE, 'bad_content_type', status)
  }

  let html
  try {
    html = await res.text()
  } catch {
    return fail(BRIEF_STATE.UNAVAILABLE, 'body_read_error', status)
  }

  if (typeof html !== 'string' || html.trim() === '') {
    return fail(BRIEF_STATE.UNAVAILABLE, 'empty_body', status)
  }
  if (html.length > MAX_BRIEF_BYTES) {
    return fail(BRIEF_STATE.UNAVAILABLE, 'too_large', status)
  }

  return { state: BRIEF_STATE.OK, html, reason: '', status }
}
