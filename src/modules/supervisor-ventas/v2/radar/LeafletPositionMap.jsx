import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import {
  PLANNED_STYLE, RESULT_LEGEND, RESULT_STYLES,
  RESULT_NO_SALE, RESULT_PENDING, RESULT_SOLD,
  zoneColor, zoneLabel, zoneToLeafletPositions,
} from '../../radar/stopResultStyle.js'

const C = TOKENS.colors
const UNIT_STYLES = {
  unit: { fill: '#0077BB', stroke: '#013F5E' },
  unit_stale: { fill: '#d97706', stroke: '#5a3a00' },
}
// Las paradas se colorean por RESULTADO de venta. `stop_done`/`stop_pending`
// siguen mapeados por compatibilidad con un backend que aún no mande
// `result_status`: sin ellos las paradas desaparecerían del mapa.
const STOP_STYLES = {
  stop_sold: RESULT_STYLES[RESULT_SOLD],
  stop_no_sale: RESULT_STYLES[RESULT_NO_SALE],
  stop_pending: RESULT_STYLES[RESULT_PENDING],
  stop_planned: PLANNED_STYLE,
  stop_done: RESULT_STYLES[RESULT_SOLD],
}
const GPS_TRAIL_STYLE = { color: C.blue3, weight: 4, opacity: 0.78 }

function MapLegend({ zone }) {
  // Leyenda CON PALABRA: el color solo no basta en un mapa que se mira bajo el
  // sol y que lee gente que no distingue rojo de verde.
  return (
    <div
      data-testid="v2-map-legend"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center',
        padding: '8px 12px', borderTop: `1px solid ${C.border}`, background: C.surface,
        fontSize: 11, color: C.textMuted,
      }}
    >
      {RESULT_LEGEND.map((item) => (
        <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden="true"
            style={{
              width: item.radius * 2, height: item.radius * 2, borderRadius: '50%', flexShrink: 0,
              background: item.fill, opacity: item.fillOpacity,
              border: `${item.weight}px ${item.dashArray ? 'dashed' : 'solid'} ${item.stroke}`,
            }}
          />
          {item.label}
        </span>
      ))}
      {zone && (
        <span data-testid="v2-map-legend-zone" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden="true"
            style={{
              width: 12, height: 10, flexShrink: 0, borderRadius: 2,
              background: `${zoneColor(zone)}22`, border: `1.5px solid ${zoneColor(zone)}`,
            }}
          />
          {zoneLabel(zone)}
        </span>
      )}
    </div>
  )
}

function isPlanId(id) {
  return typeof id === 'number' && Number.isFinite(id)
}

function MapViewport({ positions }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (positions.length >= 2) map.fitBounds(positions, { padding: [24, 24] })
    else if (positions[0]) map.setView(positions[0], 15)
  }, [map, positions])
  return null
}

function unitIcon(point, selected) {
  const style = UNIT_STYLES[point.kind] || UNIT_STYLES.unit
  const size = selected ? 24 : 16
  const ring = selected ? `box-shadow:0 0 0 4px ${C.blue3};` : ''
  return divIcon({
    className: 'supervisor-radar-unit-marker',
    html: `<span aria-hidden="true" style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${style.fill};border:2px solid ${style.stroke};${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function LeafletPositionMap({ points, trail = [], zone = null, selectedId, onSelect, height, backdropUrl, width = 640, testid }) {
  // backdropUrl se conserva como no-op: superponer una imagen sobre calles reales
  // alteraría la cartografía y podría volver engañosa la posición del plan.
  void backdropUrl
  const positions = [...points, ...trail].map((point) => [point.lat, point.lng])
  // Sin zona NO se dibuja nada: un polígono inventado se leería como que la
  // unidad se salió de su zona, que es justo lo que se mira aquí.
  const zoneRings = zoneToLeafletPositions(zone)
  return (
    <section data-testid={testid} aria-label="Mapa vial de las últimas posiciones conocidas del plan seleccionado" style={{ border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, overflow: 'hidden' }}>
      <MapContainer scrollWheelZoom={false} style={{ height, width: width === 640 ? '100%' : width }} aria-label="Mapa vial de posiciones conocidas">
        <MapViewport positions={positions} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        />
        {zoneRings && (
          <Polygon
            positions={zoneRings}
            pathOptions={{ color: zoneColor(zone), weight: 2, opacity: 0.85, fillColor: zoneColor(zone), fillOpacity: 0.08 }}
          >
            <Tooltip sticky>{zoneLabel(zone)}</Tooltip>
          </Polygon>
        )}
        {trail.length >= 2 && (
          <Polyline positions={trail} pathOptions={GPS_TRAIL_STYLE} />
        )}
        {points.map((point) => {
          const position = [point.lat, point.lng]
          if (STOP_STYLES[point.kind]) {
            const style = STOP_STYLES[point.kind]
            // Forma además de color: el verde y el rojo que cumplen AA contra
            // un mapa claro quedan en 1.10:1 entre sí, o sea indistinguibles
            // para quien no ve el rojo. El radio y el trazo sí se distinguen.
            return <CircleMarker key={`${point.id}-${point.lat}-${point.lng}`} center={position} radius={style.radius ?? 6} pathOptions={{ color: style.stroke, fillColor: style.fill, fillOpacity: style.fillOpacity ?? 1, weight: style.weight ?? 2, dashArray: style.dashArray || undefined }}>
              {point.label && <Tooltip>{point.label}</Tooltip>}
            </CircleMarker>
          }
          if (!UNIT_STYLES[point.kind]) return null

          const numericPlanId = isPlanId(point.id)
          const selected = numericPlanId && point.id === selectedId
          const label = point.label || 'Unidad'
          const activate = () => { if (numericPlanId && onSelect) onSelect(point.id) }
          const eventHandlers = numericPlanId && onSelect ? {
            click: activate,
            keydown: (event) => {
              const key = event.originalEvent?.key
              if (key === 'Enter' || key === ' ') {
                event.originalEvent?.preventDefault?.()
                activate()
              }
            },
          } : undefined
          return <Marker key={`${point.id}-${point.lat}-${point.lng}`} position={position} icon={unitIcon(point, selected)} title={label} alt={label} aria-label={label} keyboard={true} eventHandlers={eventHandlers}>
            <Tooltip>{label}</Tooltip>
          </Marker>
        })}
      </MapContainer>
      <MapLegend zone={zone} />
    </section>
  )
}
