export const FAVY_CEDIS_GEOFENCE = {
  latitude: 19.411386,
  longitude: -99.147021,
  maxDistanceMeters: 50,
  maxAccuracyMeters: 25,
}

const EARTH_RADIUS_METERS = 6371000

function toRadians(value) {
  return (value * Math.PI) / 180
}

export function getFavyCedisDistanceMeters(latitude, longitude) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const deltaLat = toRadians(FAVY_CEDIS_GEOFENCE.latitude - lat)
  const deltaLon = toRadians(FAVY_CEDIS_GEOFENCE.longitude - lon)
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat))
    * Math.cos(toRadians(FAVY_CEDIS_GEOFENCE.latitude))
    * Math.sin(deltaLon / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function validateCupQuantity(value) {
  const qty = Number(value)
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, code: 'INVALID_QTY', message: 'Captura una cantidad entera mayor a cero.' }
  }
  return { ok: true, qty }
}

export function validateAttendancePreflight({ selfie, facade, latitude, longitude, accuracy } = {}) {
  if (!selfie) return { ok: false, code: 'SELFIE_REQUIRED', message: 'La foto de la colaboradora es obligatoria.' }
  if (!facade) return { ok: false, code: 'FACADE_REQUIRED', message: 'La foto de la fachada es obligatoria.' }

  const accuracyMeters = Number(accuracy)
  const distanceMeters = getFavyCedisDistanceMeters(latitude, longitude)
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'No fue posible obtener una ubicacion valida.' }
  }
  if (accuracyMeters > FAVY_CEDIS_GEOFENCE.maxAccuracyMeters) {
    return {
      ok: false,
      code: 'GPS_IMPRECISE',
      message: 'La precision de ubicacion debe ser de 25 metros o menos.',
      accuracyMeters,
    }
  }
  if (distanceMeters === null) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'No fue posible obtener una ubicacion valida.' }
  }
  if (distanceMeters > FAVY_CEDIS_GEOFENCE.maxDistanceMeters) {
    return {
      ok: false,
      code: 'OUTSIDE_CEDIS',
      message: 'Debes estar a 50 metros o menos del CEDIS para iniciar labores.',
      distanceMeters,
      accuracyMeters,
    }
  }
  return { ok: true, distanceMeters, accuracyMeters }
}
