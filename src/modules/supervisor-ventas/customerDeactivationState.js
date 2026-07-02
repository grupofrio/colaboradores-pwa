export const DEFAULT_DEACTIVATION_JOB_CONFIG = {
  sugeyJobIds: ['supervisor_ventas'],
  angelicaJobIds: ['gerente_sucursal'],
}

export const SUGEY_VERIFICATION_RESULTS = {
  confirmed_not_exists: { value: 'confirmed_not_exists', label: 'Confirmado no existe' },
  confirmed_no_purchase: { value: 'confirmed_no_purchase', label: 'Confirmado no quiere comprar' },
  confirmed_address_change: { value: 'confirmed_address_change', label: 'Confirmado cambio domicilio' },
  not_confirmed: { value: 'not_confirmed', label: 'No confirmado' },
  second_visit_required: { value: 'second_visit_required', label: 'Segunda revisita requerida' },
  keep_active: { value: 'keep_active', label: 'Mantener activo' },
  commercial_recovery: { value: 'commercial_recovery', label: 'Enviar a recuperacion comercial' },
}

export const ANGELICA_DECISIONS = {
  approve: { value: 'approve', label: 'Dar visto bueno' },
  reject: { value: 'reject', label: 'Rechazar baja' },
  request_second_verification: { value: 'request_second_verification', label: 'Pedir segunda verificacion' },
  keep_active: { value: 'keep_active', label: 'Mantener activo' },
  commercial_recovery: { value: 'commercial_recovery', label: 'Enviar a recuperacion comercial' },
}

const ANGELICA_DECISIONS_REQUIRING_COMMENT = new Set([
  'reject',
  'request_second_verification',
  'keep_active',
  'commercial_recovery',
])

function addToken(tokens, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => addToken(tokens, item))
    return
  }
  const token = String(value ?? '').trim()
  if (token) tokens.push(token)
}

