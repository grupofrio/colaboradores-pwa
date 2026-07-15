// ─── KOLD OS · M2 — Motor de derivación: run del auditor → hallazgos ─────────
// Evalúa el catálogo de reglas sobre las métricas AGREGADAS del run validado.
// Puro y determinista: mismas métricas ⇒ mismos hallazgos. No corrige nada.
//
// Honestidad de estados (Fase 9):
//   · división entre cero / métrica ausente ⇒ NOT_EVALUABLE (nunca 0% falso)
//   · un RED aquí significa "M2 funcionó y detectó incumplimiento", jamás
//     "M2 falló" (eso es el estado técnico del contrato).
//
// Limitación v1 (contrato agregado): los hallazgos son AGREGADOS del scope
// completo (companies del run). La atribución por compañía/sucursal y el
// detalle por registro requieren la extensión v1.1 del contrato del auditor
// (ver docs/m2/M2_DATA_CONTRACT.md §5) — NO se inventa aquí.

import { metricRows } from './contract.js'
import { M2_CATEGORIES, M2_RULES, categoryLabel } from './ruleCatalog.js'

const DAY_MS = 86400000

/** Porcentaje 2 decimales con guardia de división entre cero.
 *  null/undefined explícitos ⇒ null (Number(null) sería 0: un 0% FALSO). */
export function safePct(numerator, denominator) {
  if (numerator === null || numerator === undefined) return null
  if (denominator === null || denominator === undefined) return null
  const num = Number(numerator)
  const den = Number(denominator)
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null
  return Math.round((num / den) * 10000) / 100
}

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function sumField(rows, field) {
  if (!rows) return null
  let total = 0
  let seen = false
  for (const row of rows) {
    const value = toNum(row?.[field])
    if (value === null) continue
    total += value
    seen = true
  }
  return seen ? total : null
}

function weightedAvg(rows, valueField, weightField) {
  if (!rows || !rows.length) return null
  let acc = 0
  let weight = 0
  for (const row of rows) {
    const value = toNum(row?.[valueField])
    const w = toNum(row?.[weightField])
    if (value === null || w === null || w <= 0) continue
    acc += value * w
    weight += w
  }
  return weight > 0 ? acc / weight : null
}

function maxDate(rows, field) {
  if (!rows) return null
  let best = null
  for (const row of rows) {
    const raw = row?.[field]
    if (typeof raw !== 'string' || !raw) continue
    const t = Date.parse(raw.length === 10 ? `${raw}T00:00:00Z` : raw)
    if (Number.isFinite(t) && (best === null || t > best)) best = t
  }
  return best
}

function stateRows(rows, state) {
  return (rows || []).filter((row) => row?.state === state)
}

/** Universo de planes diarios de la ventana (capacity_metrics.plan_count). */
function planUniverse(report) {
  const rows = metricRows(report, 'capacity_metrics')
  if (!rows || !rows.length) return null
  return toNum(rows[0]?.plan_count)
}

const FALLBACK_DISTANCE_SOURCES = new Set(['haversine', 'haversine_fallback', 'fallback', 'manual'])

