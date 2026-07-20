// ─── Supervisor V2 · PendientesTab (contenedor) ──────────────────────────────
// Patrón canónico de pestaña: usa el hook de día operativo (fuente ÚNICA
// compartida), gestiona estados con StateScreen y delega el render a la vista
// PURA PendientesView. Los items ya vienen consolidados por derivePendientes
// (autoridad única por tipo). El filtro de tipo vive como estado local de UI.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import PendientesView from '../pendientes/PendientesView'
import { useOperationalDay } from '../useOperationalDay'
import { derivePendientes } from '../presentation.js'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function PendientesTab() {
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState(null) // null = todos
  const day = useOperationalDay({ demoEnabled: DEMO })

  if (day.status === 'loading') return <StateScreen title="Cargando pendientes…" detail="Excepciones consolidadas de la jornada." tone="neutral" />
  if (day.status === 'error') return <StateScreen title="No se pudieron cargar los pendientes" detail={day.error} tone="error" actionLabel="Reintentar" onAction={day.reload} />

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