function uniqueTokens(values) {
  const seen = new Set()
  return values.filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

export function getSessionJobIds(session = {}) {
  const values = []
  addToken(values, session.role)
  addToken(values, session.job_key)
  addToken(values, session.job_id)
  addToken(values, session.additional_job_keys)
  addToken(values, session.additional_roles)
  addToken(values, session.additional_job_ids)
  return uniqueTokens(values)
}

function hasConfiguredJob(session, configuredValues = []) {
  const sessionJobs = new Set(getSessionJobIds(session))
  return configuredValues.some((value) => sessionJobs.has(String(value ?? '').trim()))
}

export function canAccessSugeyDeactivation(session = {}, config = DEFAULT_DEACTIVATION_JOB_CONFIG) {
  return hasConfiguredJob(session, config.sugeyJobIds || [])
}

export function canAccessAngelicaDeactivation(session = {}, config = DEFAULT_DEACTIVATION_JOB_CONFIG) {
  return hasConfiguredJob(session, config.angelicaJobIds || [])
}

function m2oId(value) {
  if (Array.isArray(value)) return Number(value[0] || 0)
  return Number(value || 0)
}

function m2oName(value) {
  if (Array.isArray(value)) return String(value[1] || '')
  return ''
}

function firstText(row, fields) {
  for (const field of fields) {
    const value = row?.[field]
    if (value !== undefined && value !== null && value !== false) return String(value)
  }
  return ''
}

function firstNumber(row, fields) {
  for (const field of fields) {
    const value = Number(row?.[field])
    if (Number.isFinite(value)) return value
  }
  return null
}

export function normalizeDeactivationRequest(row = {}) {
  const partner = row.partner_id || row.customer_id || row.client_id
  const route = row.route_id
  const driver = row.driver_id || row.driver_employee_id || row.user_id

  return {
    id: Number(row.id || 0),
    name: firstText(row, ['name', 'display_name']),
    state: firstText(row, ['state', 'status']),
    partner_id: m2oId(partner),
    partner_name: m2oName(partner) || firstText(row, ['partner_name', 'customer_name', 'client_name']),
    route_name: m2oName(route) || firstText(row, ['route_name', 'route']),
    driver_name: m2oName(driver) || firstText(row, ['driver_name', 'requested_by_name', 'user_name']),
    reason: firstText(row, ['reason', 'reason_code', 'motive']),
    reason_label: firstText(row, ['reason_label', 'motive_label']),
    request_comment: firstText(row, ['request_comment', 'comment', 'initial_comment']),
    request_contact_person: firstText(row, ['request_contact_person', 'contact_person', 'contact_name']),
    request_latitude: firstNumber(row, ['request_latitude', 'latitude', 'lat']),
    request_longitude: firstNumber(row, ['request_longitude', 'longitude', 'lng']),
    request_photo_url: firstText(row, ['request_photo_url', 'photo_url', 'initial_photo_url']),
    requested_at: firstText(row, ['requested_at', 'create_date', 'request_datetime']),
    sugey_result: firstText(row, ['sugey_result', 'supervisor_result']),
    sugey_comment: firstText(row, ['sugey_comment', 'supervisor_comment']),
    sugey_photo_url: firstText(row, ['sugey_photo_url', 'supervisor_photo_url']),
    sugey_latitude: firstNumber(row, ['sugey_latitude', 'supervisor_latitude']),
    sugey_longitude: firstNumber(row, ['sugey_longitude', 'supervisor_longitude']),
    sugey_verified_at: firstText(row, ['sugey_verified_at', 'supervisor_verified_at']),
    angelica_decision: firstText(row, ['angelica_decision', 'corporate_pre_decision']),
    angelica_comment: firstText(row, ['angelica_comment', 'corporate_pre_comment']),
    angelica_decided_at: firstText(row, ['angelica_decided_at', 'corporate_pre_decided_at']),
    age_hours: Number(row.age_hours || 0),
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
  }
}

export function validateSugeyVerificationForm(form = {}) {
  if (!String(form.result || '').trim()) return 'Selecciona el resultado de verificacion.'
  if (!String(form.comment || '').trim()) return 'El comentario es obligatorio.'
  if (!String(form.photoBase64 || '').trim()) return 'La foto es obligatoria.'
  const hasLatitude = form.latitude !== null && form.latitude !== undefined && String(form.latitude).trim() !== ''
  const hasLongitude = form.longitude !== null && form.longitude !== undefined && String(form.longitude).trim() !== ''
  if (!hasLatitude || !hasLongitude || !Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude))) {
    return 'GPS obligatorio para verificar la solicitud.'
  }
  return ''
}

export function validateAngelicaDecisionForm(form = {}) {
  const decision = String(form.decision || '').trim()
  if (!decision) return 'Selecciona una decision.'
  if (ANGELICA_DECISIONS_REQUIRING_COMMENT.has(decision) && !String(form.comment || '').trim()) {
    return 'El comentario es obligatorio para esta decision.'
  }
  return ''
}

function parsePhotoBase64(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return { photo_base64: raw, photo_mime: '' }
  return { photo_base64: match[2] || '', photo_mime: match[1] || '' }
}

export function stripDataUrlBase64(value) {
  return parsePhotoBase64(value).photo_base64
}

export function buildSugeyVerificationPayload(form = {}) {
  const photo = parsePhotoBase64(form.photoBase64)
  return {
    result: String(form.result || '').trim(),
    comment: String(form.comment || '').trim(),
    photo_base64: photo.photo_base64,
    photo_mime: photo.photo_mime,
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    accuracy: form.accuracy === undefined || form.accuracy === null ? null : Number(form.accuracy),
    verified_at: String(form.verifiedAt || '').trim(),
  }
}

export function buildAngelicaDecisionPayload(form = {}) {
  return {
    decision: String(form.decision || '').trim(),
    comment: String(form.comment || '').trim(),
    decided_at: String(form.decidedAt || '').trim(),
  }
}
