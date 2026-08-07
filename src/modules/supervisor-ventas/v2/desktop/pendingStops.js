// ─── Clientes por visitar (columna 3 del tablero de escritorio) ──────────────
// PURO: sin React, sin fetch. Deriva la lista de clientes pendientes del MISMO
// payload de radar/1 que ya cargó `loadOperationalDay()`.
//
// POR QUÉ NO SE REUSA ScreenClientesSinVisitar: esa pantalla arma su lista con
// `getDayOverview()` + un `getRouteStops()` POR VENDEDOR (N+1 llamadas). El
// encargo prohíbe explícitamente refetch por columna, y el contrato radar/1 ya
// trae `units[].stops.planned[]` con `done` y coordenadas del MISMO día y el
// MISMO alcance. Derivar de ahí cuesta cero red y además cruza de forma natural
// con la selección de ruta/unidad. La pantalla móvil de sin-visitar no se toca.
//
// REGLAS DEL CONTRATO que se respetan aquí:
//   · `null ≠ 0`: si la unidad no declara paradas, la ruta reporta `unknown`,
//     no "0 pendientes".
//   · No se inventan coordenadas: una parada sin lat/lng se lista igual, pero
//     marcada como no mapeable.

/** ¿La unidad declara su plan de paradas? (null ⇒ desconocido, no vacío) */
export function hasStopPlan(unit) {
  return Boolean(unit && unit.stops && Array.isArray(unit.stops.planned))
}

// OJO con el `null ≠ 0` del contrato: `Number(null)` es 0 y `Number.isFinite(0)`
// es true, así que convertir a número sin más daría por MAPEABLE una parada sin
// coordenadas y la plantaría en el golfo de Guinea. Solo cuentan los números
// reales (o cadenas numéricas), nunca null/undefined/''/booleanos.
function isRealCoord(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return false
  return Number.isFinite(Number(value))
}

function isMappable(stop) {
  return isRealCoord(stop?.latitude) && isRealCoord(stop?.longitude)
}

/**
 * Clientes pendientes de visitar, ordenados por secuencia dentro de cada ruta.
 * @param {object} radar payload radar/1
 * @param {number|null} planId  si viene, filtra a esa ruta (cruce de columnas)
 * @returns {{rows: Array, unknownRoutes: Array<string>, totalPending: number}}
 */
export function derivePendingStops(radar, planId = null) {
  const units = Array.isArray(radar?.units) ? radar.units : []
  const rows = []
  const unknownRoutes = []

  for (const unit of units) {
    if (planId != null && unit?.plan_id !== planId) continue

    if (!hasStopPlan(unit)) {
      // Sin plan declarado NO es "todo visitado": es desconocido y se nombra.
      unknownRoutes.push(unit?.route_name || unit?.name || 'Ruta sin nombre')
      continue
    }

    const pendientes = unit.stops.planned
      .filter((s) => s && s.done !== true)
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))

    for (const stop of pendientes) {
      rows.push({
        stopId: stop.stop_id ?? null,
        name: stop.name || 'Cliente sin nombre',
        sequence: Number(stop.sequence) || null,
        planId: unit.plan_id ?? null,
        routeName: unit.route_name || unit.name || '',
        driver: unit.name || '',
        mappable: isMappable(stop),
        latitude: isMappable(stop) ? Number(stop.latitude) : null,
        longitude: isMappable(stop) ? Number(stop.longitude) : null,
      })
    }
  }

  return { rows, unknownRoutes, totalPending: rows.length }
}

/**
 * Resumen por ruta para el encabezado de la columna. `pending` es null cuando la
 * unidad no declara plan: la UI debe decir "sin dato", nunca "0".
 */
export function summarizePendingByRoute(radar) {
  const units = Array.isArray(radar?.units) ? radar.units : []
  return units.map((unit) => ({
    planId: unit?.plan_id ?? null,
    routeName: unit?.route_name || unit?.name || 'Ruta sin nombre',
    pending: hasStopPlan(unit)
      ? unit.stops.planned.filter((s) => s && s.done !== true).length
      : null,
    plannedTotal: hasStopPlan(unit) ? unit.stops.planned.length : null,
  }))
}
