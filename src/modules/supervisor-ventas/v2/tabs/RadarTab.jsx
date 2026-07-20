// ─── Supervisor V2 · RadarTab (contenedor) ───────────────────────────────────
// Patrón canónico de pestaña (calcado de HoyTab): usa el hook de día operativo
// (fuente compartida), gestiona estados con StateScreen y delega el render a la
// vista PURA RadarView. El estado de orden/selección vive aquí (la vista es pura).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import RadarView from '../radar/RadarView'
import { useOperationalDay } from '../useOperationalDay'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function RadarTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })
  const [order, setOrder] = useState('urgente')
  const [selectedId, setSelectedId] = useState(null)

  if (day.status === 'loading') return <StateScreen title="Cargando el radar de la jornada…" detail="Última posición conocida de cada unidad." tone="neutral" />
  if (day.status === 'error') return <StateScreen title="No se pudo cargar el día operativo" detail={day.error} tone="error" actionLabel="Reintentar" onAction={day.reload} />

  return (
    <RadarView
      radar={day.radar}
      dayControl={day.dayControl}
      radarError={day.radarError}
      source={day.source}
      nowMs={day.nowMs}
      order={order}
      onSelectOrder={setOrder}
      selectedId={selectedId}
      onSelectUnit={setSelectedId}
      onOpenRoute={(planId) => navigate(`/equipo/rutas?plan=${planId}`)}
    />
  )
}
