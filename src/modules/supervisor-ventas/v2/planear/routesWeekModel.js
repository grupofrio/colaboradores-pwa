// ─── Modelo PURO de la matriz semanal de cumplimiento (sin JSX) ──────────────
// El backend ya entrega rows ordenadas por atención y celdas con coverage_pct +
// coverage_tone. Aquí solo la presentación testeable: etiquetas de día, palabra
// del semáforo, y el texto honesto de cada celda (sin ruta ≠ 0%).

const WD = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'America/Mexico_City' })

/** "Lun 3" a partir de una fecha ISO (YYYY-MM-DD), tz centro. */
export function weekdayLabel(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  // mediodía UTC para que la tz no reste un día
  return WD.format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** Semáforo EN PALABRA (el color solo no basta). `today` = jornada EN CURSO:
 *  todavía no es veredicto, así que nunca se pinta "Bajo". */
export const TONE_WORD = Object.freeze({
  ok: 'Bien', watch: 'Parcial', bad: 'Bajo', none: 'Sin ruta', today: 'En curso',
  planned: 'Planeado',
})

export function toneWord(tone) {
  return TONE_WORD[tone] || TONE_WORD.none
}

/** Jornada operativa de HOY derivada del servidor: `tomorrow` (autoritativa, tz
 *  de la sucursal) menos un día. NUNCA del reloj del navegador. */
export function todayFromTomorrow(tomorrowIso) {
  const [y, m, d] = String(tomorrowIso || '').split('-').map(Number)
  if (!y || !m || !d) return null
  const t = new Date(Date.UTC(y, m - 1, d, 12))
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

export function isCurrentDay(cell, todayIso) {
  return !!(todayIso && cell?.date && String(cell.date) === String(todayIso))
}

/** Tono de la celda. El día EN CURSO no emite veredicto (la jornada no terminó):
 *  con plan ⇒ 'today'; sin plan ⇒ 'none' (sigue siendo "sin ruta", eso ya es un
 *  hecho cerrado). Los días pasados/futuros conservan el tono del backend. */
export function cellTone(cell, todayIso) {
  const base = cell?.coverage_tone || 'none'
  if (!cell?.has_plan) return 'none'
  if (isCurrentDay(cell, todayIso)) return 'today'
  // Día FUTURO con plan: la jornada ni siquiera empezó, así que su cobertura de 0%
  // no es un "Bajo" — es un plan por ejecutar. (Codex P2)
  if (todayIso && cell?.date && String(cell.date) > String(todayIso)) return 'planned'
  return base
}

/** Texto de una celda de día. has_plan=false ⇒ "Sin ruta" (nunca 0%). El día en
 *  curso muestra su avance real, pero etiquetado como parcial (ver cellTone). */
export function cellLabel(cell) {
  if (!cell || !cell.has_plan) return 'Sin ruta'
  if (cell.coverage_pct == null) return 'Sin dato'
  return `${cell.coverage_pct}%`
}

/** Resumen de la asignación de mañana para el chip. */
export function tomorrowSummary(tomorrow) {
  const t = tomorrow || {}
  if (!t.assigned) return { assigned: false, text: 'Sin asignar' }
  const parts = [t.vehicle?.name, t.driver?.name, t.salesperson?.name].filter(Boolean)
  return { assigned: true, text: parts.join(' · ') || 'Asignada' }
}

/** Nombre de la fila = el PLAN OPERATIVO (segmento/subpolígono/polígono). El backend
 * entrega `name` ya resuelto; nunca es un nombre de vendedor. */
export function rowName(row) {
  return (row?.name) || (row?.subpolygon?.name) || '—'
}

/** Tipo del plan operativo en palabra (el chip; el color/letra solo no basta). */
export const TYPE_LABEL = Object.freeze({
  SO: 'Segmento operativo', SP: 'Subpolígono', P: 'Polígono',
})
export const TYPE_SHORT = Object.freeze({ SO: 'Segmento', SP: 'Subpolígono', P: 'Polígono' })

export function typeLabel(tipo) {
  return TYPE_LABEL[tipo] || 'Plan'
}

/** ¿La fila tiene VARIOS planes de mañana (varias rutas)? Entonces no hay una ruta
 *  accionable única — el backend (B2) marca requires_route_selection y el detalle
 *  debe pedir elegir cuál, no autoabrir una arbitraria. */
export function rowRequiresRouteSelection(row) {
  return Boolean(row?.tomorrow?.requires_route_selection)
}

/** route_id de la fila para el flujo de asignar (tomorrow plan o la ruta base).
 *  0 en multiplicidad (varios planes mañana): el detalle abre el SELECTOR de ruta,
 *  no autoabre una ruta arbitraria según el orden del backend (Codex P1 / B2). */
export function rowRouteId(row) {
  if (rowRequiresRouteSelection(row)) return 0
  return Number(row?.route?.id || 0) || 0
}

/** Zona/segmento que se hereda al armar desde esta fila, según el tipo:
 *  SP → subpolígono (+ su polígono); P → polígono; SO → segmento. */
export function rowZone(row) {
  const tipo = row?.tipo
  const id = Number(row?.id || 0) || 0
  if (tipo === 'SP') {
    return { subpolygonId: id, polygonId: Number(row?.polygon?.id || 0) || 0, segmentId: 0 }
  }
  if (tipo === 'P') {
    return { subpolygonId: 0, polygonId: id, segmentId: 0 }
  }
  if (tipo === 'SO') {
    return { subpolygonId: 0, polygonId: 0, segmentId: id }
  }
  return { subpolygonId: 0, polygonId: 0, segmentId: 0 }
}
