// ─── Supervisor V2 · presentación PURA (derivaciones honestas) ────────────────
// Reutiliza los formateadores atómicos del contrato #80 (day_control/1) y añade
// las derivaciones de V2: situación completa, filas/detalle de ruta (línea de
// tiempo de 14 hitos), segmentación de clientes, consolidación de pendientes y
// frescura global. Reglas duras (heredadas del contrato): null/ausente ≠ 0;
// error ≠ 0; unknown ≠ incumplimiento; falta de GPS ≠ ruta detenida; faltante =
// "no disponible", no cero. Cada métrica retorna {value, available} cuando la
// ausencia debe nombrarse.
import {
  departureLabel, departureTone, deviationText, closeStageLabel, CLOSE_STAGE_ORDER,
  signalLabel, safeSignalStatus, ageText, moneyText, moneyByCurrencyTexts,
  groupPriorities, priorityCountChip, operationalDateLabel, timezoneSourceLabel,
  radarSummary,
} from '../dayControl/presentation.js'

export {
  departureLabel, departureTone, deviationText, closeStageLabel, CLOSE_STAGE_ORDER,
  signalLabel, safeSignalStatus, ageText, moneyText, moneyByCurrencyTexts,
  groupPriorities, priorityCountChip, operationalDateLabel, timezoneSourceLabel,
  radarSummary,
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
/** Métrica honesta: value numérico o null; available=false ⇒ "Sin dato". */
const metric = (v) => {
  const n = num(v)
  return n === null ? { value: null, available: false } : { value: n, available: true }
}

// ── Frescura global de la carga ──────────────────────────────────────────────
// completo | parcial | stale | no_disponible, derivado de capabilities + edad.
export function deriveFreshness(dayControl, nowMs = null, staleAfterMinutes = 30) {
  if (!dayControl || dayControl.ok === false) return { state: 'no_disponible', label: 'No disponible', ageMinutes: null }
  const caps = dayControl.capabilities || {}
  const capValues = Object.values(caps)
  const anyOff = capValues.some((v) => v === false)
  const gen = dayControl.generated_at
  let ageMinutes = null
  if (nowMs !== null && typeof gen === 'string') {
    const ms = Date.parse(gen.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(gen) ? '' : 'Z'))
    if (Number.isFinite(ms)) ageMinutes = Math.max(0, Math.round((nowMs - ms) / 60000))
  }
  if (ageMinutes !== null && ageMinutes > staleAfterMinutes) return { state: 'stale', label: `Datos con ${ageMinutes} min`, ageMinutes }
  if (anyOff) return { state: 'parcial', label: 'Datos parciales', ageMinutes }
  return { state: 'completo', label: 'Datos completos', ageMinutes }
}

