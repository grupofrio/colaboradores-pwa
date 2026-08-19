import { createHash } from 'node:crypto'

/** Safe fingerprint for ODOO_PWA_SERVICE_API_KEY — never returns raw value. */
export function fingerprintServiceApiKey(rawValue) {
  const value = rawValue == null ? '' : String(rawValue)
  const trimmed = value.trim()
  if (!trimmed) {
    return {
      present: false,
      len: 0,
      sha256_12: null,
    }
  }

  const digest = createHash('sha256').update(trimmed, 'utf8').digest('hex').slice(0, 12)
  return {
    present: true,
    len: trimmed.length,
    sha256_12: digest,
  }
}

export const ID14_REFERENCE_FINGERPRINT = Object.freeze({
  len: 64,
  sha256_12: '2cba99eea238',
})

export function matchesId14Reference(fingerprint) {
  if (!fingerprint?.present) return false
  return fingerprint.len === ID14_REFERENCE_FINGERPRINT.len
    && fingerprint.sha256_12 === ID14_REFERENCE_FINGERPRINT.sha256_12
}
