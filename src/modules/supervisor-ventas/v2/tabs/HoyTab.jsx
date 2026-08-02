// ─── Supervisor V2 · HoyTab (contenedor) ─────────────────────────────────────
// Patrón canónico de pestaña: usa el hook de día operativo (fuente compartida),
// gestiona estados con StateScreen y delega el render a la vista PURA HoyView.
//
// ESCRITORIO: a partir de DESKTOP_MIN se monta el tablero de 3 columnas (rutas ·
// radar · clientes por visitar) en lugar de la vista de una columna. Es el MISMO
// `day` — un solo fetch compartido, sin recarga por columna — y por debajo del
// breakpoint la experiencia móvil de pestañas queda exactamente igual.
import { useNavigate } from 'react-router-dom'
import DayStateGate from '../dayStateGate'
import HoyView from '../hoy/HoyView'
import { useOperationalDay } from '../useOperationalDay'
import { useIsDesktop } from '../desktop/useDesktopBoard'
import SupervisorDesktopBoard from '../desktop/SupervisorDesktopBoard'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function HoyTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })
  const isDesktop = useIsDesktop()

  if (day.status !== 'live' && day.status !== 'demo') return <DayStateGate day={day} loadingTitle="Cargando el día operativo…" />

  if (isDesktop) {
    return (
      <SupervisorDesktopBoard
        day={day}
        onOpenRoute={(planId) => navigate(planId ? `/equipo/rutas?plan=${planId}` : '/equipo/rutas')}
      />
    )
  }

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