// ── Situación completa (11 conteos) ──────────────────────────────────────────
// Cada uno derivado de UNA fuente; donde no hay señal fiable ⇒ available:false.
export function deriveSituation(dayControl) {
  const s = dayControl?.summary || {}
  const routes = Array.isArray(dayControl?.routes) ? dayControl.routes : []
  const close = s.close || {}

  // activas = con salida registrada y cierre aún abierto (en calle).
  let activas = 0
  let regresandoAvailable = false
  let conIncidencia = 0
  let sinSenal = 0
  for (const r of routes) {
    const dep = r?.departure?.status
    const stage = r?.close?.stage
    if ((dep === 'on_time' || dep === 'late') && stage === 'open') activas += 1
    if (Array.isArray(r?.incident_markers) && r.incident_markers.length > 0) conIncidencia += 1
    const sig = safeSignalStatus(r?.position || {})
    if (r?.position == null || sig === 'no_signal' || sig === 'invalid') sinSenal += 1
  }
  // §11: el bloque `close` puede faltar ⇒ conteo NO disponible (no "0"). Solo si
  // el objeto close existe con al menos una etapa numérica se computa el total.
  const closeStages = ['open', 'closed', 'corte_done', 'liquidated', 'validated']
  const closeAvailable = !!s.close && typeof s.close === 'object' && closeStages.some((k) => num(close[k]) !== null)
  const sumStages = (keys) => keys.reduce((acc, k) => acc + (num(close[k]) || 0), 0)
  // "cerradas" = etapas de cierre != open (closed/corte_done/liquidated/validated).
  const cerradas = sumStages(['closed', 'corte_done', 'liquidated', 'validated'])
  // cierres pendientes = cerradas pero sin validar (closed+corte_done+liquidated).
  const cierresPendientes = sumStages(['closed', 'corte_done', 'liquidated'])
  // cargas pendientes = refill + inicial (nullable ⇒ honesto).
  const refill = num(s.pending_refill_acceptance)
  const inicial = num(s.pending_initial_acceptance)
  const cargasPendientes = refill === null && inicial === null
    ? { value: null, available: false }
    : { value: (refill || 0) + (inicial || 0), available: true }

  return {
    planeadas: metric(s.routes_total),
    salieron: metric(s.departed),
    tarde: metric(s.departed_late),
    sinSalir: metric(s.not_departed),
    sinDatoSalida: metric(s.departure_unknown),
    activas: { value: activas, available: routes.length > 0 },
    // "regresando" no tiene señal canónica en day_control/1 ⇒ no se inventa.
    regresando: { value: null, available: regresandoAvailable },
    cerradas: { value: closeAvailable ? cerradas : null, available: closeAvailable },
    conIncidencia: { value: conIncidencia, available: routes.length > 0 },
    sinSenal: { value: sinSenal, available: routes.length > 0 },
    cargasPendientes,
    cierresPendientes: { value: closeAvailable ? cierresPendientes : null, available: closeAvailable },
  }
}

// ── Filas de ruta (para la lista de Rutas) ───────────────────────────────────
export function deriveRouteRows(dayControl) {
  const routes = Array.isArray(dayControl?.routes) ? dayControl.routes : []
  return routes.map((r) => {
    const dep = r?.departure || {}
    const stops = r?.stops || {}
    const loads = r?.loads || {}
    const pendingLoads = loads.available === false ? null : num(loads.pending_acceptance_count)
    const sig = safeSignalStatus(r?.position || {})
    return {
      planId: r?.plan_id ?? null,
      routeName: r?.route_name || 'Ruta sin nombre',
      driver: r?.driver?.name || 'Sin responsable',
      vehicle: r?.vehicle?.name || 'Sin unidad',
      departureStatus: dep.status || 'unknown',
      deviationMinutes: num(dep.deviation_minutes),
      stopsDone: num(stops.done),
      stopsTotal: num(stops.total),
      progressPct: num(stops.progress_pct),
      nextStopName: stops?.next_stop?.name || null,
      sales: { amount: num(r?.sales?.day_amount), currency: r?.sales?.currency || null, available: r?.sales?.available !== false },
      incidentCount: Array.isArray(r?.incident_markers) ? r.incident_markers.length : 0,
      pendingLoads,
      signalStatus: sig,
      ageSeconds: num(r?.position?.age_seconds),
      closeStage: r?.close?.stage || 'unknown',
      cashPending: { amount: num(r?.close?.cash_pending_amount), currency: r?.close?.cash_pending_currency || null },
      state: r?.state || null,
    }
  })
}

