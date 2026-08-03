import { isOperationalDate } from '../../dayControl/operationalDate.js'
import { normalizeUnitTrack, unitTrackAvailability } from '../../unitTrackState.js'

const isPlanId = (value) => Number.isSafeInteger(value) && value > 0

export function radarTrailKey(planId, operationalDate) {
  if (!isPlanId(planId) || !isOperationalDate(operationalDate)) return null
  return `${planId}:${operationalDate}`
}

export function createRadarTrailRequest(planId, operationalDate) {
  const key = radarTrailKey(planId, operationalDate)
  if (!key) {
    return {
      key: null,
      planId: null,
      operationalDate: null,
      status: 'idle',
      trail: [],
    }
  }

  return {
    key,
    planId,
    operationalDate,
    status: 'loading',
    trail: [],
  }
}

function trackPayload(response) {
  const result = response?.result && typeof response.result === 'object'
    ? response.result
    : response
  return result?.data ?? result?.payload ?? result ?? {}
}

function normalizeRadarTrail(response) {
  if (unitTrackAvailability(response) !== 'ready') return []

  const track = normalizeUnitTrack(trackPayload(response))
  if (!track.trail_available || track.trail.length < 2) return []

  const trail = [...track.trail]
  const lastPoint = trail.at(-1)
  if (track.current && (lastPoint?.lat !== track.current.lat || lastPoint?.lng !== track.current.lng)) {
    trail.push(track.current)
  }
  return trail
}

function acceptsResponse(state, requestKey) {
  return requestKey != null && state?.key === requestKey
}

export function applyRadarTrailResponse(state, requestKey, response) {
  if (!acceptsResponse(state, requestKey)) return state

  return {
    ...state,
    status: unitTrackAvailability(response),
    trail: normalizeRadarTrail(response),
  }
}

export function applyRadarTrailError(state, requestKey) {
  if (!acceptsResponse(state, requestKey)) return state
  return { ...state, status: 'error', trail: [] }
}

export function selectRadarTrail(state, planId, operationalDate) {
  const key = radarTrailKey(planId, operationalDate)
  if (!key || state?.key !== key || !Array.isArray(state.trail) || state.trail.length < 2) return []
  return state.trail
}
