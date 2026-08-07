import { safeSignalStatus } from '../presentation.js'
import { stopKind } from '../../radar/stopResultStyle.js'
import { isValidLatLng } from './mapProjection.js'

export function isPlanId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function resolveActivePlanId(units, requestedId) {
  const valid = (Array.isArray(units) ? units : []).filter((unit) => isPlanId(unit?.plan_id))
  return valid.some((unit) => unit.plan_id === requestedId)
    ? requestedId
    : (valid[0]?.plan_id ?? null)
}

export function buildRadarPlanOptions(units) {
  const seen = new Set()
  return (Array.isArray(units) ? units : []).flatMap((unit) => {
    if (!isPlanId(unit?.plan_id) || seen.has(unit.plan_id)) return []
    seen.add(unit.plan_id)
    const route = unit.route_name || 'Ruta sin nombre'
    const responsible = unit.name || 'Sin responsable'
    const vehicle = unit.vehicle?.name || 'Sin unidad'
    return [{ planId: unit.plan_id, label: `${route} · ${responsible} · ${vehicle}` }]
  })
}

const isMapPosition = (latitude, longitude) => {
  const position = { lat: latitude, lng: longitude }
  return isValidLatLng(position) && !(position.lat === 0 && position.lng === 0)
}

export function buildSelectedPlanPoints(radar, activePlanId, nowMs) {
  const units = Array.isArray(radar?.units) ? radar.units : []
  const unit = units.find((candidate) => candidate?.plan_id === activePlanId && isPlanId(candidate.plan_id))
  if (!unit) return []

  const points = []
  if (isMapPosition(unit.latitude, unit.longitude)) {
    points.push({
      id: unit.plan_id,
      lat: unit.latitude,
      lng: unit.longitude,
      kind: safeSignalStatus(unit, nowMs) === 'recent' ? 'unit' : 'unit_stale',
      label: unit.route_name || unit.name || 'Unidad',
    })
  }

  const planned = Array.isArray(unit.stops?.planned) ? unit.stops.planned : []
  for (const stop of planned) {
    if (!isMapPosition(stop?.latitude, stop?.longitude)) continue
    points.push({
      id: `stop:${stop.stop_id}`,
      lat: stop.latitude,
      lng: stop.longitude,
      // Por RESULTADO, no por visita: una parada donde llegaron y NO vendieron
      // se pintaba igual de verde que una venta. `stop.done` sigue disponible
      // en el contrato, pero ya no decide el color.
      kind: stopKind(stop),
      label: stop.name || '',
      result_status: stop.result_status ?? null,
      done: stop.done,
    })
  }
  return points
}

/** Zona geográfica del plan seleccionado. `null` ⇒ no se dibuja nada. */
export function selectedPlanZone(radar, activePlanId) {
  const units = Array.isArray(radar?.units) ? radar.units : []
  const unit = units.find((candidate) => candidate?.plan_id === activePlanId && isPlanId(candidate.plan_id))
  return unit?.zone || null
}
