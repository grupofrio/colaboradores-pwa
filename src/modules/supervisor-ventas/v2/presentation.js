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
/** Métrica honesta (Codex §11): value numérico o null; available=false ⇒
 *  "Sin dato". Lleva `source` y `dataAsOf` para que la UI cite su procedencia y
 *  frescura (nunca un 0 fabricado sin fuente). */
const metric = (v, source = null, dataAsOf = null) => {
  const n = num(v)
  return n === null
    ? { value: null, available: false, source, dataAsOf }
    : { value: n, available: true, source, dataAsOf }
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
  const asOf = dayControl?.generated_at || null
  const SRC_SUM = 'day_control.summary'
  const SRC_CLOSE = 'day_control.summary.close'

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
  // §11: el bloque `close` puede faltar ⇒ conteo NO disponible (no "0"). Suma
  // HONESTA: solo se totaliza sobre etapas presentes; si falta alguna requerida
  // la suma es PARCIAL (partial=true + `missing`), NUNCA se coacciona null a 0
  // (antes: `num(close[k]) || 0`, que fabricaba una suma "completa" falsa).
  const sumStagesHonest = (keys) => {
    const present = keys.filter((k) => num(close[k]) !== null)
    const missing = keys.filter((k) => num(close[k]) === null)
    if (present.length === 0) {
      return { value: null, available: false, partial: false, missing, source: SRC_CLOSE, dataAsOf: asOf }
    }
    const knownSum = present.reduce((acc, k) => acc + num(close[k]), 0)
    return { value: knownSum, available: true, partial: missing.length > 0, missing, source: SRC_CLOSE, dataAsOf: asOf }
  }
  // "cerradas" = etapas de cierre != open (closed/corte_done/liquidated/validated).
  const cerradas = sumStagesHonest(['closed', 'corte_done', 'liquidated', 'validated'])
  // cierres pendientes = cerradas pero sin validar (closed+corte_done+liquidated).
  const cierresPendientes = sumStagesHonest(['closed', 'corte_done', 'liquidated'])
  // cargas pendientes = refill + inicial. Si AMBAS faltan ⇒ no disponible; si solo
  // una falta ⇒ suma parcial declarada (no se coacciona a 0 la faltante).
  const refill = num(s.pending_refill_acceptance)
  const inicial = num(s.pending_initial_acceptance)
  const cargasMissing = [refill === null ? 'refill' : null, inicial === null ? 'inicial' : null].filter(Boolean)
  const cargasPendientes = refill === null && inicial === null
    ? { value: null, available: false, partial: false, missing: cargasMissing, source: SRC_SUM, dataAsOf: asOf }
    : { value: (refill || 0) + (inicial || 0), available: true, partial: cargasMissing.length > 0, missing: cargasMissing, source: SRC_SUM, dataAsOf: asOf }

  return {
    planeadas: metric(s.routes_total, SRC_SUM, asOf),
    salieron: metric(s.departed, SRC_SUM, asOf),
    tarde: metric(s.departed_late, SRC_SUM, asOf),
    sinSalir: metric(s.not_departed, SRC_SUM, asOf),
    sinDatoSalida: metric(s.departure_unknown, SRC_SUM, asOf),
    activas: { value: activas, available: routes.length > 0, source: 'day_control.routes', dataAsOf: asOf },
    // "regresando" no tiene señal canónica en day_control/1 ⇒ no se inventa.
    regresando: { value: null, available: regresandoAvailable, source: null, dataAsOf: asOf },
    cerradas,
    conIncidencia: { value: conIncidencia, available: routes.length > 0, source: 'day_control.routes', dataAsOf: asOf },
    sinSenal: { value: sinSenal, available: routes.length > 0, source: 'day_control.routes', dataAsOf: asOf },
    cargasPendientes,
    cierresPendientes,
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
      // QUÉ se ejecuta (segmento/subpolígono/polígono), no solo quién.
      operationalPlan: r?.operational_plan || null,
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
// Kilometraje y checklist: el backend ya los acredita (bloques `odometer` y
// `checklist` del contrato de day-control). Antes los tres hitos decían "No
// expuesto por el contrato v1", que era cierto y ya no lo es.
//
// El backend manda `null` cuando NO hay captura — nunca 0 —, porque el campo de
// Odoo es Float con default 0.0 y un 0 se leería como "salió con el odómetro en
// cero". Aquí se respeta esa distinción: sin lectura no se pinta un número.
export function formatKm(value) {
  if (value == null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
}

function kmStatus(value, available, esperado) {
  if (!available) return 'not_available'
  if (value != null) return 'done'
  // Sin captura: "pendiente" solo cuando el momento de capturarlo YA pasó.
  // Antes de salir no falta nada.
  return esperado ? 'pending' : 'unknown'
}

function kmDetail(value, available, esperado, momento) {
  if (!available) return 'Kilometraje no disponible'
  const km = formatKm(value)
  if (km) return km
  return esperado ? `Sin captura ${momento}` : 'Aún no corresponde'
}

function kmFinalDetail(odo, available, closed) {
  const base = kmDetail(odo.arrival_km, available, closed, 'al cerrar')
  const recorrido = formatKm(odo.traveled_km)
  // El recorrido solo aparece con las DOS lecturas; el backend ya lo deja en
  // null si falta una o si el par es incoherente.
  return recorrido ? `${base} · recorrido ${recorrido}` : base
}

const CHECKLIST_LABELS = {
  completed: 'Completado',
  in_progress: 'En progreso',
  draft: 'Iniciado sin responder',
  cancelled: 'Cancelado',
}

function checklistStatus(chk, available) {
  if (!available) return 'not_available'
  if (chk.state === 'completed') return 'done'
  // Sin checklist ligado NO es incumplimiento: el flujo es de adopción reciente
  // y la mayoría de las rutas todavía no lo usa. Se declara como desconocido.
  if (!chk.state) return 'unknown'
  return 'pending'
}

function checklistDetail(chk, available) {
  if (!available) return 'Checklist no disponible'
  if (!chk.state) return 'Sin checklist ligado a la ruta (no es "sin revisar")'
  const label = CHECKLIST_LABELS[chk.state] || chk.state
  const partes = [label]
  if (chk.checks_answered != null && chk.checks_total != null) {
    partes.push(`${chk.checks_answered}/${chk.checks_total} puntos`)
  }
  if (chk.checks_required_pending != null && chk.checks_required_pending > 0) {
    partes.push(`${chk.checks_required_pending} obligatorio(s) pendiente(s)`)
  }
  return partes.join(' · ')
}

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
  const closed = stageIdx >= 1
  const step = (key, label, status, detail) => ({ key, label, status, detail: detail || '' })

  const odo = r.odometer || {}
  const chk = r.checklist || {}
  const odoOn = capabilities.odometer_available !== false
  const chkOn = capabilities.checklist_available !== false

  return [
    step('checklist', 'Checklist de unidad', checklistStatus(chk, chkOn), checklistDetail(chk, chkOn)),
    step('km_inicial', 'Kilometraje inicial',
      kmStatus(odo.departure_km, odoOn, departed),
      kmDetail(odo.departure_km, odoOn, departed, 'al salir')),
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
    step('km_final', 'Kilometraje final',
      kmStatus(odo.arrival_km, odoOn, closed),
      kmFinalDetail(odo, odoOn, closed)),
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

// ── Jerarquía de ATENCIÓN de las rutas del día ───────────────────────────────
// Las 5 tarjetas pesaban igual: una ruta que NO ha salido (sin venta, sin señal)
// se leía como cualquier otra. Aquí se ordena por lo que necesita a la
// supervisora AHORA, y cada fila declara POR QUÉ subió (nunca solo un color).
export const ATTENTION_NONE = 'ok'

// Etapas de cierre que YA no están abiertas pero todavía no se validan.
const CLOSE_PENDING_STAGES = new Set(['closed', 'corte_done', 'liquidated'])

export function routeAttention(row) {
  const dep = String(row?.departureStatus || 'unknown')
  const done = num(row?.stopsDone)
  const total = num(row?.stopsTotal)
  // 1. No salió: es lo único que todavía se puede corregir hoy temprano.
  if (dep === 'not_departed') return { rank: 0, level: 'bad', reason: 'No ha salido' }
  // 2. Cerró con CAJA PENDIENTE: es dinero de la empresa sin validar. Va antes
  //    que cualquier aviso informativo (la Torre acumuló $607K justo así).
  const cash = num(row?.cashPending?.amount)
  const stage = String(row?.closeStage || 'unknown')
  if (CLOSE_PENDING_STAGES.has(stage) && cash != null && cash > 0) {
    return { rank: 1, level: 'bad', reason: 'Caja pendiente' }
  }
  // 3. Salió tarde.
  if (dep === 'late') return { rank: 2, level: 'warn', reason: 'Salió tarde' }
  // 4. Incidencias abiertas.
  if (num(row?.incidentCount) > 0) return { rank: 3, level: 'warn', reason: 'Con incidencia' }
  // 5. Cierre sin validar (aunque no se conozca el monto de caja).
  if (CLOSE_PENDING_STAGES.has(stage)) {
    return { rank: 4, level: 'warn', reason: 'Cierre sin validar' }
  }
  // 6. Sin señal GPS: no se puede verificar la ejecución.
  const sig = String(row?.signalStatus || '')
  if (sig === 'no_signal' || sig === 'invalid') return { rank: 5, level: 'warn', reason: 'Sin señal' }
  // 7. Salió y todavía no marca visitas. NO es alarma: a primera hora es lo normal
  //    (Codex P2-4). Se informa en tono neutro y solo cuando ya salió de verdad.
  if (dep !== 'unknown' && dep !== 'not_departed' && total != null && total > 0 && done === 0) {
    return { rank: 6, level: 'info', reason: 'Sin visitas aún' }
  }
  return { rank: 9, level: ATTENTION_NONE, reason: null }
}

/** Rutas ordenadas por atención; empate ⇒ orden estable por nombre. */
export function sortRoutesByAttention(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((r, i) => ({ r, i, a: routeAttention(r) }))
    .sort((x, y) => (x.a.rank - y.a.rank) || (x.i - y.i))
    .map((x) => x.r)
}

// ── Segmentación de clientes (desde route-stops de una o varias rutas) ────────
// Segmentos honestos por resultado de parada; sin fuente ⇒ el segmento no aparece.
export const CUSTOMER_SEGMENTS = Object.freeze([
  'planeados', 'visitados', 'pendientes', 'no_venta', 'con_venta', 'visita_tardia', 'incidencia', 'fuera_secuencia', 'sin_actividad', 'sin_cliente', 'prospectos',
])
export const CUSTOMER_SEGMENT_LABELS = Object.freeze({
  planeados: 'Planeados', visitados: 'Visitados', pendientes: 'Pendientes', no_venta: 'No venta',
  con_venta: 'Con venta', visita_tardia: 'Visita tardía', incidencia: 'Incidencia',
  fuera_secuencia: 'Fuera de secuencia', sin_actividad: 'Sin actividad', recuperacion: 'Recuperación',
  sin_cliente: 'Sin cliente ni prospecto', prospectos: 'Prospectos',
})

const hasId = (v) => {
  if (v === null || v === undefined || v === false || v === '') return false
  if (Array.isArray(v)) return Number(v[0]) > 0        // forma m2o [id, name]
  return Number(v) > 0
}

/** Parada de PROSPECCIÓN: no hay cliente de cartera, hay un lead (crm.lead). Es
 *  una visita real y con nombre — solo que a un prospecto, no a un cliente. El
 *  backend lo declara con is_prospect/stop_kind='lead'. */
export function isProspectStop(stop) {
  // El CLIENTE manda: una parada con cliente NUNCA es prospecto, aunque el
  // backend traiga is_prospect/stop_kind='lead' de un lead convertido.
  if (hasId(stop?.customer_id)) return false
  if (stop?.is_prospect === true) return true
  if (String(stop?.stop_kind || '') === 'lead') return true
  return hasId(stop?.lead_id)
}

/** Anomalía real: la parada no tiene NI cliente NI prospecto ⇒ no es visitable
 *  ni verificable. Hoy en la sucursal 29 son CERO; el segmento existe para que,
 *  si aparece una, se vea en vez de esconderse entre las pendientes. */
export function isStopWithoutCustomer(stop) {
  return !hasId(stop?.customer_id) && !isProspectStop(stop)
}

export function segmentCustomers(stops) {
  const rows = Array.isArray(stops) ? stops : []
  const seg = { planeados: [], visitados: [], pendientes: [], no_venta: [], con_venta: [], incidencia: [], fuera_secuencia: [], sin_cliente: [], prospectos: [] }
  for (const st of rows) {
    // planeados = TODAS las paradas del plan (incluidas las que no tienen
    // cliente): es el total real de lo planeado, no se maquilla.
    seg.planeados.push(st)
    // Anomalía (ni cliente ni prospecto) y prospección: ambas siguen contando en
    // visitados/pendientes —son paradas reales del plan— y ADEMÁS se agrupan en su
    // propio chip. Así el chip nuevo no altera en silencio los conteos existentes.
    if (isStopWithoutCustomer(st)) seg.sin_cliente.push(st)
    else if (isProspectStop(st)) seg.prospectos.push(st)
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
