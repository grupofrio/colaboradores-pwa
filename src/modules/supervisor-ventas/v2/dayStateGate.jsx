// ─── Supervisor V2 · guard de estados de carga del día (compartido) ──────────
// Homogeneiza loading / error / DATE_NOT_ALLOWED / unauthorized en las 6
// superficies (Codex P14): un único punto que decide el estado NO-éxito. Devuelve
// un StateScreen o null (=> la superficie renderiza su vista). DATE_NOT_ALLOWED
// es explícito: no cae a error genérico, no a fecha actual, no a demo.
import StateScreen from '../../../components/kold/StateScreen'

export default function DayStateGate({ day, loadingTitle = 'Cargando…' }) {
  if (!day || day.status === 'loading') {
    return <StateScreen title={loadingTitle} tone="neutral" />
  }
  if (day.status === 'date_not_allowed') {
    return (
      <StateScreen
        testid="v2-date-not-allowed"
        title="Fecha no permitida"
        detail="Esta superficie solo opera sobre la jornada actual de la sucursal. Vuelve al día de hoy."
        tone="warning"
        actionLabel="Ir a hoy"
        actionHref="/equipo"
      />
    )
  }
  if (day.status === 'error') {
    return (
      <StateScreen
        title="No se pudo cargar el día operativo"
        detail={day.error}
        tone="error"
        actionLabel="Reintentar"
        onAction={day.reload}
      />
    )
  }
  return null // live / demo ⇒ la superficie renderiza su vista
}