// ── Línea de tiempo de UNA ruta (14 hitos) ───────────────────────────────────
// Cada hito: {key, label, status: done|pending|unknown|not_available, detail}.
// unknown = el contrato no lo acredita; not_available = capability apagada.
// NUNCA se marca "incumplimiento" por ausencia. Reglas canónicas: cargas =
// stock.picking; validated ≠ recepción física (se declara).
export function deriveRouteTimeline(route, capabilities = {}) {
  const r = route || {}
  const dep = r.departure || {}
  const stops = r.stops || {}
  const loads = r.loads || {}
  const initialLoad = (loads.items || []).find((i) => i?.load_kind === 'initial') || null
  const refillPending = (loads.items || []).some((i) => i?.load_kind === 'refill' && i?.status === 'pending_acceptance')
  const stage = r.close?.stage || 'unknown'
  const stageIdx = CLOSE_STAGE_ORDER.indexOf(stage)
  const has = (v) => v != null

  const departed = dep.status === 'on_time' || dep.status === 'late'
  const step = (key, label, status, detail) => ({ key, label, status, detail: detail || '' })

  return [
    step('checklist', 'Checklist de unidad', 'unknown', 'No expuesto por el contrato v1'),
    step('km_inicial', 'Kilometraje inicial', 'unknown', 'No expuesto por el contrato v1'),
    step('carga_preparada', 'Carga preparada', initialLoad ? 'done' : (loads.available === false ? 'not_available' : 'unknown'),
      initialLoad ? `picking ${initialLoad.picking_id}` : (loads.available === false ? 'Cargas no disponibles' : 'Sin carga inicial registrada')),
    step('carga_aceptada', 'Carga aceptada', initialLoad?.status === 'accepted' ? 'done' : (initialLoad ? 'pending' : 'unknown'),
      initialLoad?.accepted_at ? `aceptada ${String(initialLoad.accepted_at).slice(11, 16)}` : (initialLoad ? 'Pendiente de aceptar' : '')),
    step('salida', 'Salida', departed ? 'done' : (dep.status === 'not_departed' ? 'pending' : 'unknown'),
      has(dep.real_at) ? `${departureLabel(dep.status)} · ${deviationText(dep.deviation_minutes)}` : departureLabel(dep.status)),
    step('primera_visita', 'Primera visita', num(stops.done) > 0 ? 'done' : (num(stops.total) ? 'pending' : 'unknown'),
      has(stops.next_stop?.name) ? `Siguiente: ${stops.next_stop.name}` : ''),
    step('ventas', 'Ventas / no ventas', num(stops.done) > 0 ? 'done' : 'unknown',
      `${num(stops.done) ?? '—'} / ${num(stops.total) ?? '—'} paradas`),
    step('incidencias', 'Incidencias', (r.incident_markers || []).length > 0 ? 'done' : 'unknown',
      (r.incident_markers || []).length > 0 ? `${r.incident_markers.length} marcador(es)` : 'Sin marcadores (no es "sin incidencias")'),
    step('refill', 'Refill', refillPending ? 'pending' : (loads.available === false ? 'not_available' : 'unknown'),
      refillPending ? 'Refill pendiente de aceptar' : ''),
    step('regreso', 'Regreso', stageIdx >= 1 ? 'done' : 'unknown', 'Derivado de la etapa de cierre'),
    step('km_final', 'Kilometraje final', 'unknown', 'No expuesto por el contrato v1'),
    step('cierre', 'Cierre', stageIdx >= 1 ? 'done' : (departed ? 'pending' : 'unknown'), `Etapa: ${closeStageLabel(stage)}`),
    step('corte', 'Corte', stageIdx >= 2 ? 'done' : (stageIdx >= 1 ? 'pending' : 'unknown'),
      has(r.close?.cash_pending_amount) && Number(r.close.cash_pending_amount) > 0 ? 'Con caja pendiente' : ''),
    step('conciliacion', 'Conciliación / devolución',
      stage === 'validated' ? 'done' : (stageIdx >= 2 ? 'pending' : 'unknown'),
      capabilities.route_return_receipt_available === false
        ? 'Conciliación de SISTEMA — no acredita recepción física'
        : 'Conciliación'),
  ]
}

// ── Segmentación de clientes (desde route-stops de una o varias rutas) ────────
// Segmentos honestos por resultado de parada; sin fuente ⇒ el segmento no aparece.
export const CUSTOMER_SEGMENTS = Object.freeze([
  'planeados', 'visitados', 'pendientes', 'no_venta', 'con_venta', 'visita_tardia', 'incidencia', 'fuera_secuencia', 'sin_actividad',
])
export const CUSTOMER_SEGMENT_LABELS = Object.freeze({
  planeados: 'Planeados', visitados: 'Visitados', pendientes: 'Pendientes', no_venta: 'No venta',
  con_venta: 'Con venta', visita_tardia: 'Visita tardía', incidencia: 'Incidencia',
  fuera_secuencia: 'Fuera de secuencia', sin_actividad: 'Sin actividad', recuperacion: 'Recuperación',
})

