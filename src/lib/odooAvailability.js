// Classify Odoo outages vs empty operational data. Fail-closed for actions;
// never convert 503/HTML/timeout into $0 or "sin actividad".

export const ODOO_UNAVAILABLE_MESSAGE = 'Servicio de Odoo temporalmente no disponible.'
export const ODOO_INCOMPATIBLE_MESSAGE = 'El backend de Odoo requiere actualización para este catálogo.'
export const AUTO_RETRY_DELAYS_MS = Object.freeze([1500, 4000, 8000])

function asText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export function looksLikeOdooHtml(value) {
  const text = asText(value).toLowerCase()
  if (!text) return false
  return text.includes('odoo.sh')
    || text.includes('platform error')
    || text.includes('service unavailable')
    || (text.includes('<html') && text.includes('odoo'))
}

export function isOdooUnavailableError(error) {
  const status = Number(error?.status || 0)
  if (status === 502 || status === 503 || status === 504) return true
  const code = String(error?.code || '').toLowerCase()
  if (code === 'network' || code === 'timeout' || code === 'odoo_unavailable') return true
  return looksLikeOdooHtml(error?.message)
    || looksLikeOdooHtml(error?.details)
    || looksLikeOdooHtml(error)
}

export function isOdooUnavailablePayload(payload) {
  if (payload == null) return false
  if (typeof payload === 'string') return looksLikeOdooHtml(payload)
  if (typeof payload !== 'object' || Array.isArray(payload)) return false
  return looksLikeOdooHtml(payload.error)
    || looksLikeOdooHtml(payload.message)
    || looksLikeOdooHtml(payload.data)
}

export function unavailableMetric(reason = 'odoo_unavailable') {
  return {
    count: null,
    total: null,
    available: false,
    reason,
  }
}
