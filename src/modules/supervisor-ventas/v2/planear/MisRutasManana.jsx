// ─── Supervisor V2 · "Mis rutas de mañana" (contenedor) ──────────────────────
// PORTADA = matriz semanal de cumplimiento (RutasMananaMatriz). Al pulsar
// Asignar/Reasignar en una fila se entra al flujo existente de armar → asignar →
// publicar (PlanearMananaTab) para la ruta de mañana de esa fila. El switch va
// por query param (?armar=1&route=<id>) para que el "atrás" del navegador
// funcione y la matriz sea la vista por defecto.
import { useSearchParams } from 'react-router-dom'

import RutasMananaMatriz from './RutasMananaMatriz'
import PlanearMananaTab from './PlanearMananaTab'

export default function MisRutasManana() {
  const [params, setParams] = useSearchParams()
  const armar = params.get('armar')

  if (armar) {
    const routeId = Number(params.get('route') || 0) || 0
    return (
      <PlanearMananaTab
        initialRouteId={routeId}
        initialPolygonId={Number(params.get('poly') || 0) || 0}
        initialSubpolygonId={Number(params.get('sub') || 0) || 0}
        onExit={() => setParams({}, { replace: true })}
      />
    )
  }

  return (
    <RutasMananaMatriz
      onOpenRoute={(routeId, zone) => {
        // Hereda la zona (polígono/subpolígono) de la fila para preseleccionarla
        // al armar la propuesta; así la supervisora no re-elige la zona a mano.
        const next = { armar: '1' }
        if (routeId) next.route = String(routeId)
        if (zone?.polygonId) next.poly = String(zone.polygonId)
        if (zone?.subpolygonId) next.sub = String(zone.subpolygonId)
        setParams(next)
      }}
    />
  )
}