// Extractores por regla: (report) → { numerator, denominator }|null (null = no evaluable)
function extract(report, rule) {
  const rows = rule.query_id ? metricRows(report, rule.query_id) : null
  const first = rows && rows.length ? rows[0] : null
  switch (rule.code) {
    case 'M2-A-01':
      return first ? { numerator: toNum(first.missing_territory_count), denominator: toNum(first.plan_count) } : null
    case 'M2-B-01': {
      const universe = planUniverse(report)
      const evidence = sumField(rows, 'solver_evidence_count')
      if (universe === null || evidence === null) return null
      return { numerator: Math.max(universe - evidence, 0), denominator: universe }
    }
    case 'M2-B-02': {
      if (!rows) return null
      const universe = planUniverse(report)
      let fallback = 0
      for (const row of rows) {
        const src = String(row?.distance_source || '')
        if (FALLBACK_DISTANCE_SOURCES.has(src)) fallback += toNum(row?.plan_count) || 0
      }
      return { numerator: fallback, denominator: universe }
    }
    case 'M2-B-03': {
      const newest = maxDate(rows, 'newest_solver_run_at')
      const cutoff = Date.parse(report?.finished_at || '')
      if (newest === null || !Number.isFinite(cutoff)) return null
      return { numerator: Math.max((cutoff - newest) / DAY_MS, 0), denominator: null }
    }
    case 'M2-C-01':
      return first ? { numerator: toNum(first.missing_vehicle_count), denominator: toNum(first.plan_count) } : null
    case 'M2-C-02':
      return first ? { numerator: toNum(first.missing_capacity_count), denominator: toNum(first.plan_count) } : null
    case 'M2-C-03':
      return first ? { numerator: toNum(first.overcapacity_count), denominator: toNum(first.plan_count) } : null
    case 'M2-C-04':
      return rows ? { numerator: sumField(rows, 'overcapacity_line_count'), denominator: sumField(rows, 'line_count') } : null
    case 'M2-D-01':
      return first ? { numerator: toNum(first.published_without_load_count), denominator: toNum(first.published_count) } : null
    case 'M2-D-02':
      return first ? { numerator: toNum(first.plan_missing_snapshot_count), denominator: toNum(first.daily_plan_count) } : null
    case 'M2-D-03':
      return first ? { numerator: toNum(first.plan_without_stops_count), denominator: toNum(first.daily_plan_count) } : null
    case 'M2-D-04': {
      const published = stateRows(rows, 'published')
      if (!published.length) return null
      return { numerator: sumField(published, 'missing_warehouse_count'), denominator: sumField(published, 'line_count') }
    }
    case 'M2-D-05':
      return rows ? { numerator: sumField(rows, 'missing_snapshot_count'), denominator: sumField(rows, 'line_count') } : null
    case 'M2-E-01': {
      const coverage = weightedAvg(rows, 'coverage_avg', 'snapshot_count')
      // coverage_avg viene como fracción (0.5682) o pct según fuente; normalizamos a pct.
      if (coverage === null) return null
      return { numerator: coverage <= 1 ? coverage * 100 : coverage, denominator: null }
    }
    case 'M2-E-02': {
      const confidence = weightedAvg(rows, 'confidence_avg', 'snapshot_count')
      return confidence === null ? null : { numerator: confidence, denominator: null }
    }
    case 'M2-E-03':
      return rows ? { numerator: sumField(rows, 'fallback_count'), denominator: sumField(rows, 'line_count') } : null
    case 'M2-E-04':
      return rows ? { numerator: sumField(rows, 'warning_count'), denominator: null } : null
    case 'M2-E-05': {
      const newest = maxDate(rows, 'newest_target_date')
      const cutoff = Date.parse(report?.finished_at || '')
      if (newest === null || !Number.isFinite(cutoff)) return null
      return { numerator: Math.max((cutoff - newest) / DAY_MS, 0), denominator: null }
    }
    case 'M2-F-01':
      return first ? { numerator: toNum(first.actual_kg_count), denominator: toNum(first.row_count) } : null
    case 'M2-F-02':
      return first ? { numerator: toNum(first.final_count), denominator: toNum(first.row_count) } : null
    case 'M2-F-03': {
      const covered = first ? toNum(first.covered_days) : null
      const window = toNum(report?.scope?.window_days)
      if (covered === null || window === null) return null
      return { numerator: Math.max(window - covered, 0), denominator: window }
    }
    default:
      return null
  }
}

