// ─── Supervisor V2 · "Mis rutas de mañana" (contenedor) ──────────────────────
// PORTADA = matriz semanal de cumplimiento (RutasMananaMatriz). Al pulsar
// Asignar/Reasignar en una fila se entra al flujo existente de armar → asignar →
// publicar (PlanearMananaTab) para la ruta de mañana de esa fila. El switch va
// por query param (?armar=1&route=<id>) para que el "atrás" del navegador
// funcione y la matriz sea la vista por defecto.
import { useSearchParams } from 'react-router-dom'

import RutasMananaMatriz from './RutasMananaMatriz'
import PlanearMananaTab from './PlanearMananaTab'
import {
  encodeSourcesParam,
  resolveArmarZone,
  zoneFromSources,
  resolveTargetRouteId,
  assertSourcesZoneCompatible,
} from './routesWeekModel'

export default function MisRutasManana() {
  const [params, setParams] = useSearchParams()
  const armar = params.get('armar')

  if (armar) {
    const routeId = Number(params.get('route') || 0) || 0
    const zone = resolveArmarZone({
      poly: params.get('poly'),
      sub: params.get('sub'),
      seg: params.get('seg'),
      src: params.get('src'),
    })
    return (
      <PlanearMananaTab
        initialRouteId={routeId}
        initialPolygonId={zone.polygonId}
        initialSubpolygonId={zone.subpolygonId}
        initialSegmentId={zone.segmentId}
        initialSources={zone.sources}
        initialLeadId={Number(params.get('lead') || 0) || 0}
        onExit={() => setParams({}, { replace: true })}
      />
    )
  }

  const goArmar = (routeId, zone, sources) => {
    const next = { armar: '1' }
    if (routeId) next.route = String(routeId)
    if (zone?.polygonId) next.poly = String(zone.polygonId)
    if (zone?.subpolygonId) next.sub = String(zone.subpolygonId)
    if (zone?.segmentId) next.seg = String(zone.segmentId)
    if (sources?.length) next.src = encodeSourcesParam(sources)
    setParams(next)
  }

  return (
    <RutasMananaMatriz
      onOpenRoute={(routeId, zone, rows) => goArmar(routeId, zone, rows)}
      onArmarSources={(sources) => {
        const zoneCheck = assertSourcesZoneCompatible(sources)
        if (zoneCheck.error) return zoneCheck.error
        const resolved = resolveTargetRouteId(sources)
        if (resolved.error) return resolved.error
        goArmar(resolved.routeId, zoneFromSources(sources), sources)
        return null
      }}
    />
  )
}
