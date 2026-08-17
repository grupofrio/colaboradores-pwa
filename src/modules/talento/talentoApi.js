// Talento GF — cliente delgado. NO usa lib/api.js (god-object).
// Prefijo /odoo-api → Odoo (igual que talentUploadApi).

const ODOO_BASE = '/odoo-api'

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('gf_session') || '{}')
  } catch {
    return {}
  }
}

function employeeToken(currentSession = null) {
  const session = currentSession && typeof currentSession === 'object' && !Array.isArray(currentSession)
    ? currentSession
    : getSession()
  // `session_token` autentica la sesión general de la PWA, pero no es una
  // capability de empleado para Talento. Nunca lo promovemos a este header.
  return session.odoo_employee_token || session.gf_employee_token || ''
}

export const TALENT_ERROR_MESSAGES = {
  no_session: 'Tu sesión venció. Entra de nuevo.',
  invalid_employee_token: 'Tu sesión venció. Entra de nuevo.',
  talent_access_denied: 'No tienes acceso a Talento RH.',
  applicant_not_found: 'No encontramos ese candidato.',
  feature_disabled: 'Talento RH todavía no está encendido.',
  academy: 'La academia está apagada.',
  no_employee: 'Tu usuario no tiene empleado ligado.',
  invalid_payload: 'La consulta no es válida.',
  internal_error: 'Tuvimos un detalle técnico. Intenta de nuevo.',
  network: 'No hay conexión. Revisa tu red.',
}

/** Contrato PWA ↔ Odoo. El flag de frontend NO autoriza nada. */
export const TALENT_SECTION_ENDPOINTS = {
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

export function mapTalentError(code) {
  return TALENT_ERROR_MESSAGES[code] || TALENT_ERROR_MESSAGES.internal_error
}

export function classifyTalentStatus(err) {
  const code = err?.code
  if (code === 'no_session' || code === 'invalid_employee_token') return 'expired'
  if (code === 'talent_access_denied') return 'unauthorized'
  if (code === 'network') return 'offline'
  return 'error'
}

export function isTalentAuthError(err) {
  const code = err?.code
  return code === 'no_session' || code === 'invalid_employee_token'
}

/**
 * Combina /api/colaborador/capacitacion y /pwa-talento/me.
 * Generales desde /me; pasaporte desde capacitación. Una respuesta
 * parcial no tapa datos válidos de la otra.
 */
export function mergeCapacitacionAndMe(capRes, meRes) {
  const cap = capRes.status === 'fulfilled' ? capRes.value : null
  const me = meRes.status === 'fulfilled' ? meRes.value : null
  const capErr = capRes.status === 'rejected' ? capRes.reason : null
  const meErr = meRes.status === 'rejected' ? meRes.reason : null

  if (!cap && !me) {
    const authBoth = isTalentAuthError(capErr) && isTalentAuthError(meErr)
    const err = capErr || meErr || { code: 'network' }
    return {
      status: authBoth ? 'expired' : classifyTalentStatus(err),
      message: err?.message || mapTalentError(err?.code),
      data: null,
      degraded: { me: true, capacitacion: true },
      errors: { me: meErr, capacitacion: capErr },
    }
  }

  const data = { ...(me || {}) }
  if (cap) {
    data.academy = cap.academy
    data.passport = cap.passport
  } else {
    data.passport = null
  }
  if (!me) {
    delete data.operating
    delete data.induction
    delete data.labor_state
    delete data.first_day_state
    delete data.payroll
  }

  return {
    status: 'ready',
    message: '',
    data,
    degraded: { me: !me, capacitacion: !cap },
    errors: {
      me: meErr ? (meErr.message || mapTalentError(meErr.code)) : null,
      capacitacion: capErr ? (capErr.message || mapTalentError(capErr.code)) : null,
    },
  }
}

export async function talentFetch(path, currentSession = null) {
  const token = employeeToken(currentSession)
  const res = await fetch(`${ODOO_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-GF-Employee-Token': token,
    },
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = { ok: false, error: 'internal_error' }
  }
  if (!res.ok || data.ok === false) {
    const error = new Error(mapTalentError(data.error))
    error.code = data.error || 'http_error'
    error.status = res.status
    throw error
  }
  return data
}

export function fetchMe(currentSession = null) {
  return talentFetch('/pwa-talento/me', currentSession)
}

export function fetchCapacitacion() {
  return talentFetch('/api/colaborador/capacitacion')
}

export function fetchInbox() {
  return talentFetch('/pwa-talento/rh/inbox')
}

export function fetchPipeline(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const suffix = qs.toString() ? `?${qs}` : ''
  return talentFetch(`/pwa-talento/rh/pipeline${suffix}`)
}

export function fetchWorklist(params = {}) {
  const qs = new URLSearchParams(params)
  const suffix = qs.toString() ? `?${qs}` : ''
  return talentFetch(`/pwa-talento/rh/worklist${suffix}`)
}

export function fetchApplicant(id) {
  return talentFetch(`/pwa-talento/rh/applicants/${encodeURIComponent(id)}`)
}

export function fetchVacancies() {
  return talentFetch('/pwa-talento/rh/vacancies')
}

export function fetchRequisitions() {
  return talentFetch('/pwa-talento/rh/requisitions')
}

export function fetchInterviews() {
  return talentFetch('/pwa-talento/rh/interviews')
}

export function fetchAnalytics() {
  return talentFetch('/pwa-talento/rh/analytics')
}
