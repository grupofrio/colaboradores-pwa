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
