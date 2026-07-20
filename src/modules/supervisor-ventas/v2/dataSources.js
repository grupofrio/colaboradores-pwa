// ─── Supervisor V2 · fuentes de datos canónicas (fuente ÚNICA por dato) ───────
// Regla dura: cada dato viene de UNA sola fuente. El shell carga los DOS payloads
// primarios (day-control + radar del contrato #220) una vez y los comparte a las
// 6 superficies; los drill-downs (paradas por ruta) se piden bajo demanda. Nada
// se recalcula: la UI solo formatea (presentation.js). Autoridades:
//   · venta / salida / cierre / prioridades / cargas / marcadores → day-control
//   · posición / paradas planeadas geocodificadas          → radar
//   · resultado por parada (visitado / no-venta / motivo)  → route-stops
// team-routes y reconciliation son ENRIQUECIMIENTO opcional con degradación.
import { getDayControl, getRadar, getRouteStops, getTeamRoutes } from '../api'

/** Envelope utilizable = objeto con ok !== false. */
export function usable(payload) {
  return !!payload && typeof payload === 'object' && payload.ok !== false
}

function errMsg(e, fallback) {
  if (!e) return fallback
  if (typeof e === 'string') return e
  return e.message || fallback
}

/**
 * Carga primaria del día operativo: day-control + radar EN PARALELO.
 * day-control es la fuente primaria; radar es secundario (si falla, la vista lo
 * declara "no disponible" y NO tumba el shell). Puro respecto a React: recibe
 * los fetchers por inyección (testeable) con defaults a los clientes reales.
 */
export async function loadOperationalDay({
  date,
  fetchDayControl = () => getDayControl(date),
  fetchRadar = () => getRadar(date),
} = {}) {
  const [dcRes, radarRes] = await Promise.allSettled([fetchDayControl(), fetchRadar()])
  const dayControl = dcRes.status === 'fulfilled' ? dcRes.value : null
  const radar = radarRes.status === 'fulfilled' ? radarRes.value : null

  if (usable(dayControl)) {
    return {
      ok: true,
      dayControl,
      radar: usable(radar) ? radar : null,
      radarError: usable(radar) ? null : (radarRes.status === 'rejected' ? errMsg(radarRes.reason, 'Radar no disponible.') : 'Radar no disponible en la respuesta.'),
      error: null,
    }
  }
  return {
    ok: false,
    dayControl: null,
    radar: null,
    radarError: null,
    error: dcRes.status === 'rejected' ? errMsg(dcRes.reason, 'No se pudo cargar el día operativo.') : 'La respuesta del día operativo no es utilizable.',
  }
}

/**
 * Drill-down: paradas de UNA ruta (resultado por parada: visitado / no-venta /
 * motivo / evidencia checkin). Fuente = route-stops (gf.route.stop). Degradación
 * honesta: error ⇒ {ok:false, error}, jamás lista vacía silenciosa.
 */
export async function loadRouteStops(planId, { fetch = getRouteStops } = {}) {
  const id = Number(planId || 0)
  if (!id) return { ok: false, error: 'plan_id requerido', stops: [] }
  try {
    const res = await fetch(id)
    const stops = Array.isArray(res) ? res : (res?.data?.stops || res?.stops || res?.data || [])
    return { ok: true, stops: Array.isArray(stops) ? stops : [], raw: res }
  } catch (e) {
    return { ok: false, error: errMsg(e, 'No se pudieron cargar las paradas.'), stops: [] }
  }
}

/**
 * Enriquecimiento opcional: team-routes (gf.route.plan) para km/closure_time/
 * reconciliation_id cuando day-control no basta. Nunca bloquea: error ⇒ null.
 */
export async function loadTeamRoutesEnrichment(date, { fetch = getTeamRoutes } = {}) {
  try {
    const res = await fetch(date)
    const rows = Array.isArray(res) ? res : (res?.data?.routes || res?.routes || res?.data || [])
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}
