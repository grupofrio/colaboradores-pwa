import { useEffect, useState } from 'react'
import { getUnitTrack } from '../../api.js'
import {
  applyRadarTrailError,
  applyRadarTrailResponse,
  createRadarTrailRequest,
  radarTrailKey,
  selectRadarTrail,
} from './radarTrailState.js'

export function useRadarTrail(planId, operationalDate, { loadTrack = getUnitTrack } = {}) {
  const [state, setState] = useState(() => createRadarTrailRequest(null, null))

  useEffect(() => {
    const request = createRadarTrailRequest(planId, operationalDate)
    setState(request)
    if (!request.key) return undefined

    let cancelled = false
    loadTrack(request.planId, request.operationalDate)
      .then((response) => {
        if (cancelled) return
        setState((prev) => applyRadarTrailResponse(prev, request.key, response))
      })
      .catch(() => {
        if (cancelled) return
        setState((prev) => applyRadarTrailError(prev, request.key))
      })

    return () => { cancelled = true }
  }, [planId, operationalDate, loadTrack])

  const key = radarTrailKey(planId, operationalDate)
  return {
    trail: selectRadarTrail(state, planId, operationalDate),
    trailStatus: key && state?.key === key ? state.status : 'idle',
  }
}
