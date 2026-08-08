// ─── Torre curada del supervisor — modelo PURO (sin React) ───────────────────
// La Torre de Aida NO repite Pendientes. El reparto es deliberado:
//   · Pendientes  = lo ACCIONABLE de hoy (candidatas, gestión por acción, riesgo).
//   · Torre       = el ENVEJECIMIENTO y la CAJA ATADA: dónde se está pudriendo
//                   el backlog y dónde está el dinero viejo.
// Por eso aquí el número protagonista es "abiertas >7 días" y no "abiertas".
//
// Todo lo que se puede probar sin navegador vive en este archivo. La pantalla
// solo presenta: no re-clasifica buckets, no recalcula KPIs, no reinterpreta
// `recommended_action` — eso lo decide el backend y se muestra tal cual.
import { fmtInt, fmtMoney } from '../../torre/m1/m1BacklogModel.js'  // extension explicita: node --test lo importa como ESM
import { civilWeekRange } from '../v2/civilWeek.js'

// ── Período: la Torre abre en la SEMANA EN CURSO, no en el backlog viejo ──────
// Hallazgo de la auditoría: la Torre arrancaba filtrada a ">7 días", así que
// Aida abría y NO veía la operación de la semana, solo lo añejo. Ahora el
// arranque es la semana en curso (su realidad diaria) y el histórico queda como
// una vista aparte, a un clic.
//
// Semana (rango de fechas) y antigüedad (edad de la ruta) miden ejes DISTINTOS y
// se contradicen: "esta semana" + ">7 días" da vacío. Por eso son excluyentes:
// elegir uno limpia el otro (ver applyPeriod/applyAging).
export const TORRE_PERIODS = Object.freeze([
  { value: 'week', label: 'Semana en curso' },
  { value: 'historical', label: 'Histórico (+7 días)' },
])

/** Rango Lun–Dom que contiene `todayStr` ('YYYY-MM-DD'); tz-neutral. */
export function weekRange(todayStr) {
  const wk = civilWeekRange(todayStr)
  return { date_from: wk.monday || '', date_to: wk.sunday || '' }
}

/** ¿En qué período estamos, a partir de los filtros vivos? El histórico se
 *  reconoce por el bucket de antigüedad; cualquier otra cosa es "semana". */
export function periodOf(filters) {
  return (filters && filters.bucket === 'historical') ? 'historical' : 'week'
}

/** Filtros iniciales de la Torre: semana en curso, abiertas, sin antigüedad. */
export function initialTorreFilters(todayStr) {
  return { state_bucket: 'open', bucket: '', ...weekRange(todayStr) }
}

/** Delta al cambiar de período. Cada preset deja un conjunto COHERENTE:
 *   · week       → rango de la semana, sin filtro de antigüedad;
 *   · historical → antigüedad >7 días, sin rango de fechas (si no, vacío). */
export function applyPeriod(period, todayStr) {
  if (period === 'historical') {
    return { bucket: 'historical', date_from: '', date_to: '' }
  }
  return { bucket: '', ...weekRange(todayStr) }
}

/** Delta al elegir una antigüedad concreta desde los chips. Si se pide cualquier
 *  antigüedad, se sale de la semana (ejes excluyentes); volver a "toda" reanuda
 *  la semana en curso. */
export function applyAging(bucket, todayStr) {
  if (bucket) return { bucket, date_from: '', date_to: '' }
  return { bucket: '', ...weekRange(todayStr) }
}

// Los tres números del encabezado, en el orden en que importan para este puesto.
// `open_routes_over_7d` va primero A PROPÓSITO: es la señal de envejecimiento y
// hoy es la que no se ve en ningún lado (200 de 217 abiertas la cruzan).
export const HEADER_KPI_KEYS = Object.freeze([
  'open_routes_over_7d',
  'cash_pending_amount',
  'cash_closed_pending_amount',
])

// Etiquetas propias del puesto. Las del modelo compartido están escritas para
// dirección ("Venta cash pendiente de recepción") y afirman algo que el backend
// no ha confirmado; aquí la etiqueta de dinero es NEUTRA.
export const HEADER_KPI_LABELS = Object.freeze({
  open_routes_over_7d: 'Abiertas con más de 7 días',
  cash_pending_amount: 'Caja pendiente (abiertas)',
  cash_closed_pending_amount: 'Caja pendiente (ya cerradas)',
})

