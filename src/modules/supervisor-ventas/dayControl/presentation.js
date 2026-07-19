// ─── Day Control · helpers PUROS de presentación (PREP · post-RED) ───────────
// Espejo de PRESENTACIÓN del contrato day_control/1 + radar/1 (autoridad = JSON
// Schema en ./contracts/). Reglas duras (RED Codex P14):
//   · SOLO formatea enums/valores del contrato — NO reimplementa reglas backend;
//   · null/undefined ≠ 0 — ausencia se presenta como "Sin dato";
//   · la MONEDA viene del contrato: sin currency ⇒ "Moneda no disponible"
//     (jamás se asume MXN ni ninguna otra);
//   · timestamps futuros/edades negativas ⇒ señal 'invalid' (nunca 'recent');
//   · enum desconocido ⇒ estado NEUTRAL explícito, nunca crash ni verde.
// Sin React, sin fetch, sin estado.

export const DEPARTURE_LABELS = Object.freeze({
  not_departed: 'Sin salir',
  on_time: 'A tiempo',
  late: 'Tarde',
  unknown: 'Sin dato de salida',
})

// tone: token semántico abstracto (la rama ejecutable lo mapea a TOKENS.state).
export const DEPARTURE_TONES = Object.freeze({
  not_departed: 'risk',
  on_time: 'ok',
  late: 'risk',
  unknown: 'neutral', // sin dato NUNCA es rojo: no se acusa sin evidencia
})

const UNKNOWN_ENUM_LABEL = 'Estado no reconocido'

export function departureLabel(status) {
  if (status in DEPARTURE_LABELS) return DEPARTURE_LABELS[status]
  return UNKNOWN_ENUM_LABEL // enum fuera de contrato: neutral, no se adivina
}

export function departureTone(status) {
  return DEPARTURE_TONES[status] || 'neutral'
}

/** Texto de desviación: null ⇒ '' (nunca "+0 min" inventado). */
export function deviationText(deviationMinutes) {
  if (deviationMinutes === null || deviationMinutes === undefined) return ''
  const n = Number(deviationMinutes)
  if (!Number.isFinite(n)) return ''
  const rounded = Math.round(n)
  if (rounded === 0) return 'en punto'
  return rounded > 0 ? `+${rounded} min` : `${rounded} min`
}

export const CLOSE_STAGE_ORDER = Object.freeze([
  'open', 'closed', 'corte_done', 'liquidated', 'validated',
])

export const CLOSE_STAGE_LABELS = Object.freeze({
  open: 'Abierta',
  closed: 'Cerrada',
  corte_done: 'Corte hecho',
  liquidated: 'Liquidada',
  validated: 'Validada',
  unknown: 'Estado por confirmar',
})

export function closeStageLabel(stage) {
  if (stage in CLOSE_STAGE_LABELS) return CLOSE_STAGE_LABELS[stage]
  return CLOSE_STAGE_LABELS.unknown
}

export const SIGNAL_LABELS = Object.freeze({
  recent: 'Señal reciente',
  delayed: 'Señal retrasada',
  no_signal: 'Sin señal',
  invalid: 'Señal inválida',
})

export function signalLabel(status) {
  if (status in SIGNAL_LABELS) return SIGNAL_LABELS[status]
  return UNKNOWN_ENUM_LABEL
}

/**
 * Saneo de PRESENTACIÓN de la señal (no re-clasifica edades — eso es del
 * backend): si el timestamp de captura está en el futuro (más allá del skew) o
 * la edad viene negativa/no numérica con posición presente, el estado NO puede
 * presentarse como confiable ⇒ 'invalid' (nunca 'recent').
 */
export function safeSignalStatus(unit, nowMs = null, futureSkewMs = 120000) {
  const status = unit?.signal_status
  const captured = unit?.captured_at
  const age = unit?.age_seconds
  if (captured == null) {
    return status === 'no_signal' ? 'no_signal' : (status in SIGNAL_LABELS ? status : 'no_signal')
  }
  if (nowMs !== null) {
    const capturedMs = Date.parse(String(captured).replace(' ', 'T') + 'Z')
    if (Number.isFinite(capturedMs) && capturedMs > nowMs + futureSkewMs) return 'invalid'
  }
  if (age !== null && age !== undefined && (!Number.isFinite(Number(age)) || Number(age) < 0)) {
    return 'invalid'
  }
  return status in SIGNAL_LABELS ? status : 'invalid'
}

