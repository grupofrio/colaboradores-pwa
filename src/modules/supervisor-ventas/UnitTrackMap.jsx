import { Fragment, useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { buildUnitTrackBounds } from './unitTrackState.js'
import {
  PLANNED_STYLE, RESULT_LEGEND, pathOptionsForStop, styleForStop,
  zoneColor, zoneLabel, zoneToLeafletPositions,
} from './radar/stopResultStyle.js'

const SINGLE_POINT_ZOOM = 15
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function asPosition(lat, lng) {
  if (
    typeof lat !== 'number'
    || typeof lng !== 'number'
    || !Number.isFinite(lat)
    || !Number.isFinite(lng)
    || lat < -90
    || lat > 90
    || lng < -180
    || lng > 180
    || (lat === 0 && lng === 0)
  ) return null

  return [lat, lng]
}

function currentTime(point) {
  return point?.captured_at ?? point?.recorded_at ?? point?.timestamp ?? '—'
}

function currentSpeed(point) {
  return point?.speed === undefined || point?.speed === null ? '—' : String(point.speed)
}

function MapViewport({ bounds }) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()

    if (bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [24, 24] })
      return
    }

    map.setView(bounds[0], SINGLE_POINT_ZOOM)
  }, [bounds, map])

  return null
}

function Legend({ zone }) {
  // CON PALABRA, no solo color. Mismo criterio y mismos colores que el radar:
  // dos paletas para el mismo hecho serían dos verdades.
  return (
    <div
      data-testid="unit-track-legend"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center',
        padding: '8px 4px 0', fontSize: 11, color: '#5B7285',
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
        <span data-testid="unit-track-legend-zone" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

export function UnitTrackMap({ track, typo }) {
  const bounds = buildUnitTrackBounds(track)
  if (bounds.length === 0) return null

  const currentPosition = asPosition(track?.current?.lat, track?.current?.lng)
  const trailPositions = Array.isArray(track?.trail)
    ? track.trail
      .map((point) => asPosition(point?.lat, point?.lng))
      .filter(Boolean)
    : []
  const stops = Array.isArray(track?.stops) ? track.stops : []
  // Sin zona no se dibuja nada: inventar un cuadro se leería como que la unidad
  // se salió de su polígono.
  const zone = track?.zone || null
  const zoneRings = zoneToLeafletPositions(zone)

  return (
    <div style={{ width: '100%', fontFamily: typo?.caption?.fontFamily }}>
    <div style={{ height: 280, minHeight: 280, width: '100%' }}>
      <MapContainer
        center={bounds[0]}
        zoom={bounds.length >= 2 ? 12 : SINGLE_POINT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: '100%', minHeight: 280, width: '100%' }}
      >
        <MapViewport bounds={bounds} />
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zoneRings && (
          <Polygon
            positions={zoneRings}
            pathOptions={{ color: zoneColor(zone), weight: 2, opacity: 0.85, fillColor: zoneColor(zone), fillOpacity: 0.08 }}
          >
            <Tooltip sticky>{zoneLabel(zone)}</Tooltip>
          </Polygon>
        )}
        {trailPositions.length >= 2 && (
          <Polyline positions={trailPositions} color="#2563eb" weight={4} opacity={0.8} />
        )}
        {stops.map((stop, index) => {
          const plannedPosition = asPosition(stop?.planned_lat, stop?.planned_lng)
          const checkinPosition = asPosition(stop?.checkin_lat, stop?.checkin_lng)
          // El color sale del RESULTADO de venta, no de si hubo check-in. Antes
          // una parada donde el vendedor llegó y NO vendió se pintaba igual de
          // verde que una venta: lo contrario de informar.
          const style = styleForStop(stop)
          const etiqueta = [stop?.name, style.label].filter(Boolean).join(' · ')

          return (
            <Fragment key={`${stop?.sequence ?? index}-${index}`}>
              {/* La posición PLANEADA queda como referencia tenue: sin ella no
                  se ve el desvío entre dónde debía estar el cliente y dónde se
                  hizo el check-in. */}
              {plannedPosition && (
                <CircleMarker
                  center={plannedPosition}
                  radius={PLANNED_STYLE.radius}
                  pathOptions={{ color: PLANNED_STYLE.stroke, fillColor: PLANNED_STYLE.fill, fillOpacity: PLANNED_STYLE.fillOpacity, weight: PLANNED_STYLE.weight, dashArray: PLANNED_STYLE.dashArray }}
                />
              )}
              {/* El punto de RESULTADO va donde ocurrió la visita; si no hubo
                  check-in, sobre la posición planeada, para que una parada
                  pendiente siga siendo visible. */}
              {(checkinPosition || plannedPosition) && (
                <CircleMarker
                  center={checkinPosition || plannedPosition}
                  radius={style.radius}
                  pathOptions={pathOptionsForStop(stop)}
                >
                  {etiqueta && <Tooltip>{etiqueta}</Tooltip>}
                </CircleMarker>
              )}
            </Fragment>
          )
        })}
        {currentPosition && (
          <CircleMarker center={currentPosition} radius={8} color="#2563eb" fillColor="#3b82f6" fillOpacity={0.95} weight={3}>
            <Tooltip direction="top" offset={[0, -8]}>
              <span style={typo?.caption}>Hora: {currentTime(track.current)}<br />Velocidad: {currentSpeed(track.current)}</span>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
    <Legend zone={zone} />
    </div>
  )
}
