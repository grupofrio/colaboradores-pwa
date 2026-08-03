import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors
const UNIT_STYLES = {
  unit: { fill: '#0077BB', stroke: '#013F5E' },
  unit_stale: { fill: '#d97706', stroke: '#5a3a00' },
}
const STOP_STYLES = {
  stop_done: { fill: '#16a34a', stroke: '#0a3a1a' },
  stop_pending: { fill: 'rgba(15,42,61,0.35)', stroke: 'rgba(15,42,61,0.55)' },
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

export default function LeafletPositionMap({ points, selectedId, onSelect, height, testid }) {
  const positions = points.map((point) => [point.lat, point.lng])
  return (
    <section data-testid={testid} aria-label="Mapa vial de las últimas posiciones conocidas del plan seleccionado" style={{ border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, overflow: 'hidden' }}>
      <MapContainer scrollWheelZoom={false} style={{ height, width: '100%' }} aria-label="Mapa vial de posiciones conocidas">
        <MapViewport positions={positions} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        />
        {points.map((point) => {
          const position = [point.lat, point.lng]
          if (STOP_STYLES[point.kind]) {
            const style = STOP_STYLES[point.kind]
            return <CircleMarker key={`${point.id}-${point.lat}-${point.lng}`} center={position} radius={6} pathOptions={{ color: style.stroke, fillColor: style.fill, fillOpacity: 1, weight: 2 }}>
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
    </section>
  )
}