/** "hace 3 min" / "hace 1 h 10 min" — null/negativa ⇒ texto honesto. */
export function ageText(ageSeconds) {
  if (ageSeconds === null || ageSeconds === undefined) return 'sin señal registrada'
  const n = Number(ageSeconds)
  if (!Number.isFinite(n) || n < 0) return 'edad de señal inválida'
  if (n < 60) return 'hace menos de 1 min'
  const minutes = Math.floor(n / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `hace ${hours} h ${minutes % 60} min`
}

/**
 * Monto honesto y CURRENCY-AWARE: {text, available}.
 * - amount null/undefined o available=false ⇒ "Sin dato" (jamás $0);
 * - currency ausente con monto presente ⇒ "Moneda no disponible" (no se asume
 *   MXN ni ninguna moneda);
 * - formatea con el código de moneda del CONTRATO.
 */
export function moneyText(amount, currency, available = true) {
  if (!available || amount === null || amount === undefined) {
    return { text: 'Sin dato', available: false }
  }
  const n = Number(amount)
  if (!Number.isFinite(n)) return { text: 'Sin dato', available: false }
  if (!currency) return { text: 'Moneda no disponible', available: false }
  try {
    return {
      text: n.toLocaleString('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }),
      available: true,
    }
  } catch {
    // Código de moneda no soportado por Intl (p.ej. de prueba): formato neutro.
    return { text: `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${currency}`, available: true }
  }
}

/** Lista sales_day_by_currency ⇒ textos por moneda (para el caso no consolidado). */
export function moneyByCurrencyTexts(entries) {
  return (entries || []).map((e) => moneyText(e?.amount, e?.currency, true))
}

/** Meta: si no existe ⇒ copy explícito, jamás "$0" ni barra roja. */
export function targetText(target, currency) {
  if (target === null || target === undefined || Number(target) <= 0) {
    return { text: 'Sin meta configurada', hasTarget: false }
  }
  const money = moneyText(target, currency, true)
  return { text: money.text, hasTarget: money.available }
}

/** Buckets de jornada desde summary (los 5 del contrato; unknown NUNCA en tarde).
 *  summary ausente/parcial ⇒ ceros de CONTEO (contar 0 rutas es un hecho, no un
 *  monto inventado). */
export function journeyBuckets(summary) {
  const s = summary || {}
  return {
    total: s.routes_total ?? 0,
    departed: s.departed ?? 0,
    late: s.departed_late ?? 0,
    notDeparted: s.not_departed ?? 0,
    unknown: s.departure_unknown ?? 0,
  }
}

/** Agrupa prioridades por severidad SIN reordenar dentro de cada grupo. */
export function groupPriorities(priorities) {
  const groups = { critical: [], warning: [], info: [] }
  for (const p of priorities || []) {
    const bucket = groups[p?.severity] || groups.info
    bucket.push(p)
  }
  return groups
}

/**
 * Chip de conteo para una prioridad AGREGADA (P1-B). El backend YA deduplica: una
 * sola prioridad por ruta con `count` = nº de entidades únicas (p.ej. refills
 * pendientes) y `reason` ya redactado en plural ("2 refills pendientes…"). El
 * frontend muestra UNA tarjeta con ese reason y, si count>1, un chip "×N"; JAMÁS
 * pinta N tarjetas. (RED-2 P2: `related_entity_ids` fue eliminado del contrato v1;
 * `count` basta para la UX y no hay deep-link autorizado.)
 */
export function priorityCountChip(priority) {
  const count = Number(priority?.count)
  if (!Number.isFinite(count) || count <= 1) return { show: false, text: '', count: count || 1 }
  return { show: true, text: `×${count}`, count }
}

/** Etiqueta de hora server-received: "registrado HH:MM" (no "ocurrió"). */
export function serverReceivedTimeLabel(text) {
  if (!text) return ''
  const hhmm = String(text).slice(11, 16)
  return hhmm ? `registrado ${hhmm}` : ''
}

// ── Cargas de ruta (autoridad stock.picking; van.* DESCARTADO) ───────────────
// SOLO se presentan estados que el backend declara. Sin vocabulario van.*
// ("solicitud de refill", "aprobación de supervisor/inventario").
export const LOAD_KIND_LABELS = Object.freeze({
  initial: 'Carga inicial',
  refill: 'Refill',
  manual: 'Carga manual',
  unknown: 'Tipo no disponible',
})

export const LOAD_STATUS_LABELS = Object.freeze({
  prepared: 'Refill preparado',
  pending_acceptance: 'Pendiente de aceptar',
  accepted: 'Aceptado',
  cancelled: 'Cancelado',
  unknown: 'Estado no disponible',
})

export function loadKindLabel(kind) {
  return LOAD_KIND_LABELS[kind] || LOAD_KIND_LABELS.unknown
}

export function loadStatusLabel(status) {
  return LOAD_STATUS_LABELS[status] || LOAD_STATUS_LABELS.unknown
}

/**
 * Bloque de cargas de una ruta → presentación honesta.
 * - loads.available=false ⇒ "Información de cargas no disponible" (jamás 0);
 * - pending_acceptance_count null ⇒ "Aceptación no verificable" (no 0 inventado).
 */
export function loadsSummaryText(loads) {
  if (!loads || loads.available === false) {
    return { text: 'Información de cargas no disponible', available: false }
  }
  const count = loads.pending_acceptance_count
  if (count === null || count === undefined) {
    return { text: 'Aceptación de cargas no verificable', available: true, pending: null }
  }
  if (count === 0) return { text: 'Cargas al día', available: true, pending: 0 }
  return { text: `${count} carga(s) pendiente(s) de aceptar`, available: true, pending: count }
}

// ── Timezone (P1-C): SIEMPRE server-side ─────────────────────────────────────
// El backend resuelve la timezone efectiva (branch→company→system_fallback) y la
// declara en `timezone` + `timezone_source`. El frontend SOLO la etiqueta; NUNCA
// computa la fecha operativa desde el navegador (Date/Intl/zona local).
export const TIMEZONE_SOURCE_LABELS = Object.freeze({
  branch: 'Zona horaria de la sucursal',
  company: 'Zona horaria de la compañía',
  system_fallback: 'Zona horaria por defecto del sistema',
})

/** Etiqueta de la fuente de timezone (server-side). Enum desconocido ⇒ neutral. */
export function timezoneSourceLabel(source) {
  return TIMEZONE_SOURCE_LABELS[source] || 'Zona horaria no especificada'
}

const _isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const _DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Fecha operativa presentable: SIEMPRE la string del payload (resuelta server-side
 * con la timezone de la sucursal). El cliente NUNCA la deriva de su navegador.
 * RED-2 P3: validación ESTRICTA — solo `YYYY-MM-DD` (regex anclada, sin hora, sin
 * espacios, sin sufijos), con verificación de FECHA CIVIL real (mes 1-12, día 1-N
 * según el mes y el año bisiesto). JAMÁS usa Date/Intl (parsing permisivo del
 * navegador). Cualquier cosa fuera de contrato ⇒ copy neutral.
 */
export function operationalDateLabel(payloadDate) {
  const NEUTRAL = 'Fecha operativa no disponible'
  if (typeof payloadDate !== 'string') return NEUTRAL
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(payloadDate)
  if (!m) return NEUTRAL
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3])
  if (month < 1 || month > 12 || day < 1) return NEUTRAL
  const maxDay = month === 2 && _isLeapYear(year) ? 29 : _DAYS_IN_MONTH[month - 1]
  if (day > maxDay) return NEUTRAL
  return payloadDate
}

/** Resumen del mini-mapa: unidades con señal presentable vs sin señal/ inválida. */
export function radarSummary(units, nowMs = null) {
  let withSignal = 0
  let withoutSignal = 0
  for (const u of units || []) {
    const safe = safeSignalStatus(u, nowMs)
    if (safe === 'recent' || safe === 'delayed') withSignal += 1
    else withoutSignal += 1
  }
  return { withSignal, withoutSignal, total: (units || []).length }
}
