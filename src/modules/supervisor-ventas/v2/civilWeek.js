// ─── Semana CIVIL pura (Codex §14) ───────────────────────────────────────────
// Calcula el rango Lun–Dom a partir de una fecha 'YYYY-MM-DD' con aritmética de
// fechas CIVIL (sin Date/Intl dependiente de la zona del dispositivo). Elimina el
// sesgo de `new Date()` local: la referencia por defecto es la fecha UTC (neutral
// e idéntica para todos los dispositivos). El IDEAL sigue siendo la fecha
// operativa de la SUCURSAL server-side (follow-up: rango de semana en el backend);
// aquí se garantiza al menos consistencia tz-neutral y que la pantalla y su
// servicio compartan EXACTAMENTE la misma base (sin desincronización).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const daysInMonth = (y, m) => (m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1])

function parseCivil(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''))
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return { y, m: mo, d }
}

const pad = (n) => String(n).padStart(2, '0')
const fmt = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`

// Día de la semana civil (0=domingo..6=sábado) por congruencia de Sakamoto.
export function civilWeekday({ y, m, d }) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const yy = m < 3 ? y - 1 : y
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7
}

// Suma `n` días (n puede ser negativo) a una fecha civil.
export function addDays(date, n) {
  let { y, m, d } = date
  d += n
  while (d < 1) { m -= 1; if (m < 1) { m = 12; y -= 1 } d += daysInMonth(y, m) }
  while (d > daysInMonth(y, m)) { d -= daysInMonth(y, m); m += 1; if (m > 12) { m = 1; y += 1 } }
  return { y, m, d }
}

// Fecha UTC de hoy como 'YYYY-MM-DD' (neutral respecto a la zona del dispositivo).
export function utcTodayStr(nowMs = null) {
  const ms = typeof nowMs === 'number' ? nowMs : Date.parse(new Date().toISOString())
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Rango Lun–Dom que contiene `refDateStr` (o la fecha UTC si se omite/ inválida).
 * @returns {{monday, sunday, days:string[7], todayIndex:number|-1, ref:string}}
 */
export function civilWeekRange(refDateStr, { fallbackToUtc = true } = {}) {
  let ref = parseCivil(refDateStr)
  if (!ref && fallbackToUtc) ref = parseCivil(utcTodayStr())
  if (!ref) return { monday: null, sunday: null, days: [], todayIndex: -1, ref: null }
  const wd = civilWeekday(ref) // 0=dom..6=sáb
  const backToMonday = (wd + 6) % 7 // lunes = índice 0
  const monday = addDays(ref, -backToMonday)
  const days = Array.from({ length: 7 }, (_, i) => fmt(addDays(monday, i)))
  const refStr = fmt(ref)
  return {
    monday: fmt(monday),
    sunday: fmt(addDays(monday, 6)),
    days,
    todayIndex: days.indexOf(refStr),
    ref: refStr,
  }
}
