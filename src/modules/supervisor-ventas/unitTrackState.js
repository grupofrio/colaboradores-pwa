/**
 * Public track shape:
 * { current, trail, trail_available, stops }, where points use numeric { lat, lng }
 * and stops retain their flat planned_* and checkin_* coordinate pairs separately.
 */

const POINT_METADATA = ['captured_at', 'recorded_at', 'timestamp', 'accuracy', 'accuracy_meters', 'heading', 'speed']

export function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number'
    && typeof lng === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && (lat !== 0 || lng !== 0)
  )
}

function coordinateValues(value, latKey = 'lat', lngKey = 'lng') {
  if (!value || typeof value !== 'object') return null

  const lat = value[latKey] ?? (latKey === 'lat' ? value.latitude : undefined)
  const lng = value[lngKey] ?? (lngKey === 'lng' ? value.longitude : undefined)
  return isValidCoordinate(lat, lng) ? { lat, lng } : null
}

function normalizePoint(value) {
  const coordinates = coordinateValues(value)
  if (!coordinates) return null

  const point = { ...coordinates }
  for (const key of POINT_METADATA) {
    if (value[key] !== undefined) point[key] = value[key]
  }
  return point
}

function normalizeStop(stop) {
  if (!stop || typeof stop !== 'object') return null

  const planned = coordinateValues(stop, 'planned_lat', 'planned_lng')
    ?? coordinateValues(stop.planned ?? stop.planned_location)
  const checkin = coordinateValues(stop, 'checkin_lat', 'checkin_lng')
    ?? coordinateValues(stop.checkin ?? stop.checkin_location)

  if (!planned && !checkin) return null

  return {
    sequence: stop.sequence ?? stop.seq ?? stop.order,
    name: stop.name,
    done: stop.done,
    result_status: stop.result_status,
    arrived_at: stop.arrived_at,
    planned_lat: planned?.lat,
    planned_lng: planned?.lng,
    checkin_lat: checkin?.lat,
    checkin_lng: checkin?.lng,
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function normalizeUnitTrack(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const trailSource = source.trail ?? source.locations ?? source.history
  const trailAvailable = source.trail_available === false
    ? false
    : Array.isArray(trailSource)

  return {
    current: normalizePoint(source.current ?? source.current_position ?? source.location),
    trail: trailAvailable ? asArray(trailSource).map(normalizePoint).filter(Boolean) : [],
    trail_available: trailAvailable,
    stops: asArray(source.stops ?? source.route_stops).map(normalizeStop).filter(Boolean),
  }
}

export function buildUnitTrackBounds(track) {
  const normalized = track && typeof track === 'object' ? track : {}
  const bounds = []

  const add = (lat, lng) => {
    if (isValidCoordinate(lat, lng)) bounds.push([lat, lng])
  }

  add(normalized.current?.lat, normalized.current?.lng)
  for (const point of asArray(normalized.trail)) add(point?.lat, point?.lng)
  for (const stop of asArray(normalized.stops)) {
    add(stop?.planned_lat, stop?.planned_lng)
    add(stop?.checkin_lat, stop?.checkin_lng)
  }

  return bounds
}

function responseCode(response) {
  const code = response?.error?.code
    ?? response?.error?.status
    ?? response?.error_code
    ?? response?.code
    ?? response?.status_code
    ?? response?.status
    ?? response?.data?.error?.code
    ?? response?.data?.error?.status
    ?? response?.data?.code
    ?? response?.data?.status
    ?? response?.payload?.error?.code
    ?? response?.payload?.error?.status
    ?? response?.payload?.code
    ?? response?.payload?.status
  return typeof code === 'string' ? code.toUpperCase() : ''
}

export function unitTrackAvailability(response) {
  const result = response?.result && typeof response.result === 'object'
    ? response.result
    : response
  const code = responseCode(result)
  if (code === 'FEATURE_DISABLED') return 'disabled'
  if (code === 'FORBIDDEN') return 'forbidden'
  if (code === 'DATE_NOT_ALLOWED') return 'date_not_allowed'

  if (!response?.result && response?.error) return 'error'
  if (!result || typeof result !== 'object') return 'error'
  if (typeof result.status === 'string' && result.status.toUpperCase() === 'ERROR') return 'error'
  if (result.ok === false || result.success === false || Number(result.status) >= 400) return 'error'

  const payload = result.data ?? result.payload ?? result
  return buildUnitTrackBounds(normalizeUnitTrack(payload)).length > 0 ? 'ready' : 'empty'
}