function statusFor(rule, extracted) {
  if (!extracted || extracted.numerator === null || extracted.numerator === undefined) {
    return { status: 'NOT_EVALUABLE', pct: null }
  }
  const { numerator, denominator } = extracted
  const kind = rule.threshold.kind
  if (kind === 'zero') {
    const pct = safePct(numerator, denominator)
    if (denominator !== null && denominator !== undefined && pct === null) {
      // denominador declarado pero inválido (p.ej. 0 publicados) ⇒ no evaluable
      return { status: 'NOT_EVALUABLE', pct: null }
    }
    if (numerator <= 0) return { status: 'GREEN', pct: pct ?? 0 }
    return { status: rule.severity === 'high' ? 'RED' : 'AMBER', pct }
  }
  if (kind === 'min_pct') {
    const value = denominator === null || denominator === undefined
      ? numerator
      : safePct(numerator, denominator)
    if (value === null) return { status: 'NOT_EVALUABLE', pct: null }
    const pct = Math.round(value * 100) / 100
    if (pct >= rule.threshold.green_at) return { status: 'GREEN', pct }
    if (pct >= rule.threshold.amber_at) return { status: 'AMBER', pct }
    return { status: 'RED', pct }
  }
  if (kind === 'min_score') {
    const score = Math.round(numerator * 10000) / 10000
    if (score >= rule.threshold.green_at) return { status: 'GREEN', pct: score }
    if (score >= rule.threshold.amber_at) return { status: 'AMBER', pct: score }
    return { status: 'RED', pct: score }
  }
  if (kind === 'max_age_days') {
    const age = Math.round(numerator * 100) / 100
    if (age <= rule.threshold.green_at) return { status: 'GREEN', pct: age }
    return { status: rule.severity === 'high' ? 'RED' : 'AMBER', pct: age }
  }
  return { status: 'NOT_EVALUABLE', pct: null }
}

// Registros afectados por regla — SEMÁNTICA HONESTA:
//   · kind zero      → el numerador ES un conteo de registros en incumplimiento
//   · kind min_pct   → los afectados son el COMPLEMENTO (denominador - numerador),
//                      p.ej. filas de historia SIN actual_kg; sin denominador ⇒ null
//   · min_score / max_age_days / manual → es un valor (score/días), NO registros ⇒ null
function affectedRecordsFor(rule, extracted, evaluated) {
  if (!extracted || evaluated.status === 'NOT_EVALUABLE' || evaluated.status === 'GREEN') return null
  const kind = rule.threshold.kind
  const { numerator, denominator } = extracted
  if (kind === 'zero') return Number.isFinite(numerator) ? numerator : null
  if (kind === 'min_pct' && Number.isFinite(numerator) && Number.isFinite(denominator)) {
    return Math.max(denominator - numerator, 0)
  }
  return null
}

function observedValueText(rule, extracted, evaluated) {
  if (evaluated.status === 'NOT_EVALUABLE') {
    return rule.threshold.kind === 'manual'
      ? 'No evaluable en el contrato v1'
      : 'Métrica no disponible o denominador cero'
  }
  const { numerator, denominator } = extracted
  const kind = rule.threshold.kind
  if (kind === 'zero') {
    return denominator
      ? `${numerator} de ${denominator} (${evaluated.pct ?? 0}%)`
      : `${numerator}`
  }
  if (kind === 'min_pct') return `${evaluated.pct}%`
  if (kind === 'min_score') return `${evaluated.pct}`
  if (kind === 'max_age_days') return `${evaluated.pct} días`
  return String(numerator)
}

/** Evalúa TODAS las reglas del catálogo sobre un run validado. */
export function evaluateRules(report) {
  return M2_RULES.map((rule) => {
    const extracted = rule.threshold.kind === 'manual' ? null : extract(report, rule)
    const evaluated = statusFor(rule, extracted)
    return {
      rule_code: rule.code,
      category: rule.category,
      severity: rule.severity,
      name: rule.name,
      status: evaluated.status,
      numerator: extracted?.numerator ?? null,
      denominator: extracted?.denominator ?? null,
      pct: evaluated.pct,
      affected_records: affectedRecordsFor(rule, extracted, evaluated),
      observed_value: observedValueText(rule, extracted ?? {}, evaluated),
      not_evaluable_reason: evaluated.status === 'NOT_EVALUABLE'
        ? (rule.threshold.reason || 'métrica no disponible / denominador cero')
        : null,
    }
  })
}

