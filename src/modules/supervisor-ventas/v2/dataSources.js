// ─── Supervisor V2 · fuentes de datos canónicas (fuente ÚNICA por dato) ───────
// Regla dura: cada dato viene de UNA sola fuente. El shell carga los DOS payloads
// primarios (day-control + radar del contrato #220) una vez y los comparte a las
// 6 superficies; los drill-downs (paradas por ruta) se piden bajo demanda. Nada
// se recalcula: la UI solo formatea (presentation.js).
//
// Codex P11/P14: clasificación EXPLÍCITA de respuestas — una respuesta
// malformada NO es `ok []`; DATE_NOT_ALLOWED / unauthorized / network son
// estados propios (no falso vacío). Autoridades:
//   · venta / salida / cierre / prioridades / cargas / marcadores → day-control
//   · posición / paradas planeadas geocodificadas          → radar
//   · resultado por parada (visitado / no-venta / motivo)  → route-stops
// Los clientes API se cargan por import DINÁMICO dentro de los fetchers por
// defecto: así este módulo (lógica pura de clasificación/carga) es importable en
// tests de node sin arrastrar todo lib/api.js, y las vistas siguen inyectando
// fetchers. En runtime, vite resuelve el import dinámico normalmente.
async function _apiClient(name) {
  const mod = await import('../api.js')
  return mod[name]
}

/** Estados canónicos de una respuesta de datos. */
export const RESULT = Object.freeze({
  OK: 'ok', EMPTY: 'empty', PARTIAL: 'partial', INVALID: 'invalid',
  DATE_NOT_ALLOWED: 'date_not_allowed', UNAUTHORIZED: 'unauthorized',
  NETWORK: 'network', ERROR: 'error',
})

/** Envelope utilizable = objeto con ok !== false. */
export function usable(payload) {
  return !!payload && typeof payload === 'object' && payload.ok !== false
}

/** Clasifica un payload/erro en un RESULT explícito (no adivina). */
export function classify(payload, err) {
  if (err) {
    const code = String(err.code || err.status || '').toUpperCase()
    const msg = String(err.message || err || '')
    if (code === 'DATE_NOT_ALLOWED' || /DATE_NOT_ALLOWED/i.test(msg)) return RESULT.DATE_NOT_ALLOWED
    if (code === '401' || code === '403' || code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return RESULT.UNAUTHORIZED
    if (code === 'TYPEERROR' || /network|fetch|failed to fetch/i.test(msg)) return RESULT.NETWORK
    return RESULT.ERROR
  }
  if (payload && typeof payload === 'object' && payload.ok === false) {
    const code = String(payload.code || '').toUpperCase()
    if (code === 'DATE_NOT_ALLOWED') return RESULT.DATE_NOT_ALLOWED
    if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return RESULT.UNAUTHORIZED
    return RESULT.ERROR
  }
  return RESULT.OK
}

function errMsg(e, fallback) {
  if (!e) return fallback
  if (typeof e === 'string') return e
  return e.message || fallback
}

// Versión de fuente para la clave de caché (fecha + sucursal + generated_at).
export function sourceVersion(dayControl) {
  const dc = dayControl || {}
  const branch = dc.branch?.branch_config_id ?? dc.branch?.analytic_account_id ?? 'na'
  return `${dc.date || 'today'}|${branch}|${dc.generated_at || 'na'}`
}

/**
 * Carga primaria del día operativo: day-control + radar EN PARALELO.
 * day-control es la fuente primaria; radar es secundario. Clasifica el estado
 * (incl. DATE_NOT_ALLOWED / unauthorized) sin caer a falso vacío.
 */
export async function loadOperationalDay({
  date,
  fetchDayControl = null,
  fetchRadar = null,
} = {}) {
  const fdc = fetchDayControl || (async () => (await _apiClient('getDayControl'))(date))
  const frd = fetchRadar || (async () => (await _apiClient('getRadar'))(date))
  const [dcRes, radarRes] = await Promise.allSettled([fdc(), frd()])
  const dayControl = dcRes.status === 'fulfilled' ? dcRes.value : null
  const radar = radarRes.status === 'fulfilled' ? radarRes.value : null

  if (usable(dayControl)) {
    return {
      ok: true, result: RESULT.OK, dayControl,
      radar: usable(radar) ? radar : null,
      radarError: usable(radar) ? null : (radarRes.status === 'rejected' ? errMsg(radarRes.reason, 'Radar no disponible.') : 'Radar no disponible en la respuesta.'),
      error: null,
    }
  }
  // day-control no utilizable ⇒ clasificar el motivo (DATE_NOT_ALLOWED, etc.).
  const reason = dcRes.status === 'rejected' ? classify(null, dcRes.reason) : classify(dayControl, null)
  return {
    ok: false, result: reason, dayControl: null, radar: null, radarError: null,
    error: dcRes.status === 'rejected' ? errMsg(dcRes.reason, 'No se pudo cargar el día operativo.') : (dayControl?.message || 'La respuesta del día operativo no es utilizable.'),
  }
}

/** Forma mínima de una parada válida (P11: malformed ≠ empty). */
function isValidStop(st) {
  return !!st && typeof st === 'object' && (st.stop_id != null || st.customer_id != null)
}

/**
 * Drill-down: paradas de UNA ruta. Fuente = route-stops (gf.route.stop).
 * Clasificación explícita (P11): malformed ⇒ RESULT.INVALID (no `ok []`);
 * arreglo vacío real ⇒ RESULT.EMPTY; error ⇒ NETWORK/UNAUTHORIZED/DATE/ERROR.
 * @returns {{result, stops, error, raw}}
 */
export async function loadRouteStops(planId, { fetch = null } = {}) {
  const id = Number(planId || 0)
  if (!id) return { result: RESULT.INVALID, stops: null, error: 'plan_id requerido' }
  const doFetch = fetch || (async (pid) => (await _apiClient('getRouteStopsV2'))(pid))
  let res
  try {
    res = await doFetch(id)
  } catch (e) {
    return { result: classify(null, e), stops: null, error: errMsg(e, 'No se pudieron cargar las paradas.') }
  }
  if (res && typeof res === 'object' && res.ok === false) {
    return { result: classify(res, null), stops: null, error: res.message || 'Respuesta no utilizable.' }
  }
  const rows = Array.isArray(res) ? res : (res?.data?.stops || res?.stops || res?.data)
  if (rows === undefined || rows === null) {
    // Estructura inesperada (ni array ni contenedor conocido) ⇒ malformed.
    return { result: RESULT.INVALID, stops: null, error: 'Respuesta de paradas con forma inesperada.', raw: res }
  }
  if (!Array.isArray(rows)) {
    return { result: RESULT.INVALID, stops: null, error: 'Paradas no es una lista.', raw: res }
  }
  // Array presente pero con elementos malformados ⇒ INVALID (no falso vacío).
  const allValid = rows.every(isValidStop)
  if (rows.length > 0 && !allValid) {
    return { result: RESULT.INVALID, stops: rows.filter(isValidStop), error: 'Algunas paradas llegaron malformadas.', raw: res }
  }
  return { result: rows.length === 0 ? RESULT.EMPTY : RESULT.OK, stops: rows, raw: res }
}
