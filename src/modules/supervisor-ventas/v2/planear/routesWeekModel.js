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
 *  accionable única — el detalle debe pedir elegir cuál, no autoabrir una arbitraria.
 *  Se dispara con el flag nuevo del backend (B2: requires_route_selection) O con
 *  plan_count > 1 — así es seguro también contra un backend PRE-B2 que trae dos
 *  planes mañana y una row.route arbitraria (Codex P1). */
export function rowRequiresRouteSelection(row) {
  return Boolean(row?.tomorrow?.requires_route_selection)
    || Number(row?.tomorrow?.plan_count || 0) > 1
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

export const ASSIGNMENT_LABEL = Object.freeze({
  no_plan: 'Sin ruta',
  unassigned: 'Sin asignar',
  blocked: 'Bloqueada',
  assigned: 'Asignada',
  published: 'Publicada',
  in_progress: 'En curso',
  closed: 'Cerrada',
})

export function assignmentLabel(state) {
  if (!state) return 'Sin dato'
  return ASSIGNMENT_LABEL[state] || 'Sin dato'
}

export function rowSource(row) {
  return {
    key: row?.key || `${row?.tipo}:${row?.id}`,
    type: row?.tipo,
    tipo: row?.tipo,
    id: Number(row?.id || 0) || 0,
    name: rowName(row),
    polygon: row?.polygon || null,
    routeId: rowRouteId(row),
  }
}

export const MAX_OPERATIONAL_SOURCES = 2

/** Selección 1–2. Intentar 3 no sustituye en silencio: devuelve el mismo selected + error. */
export function toggleOperationalSelection(selected, row) {
  const current = Array.isArray(selected) ? selected : []
  const source = rowSource(row)
  if (!source.id || !source.tipo) return { selected: current, error: null }
  const exists = current.some((s) => s.key === source.key)
  if (exists) return { selected: current.filter((s) => s.key !== source.key), error: null }
  if (current.length >= MAX_OPERATIONAL_SOURCES) {
    return {
      selected: current,
      error: 'No puedes combinar más de 2 planes operativos en una ruta.',
    }
  }
  return { selected: [...current, source], error: null }
}

export function encodeSourcesParam(selected) {
  return (selected || []).map((s) => s.key).filter(Boolean).join(',')
}

export function decodeSourcesParam(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((key) => {
      const [tipo, id] = key.split(':')
      return { key, tipo, type: tipo, id: Number(id || 0) || 0 }
    })
    .filter((s) => s.id && ['SO', 'SP', 'P'].includes(s.tipo))
    .slice(0, MAX_OPERATIONAL_SOURCES)
}

export function filterMatrixRows(rows, filter) {
  const list = Array.isArray(rows) ? rows : []
  if (!filter || filter === 'all') return list
  if (filter === 'SO' || filter === 'SP' || filter === 'P') {
    return list.filter((r) => r?.tipo === filter)
  }
  if (filter === 'pending_tomorrow') {
    return list.filter((r) => !isReadyTomorrow(r))
  }
  if (filter === 'ready_tomorrow') {
    return list.filter((r) => isReadyTomorrow(r))
  }
  if (filter === 'week_gaps') {
    return list.filter((r) => (r?.days || []).some((c) => !c?.has_plan))
  }
  return list
}

export function isReadyTomorrow(row) {
  const state = row?.tomorrow?.assignment_state
  if (state) return ['assigned', 'published', 'in_progress', 'closed'].includes(state)
  return Boolean(row?.tomorrow?.assigned)
}

export function tomorrowAction(row) {
  const t = row?.tomorrow || {}
  const state = t.assignment_state || (t.assigned ? 'assigned' : (Number(t.plan_count || 0) > 0 ? 'unassigned' : 'no_plan'))
  if (rowRequiresRouteSelection(row)) {
    return { state, label: 'Varias rutas', cta: 'Elegir ruta', testid: 'rw-elegir-ruta' }
  }
  if (state === 'published' || state === 'in_progress' || state === 'closed') {
    return { state, label: assignmentLabel(state), cta: 'Revisar', testid: 'rw-reasignar' }
  }
  if (state === 'assigned') {
    return { state, label: 'Lista', cta: 'Revisar', testid: 'rw-reasignar' }
  }
  if (state === 'blocked') {
    return { state, label: 'Bloqueada', cta: 'Resolver', testid: 'rw-asignar' }
  }
  if (state === 'unassigned') {
    const miss = []
    if (t.missing_vehicle) miss.push('Sin unidad')
    if (t.missing_driver) miss.push('Sin chofer')
    if (t.missing_salesperson) miss.push('Sin vendedor')
    return { state, label: miss[0] || 'Pendiente', cta: 'Completar', testid: 'rw-asignar' }
  }
  return { state: 'no_plan', label: 'Sin preparar', cta: 'Preparar', testid: 'rw-asignar' }
}

function asCount(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Resume el contrato autoritativo. Si falta summary, deriva de rows (mismos números, no inventa). */
export function executiveSummary(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const counts = data?.counts || {}
  const s = data?.summary && typeof data.summary === 'object' ? data.summary : null
  const total = asCount(s?.total_operational_plans) ?? asCount(counts.total) ?? rows.length
  const ready = asCount(s?.ready_tomorrow)
  const pending = asCount(s?.pending_tomorrow)
  const noPlan = asCount(s?.no_plan_tomorrow)
  const incomplete = asCount(s?.incomplete_resources_tomorrow)
  const blocked = asCount(s?.blocked_tomorrow)
  const published = asCount(s?.published_tomorrow)
  const weekGaps = asCount(s?.week_rows_with_missing_route)
  const coverage = s?.weekly_coverage_pct == null ? null : Number(s.weekly_coverage_pct)
  const derived = !s ? deriveSummaryFromRows(rows, counts) : null
  return {
    total,
    ready: ready ?? derived?.ready ?? null,
    pending: pending ?? derived?.pending ?? null,
    noPlan: noPlan ?? derived?.noPlan ?? null,
    incomplete: incomplete ?? derived?.incomplete ?? null,
    blocked: blocked ?? derived?.blocked ?? null,
    published: published ?? derived?.published ?? null,
    weekGaps: weekGaps ?? derived?.weekGaps ?? null,
    coverage: coverage ?? derived?.coverage ?? null,
    SO: asCount(s?.SO) ?? asCount(counts.SO),
    SP: asCount(s?.SP) ?? asCount(counts.SP),
    P: asCount(s?.P) ?? asCount(counts.P),
    tomorrow: data?.tomorrow || null,
  }
}

export function deriveSummaryFromRows(rows, counts = {}) {
  const list = Array.isArray(rows) ? rows : []
  let ready = 0
  let noPlan = 0
  let incomplete = 0
  let blocked = 0
  let published = 0
  let weekGaps = 0
  const cov = []
  for (const row of list) {
    const state = row?.tomorrow?.assignment_state
      || (row?.tomorrow?.assigned ? 'assigned' : (Number(row?.tomorrow?.plan_count || 0) > 0 ? 'unassigned' : 'no_plan'))
    if (state === 'no_plan') noPlan += 1
    else if (state === 'blocked') blocked += 1
    else if (state === 'unassigned') incomplete += 1
    else {
      ready += 1
      if (state === 'published') published += 1
    }
    if ((row?.days || []).some((c) => !c?.has_plan)) weekGaps += 1
    if (row?.weekly_coverage_pct != null) cov.push(Number(row.weekly_coverage_pct))
  }
  return {
    ready,
    pending: noPlan + incomplete + blocked,
    noPlan,
    incomplete,
    blocked,
    published,
    weekGaps,
    coverage: cov.length ? Math.round((cov.reduce((a, b) => a + b, 0) / cov.length) * 10) / 10 : null,
    SO: asCount(counts.SO),
    SP: asCount(counts.SP),
    P: asCount(counts.P),
  }
}

export function actionPhrase(summary) {
  const total = summary?.total
  const pending = summary?.pending
  const ready = summary?.ready
  if (total == null) return 'Sin dato de planes operativos.'
  if (total === 0) return 'No hay planes operativos.'
  if (pending == null || ready == null) return `${total} planes operativos.`
  if (pending === 0) return `Los ${total} planes de mañana están listos.`
  if (pending === 1) return 'Te falta 1 plan por dejar listo para mañana.'
  return `Te faltan ${pending} planes por dejar listos para mañana.`
}

export function pendingBreakdown(summary) {
  const parts = []
  if (summary?.noPlan != null) parts.push({ n: summary.noPlan, text: summary.noPlan === 1 ? 'todavía no tiene ruta' : 'todavía no tienen ruta' })
  if (summary?.incomplete != null) parts.push({ n: summary.incomplete, text: 'necesitan completar recursos' })
  if (summary?.blocked != null) parts.push({ n: summary.blocked, text: summary.blocked === 1 ? 'tiene un bloqueo que debes resolver' : 'tienen un bloqueo que debes resolver' })
  return parts.filter((p) => p.n > 0)
}

export function formatCount(n, fallback = 'Sin dato') {
  if (n == null || !Number.isFinite(Number(n))) return fallback
  return String(n)
}

export function cellAssignmentLine(cell) {
  if (!cell?.has_plan) return 'Sin ruta'
  return assignmentLabel(cell.assignment_state)
}
