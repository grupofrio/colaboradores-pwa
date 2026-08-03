import { lazy, Suspense } from 'react'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { computeBounds, validPoints } from './mapProjection.js'

const C = TOKENS.colors
const LeafletPositionMap = lazy(() => import('./LeafletPositionMap.jsx'))

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
  points = [], selectedId = null, onSelect, height = 300, testid = 'v2-position-map',
}) {
  const bounds = computeBounds(points)
  const plotted = validPoints(points)

  if (!bounds || plotted.length === 0) {
    return <EmptyMap testid={testid} height={height} note="Sin posiciones válidas para el mapa. Consulta la lista de unidades." />
  }
  if (bounds.antimeridian) {
    return <EmptyMap testid={testid} height={height} note="Posiciones cruzan la línea de fecha; usa la lista de unidades (vista geoespacial no fiable en este rango)." />
  }
  if (typeof window === 'undefined') return <LoadingMap testid={testid} height={height} />

  return (
    <Suspense fallback={<LoadingMap testid={testid} height={height} />}>
      <LeafletPositionMap points={plotted} selectedId={selectedId} onSelect={onSelect} height={height} testid={testid} />
    </Suspense>
  )
}
