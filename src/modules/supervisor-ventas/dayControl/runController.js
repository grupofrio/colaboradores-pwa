// ─── Day Control · runController (fuente ÚNICA de verdad de la home) ──────────
// Orquesta la carga del día operativo con una regla de procedencia explícita y
// honesta (patrón canónico M7):
//   1. LIVE primero: pide day-control + radar al backend (#220) EN PARALELO.
//   2. Si day-control responde ⇒ estado 'live' (radar es secundario: si falla,
//      la vista lo declara "no disponible", NO tumba la pantalla).
//   3. Si day-control falla Y la demo está habilitada (solo dev/preview) ⇒
//      import dinámico de fixtures SINTÉTICOS, estado 'demo' (rotulado).
//   4. Si falla y no hay demo ⇒ estado 'error' con mensaje honesto.
// PURO: recibe los fetchers/loader por inyección ⇒ testeable sin red ni React.
// NUNCA inventa datos: la ausencia se propaga como null y la vista la nombra.

export const RUN_STATUS = Object.freeze({
  LOADING: 'loading',
  LIVE: 'live',
  DEMO: 'demo',
  ERROR: 'error',
})

export const RUN_SOURCE = Object.freeze({
  LIVE: 'live',
  DEMO: 'demo',
})

/** ¿El payload es una respuesta de contrato utilizable? (ok !== false y objeto). */
export function isUsablePayload(payload) {
  return !!payload && typeof payload === 'object' && payload.ok !== false
}

function messageFromError(err) {
  if (!err) return 'Error desconocido al cargar el día operativo.'
  if (typeof err === 'string') return err
  return err.message || 'No se pudo cargar el día operativo.'
}

/**
 * @param {object} deps
 * @param {() => Promise<object>} deps.fetchDayControl  cliente day-control (live)
 * @param {() => Promise<object>} deps.fetchRadar       cliente radar (live)
 * @param {() => Promise<{dayControl:object, radar:object, provenance?:object}|null>} [deps.loadDemo]
 * @param {boolean} [deps.demoEnabled=false]  habilita la degradación a fixtures
 * @returns {Promise<{status:string, source:string|null, dayControl:object|null,
 *   radar:object|null, radarError:string|null, error:string|null, provenance:object|null}>}
 */
export async function runOperationsHome({
  fetchDayControl,
  fetchRadar,
  loadDemo = null,
  demoEnabled = false,
} = {}) {
  const [dcRes, radarRes] = await Promise.allSettled([
    typeof fetchDayControl === 'function' ? fetchDayControl() : Promise.reject(new Error('fetchDayControl requerido')),
    typeof fetchRadar === 'function' ? fetchRadar() : Promise.reject(new Error('fetchRadar no disponible')),
  ])

  const dayControl = dcRes.status === 'fulfilled' ? dcRes.value : null
  const radar = radarRes.status === 'fulfilled' ? radarRes.value : null

  // LIVE: basta con que day-control (la fuente primaria) sea utilizable.
  if (isUsablePayload(dayControl)) {
    return {
      status: RUN_STATUS.LIVE,
      source: RUN_SOURCE.LIVE,
      dayControl,
      radar: isUsablePayload(radar) ? radar : null,
      radarError: isUsablePayload(radar)
        ? null
        : (radarRes.status === 'rejected' ? messageFromError(radarRes.reason) : 'Radar no disponible en la respuesta.'),
      error: null,
      provenance: null,
    }
  }

  const liveError = dcRes.status === 'rejected'
    ? messageFromError(dcRes.reason)
    : 'La respuesta del día operativo no es utilizable.'

  // DEMO: solo si está explícitamente habilitada (dev/preview). Sintético, rotulado.
  if (demoEnabled && typeof loadDemo === 'function') {
    let demo = null
    try {
      demo = await loadDemo()
    } catch {
      demo = null
    }
    if (demo && isUsablePayload(demo.dayControl)) {
      return {
        status: RUN_STATUS.DEMO,
        source: RUN_SOURCE.DEMO,
        dayControl: demo.dayControl,
        radar: isUsablePayload(demo.radar) ? demo.radar : null,
        radarError: null,
        error: null,
        provenance: demo.provenance || null,
      }
    }
  }

  return {
    status: RUN_STATUS.ERROR,
    source: null,
    dayControl: null,
    radar: null,
    radarError: null,
    error: liveError,
    provenance: null,
  }
}
