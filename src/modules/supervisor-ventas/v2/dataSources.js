// ─── Supervisor V2 · fuentes de datos canónicas (fuente ÚNICA por dato) ───────
// Cada dato viene de UNA sola fuente. El shell carga los DOS payloads primarios
// (day-control + radar del contrato #220) una vez y los comparte a las 6
// superficies; los drill-downs (paradas por ruta) se piden bajo demanda.
//
// Codex §4: TODA respuesta pasa por normalizeSupervisorV2Response ⇒ contrato
// único {phase, data, code, message, partial, source, dataAsOf}. Aquí NO se
// comprueba res.ok / raw.status / result.result suelto. Autoridades:
//   · venta/salida/cierre/prioridades/cargas/marcadores → day-control
//   · posición/paradas planeadas geocodificadas         → radar
//   · resultado por parada (visitado/no-venta/motivo)   → route-stops (DTO)
// Los clientes API se cargan por import DINÁMICO (testeable en node sin lib/api).
import { PHASE, normalizeSupervisorV2Response } from './normalizeResponse.js'
import { sessionScopeKey } from './sessionScope.js'

export { PHASE }

// Versión del contrato del DTO de paradas: al cambiar la forma, la clave cambia.
const DTO_STOPS_CONTRACT = 'route_stops/1'

async function _apiClient(name) {
  const mod = await import('../api.js')
  return mod[name]
}

// ── clave de caché canónica (Codex §6) ───────────────────────────────────────
// Incluye IDENTIDAD DE SESIÓN (token/empleado) + sucursal + company + fecha +
// marca de generación. Dos supervisores, sucursales o compañías NUNCA comparten
// versión de fuente. Nada de esto es manipulable por el cliente (branch/company
// salen del payload day-control server-side; la sesión, del token).
export function sourceVersion(dayControl) {
  const dc = dayControl || {}
  const branch = dc.branch?.branch_config_id ?? dc.branch?.analytic_account_id ?? 'na'
  const company = dc.branch?.company_id ?? 'na'
  return `${sessionScopeKey()}|${dc.date || 'today'}|${branch}|${company}|${dc.generated_at || 'na'}`
}

/** Clave de caché de route-stops (§6): toda la identidad de scope (sesión/
 *  sucursal/company/fecha/generación) vía sourceVersion, más plan, ruta y la
 *  versión del DTO. NINGUNA autoridad del cliente. */
export function routeStopsCacheKey({ dayControl, planId, routeId } = {}) {
  const dc = dayControl || {}
  return ['stops', DTO_STOPS_CONTRACT, sourceVersion(dc), Number(planId || 0), Number(routeId || 0)].join('|')
}

/**
 * Carga primaria del día operativo: day-control + radar EN PARALELO.
 * day-control es la fuente primaria; radar es secundario. La fase se deriva del
 * normalizador único; DATE_NOT_ALLOWED/unauthorized son fases propias.
 * @returns {{ok, phase, dayControl, radar, radarError, error}}
 */
export async function loadOperationalDay({
  date,
  fetchDayControl = null,
  fetchRadar = null,
} = {}) {
  const fdc = fetchDayControl || (async () => (await _apiClient('getDayControl'))(date))
  const frd = fetchRadar || (async () => (await _apiClient('getRadar'))(date))
  const [dcRes, radarRes] = await Promise.allSettled([fdc(), frd()])

  const dc = dcRes.status === 'fulfilled'
    ? normalizeSupervisorV2Response(dcRes.value, null)
    : normalizeSupervisorV2Response(null, dcRes.reason)
  const rd = radarRes.status === 'fulfilled'
    ? normalizeSupervisorV2Response(radarRes.value, null)
    : normalizeSupervisorV2Response(null, radarRes.reason)

  if (dc.phase === PHASE.OK) {
    return {
      ok: true, phase: PHASE.OK, dayControl: dc.data,
      radar: rd.phase === PHASE.OK ? rd.data : null,
      radarError: rd.phase === PHASE.OK ? null : (rd.message || 'Radar no disponible.'),
      error: null,
    }
  }
  return {
    ok: false, phase: dc.phase, dayControl: null, radar: null, radarError: null,
    error: dc.message || 'No se pudo cargar el día operativo.',
  }
}

/** Forma mínima de una parada válida (malformed ≠ empty). */
function isValidStop(st) {
  return !!st && typeof st === 'object' && (st.stop_id != null || st.customer_id != null)
}

/**
 * Drill-down: paradas de UNA ruta vía el DTO read-only (#223). Pasa por el
 * normalizador único; extrae `stops` del DTO; distingue malformed (INVALID) de
 * empty real. @returns {{phase, stops, dataAsOf, partial, error}}
 */
export async function loadRouteStops(planId, { fetch = null } = {}) {
  const id = Number(planId || 0)
  if (!id) return { phase: PHASE.VALIDATION, stops: null, dataAsOf: null, partial: false, error: 'plan_id requerido' }
  const doFetch = fetch || (async (pid) => (await _apiClient('getRouteStopsV2'))(pid))
  let norm
  try {
    norm = normalizeSupervisorV2Response(await doFetch(id), null)
  } catch (e) {
    norm = normalizeSupervisorV2Response(null, e)
  }
  if (norm.phase !== PHASE.OK) {
    return { phase: norm.phase, stops: null, dataAsOf: norm.dataAsOf, partial: false, error: norm.message || 'Respuesta no utilizable.' }
  }
  // DTO OK ⇒ extraer stops. La forma canónica es data.stops (array).
  const d = norm.data || {}
  const rows = Array.isArray(d) ? d : d.stops
  if (rows === undefined || rows === null || !Array.isArray(rows)) {
    return { phase: PHASE.MALFORMED, stops: null, dataAsOf: norm.dataAsOf, partial: false, error: 'DTO de paradas con forma inesperada.' }
  }
  const valid = rows.filter(isValidStop)
  if (rows.length > 0 && valid.length !== rows.length) {
    // Algunas paradas malformadas ⇒ INVALID (no falso vacío); conserva las válidas.
    return { phase: PHASE.MALFORMED, stops: valid, dataAsOf: norm.dataAsOf, partial: true, error: 'Algunas paradas llegaron malformadas.' }
  }
  return { phase: rows.length === 0 ? PHASE.EMPTY : PHASE.OK, stops: rows, dataAsOf: norm.dataAsOf, partial: false, error: null }
}
