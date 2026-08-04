import { lazy, Suspense } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { computeBounds, validPoints } from './mapProjection.js'

const C = TOKENS.colors
const LeafletPositionMap = lazy(() => import('./LeafletPositionMap.jsx'))
const MAP_KINDS = new Set(['unit', 'unit_stale', 'stop_done', 'stop_pending'])

function isMappablePoint(point) {
  return MAP_KINDS.has(point.kind)
}

function EmptyMap({ testid, height, note }) {
  return (
    <div data-testid={`${testid}-empty`} style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: TOKENS.radius.md, color: C.textMuted, fontSize: 13, padding: 16,
    }}>{note}</div>
  )
}

function LoadingMap({ testid, height }) {
  return (
    <div data-testid={testid} role="status" aria-live="polite" style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, color: C.textMuted, fontSize: 13, padding: 16,
    }}>Cargando las últimas posiciones conocidas del plan. El mapa vial estará disponible en el navegador.</div>
  )
}

// Límite SSR: valida geometría sin cargar Leaflet. En servidor no se intenta
// representar cartografía; el navegador carga el mapa vial de manera diferida.
export default function PositionMap({
  points = [], trail = [], selectedId = null, onSelect, height = 300, backdropUrl = null, width = 640, testid = 'v2-position-map',
  showUnitList = true,
}) {
  // CEDIS y otros puntos ajenos al plan seleccionado no forman parte de la
  // geometría del mapa: no se dibujan ni pueden modificar su encuadre.
  const plotted = validPoints(points).filter(isMappablePoint)
  // `trail` ya llega normalizado por RadarTab. Sólo se conserva como geometría
  // cuando aporta dos coordenadas GPS válidas; nunca genera marcadores.
  const validTrail = validPoints(trail)
  const trailPoints = validTrail.length >= 2 ? validTrail : []
  const bounds = computeBounds([...plotted, ...trailPoints])
  const unavailableMapAction = showUnitList
    ? 'Consulta la lista de unidades.'
    : 'Selecciona otra ruta en Rutas de hoy.'

  if (!bounds || (plotted.length === 0 && trailPoints.length === 0)) {
    return <EmptyMap testid={testid} height={height} note={`Sin posiciones válidas para el mapa. ${unavailableMapAction}`} />
  }
  if (bounds.antimeridian) {
    return <EmptyMap testid={testid} height={height} note={`Posiciones cruzan la línea de fecha; ${showUnitList ? 'usa la lista de unidades (vista geoespacial no fiable en este rango).' : unavailableMapAction}`} />
  }
  if (typeof window === 'undefined') return <LoadingMap testid={testid} height={height} />

  return (
    <Suspense fallback={<LoadingMap testid={testid} height={height} />}>
      <LeafletPositionMap points={plotted} trail={trailPoints} selectedId={selectedId} onSelect={onSelect} height={height} backdropUrl={backdropUrl} width={width} testid={testid} />
    </Suspense>
  )
}
