// ─── Supervisor V2 · HoyTab (contenedor) ─────────────────────────────────────
// Patrón canónico de pestaña: usa el hook de día operativo (fuente compartida),
// gestiona estados con StateScreen y delega el render a la vista PURA HoyView.
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../../components/kold/StateScreen'
import HoyView from '../hoy/HoyView'
import { useOperationalDay } from '../useOperationalDay'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function HoyTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })

  if (day.status === 'loading') return <StateScreen title="Cargando el día operativo…" detail="Venta, rutas y pendientes." tone="neutral" />
  if (day.status === 'error') return <StateScreen title="No se pudo cargar el día operativo" detail={day.error} tone="error" actionLabel="Reintentar" onAction={day.reload} />

  return (
    <HoyView
      dayControl={day.dayControl}
      radar={day.radar}
      radarError={day.radarError}
      source={day.source}
      provenance={day.provenance}
      nowMs={day.nowMs}
      onRefresh={day.reload}
      onOpenPendientes={() => navigate('/equipo/pendientes')}
      onOpenPriority={(p) => navigate(p?.route_id ? `/equipo/rutas?plan=${p.route_id}` : '/equipo/pendientes')}
    />
  )
}