export function segmentCustomers(stops) {
  const rows = Array.isArray(stops) ? stops : []
  const seg = { planeados: [], visitados: [], pendientes: [], no_venta: [], con_venta: [], incidencia: [], fuera_secuencia: [] }
  for (const st of rows) {
    seg.planeados.push(st)
    const state = String(st?.state || '').toLowerCase()
    const result = String(st?.result_status || '').toLowerCase()
    const visited = state === 'done' || state === 'visited' || !!st?.actual_end_time || !!st?.has_checkin
    if (visited) seg.visitados.push(st); else seg.pendientes.push(st)
    if (result.includes('no') && result.includes('vent')) seg.no_venta.push(st)
    else if (num(st?.sale_order_count) > 0) seg.con_venta.push(st)
    if (num(st?.incident_count) > 0 || st?.has_incident) seg.incidencia.push(st)
  }
  return seg
}

// ── Consolidación de Pendientes (autoridad ÚNICA por tipo) ────────────────────
// Base = priorities[] de #220 (4 tipos canónicos). Se añaden tipos derivados de
// day-control SIN duplicar los que priorities ya cubre. Cada item lleva su fuente.
export function derivePendientes(dayControl) {
  const items = []
  const priorities = Array.isArray(dayControl?.priorities) ? dayControl.priorities : []
  const coveredByPriority = new Set(priorities.map((p) => `${p.type}:${p.route_id}`))
  for (const p of priorities) {
    items.push({
      type: p.type, severity: p.severity || 'info', routeId: p.route_id ?? null,
      reason: p.reason || 'Pendiente', count: num(p.count) || 1,
      occurredAt: p.occurred_at || null, dataAsOf: p.data_as_of || null, source: 'day_control.priorities',
    })
  }
  // Cierres pendientes NO cubiertos por closure_pending priority (autoridad: routes.close).
  const routes = Array.isArray(dayControl?.routes) ? dayControl.routes : []
  for (const r of routes) {
    const stage = r?.close?.stage
    const key = `closure_pending:${r?.plan_id}`
    const cash = num(r?.close?.cash_pending_amount)
    if ((stage === 'closed' || stage === 'corte_done' || stage === 'liquidated') && !coveredByPriority.has(key)) {
      items.push({
        type: 'closure_incomplete', severity: cash && cash > 0 ? 'warning' : 'info', routeId: r?.plan_id ?? null,
        reason: `Ruta ${r?.route_name || ''} en etapa '${closeStageLabel(stage)}' sin validar${cash && cash > 0 ? ' (caja pendiente)' : ''}.`,
        count: 1, occurredAt: null, dataAsOf: r?.data_as_of?.generated_at || null, source: 'day_control.routes.close',
      })
    }
  }
  return items
}

export const PENDIENTE_TYPE_LABELS = Object.freeze({
  route_not_departed: 'Ruta sin salida', gps_stale: 'Sin señal', closure_pending: 'Cierre pendiente',
  load_pending_acceptance: 'Carga/refill pendiente', closure_incomplete: 'Cierre sin validar',
})

// ── Orden de la lista del Radar ──────────────────────────────────────────────
export const RADAR_ORDERS = Object.freeze(['urgente', 'ultima_senal', 'menor_avance', 'mayor_atraso', 'incidencias', 'ruta', 'chofer'])
export function orderRadarUnits(units, order = 'urgente', nowMs = null) {
  const list = [...(Array.isArray(units) ? units : [])]
  const sigRank = (u) => {
    const s = safeSignalStatus(u, nowMs)
    return s === 'no_signal' || s === 'invalid' ? 0 : s === 'delayed' ? 1 : 2
  }
  const cmp = {
    ultima_senal: (a, b) => (num(a.age_seconds) ?? Infinity) - (num(b.age_seconds) ?? Infinity),
    menor_avance: (a, b) => (num(a.stops?.done) ?? 0) - (num(b.stops?.done) ?? 0),
    incidencias: (a, b) => (num(b.incident_count) ?? 0) - (num(a.incident_count) ?? 0),
    ruta: (a, b) => String(a.route_name || '').localeCompare(String(b.route_name || '')),
    chofer: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
    urgente: (a, b) => sigRank(a) - sigRank(b) || (num(b.age_seconds) ?? 0) - (num(a.age_seconds) ?? 0),
  }
  return list.sort(cmp[order] || cmp.urgente)
}