/** Hallazgo agregado (contrato UI v1) a partir de una regla incumplida. */
function toFinding(report, rule, result) {
  const scopeCompanies = Array.isArray(report?.scope?.company_ids) ? [...report.scope.company_ids] : []
  return {
    finding_id: `${rule.code}::global::aggregate`,
    schema: 'kold.tower.m2.finding/1',
    rule_code: rule.code,
    category: rule.category,
    severity: rule.severity,
    status: result.status,
    title: rule.name,
    description: rule.description,
    // Atribución v1: agregado del scope completo (extensión v1.1 = por sucursal).
    company_id: null,
    company_scope: scopeCompanies,
    branch_id: null,
    branch_code: null,
    branch_name: null,
    entity_type: rule.entity_type,
    entity_id: null,
    entity_reference: 'AGREGADO (scope completo, contrato v1)',
    observed_value: result.observed_value,
    expected_rule: rule.expected_rule,
    numerator: result.numerator,
    denominator: result.denominator,
    pct: result.pct,
    affected_records: result.affected_records,
    responsible_area: rule.responsible_area,
    responsible_employee_id: null,
    owner_status: 'unassigned',
    recommended_action: rule.recommended_action,
    evidence_reference: {
      query_id: rule.query_id,
      evidence_fields: rule.evidence_fields,
      evidence_sha256: report?.evidence_sha256 || null,
      manifest_sha256: report?.manifest_sha256 || null,
      build_sha: report?.build_sha || null,
    },
    source_model: rule.source_model,
    source_timestamp: report?.finished_at || null,
    drilldown_route: null, // v1: sin detalle por registro (extensión v1.1)
    auto_fix: false,
  }
}

/** Deriva el paquete completo para la UI: summary + bloques + hallazgos. */
export function deriveM2(report) {
  const results = evaluateRules(report)
  const findings = results
    .filter((r) => r.status === 'RED' || r.status === 'AMBER')
    .map((r) => toFinding(report, M2_RULES.find((rule) => rule.code === r.rule_code), r))

  const blocks = M2_CATEGORIES.map((cat) => {
    const catResults = results.filter((r) => r.category === cat.key)
    const red = catResults.filter((r) => r.status === 'RED').length
    const amber = catResults.filter((r) => r.status === 'AMBER').length
    const notEvaluable = catResults.filter((r) => r.status === 'NOT_EVALUABLE').length
    const affected = catResults
      .filter((r) => Number.isFinite(r.affected_records))
      .reduce((acc, r) => acc + r.affected_records, 0)
    let status = 'GREEN'
    if (red) status = 'RED'
    else if (amber) status = 'AMBER'
    else if (notEvaluable === catResults.length) status = 'NOT_EVALUABLE'
    return {
      category: cat.key,
      label: categoryLabel(cat.key),
      order: cat.order,
      status,
      rules: catResults,
      affected_records: affected,
      rules_red: red,
      rules_amber: amber,
      rules_green: catResults.filter((r) => r.status === 'GREEN').length,
      rules_not_evaluable: notEvaluable,
    }
  })

  const evaluated = results.filter((r) => r.status !== 'NOT_EVALUABLE')
  const red = evaluated.filter((r) => r.status === 'RED').length
  const amber = evaluated.filter((r) => r.status === 'AMBER').length
  const summary = {
    overall_status: red ? 'RED' : amber ? 'AMBER' : evaluated.length ? 'GREEN' : 'NOT_EVALUABLE',
    total_rules: results.length,
    rules_pass: evaluated.filter((r) => r.status === 'GREEN').length,
    rules_warning: amber,
    rules_fail: red,
    rules_not_evaluable: results.length - evaluated.length,
    total_affected_records: findings
      .filter((f) => Number.isFinite(f.affected_records))
      .reduce((acc, f) => acc + f.affected_records, 0),
    companies_in_scope: Array.isArray(report?.scope?.company_ids) ? report.scope.company_ids.length : 0,
    // v1: la atribución por sucursal no existe en el contrato agregado.
    branches_affected: null,
  }

  return { summary, blocks, findings, results }
}
