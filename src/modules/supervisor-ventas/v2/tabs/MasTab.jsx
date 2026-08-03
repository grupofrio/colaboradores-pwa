// ─── Supervisor V2 · MasTab (contenedor) ─────────────────────────────────────
// Los accesos de "Más" son estáticos, pero Codex §13 exige que DATE_NOT_ALLOWED
// se refleje TAMBIÉN aquí: si la jornada no es la permitida, no se enlazan
// acciones dependientes de la fecha (planeación) — se muestra el estado. En
// loading/error NO se bloquea (Más es la nav de respaldo y sus accesos de
// desempeño/clientes no dependen de la jornada).
import { useNavigate } from 'react-router-dom'
import DayStateGate from '../dayStateGate'
import MasView from '../mas/MasView'
import { useOperationalDay } from '../useOperationalDay'

const DEMO = (() => { try { return import.meta.env?.DEV === true } catch { return false } })()

export default function MasTab() {
  const navigate = useNavigate()
  const day = useOperationalDay({ demoEnabled: DEMO })
  if (day.status === 'date_not_allowed') return <DayStateGate day={day} />
  return <MasView onNavigate={navigate} />
}
