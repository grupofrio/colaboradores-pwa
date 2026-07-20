// ─── Supervisor V2 · PositionMap (SVG puro, SIN dependencias ni tiles) ────────
// Proyecta lat/long a un viewBox por bounding-box (equirectangular) y dibuja
// marcadores. NO usa librería de mapa, NO hace fetch, NO requiere API key ni
// tiles ⇒ compatible con CSP y sin costo. Un backdrop raster es OPCIONAL e
// inyectable (`backdropUrl`, config); por defecto es un fondo plano con retícula
// sutil. Solo se dibujan puntos con coordenadas VÁLIDAS (no se inventan); las
// unidades sin posición las lista el llamador (RadarView). SSR-safe (sin window).
import { TOKENS } from '../../../../tokens'
import { computeBounds, project, isFiniteNum } from './mapProjection.js'

const C = TOKENS.colors

const KIND_STYLE = {
  unit: { r: 7, fill: '#60a5fa', stroke: '#0a2654' },
  unit_stale: { r: 7, fill: '#f59e0b', stroke: '#5a3a00' },
  unit_nosignal: { r: 6, fill: 'rgba(255,255,255,0.35)', stroke: 'rgba(255,255,255,0.2)' },
  stop_done: { r: 4, fill: '#22c55e', stroke: '#0a3a1a' },
  stop_pending: { r: 4, fill: 'rgba(255,255,255,0.5)', stroke: 'rgba(255,255,255,0.25)' },
  incident: { r: 5, fill: '#ef4444', stroke: '#5a0a0a' },
  cedis: { r: 6, fill: '#c084fc', stroke: '#3a1a5a' },
}

export default function PositionMap({
  points = [], selectedId = null, onSelect, height = 300, backdropUrl = null,
  width = 640, testid = 'v2-position-map',
}) {
  const bounds = computeBounds(points)
  const plotted = (points || []).filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))

  if (!bounds || plotted.length === 0) {
    return (
      <div data-testid={`${testid}-empty`} style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: TOKENS.radius.md, color: C.textMuted, fontSize: 13, padding: 16,
      }}>
        Sin posiciones válidas para mostrar en el mapa. Consulta la lista de unidades.
      </div>
    )
  }

  return (
    <div data-testid={testid} style={{ position: 'relative', borderRadius: TOKENS.radius.md, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Mapa de posiciones de unidades" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', background: C.bg1 }}>
        {backdropUrl ? <image href={backdropUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="xMidYMid slice" opacity="0.6" /> : (
          // Retícula sutil (fondo plano, sin tiles externos).
          <g opacity="0.14">
            {Array.from({ length: 7 }).map((_, i) => <line key={`v${i}`} x1={(i + 1) * width / 8} y1="0" x2={(i + 1) * width / 8} y2={height} stroke={C.blue3} strokeWidth="0.5" />)}
            {Array.from({ length: 5 }).map((_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * height / 6} x2={width} y2={(i + 1) * height / 6} stroke={C.blue3} strokeWidth="0.5" />)}
          </g>
        )}
        {plotted.map((p) => {
          const { x, y } = project(p.lat, p.lng, bounds, width, height)
          const st = KIND_STYLE[p.kind] || KIND_STYLE.unit
          const sel = p.id != null && p.id === selectedId
          return (
            <g key={p.id ?? `${p.lat},${p.lng}`} transform={`translate(${x},${y})`} style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onClick={onSelect ? () => onSelect(p.id) : undefined} role={onSelect ? 'button' : undefined} aria-label={p.label || 'punto'}>
              {sel && <circle r={st.r + 5} fill="none" stroke={C.blue3} strokeWidth="2" opacity="0.9" />}
              <circle r={st.r} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
              {(p.kind === 'unit' || p.kind === 'unit_stale') && p.label && (
                <text x={st.r + 3} y={4} fontSize="10" fill={C.textSoft} style={{ pointerEvents: 'none' }}>{p.label}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