/** Los KPIs del encabezado, en orden, desde las tarjetas ya normalizadas. */
export function headerKpis(cards) {
  const byKey = new Map((Array.isArray(cards) ? cards : []).map((c) => [c.key, c]))
  return HEADER_KPI_KEYS.map((key) => {
    const card = byKey.get(key)
    return {
      key,
      label: HEADER_KPI_LABELS[key],
      value: card ? card.value : null,
      kind: card ? card.kind : 'int',
      // `null` NO es cero: "no vino el dato" y "no hay nada" son cosas distintas.
      text: !card || card.value === null || card.value === undefined
        ? '—'
        : (card.kind === 'money' ? fmtMoney(card.value) : fmtInt(card.value)),
    }
  })
}

/** Qué monto muestra una fila según el bucket que se está mirando. */
export function cashForBucket(row, stateBucket) {
  if (!row) return 0
  return stateBucket === 'closed_cash_pending'
    ? (row.cash_closed_pending_amount || 0)
    : (row.cash_pending_amount || 0)
}

/**
 * Avance en piso. Distingue "ya terminó y solo falta la caja" de "va a medias",
 * que es justo lo que hay que separar para cazar dinero atado.
 */
export function progressOf(row) {
  const total = Number(row?.stops_total) || 0
  const done = Number(row?.stops_done) || 0
  const finished = row?.all_stops_done === true
  return {
    done,
    total,
    finished,
    // Sin paradas no se inventa un 0%: no hay avance que medir.
    pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null,
    label: total > 0 ? `${done}/${total}` : '—',
    note: finished ? 'terminada en piso' : '',
  }
}

// Riesgo con ETIQUETA, no solo color: un punto de color no se lee en impresión,
// ni con daltonismo, ni en un lector de pantalla. Tonos AA sobre blanco.
export const RISK_LIGHT = Object.freeze({
  high: { label: 'Alto', fg: '#b91c1c', bg: '#FEE2E2' },
  medium: { label: 'Medio', fg: '#b45309', bg: '#FEF3C7' },
  low: { label: 'Bajo', fg: '#166534', bg: '#DCFCE7' },
  unknown: { label: 'Sin evaluar', fg: '#5B7285', bg: '#EEF4F8' },
})

export function riskTone(level) {
  return RISK_LIGHT[level] || RISK_LIGHT.unknown
}

/**
 * Sobre cuántas filas habla lo que se está viendo. El endpoint topa en
 * `MAX_LIMIT`; si el total lo supera, la pantalla tiene que DECIRLO en vez de
 * dejar creer que la página es el universo.
 */
export function coverage(rowsCounted, total) {
  const shown = Math.max(0, Number(rowsCounted) || 0)
  const all = Math.max(0, Number(total) || 0)
  return {
    rowsCounted: shown,
    total: all,
    partial: all > shown,
    text: all > shown ? `Mostrando ${shown} de ${all}` : `${all} en total`,
  }
}

// Antigüedad: el bucket del contrato (`bucket`) con el nombre que usa la
// supervisora. `''` = sin filtro.
export const AGING_FILTERS = Object.freeze([
  { value: '', label: 'Toda antigüedad' },
  { value: 'day', label: 'Hoy' },
  { value: 'recent', label: '1–7 días' },
  { value: 'historical', label: 'Más de 7 días' },
])

// Orden: los tres que tienen sentido para un solo puesto. `branch_name` se
// excluye a propósito — con una sucursal, ordenar por sucursal no ordena nada.
export const TORRE_SORTS = Object.freeze([
  { value: 'age_days', label: 'Más viejas primero' },
  { value: 'cash_pending_amount', label: 'Más caja primero' },
  { value: 'scheduled_date', label: 'Más recientes primero' },
])

// Buckets con el nombre que dice qué es cada uno para este puesto.
export const TORRE_BUCKETS = Object.freeze([
  { value: 'open', label: 'Abiertas', hint: 'sin cerrar' },
  { value: 'draft', label: 'Draft', hint: 'ni arrancaron el cierre' },
  { value: 'closed_cash_pending', label: 'Cerradas con caja', hint: 'dinero atado' },
])

/** Ruta de detalle. Solo NAVEGA: esta superficie no ejecuta acciones. */
export function routeDetailPath(row) {
  const id = Number(row?.plan_id)
  return Number.isFinite(id) && id > 0 ? `/equipo/rutas?plan=${id}` : '/equipo/rutas'
}

// Fecha de servidor: es cuándo quedó REGISTRADO, no cuándo ocurrió. Se muestra
// corta y se dice en la leyenda; no se disfraza de "hace X".
export function fmtActivity(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return '—'
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16)
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d)
}
