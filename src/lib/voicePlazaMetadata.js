// Non-authoritative plaza hint for the voice PoC (W120 catalog lookup).
// A warehouse ID or display name never grants PWA access, navigation, or scope.
// Authorization reads GET /pwa-admin/capabilities only.

const VOICE_PLAZA_HINT_BY_WAREHOUSE = Object.freeze({
  49: 'IGUALA', 50: 'IGUALA', 51: 'IGUALA', 52: 'IGUALA', 53: 'IGUALA',
  54: 'IGUALA', 76: 'IGUALA', 89: 'IGUALA',
  98: 'CDMX',
  2: 'MORELIA', 45: 'MORELIA', 46: 'MORELIA', 47: 'MORELIA', 48: 'MORELIA',
  55: 'GUADALAJARA', 56: 'GUADALAJARA', 94: 'GUADALAJARA', 113: 'GUADALAJARA',
  57: 'TOLUCA', 58: 'TOLUCA', 59: 'TOLUCA',
  60: 'ZIHUATANEJO', 61: 'ZIHUATANEJO',
  62: 'MANZANILLO',
})

export function voicePlazaHintFromWarehouse(warehouseId) {
  const id = Number(warehouseId || 0)
  if (!id || !Object.prototype.hasOwnProperty.call(VOICE_PLAZA_HINT_BY_WAREHOUSE, id)) {
    return null
  }
  return VOICE_PLAZA_HINT_BY_WAREHOUSE[id]
}

export function voicePlazaHintNeverAuthorizes() {
  return true
}
