// ─── PresentationMeta — adaptadores por módulo (Etapa 0A) ────────────────────
// Cada uno mapea el payload REAL del módulo a la forma común. Solo metadata de
// presentación; jamás recalcula negocio. Paths verificados contra las pantallas en
// main (ver docs/redesign/PRESENTATION_META_MATRIX.md).
import {
  str, numArr, boolOrNull, rangePeriod, daysPeriod,
  commonDecisionCaveats, commonTechnicalEvidence, buildMeta,
} from './shared.js'

// M1 — outlier: modelo de backlog, no el shape auditor-contrato.
export function readM1PresentationMeta(data) {
  const d = data || {}
  return buildMeta({
    module: 'M1',
    dataAsOf: str(d.dataAsOf),               // de p.data_as_of
    period: null,                            // snapshot, sin ventana
    companies: [],                           // branch-scoped, no company_ids
    branchScope: str(d.branchLabel) || 'agregado',
    formal: null,
    source: null,
    auditor: null,
    status: null,
    decisionCaveats: [],
    technicalEvidence: {
      branch_resolution_source: str(d.branch_resolution_source),
    },
  })
}

// Adaptador común para el shape auditor-contrato (M2–M6).
function readAuditorContractMeta(module, payload, { periodKind }) {
  const run = payload?.run || {}
  const scope = run.scope || {}
  const summary = payload?.summary || {}
  const period = periodKind === 'range' ? rangePeriod(scope) : daysPeriod(scope)
  return buildMeta({
    module,
    dataAsOf: str(run.finished_at),
    period,
    companies: numArr(scope.company_ids),
    branchScope: null,                       // agregado en v1
    formal: boolOrNull(run.is_production_shell_run),
    source: str(run.measurement_method),     // M6 lo emite; otros pueden venir null
    auditor: str(run.technical_state),
    status: str(summary.overall_status),
    decisionCaveats: commonDecisionCaveats(run),
    technicalEvidence: commonTechnicalEvidence(run),
  })
}

export const readM2PresentationMeta = (p) => readAuditorContractMeta('M2', p, { periodKind: 'days' })
export const readM3PresentationMeta = (p) => readAuditorContractMeta('M3', p, { periodKind: 'days' })
export const readM4PresentationMeta = (p) => readAuditorContractMeta('M4', p, { periodKind: 'range' })
export const readM5PresentationMeta = (p) => readAuditorContractMeta('M5', p, { periodKind: 'range' })
export const readM6PresentationMeta = (p) => readAuditorContractMeta('M6', p, { periodKind: 'range' })

export const PRESENTATION_META_READERS = Object.freeze({
  M1: readM1PresentationMeta,
  M2: readM2PresentationMeta,
  M3: readM3PresentationMeta,
  M4: readM4PresentationMeta,
  M5: readM5PresentationMeta,
  M6: readM6PresentationMeta,
})
