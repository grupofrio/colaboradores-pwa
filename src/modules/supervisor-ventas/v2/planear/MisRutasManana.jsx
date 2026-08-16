// ─── Supervisor V2 · "Mis rutas de mañana" (contenedor) ──────────────────────
// PORTADA = matriz semanal de cumplimiento (RutasMananaMatriz). Al pulsar
// Asignar/Reasignar en una fila se entra al flujo existente de armar → asignar →
// publicar (PlanearMananaTab) para la ruta de mañana de esa fila. El switch va
// por query param (?armar=1&route=<id>) para que el "atrás" del navegador
// funcione y la matriz sea la vista por defecto.
import { useSearchParams } from 'react-router-dom'

import RutasMananaMatriz from './RutasMananaMatriz'
import PlanearMananaTab from './PlanearMananaTab'
import { encodeSourcesParam, decodeSourcesParam, rowZone } from './routesWeekModel'

function zoneFromSources(sources) {
  const zone = { subpolygonId: 0, polygonId: 0, segmentId: 0 }
  for (const src of sources || []) {
    const next = rowZone(src)
    if (next.subpolygonId) zone.subpolygonId = next.subpolygonId
    if (next.polygonId && !zone.polygonId) zone.polygonId = next.polygonId
    if (next.segmentId && !zone.segmentId) zone.segmentId = next.segmentId
  }
  return zone
}

export default function MisRutasManana() {
  const [params, setParams] = useSearchParams()
  const armar = params.get('armar')

  if (armar) {
    const routeId = Number(params.get('route') || 0) || 0
    const sources = decodeSourcesParam(params.get('src'))
    const zone = sources.length ? zoneFromSources(sources) : {
      polygonId: Number(params.get('poly') || 0) || 0,
      subpolygonId: Number(params.get('sub') || 0) || 0,
      segmentId: Number(params.get('seg') || 0) || 0,
    }
    return (
      <PlanearMananaTab
        initialRouteId={routeId}
        initialPolygonId={zone.polygonId}
        initialSubpolygonId={zone.subpolygonId}
        initialSegmentId={zone.segmentId}
        initialSources={sources}
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
        const routeId = sources.find((s) => s.routeId)?.routeId || 0
        goArmar(routeId, zoneFromSources(sources), sources)
      }}
    />
  )
}
