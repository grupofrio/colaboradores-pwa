import { buildUnitTrackBounds } from './unitTrackState.js'

const DISPLAYABLE_UNIT_TRACK_STATES = new Set(['ready', 'empty'])

export function canRenderUnitTrackMap({ routePlanId, unitTrackPlanId, unitTrackState, unitTrack }) {
  return (
    routePlanId === unitTrackPlanId
    && DISPLAYABLE_UNIT_TRACK_STATES.has(unitTrackState)
    && buildUnitTrackBounds(unitTrack).length > 0
  )
}

export function createUnitTrackRequestGate() {
  let currentRequestId = 0

  return {
    start() {
      currentRequestId += 1
      return currentRequestId
    },
    invalidate() {
      currentRequestId += 1
    },
    isCurrent(requestId) {
      return requestId === currentRequestId
    },
  }
}

export async function retryUnitTrackRequest({
  requestGate,
  requestId,
  routePlanId,
  api,
  onResponse,
  onError,
}) {
  try {
    const response = await api.getUnitTrack(routePlanId)
    if (requestGate.isCurrent(requestId)) onResponse(response)
  } catch (error) {
    if (requestGate.isCurrent(requestId)) onError(error)
  }
}

export function loadRouteStopsWithUnitTrack({
  requestGate,
  requestId,
  routePlanId,
  getRouteStops,
  api,
  onTrackResponse,
  onTrackError,
}) {
  const stopsPromise = getRouteStops(routePlanId)

  void retryUnitTrackRequest({
    requestGate,
    requestId,
    routePlanId,
    api,
    onResponse: onTrackResponse,
    onError: onTrackError,
  })

  return stopsPromise
}
