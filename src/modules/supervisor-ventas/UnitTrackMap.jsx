import { Fragment, useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { buildUnitTrackBounds } from './unitTrackState.js'

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

  return (
    <div style={{ height: 280, minHeight: 280, width: '100%', fontFamily: typo?.caption?.fontFamily }}>
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
        {trailPositions.length >= 2 && (
          <Polyline positions={trailPositions} color="#2563eb" weight={4} opacity={0.8} />
        )}
        {stops.map((stop, index) => {
          const plannedPosition = asPosition(stop?.planned_lat, stop?.planned_lng)
          const checkinPosition = asPosition(stop?.checkin_lat, stop?.checkin_lng)

          return (
            <Fragment key={`${stop?.sequence ?? index}-${index}`}>
              {plannedPosition && (
                <CircleMarker center={plannedPosition} radius={7} color="#d97706" fillColor="#fbbf24" fillOpacity={0.75} weight={2} />
              )}
              {checkinPosition && (
                <CircleMarker center={checkinPosition} radius={7} color="#15803d" fillColor="#22c55e" fillOpacity={0.8} weight={2} />
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
  )
}
