// ─── PresentationMeta — helpers compartidos (Etapa 0A) ───────────────────────
// Los adaptadores NORMALIZAN metadata de presentación; NUNCA recalculan negocio.
// Forma común documentada en docs/redesign/PRESENTATION_META_MATRIX.md.

export const MISSING = Object.freeze({
  dataAsOf: 'corte no informado',
  companies: 'compañías no informadas',
  source: 'fuente no informada',
  status: 'estado no informado',
})

const isStr = (v) => typeof v === 'string' && v.trim() !== ''
export const str = (v) => (isStr(v) ? v.trim() : null)
export const numArr = (v) => (Array.isArray(v) ? v.filter((x) => Number.isFinite(x)) : [])
export const boolOrNull = (v) => (typeof v === 'boolean' ? v : null)

/** Periodo por rango (M4/M5/M6/M7). */
export function rangePeriod(scope) {
  const start = str(scope?.window_start)
  const end = str(scope?.window_end_exclusive)
  return start || end ? { kind: 'range', start, endExclusive: end } : null
}

/** Periodo por número de días (M2/M3). */
export function daysPeriod(scope) {
  const d = scope?.window_days
  return Number.isFinite(d) ? { kind: 'days', days: d } : null
}

/** Caveats de decisión comunes derivados del run (capa 1). */
export function commonDecisionCaveats(run) {
  const out = []
  if (run && run.is_production_shell_run === false) {
    out.push('Evidencia no formal (medición read-only)')
  }
  return out
}

/** Bloque de evidencia técnica común (baja a EvidenceSection). Sólo captura lo que
 *  el run REALMENTE emite; los módulos difieren (verificado contra fixtures):
 *  M2 usa `build_sha`; M3/M4/M5/M6 usan `auditor_build_sha`+`contract_build_sha`.
 *  Un campo ausente ⇒ null (jamás se inventa). */
export function commonTechnicalEvidence(run, extra = {}) {
  const r = run || {}
  return {
    run_id: str(r.run_id),
    scope_key: str(r.scope_key),
    evidence_sha256: str(r.evidence_sha256),
    build_sha: str(r.build_sha),                 // M2 lo emite; el resto null
    auditor_build_sha: str(r.auditor_build_sha), // M3-M6 lo emiten; M2 null
    contract_build_sha: str(r.contract_build_sha),
    duration_ms: Number.isFinite(r.duration_ms) ? r.duration_ms : null,
    executed_queries: Array.isArray(r.executed_queries) ? r.executed_queries.length : null,
    measurement_method: str(r.measurement_method), // SÓLO M6 lo emite; el resto null
    ...extra,
  }
}

/** Forma final validada (defensa: nunca copy falso). */
export function buildMeta(partial) {
  return Object.freeze({
    module: partial.module,
    title: partial.title || null,
    dataAsOf: partial.dataAsOf ?? null,
    period: partial.period ?? null,
    companies: partial.companies ?? [],
    branchScope: partial.branchScope ?? null,
    formal: partial.formal ?? null,
    source: partial.source ?? null,
    auditor: partial.auditor ?? null,
    status: partial.status ?? null,
    decisionCaveats: partial.decisionCaveats ?? [],
    technicalEvidence: partial.technicalEvidence ?? {},
  })
}
