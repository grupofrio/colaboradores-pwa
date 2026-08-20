// Estado puro · alta de cliente Supervisor V2 (create).
// name requerido; phone/email/geo opcionales; ambos coords o ninguno.
// NUNCA envía autoridad (branch/company/analytic) — eso es server-side.

function cleanText(value) {
  return String(value ?? '').trim()
}

function cleanNumberText(value) {
  const text = cleanText(value)
  if (!text) return ''
  const number = Number(text)
  return Number.isFinite(number) ? String(number) : text
}

export function buildCustomerCreateDraft(seed = {}) {
  return {
    name: cleanText(seed.name),
    phone: cleanText(seed.phone),
    email: cleanText(seed.email),
    latitude: cleanNumberText(seed.latitude),
    longitude: cleanNumberText(seed.longitude),
  }
}

export function getCustomerCreateValidationError(draft = {}) {
  if (!cleanText(draft.name)) return 'El nombre del cliente es obligatorio.'
  if (cleanText(draft.name).length > 128) return 'El nombre es demasiado largo.'
  const email = cleanText(draft.email)
  if (email && (!email.includes('@') || email.includes(' ') || !email.split('@')[1]?.includes('.'))) {
    return 'Email inválido.'
  }
  const lat = cleanText(draft.latitude)
  const lng = cleanText(draft.longitude)
  if ((lat && !lng) || (!lat && lng)) return 'Latitude y longitude deben enviarse juntos.'
  if (lat && !Number.isFinite(Number(lat))) return 'La latitud debe ser numerica.'
  if (lng && !Number.isFinite(Number(lng))) return 'La longitud debe ser numerica.'
  if (lat && (Number(lat) < -90 || Number(lat) > 90)) return 'Latitud fuera de rango.'
  if (lng && (Number(lng) < -180 || Number(lng) > 180)) return 'Longitud fuera de rango.'
  return ''
}

/** Payload para createSupervisorCustomer — solo allowlist; sin name-edit semantics. */
export function buildSupervisorCustomerCreatePayload(draft = {}) {
  const err = getCustomerCreateValidationError(draft)
  if (err) return { ok: false, error: err, values: null }
  const values = { name: cleanText(draft.name) }
  const phone = cleanText(draft.phone)
  const email = cleanText(draft.email)
  if (phone) values.phone = phone
  if (email) values.email = email
  const lat = cleanText(draft.latitude)
  const lng = cleanText(draft.longitude)
  if (lat && lng) {
    values.latitude = Number(lat)
    values.longitude = Number(lng)
  }
  return { ok: true, error: '', values }
}
