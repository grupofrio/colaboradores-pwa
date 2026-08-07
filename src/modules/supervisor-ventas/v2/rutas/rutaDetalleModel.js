// ─── Modelo PURO del detalle de ruta (sin JSX) ───────────────────────────────
// Deriva del DTO enriquecido de route-stops: horas en tz centro, duración de
// visita, hueco de trayecto entre paradas, clientes por hora y la marca de
// visita sospechosa. Todo testeable. null ≠ 0: sin dato, "—", nunca un 0/0:00.

const CENTER_TZ = 'America/Mexico_City'
const _hm = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CENTER_TZ })
const _h = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', hour12: false, timeZone: CENTER_TZ })

function _date(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "HH:MM" en tz centro, o "—" si no hay dato. */
export function centerTime(iso) {
  const d = _date(iso)
  return d ? _hm.format(d) : '—'
}

/** Duración en min (float) → "Xm Ys" legible. null o inválido → "—". */
export function durationLabel(minutes) {
  if (minutes == null || !(Number(minutes) >= 0)) return '—'
  const total = Math.round(Number(minutes) * 60)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}s`
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/** Brecha en minutos → texto ("tardó X en arrancar"). null → "—". */
export function gapLabel(minutes) {
  if (minutes == null || !(Number(minutes) >= 0)) return '—'
  const m = Math.round(Number(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

/** Hueco de trayecto hacia cada parada = inicio(n) − fin(n−1), en minutos.
 *  Devuelve un mapa {stop_id: minutos|null}. Faltantes → null (honesto). */
export function travelGaps(stops) {
  const out = {}
  const list = Array.isArray(stops) ? stops : []
  let prevEnd = null
  for (const st of list) {
    const start = _date(st?.actual_start_time)
    let gap = null
    if (start && prevEnd) {
      const diff = (start.getTime() - prevEnd.getTime()) / 60000
      gap = diff >= 0 ? Math.round(diff * 10) / 10 : null
    }
    out[st?.stop_id ?? `i${Object.keys(out).length}`] = gap
    const end = _date(st?.actual_end_time)
    // Solo el fin de la parada inmediatamente anterior puede formar un trayecto.
    prevEnd = end
  }
  return out
}

/** Clientes visitados por hora (tz centro), como serie para barras etiquetadas
 *  {label, value, is_current:false}. Solo horas con visitas, ordenadas. */
export function visitsByHour(stops) {
  const list = Array.isArray(stops) ? stops : []
  const counts = new Map()
  for (const st of list) {
    const d = _date(st?.actual_start_time)
    if (!d) continue
    const hourKey = Number(_h.format(d).replace(/\D/g, ''))
    counts.set(hourKey, (counts.get(hourKey) || 0) + 1)
  }
  return [...counts.keys()].sort((a, b) => a - b).map((h) => ({
    label: `${h}h`, value: counts.get(h), is_current: false,
  }))
}

/** Visita sospechosa: <1 min Y check-in a >300 m (misma def del brief/calidad).
 *  Requiere ambos datos; sin distancia no se acusa. */
export function isSuspicious(stop) {
  const dur = stop?.visit_duration_min
  const dist = stop?.checkin_distance_m
  return dur != null && Number(dur) > 0 && Number(dur) < 1 && dist != null && Number(dist) > 300
}

/** ¿la parada fue venta? (para decidir si mostrar importe). */
export function isSale(stop) {
  const rs = String(stop?.result_status || '').toLowerCase()
  return rs === 'sale' || rs === 'venta' || (Number(stop?.sale_order_count || 0) > 0)
}

// ── Orden de EJECUCIÓN (Sprint 2) ───────────────────────────────────────────
// Las paradas venían en orden de SECUENCIA PLANEADA, así que un salto de
// secuencia no se veía: había que compararlo mentalmente con las horas. Ahora
// mandan las visitadas por hora real (el recorrido tal como ocurrió) y después
// las pendientes en su secuencia planeada. El número de secuencia sigue visible
// en cada fila, así que ver "10, 50, 20" ES la señal de fuera de orden.
/** Secuencia planeada, o null si NO hay. `Number(null)` es 0 —y 0 es finito—, así
 *  que la ausencia se colaba como "parada 0": se ordenaba primero y se acusaba de
 *  fuera de orden tras cualquier parada real. Ausencia ≠ cero. */
export function stopSequence(st) {
  const raw = st?.sequence
  if (raw === null || raw === undefined || raw === '' || raw === false) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function sortStopsByExecution(stops) {
  const rows = Array.isArray(stops) ? stops : []
  const key = (st) => (st?.actual_start_time ? String(st.actual_start_time) : null)
  return [...rows]
    .map((st, i) => ({ st, i }))
    .sort((a, b) => {
      const ka = key(a.st)
      const kb = key(b.st)
      if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : a.i - b.i
      if (ka) return -1            // visitada antes que pendiente
      if (kb) return 1
      const sa = stopSequence(a.st) ?? Number.POSITIVE_INFINITY   // sin secuencia ⇒ al final
      const sb = stopSequence(b.st) ?? Number.POSITIVE_INFINITY
      return (sa - sb) || (a.i - b.i)
    })
    .map((x) => x.st)
}

/** Puntos donde la ejecución DESCENDIÓ respecto de la parada anterior visitada.
 *
 *  Regla de negocio (Codex P2-5): se marca el DESCENSO, no toda la recuperación.
 *  Con ejecución 50 → 10 → 20 se marca solo el 10 (ahí bajó el orden); el 20 ya
 *  va subiendo y no se le imputa nada. La marca es descriptiva ("bajó en la
 *  secuencia"), no una acusación: reordenar puede ser legítimo.
 *
 *  Una parada SIN secuencia planeada no es evaluable y nunca se marca ni corta
 *  la comparación. Devuelve un Set de stop_id. */
export function outOfSequenceStopIds(stopsInExecutionOrder) {
  const out = new Set()
  let prevSeq = null
  for (const st of (Array.isArray(stopsInExecutionOrder) ? stopsInExecutionOrder : [])) {
    if (!st?.actual_start_time) continue
    const seq = stopSequence(st)
    if (seq == null) continue          // ausencia ⇒ no evaluable
    if (prevSeq != null && seq < prevSeq) out.add(st?.stop_id)
    prevSeq = seq
  }
  return out
}

/** Distancia del check-in en texto honesto (0 m es válido: "en sitio"). */
export function checkinDistanceLabel(meters) {
  const m = Number(meters)
  if (!Number.isFinite(m) || meters == null) return null
  if (m < 1) return 'en sitio'
  if (m < 1000) return `a ${Math.round(m)} m`
  return `a ${(m / 1000).toFixed(1)} km`
}

/** Marca de tiempo del backend → epoch ms, SIEMPRE interpretada como UTC.
 *
 *  Odoo emite unos campos como "YYYY-MM-DDTHH:mm:ssZ" y otros (day-control
 *  `departure.real_at`) como "YYYY-MM-DD HH:mm:ss" SIN zona. `Date.parse` trata
 *  la segunda forma como hora LOCAL, así que restarla de una marca UTC daba
 *  brechas negativas de horas y la UI las escondía como "Sin dato". Aquí se
 *  normaliza: sin zona explícita, es UTC (que es lo que Odoo guarda).
 */
export function parseServerTime(value) {
  if (!value) return null
  const raw = String(value).trim()
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw)
    ? raw.replace(' ', 'T')
    : raw.replace(' ', 'T') + 'Z'
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/** Brecha en minutos entre dos marcas del servidor. Devuelve:
 *   {minutes}                 cuando se puede calcular y es coherente;
 *   {minutes:null, anomaly}   cuando la segunda es ANTERIOR a la primera —eso es
 *                             un dato imposible y se DECLARA, no se esconde;
 *   null                      cuando falta alguna marca. */
export function serverGapMinutes(fromValue, toValue) {
  const a = parseServerTime(fromValue)
  const b = parseServerTime(toValue)
  if (a == null || b == null) return null
  const minutes = Math.round((b - a) / 60000)
  if (minutes < 0) return { minutes: null, anomaly: 'anterior' }
  return { minutes, anomaly: null }
}
