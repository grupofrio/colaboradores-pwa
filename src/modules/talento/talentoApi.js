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

function employeeToken() {
  const session = getSession()
  return session.odoo_employee_token || session.gf_employee_token || session.session_token || ''
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

export async function talentFetch(path) {
  const token = employeeToken()
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

export function fetchMe() {
  return talentFetch('/pwa-talento/me')
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
