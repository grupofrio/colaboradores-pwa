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

/** Semáforo EN PALABRA (el color solo no basta). */
export const TONE_WORD = Object.freeze({ ok: 'Bien', watch: 'Parcial', bad: 'Bajo', none: 'Sin ruta' })

export function toneWord(tone) {
  return TONE_WORD[tone] || TONE_WORD.none
}

/** Texto de una celda de día. has_plan=false ⇒ "Sin ruta" (nunca 0%). */
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

/** Nombre de la fila: SIEMPRE el subpolígono (o "Sin subpolígono asignado" para el
 * hueco de datos). NUNCA el nombre de la ruta/vendedor. El backend ya entrega
 * display_name resuelto; aquí solo caemos a subpolígono como red de seguridad. */
export function rowName(row) {
  return (row?.display_name) || (row?.subpolygon?.name) || 'Sin subpolígono asignado'
}

/** route_id de la fila para el flujo de asignar (tomorrow plan o la ruta base). */
export function rowRouteId(row) {
  return Number(row?.route?.id || 0) || 0
}

/** Zona que se hereda al armar la propuesta desde esta fila (polígono + subpolígono
 * del backend). La fila "Sin subpolígono asignado" no hereda subpolígono. */
export function rowZone(row) {
  return {
    polygonId: Number(row?.polygon?.id || 0) || 0,
    subpolygonId: Number(row?.subpolygon?.id || 0) || 0,
  }
}
