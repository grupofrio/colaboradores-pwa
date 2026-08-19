/**
 * Strip API keys / bearer secrets from user-visible auth errors.
 * Odoo auth_api_key historically embeds the raw key in:
 *   "The key <secret> is not allowed"
 * That must never reach the browser UI or logs the user can see.
 */

const KEY_IN_MESSAGE = /(?:the\s+key|api[-_\s]?key|clave)\s*[:=]?\s*['"]?([A-Za-z0-9_\-]{8,})['"]?/gi
const LONG_TOKEN = /\b[A-Za-z0-9_\-]{24,}\b/g

export const SAFE_AUTH_ERROR_MESSAGE = 'No se pudo autenticar el servicio. Intenta de nuevo o reporta el problema.'

export function sanitizeAuthErrorMessage(raw, { fallback = SAFE_AUTH_ERROR_MESSAGE } = {}) {
  if (raw == null) return fallback
  let text = typeof raw === 'string' ? raw : String(raw)
  if (!text.trim()) return fallback

  const lower = text.toLowerCase()
  const looksLikeSecretLeak =
    /the\s+key\s+.+\s+is\s+not\s+allowed/i.test(text)
    || /api[-_\s]?key/i.test(text) && /not allowed|requerida|invalid|denied/i.test(text)
    || KEY_IN_MESSAGE.test(text)

  // Reset lastIndex after .test on global regex
  KEY_IN_MESSAGE.lastIndex = 0

  if (looksLikeSecretLeak) {
    // Preserve the non-secret "API key requerida." copy when no secret is present.
    if (/^api key requerida\.?$/i.test(text.trim()) || /^api[-_\s]?key requerida\.?$/i.test(text.trim())) {
      return 'No se pudo autenticar el servicio (credencial de servicio).'
    }
    return fallback
  }

  // Defense in depth: scrub long opaque tokens even in other messages.
  text = text.replace(LONG_TOKEN, '[REDACTED]')
  if (lower.includes('api-key') || lower.includes('api_key')) {
    text = text.replace(KEY_IN_MESSAGE, 'API key [REDACTED]')
  }
  return text
}

/**
 * Sanitize an upstream proxy body (JSON or HTML/text) before it reaches the browser.
 * Never throws. Returns { body: Buffer|string, contentType, redacted: boolean }.
 */
export function sanitizeUpstreamAuthBody(body, contentType = '') {
  const ctype = String(contentType || '').toLowerCase()
  const asString = Buffer.isBuffer(body)
    ? body.toString('utf8')
    : String(body ?? '')

  if (!asString) {
    return { body: body ?? '', contentType, redacted: false }
  }

  const hasLeak = /the\s+key\s+[A-Za-z0-9_\-]{6,}\s+is\s+not\s+allowed/i.test(asString)
    || (/api[-_\s]?key/i.test(asString) && /[A-Za-z0-9_\-]{20,}/.test(asString)
      && /not allowed|invalid|denied|forbidden/i.test(asString))

  if (!hasLeak) {
    return { body, contentType, redacted: false }
  }

  if (ctype.includes('application/json') || asString.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(asString)
      const scrub = (value) => {
        if (typeof value === 'string') return sanitizeAuthErrorMessage(value)
        if (Array.isArray(value)) return value.map(scrub)
        if (value && typeof value === 'object') {
          const out = {}
          for (const [k, v] of Object.entries(value)) out[k] = scrub(v)
          return out
        }
        return value
      }
      const clean = scrub(parsed)
      if (typeof clean.message === 'string') {
        clean.message = sanitizeAuthErrorMessage(clean.message)
      }
      const encoded = JSON.stringify(clean)
      return {
        body: Buffer.from(encoded, 'utf8'),
        contentType: 'application/json',
        redacted: true,
      }
    } catch {
      // fall through to text/html sanitization
    }
  }

  // HTML / plain text from Odoo ValidationError pages
  const safeHtml = [
    '<!doctype html><html lang="es"><title>Error de autenticación</title>',
    '<body><h1>Error de autenticación</h1>',
    `<p>${SAFE_AUTH_ERROR_MESSAGE}</p></body></html>`,
  ].join('')
  return {
    body: Buffer.from(safeHtml, 'utf8'),
    contentType: 'text/html; charset=utf-8',
    redacted: true,
  }
}
