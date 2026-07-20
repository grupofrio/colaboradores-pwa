// ─── KOLD OS · M7 — Controlador de corrida seleccionada (autoridad única) ────
//
// Codex (auditoría final) marcó un BLOCKER: RunsTab hacía `setSelected(run_id)`
// —selección puramente visual— mientras findings/latest/scope/exports seguían
// mostrando la corrida `latest`. La pantalla PROMETÍA "carga EXACTAMENTE ese run"
// y no cargaba nada. Este módulo es la ÚNICA autoridad de "qué corrida se está
// viendo" para findings y exports; la pantalla es una vista delgada sobre él.
//
// CONTRATO REAL DEL BACKEND #211 (head 881a9c62, verificado leyendo el código):
//   · GET /latest   → SIN params. SIEMPRE la última corrida. NO acepta run_id.
//   · GET /findings → acepta run_id + scope_key (core.select_run): run_id
//                     desconocido ⇒ 422 unknown_run_id (JAMÁS cae a latest);
//                     run_id+scope_key incompatibles ⇒ 422; ecoa run_id/scope_key.
//   · GET /runs     → metadata por corrida (run_id, scope_key, finished_at,
//                     is_production_shell_run, measurement_method,
//                     auditor_build_sha, finding_count). SIN summary/capabilities/
//                     metrics por corrida.
//
// CONSECUENCIA HONESTA (Strategy B, vista histórica PARCIAL): al seleccionar una
// corrida histórica se re-anclan SÓLO findings y su export. summary/capabilities/
// señales por dominio provienen de /latest y NO pueden reconstruirse por corrida
// (el backend no expone ese payload). La pantalla lo DECLARA; nunca finge que
// toda la vista corresponde a la corrida elegida.

import { buildFindingsParams } from './filters.js'

export const M7_SELECTION_MODE = Object.freeze({ LATEST: 'latest', HISTORICAL: 'historical' })

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) }

/** Contexto COMPLETO desde el payload /latest (única corrida con scope completo). */
export function runContextFromLatest(payload) {
  const run = (isObj(payload) && payload.run) || {}
  const scope = run.scope || {}
  const caps = (isObj(payload) && payload.capabilities) || {}
  return Object.freeze({
    run_id: run.run_id || null,
    scope_key: run.scope_key || null,
    finished_at: run.finished_at || null,
    is_production_shell_run: run.is_production_shell_run === true,
    measurement_method: run.measurement_method || null,
    auditor_build_sha: run.auditor_build_sha || null,
    finding_count: Array.isArray(payload?.findings) ? payload.findings.length : null,
    isLatest: true,
    // scope completo: SÓLO existe para la corrida latest.
    full: Object.freeze({
      window_start: scope.window_start || null,
      window_end_exclusive: scope.window_end_exclusive || null,
      currency_ids: Array.isArray(scope.currency_ids) ? scope.currency_ids : [],
      company_ids: Array.isArray(scope.company_ids) ? scope.company_ids : [],
      date_basis: scope.date_basis || null,
      cost_method: scope.cost_method || null,
      contract_build_sha: run.contract_build_sha || null,
      evidence_sha256: run.evidence_sha256 || null,
      profitability_level: caps.profitability_level_reached || null,
    }),
  })
}

/** Contexto PARCIAL desde un item de /runs: metadata, SIN scope económico. */
export function runContextFromRunsItem(item, latestRunId) {
  const it = isObj(item) ? item : {}
  return Object.freeze({
    run_id: it.run_id || null,
    scope_key: it.scope_key || null,
    finished_at: it.finished_at || null,
    is_production_shell_run: it.is_production_shell_run === true,
    measurement_method: it.measurement_method || null,
    auditor_build_sha: it.auditor_build_sha || null,
    finding_count: Number.isFinite(it.finding_count) ? it.finding_count : null,
    isLatest: !!latestRunId && it.run_id === latestRunId,
    // el backend NO expone scope económico por corrida histórica.
    full: null,
  })
}

/** Estado inicial: anclado a la corrida latest. */
export function initSelection(payload) {
  const latest = runContextFromLatest(payload)
  return Object.freeze({ latest, anchor: latest })
}

// ── reducer: la ÚNICA transición de "qué corrida se ve" ──────────────────────
export const M7_RUN_ACTIONS = Object.freeze({ SELECT: 'select', CLEAR: 'clear' })

export function m7SelectionReducer(state, action) {
  switch (action?.type) {
    case M7_RUN_ACTIONS.SELECT: {
      const anchor = runContextFromRunsItem(action.run, state.latest.run_id)
      if (!anchor.run_id) return state // sin run_id no se ancla nada
      return { ...state, anchor }
    }
    case M7_RUN_ACTIONS.CLEAR:
      return { ...state, anchor: state.latest }
    default:
      return state
  }
}

export const selectRunAction = (run) => ({ type: M7_RUN_ACTIONS.SELECT, run })
export const clearRunAction = () => ({ type: M7_RUN_ACTIONS.CLEAR })

/** ¿La vista está anclada a la corrida más reciente? */
export function isLatestSelected(state) {
  return !!state && state.anchor?.run_id === state.latest?.run_id
}

/**
 * Params para /findings SIEMPRE anclados a la corrida vista (run_id + scope_key)
 * combinados con los filtros. Enviar ambos es seguro: provienen de la MISMA
 * corrida, así que jamás son incompatibles (no dispara el 422 de mismatch).
 */
export function planFindingsRequest(state, filters) {
  const anchor = state?.anchor || {}
  const params = buildFindingsParams(filters)
  if (anchor.run_id) params.run_id = anchor.run_id
  if (anchor.scope_key) params.scope_key = anchor.scope_key
  return params
}

/** Params para /runs (histórico de metadata; sin ancla forzada). */
export function planRunsRequest(filters = {}) {
  const params = {}
  for (const k of ['run_id', 'scope_key', 'date_from', 'date_to', 'page', 'page_size']) {
    const v = filters?.[k]
    if (v !== undefined && v !== null && v !== '') params[k] = v
  }
  return params
}

/**
 * DEFENSA anti-fallback silencioso: el backend ecoa run_id/scope_key en /findings.
 * Si lo que volvió NO es la corrida anclada, es un mismatch VISIBLE (no se pinta).
 */
export function findingsAnchorMismatch(payload, state) {
  const anchor = state?.anchor
  if (!anchor?.run_id || !isObj(payload)) return false
  if (payload.run_id && payload.run_id !== anchor.run_id) return true
  if (anchor.scope_key && payload.scope_key && payload.scope_key !== anchor.scope_key) return true
  return false
}

/** Contexto de la corrida vista, para banner / scope / exports. */
export function selectedRunContext(state) {
  return state?.anchor || null
}

// ── guarda de carrera: respuestas fuera de orden NO pisan la vista ───────────
// Seleccionar A y luego B rápido: si A resuelve tarde, su token queda obsoleto y
// se descarta. Puro y testeable; el componente lo mantiene en un useRef.
export function makeSeqGuard() {
  let current = 0
  return {
    next() { current += 1; return current },
    isStale(token) { return token !== current },
    get current() { return current },
  }
}
