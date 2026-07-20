// ─── Supervisor V2 · PendientesTab (contenedor) ──────────────────────────────
// Patrón canónico de pestaña: usa el hook de día operativo (fuente ÚNICA
// compartida), gestiona estados con StateScreen y delega el render a la vista
// PURA PendientesView. Los items ya vienen consolidados por derivePendientes
// (autoridad única por tipo). El filtro de tipo vive como estado local de UI.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DayStateGate from '../dayStateGate'
import PendientesView from '../pendientes/PendientesView'
import { useOperationalDay } from '../useOperationalDay'
import { derivePendientes } from '../presentation.js'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function PendientesTab() {
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState(null) // null = todos
  const day = useOperationalDay({ demoEnabled: DEMO })

  if (day.status !== 'live' && day.status !== 'demo') return <DayStateGate day={day} loadingTitle="Cargando pendientes…" />

  const items = derivePendientes(day.dayControl)

  return (
    <PendientesView
      items={items}
      source={day.source}
      nowMs={day.nowMs}
      filterType={filterType}
      onSelectFilter={setFilterType}
      onOpenRoute={(routeId) => navigate(`/equipo/rutas?plan=${routeId}`)}
    />
  )
}
