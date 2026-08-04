// ─── Supervisor V2 · RadarTab (contenedor) ───────────────────────────────────
// Patrón canónico de pestaña (calcado de HoyTab): usa el hook de día operativo
// (fuente compartida), gestiona estados con StateScreen y delega el render a la
// vista PURA RadarView. El estado de orden/selección vive aquí (la vista es pura).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUnitTrack } from '../../api.js'
import DayStateGate from '../dayStateGate'
import RadarView from '../radar/RadarView'
import { resolveActivePlanId } from '../radar/radarSelection.js'
import {
  applyRadarTrailError,
  applyRadarTrailResponse,
  createRadarTrailRequest,
  selectRadarTrail,
} from '../radar/radarTrailState.js'
import { useOperationalDay } from '../useOperationalDay'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function RadarTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [order, setOrder] = useState('urgente')
  const [selectedId, setSelectedId] = useState(null)
  const [trailState, setTrailState] = useState(() => createRadarTrailRequest(null, null))
  const activePlanId = resolveActivePlanId(day.radar?.units, selectedId)
  const operationalDate = day.dayControl?.date
  const trail = selectRadarTrail(trailState, activePlanId, operationalDate)
  const trailStatus = trailState?.key === `${activePlanId}:${operationalDate}` ? trailState.status : 'idle'

  useEffect(() => {
    const request = createRadarTrailRequest(activePlanId, operationalDate)
    setTrailState(request)
    if (!request.key) return undefined

    let cancelled = false
    getUnitTrack(request.planId, request.operationalDate)
      .then((response) => {
        if (cancelled) return
        setTrailState((state) => applyRadarTrailResponse(state, request.key, response))
      })
      .catch(() => {
        if (cancelled) return
        setTrailState((state) => applyRadarTrailError(state, request.key))
      })

    return () => { cancelled = true }
  }, [activePlanId, operationalDate])

  if (day.status !== 'live' && day.status !== 'demo') return <DayStateGate day={day} loadingTitle="Cargando el radar de la jornada…" />

  return (
    <RadarView
      radar={day.radar}
      dayControl={day.dayControl}
      radarError={day.radarError}
      source={day.source}
      nowMs={day.nowMs}
      trail={trail}
      trailStatus={trailStatus}
      order={order}
      onSelectOrder={setOrder}
      selectedId={selectedId}
      onSelectUnit={setSelectedId}
      onOpenRoute={(planId) => navigate(`/equipo/rutas?plan=${planId}`)}
    />
  )
}
