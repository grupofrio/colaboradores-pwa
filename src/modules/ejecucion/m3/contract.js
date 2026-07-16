// ─── KOLD OS · M3 — Contrato del envelope de la API (kold.os.m3.api/1) ───────
// Valida la respuesta de GET /pwa-kold-os/m3/latest (backend gf_kold_os_m3,
// GrupoVeniu/GrupoFrio PR #202). Fail-closed: la UI jamás renderiza un
// envelope que no valide.
//
// Versionado: `schema_version` EXPLÍCITO (nunca inferido); versión futura ⇒
// error CONTROLADO; campos extra compatibles se ignoran; queries del auditor
// via capabilities (required/optional). Scope FLEXIBLE (forma, no valores).
//
// Granularidad HONESTA: un finding `aggregate` NO puede traer branch/entity
// ids; un finding `branch` DEBE traer branch_id — mentir granularidad = error.

export const M3_API_SCHEMA_VERSION = 'kold.os.m3.api/1'
export const M3_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M3_API_SCHEMA_VERSION])
export const M3_STALE_DAYS = 7
export const M3_FINDINGS_DEFAULT_PAGE_SIZE = 25
export const M3_FINDINGS_MAX_PAGE_SIZE = 100

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const RUN_ID_RE = SHA256_RE
const ENVIRONMENTS = new Set(['dev', 'staging', 'production'])
const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

// Espejo del enum cerrado del backend (kold_os_m3_audit_core). Cerrado a
// propósito: un `evidence_source` de texto libre permitiría que una evidencia
// se auto-describa como quiera.
const EVIDENCE_SOURCES = ['odoo_shell_production_run', 'xml_rpc_read_only_measurements']
const EVIDENCE_CLASSIFICATIONS = ['formal_production_run', 'pre_deployment_semantic_validation']
const SHELL_BLOCKERS = ['ssh_key_not_registered', 'module_not_deployed', 'production_shell_unavailable']
export const M3_FORBIDDEN_KEY_RE = /(?:password|passwd|api[_-]?key|token|secret|email|phone|mobile|display_name|partner_name|employee_name|customer_name|raw_value)/i

const STATUSES = new Set(['GREEN', 'AMBER', 'RED', 'NOT_EVALUABLE'])
// Contrato epistémico (Codex Track C): el backend declara qué puede afirmarse.
export const M3_CLASSIFICATIONS = Object.freeze(['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M3_VERDICTS = Object.freeze(['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M3_EPISTEMIC_CONTRACT_FIELDS = Object.freeze([
  'classification',
  'verdict',
  'confidence',
  'universe',
  'business_assumption',
  'evidence_limitations',
  'approved_threshold',
  'threshold_source',
])
const CLASSIFICATION_SET = new Set(M3_CLASSIFICATIONS)
const VERDICT_SET = new Set(M3_VERDICTS)
const LIFECYCLES = new Set(['new', 'persistent', 'recurrent', 'corrected'])
export const M3_ALLOWED_GRANULARITIES = Object.freeze(['aggregate', 'branch'])
const GRANULARITIES = new Set(M3_ALLOWED_GRANULARITIES)
const CONFIDENCES = new Set(['high', 'medium', 'low', 'n/a'])
const EPISTEMIC_TEXT_FIELDS = ['universe', 'business_assumption', 'evidence_limitations', 'threshold_source']

const REQUIRED_QUERY_IDS = Object.freeze([
  'cashbox_metrics', 'daily_close_metrics', 'closure_metrics', 'commercial_reason_metrics',
  'incident_metrics', 'module_status', 'offroute_metrics', 'plan_branch_metrics',
  'plan_start_metrics', 'plan_state_metrics', 'reconciliation_metrics', 'schema_catalog',
  'scope_validation', 'stop_quality_metrics', 'stop_result_metrics', 'stop_state_metrics',
  'stop_universe_metrics',
])
const OPTIONAL_QUERY_IDS = Object.freeze(['refill_metrics'])
const CAPABILITY_FEATURES = Object.freeze({
  history: true,
  findings_pagination: true,
  branch_dimension: true,
  route_dimension: false,
  stop_dimension: false,
  entity_detail: false,
  offline_telemetry: false,
  map_view: false,
})
const CATEGORIES = new Set([
  'asignacion_arranque', 'carga_inventario', 'cierre', 'ejecucion_paradas',
  'incidentes', 'offline_sync', 'plan_vs_real', 'resultado_comercial',
])
export const M3_RULE_CODES = Object.freeze([
  'M3-A-01', 'M3-A-02', 'M3-A-03', 'M3-A-04', 'M3-A-05', 'M3-A-06', 'M3-A-07', 'M3-A-08',
  'M3-B-01', 'M3-B-02', 'M3-B-03', 'M3-B-04', 'M3-B-05', 'M3-B-06', 'M3-B-07', 'M3-B-08', 'M3-B-09',
  'M3-C-01', 'M3-C-02', 'M3-C-03',
  'M3-D-01', 'M3-D-02', 'M3-D-03', 'M3-D-04',
  'M3-E-01', 'M3-E-02', 'M3-E-03',
  'M3-F-01', 'M3-F-02', 'M3-F-03', 'M3-F-04', 'M3-F-05', 'M3-F-06', 'M3-F-07',
  'M3-G-01', 'M3-G-02', 'M3-H-01', 'M3-H-02', 'M3-H-03',
])
const RULE_CODE_SET = new Set(M3_RULE_CODES)
const SEVERITIES = new Set(['high', 'medium'])
const ENTITY_TYPES = new Set([
  'route_plan', 'route_stop', 'reconciliation', 'incident', 'daily_close',
  'cashbox', 'offroute_visit',
])
const RESPONSIBLE_AREAS = new Set([
  'Operaciones / Administración de sucursal', 'Jefe de ruta / Supervisión de campo',
  'Comercial / Supervisión de ventas', 'Almacén / Conciliación',
  'Operaciones / Supervisión de campo', 'Administración de sucursal / Caja',
  'Planeación / Operaciones',
])
const SOURCE_MODELS = new Set([
  'gf.route.plan', 'gf.route.vehicle.checklist', 'stock.picking', 'gf.route.stop',
  'gf.dispatch.reconciliation', 'gf.route.incident', 'gf.branch.daily.close',
  'gf.seller.cashbox', 'gf.offroute.visit',
])
const EMAIL_VALUE_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const RFC_VALUE_RE = /\b(?:[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/i
const CURP_VALUE_RE = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i
const PHONE_VALUE_RE = /(?:^|\D)(?:\d[\s().-]*){10}(?:\D|$)/

const RUN_FIELDS = Object.freeze([
  'auditor_build_sha', 'contract_build_sha', 'duration_ms', 'environment',
  'evidence_classification', 'evidence_sha256', 'evidence_source', 'executed_queries',
  'finished_at', 'ingested_at', 'is_production_shell_run', 'manifest_sha256',
  'production_shell_run_blocked_by', 'rollback_confirmed', 'run_id', 'scope',
  'skipped_queries', 'started_at', 'status', 'technical_state',
  'transaction_read_only', 'write_blocked',
])
const KPI_FIELDS = Object.freeze([
  'coverage', 'incidents_reported', 'no_sale_without_structured_reason', 'no_sales_count',
  'offline_events_note', 'offline_events_pending', 'offroute_visits_total',
  'offroute_visits_with_sale', 'plans_closed', 'plans_in_progress', 'plans_operational',
  'plans_published_pending', 'plans_started_overdue_open',
  'reconciliations_draft_on_closed_route', 'sales_count', 'stops_active_all',
  'stops_done_all', 'visit_compliance',
])
const SUMMARY_FIELDS = Object.freeze([
  'branches_with_findings', 'compliant_rule_count', 'definitive_incident_count',
  'definitive_incident_rule_count', 'exploratory_signal_count',
  'exploratory_signal_rule_count', 'not_evaluable_rule_count', 'overall_status',
  'rules_fail', 'rules_not_evaluable', 'rules_pass', 'rules_warning',
  'total_incidences', 'total_rules', 'unique_records_available', 'warning_count',
  'warning_rule_count',
])
const RULE_FIELDS = Object.freeze([
  'approved_threshold', 'business_assumption', 'category', 'classification', 'confidence',
  'denominator', 'evidence_limitations', 'granularity', 'incidences', 'name',
  'not_evaluable_reason', 'numerator', 'observed_value', 'pct', 'rule_code', 'severity',
  'status', 'threshold_source', 'universe', 'verdict',
])
const FINDING_FIELDS = Object.freeze([
  'approved_threshold', 'branch_code', 'branch_id', 'business_assumption', 'category',
  'classification', 'company_id', 'confidence', 'denominator', 'description', 'entity_id',
  'entity_reference', 'entity_type', 'evidence_limitations', 'evidence_reference',
  'expected_rule', 'finding_id', 'first_seen_at', 'granularity', 'incidence_semantics',
  'incidences', 'last_seen_at', 'lifecycle_status', 'numerator', 'observed_value',
  'occurrence_count', 'owner_status', 'pct', 'plan_id', 'recommended_action',
  'responsible_area', 'route_id', 'rule_code', 'severity', 'source_model',
  'source_timestamp', 'status', 'stop_id', 'threshold_source', 'title', 'universe',
  'verdict',
])
const EVIDENCE_FIELDS = Object.freeze([
  'auditor_build_sha', 'contract_build_sha', 'evidence_classification', 'evidence_fields',
  'evidence_sha256', 'evidence_source', 'is_production_shell_run', 'manifest_sha256',
  'query_id',
])
const CORRECTED_FIELDS = Object.freeze([
  'finding_key', 'rule_code', 'lifecycle_status', 'first_seen_at', 'last_seen_at',
  'occurrence_count',
])

const isBool = (v) => typeof v === 'boolean'
const isInt = (v) => typeof v === 'number' && Number.isInteger(v)
const isValidUtcParts = (match, hasTime) => {
  if (!match) return false
  const [year, month, day] = match.slice(1, 4).map(Number)
  const hour = hasTime ? Number(match[4]) : 0
  const minute = hasTime ? Number(match[5]) : 0
  const second = hasTime ? Number(match[6]) : 0
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return instant.getUTCFullYear() === year && instant.getUTCMonth() === month - 1
    && instant.getUTCDate() === day && instant.getUTCHours() === hour
    && instant.getUTCMinutes() === minute && instant.getUTCSeconds() === second
}
const isIso = (v) => typeof v === 'string' && isValidUtcParts(v.match(ISO_UTC_RE), true)
const isDate = (v) => typeof v === 'string' && isValidUtcParts(v.match(DATE_RE), false)
export const isM3RunId = (value) => typeof value === 'string' && RUN_ID_RE.test(value)

const isSupportedTimeZone = (value) => {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}
const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const canonicalJson = (value) => {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]),
    )
  }
  return value
}
const sameJson = (a, b) => JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b))

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => Object.hasOwn(source || {}, field)).map((field) => [field, source[field]]),
)

function projectJson(value) {
  if (Array.isArray(value)) return value.map(projectJson)
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, projectJson(val)]))
  }
  return value
}

function projectFinding(finding) {
  const projected = pick(finding, FINDING_FIELDS)
  if (isPlainObject(projected.evidence_reference)) {
    projected.evidence_reference = projectJson(pick(projected.evidence_reference, EVIDENCE_FIELDS))
  }
  return projectJson(projected)
}

function projectKpis(kpis) {
  const projected = pick(kpis, KPI_FIELDS)
  projected.coverage = pick(kpis?.coverage, [
    'checklist_applicable_pct', 'departure_km_pct', 'expected_distance_pct',
    'km_pair_pct', 'note', 'vehicle_pct',
  ])
  const visit = pick(kpis?.visit_compliance, [
    'denominator', 'excluded', 'numerator', 'rationale', 'sensitivity', 'universe',
    'universe_label', 'value_pct',
  ])
  visit.excluded = pick(kpis?.visit_compliance?.excluded, ['draft_route_stops', 'note'])
  visit.sensitivity = Object.fromEntries(
    ['all_active_stops', 'closed_routes', 'published_plus'].map((name) => [
      name,
      pick(kpis?.visit_compliance?.sensitivity?.[name], [
        'denominator', 'note', 'numerator', 'value_pct',
      ]),
    ]),
  )
  projected.visit_compliance = visit
  return projectJson(projected)
}

function projectLatest(doc) {
  return {
    ok: doc.ok,
    schema_version: doc.schema_version,
    read_only: doc.read_only,
    run: projectJson({ ...pick(doc.run, RUN_FIELDS), scope: pick(doc.run?.scope, [
      'company_ids', 'window_days', 'window_start', 'window_end_exclusive', 'timezone',
    ]) }),
    stale: doc.stale,
    age_days: doc.age_days,
    kpis: projectKpis(doc.kpis),
    summary: projectJson(pick(doc.summary, SUMMARY_FIELDS)),
    rule_results: (doc.rule_results || []).map((rule) => projectJson(pick(rule, RULE_FIELDS))),
    findings: (doc.findings || []).map(projectFinding),
    corrected: (doc.corrected || []).map((item) => projectJson(pick(item, CORRECTED_FIELDS))),
    history: projectJson(pick(doc.history, ['latest_finished_at', 'previous_finished_at', 'runs_count'])),
    capabilities: projectJson(pick(doc.capabilities, [
      'classifications', 'features', 'findings_max_page_size', 'granularities',
      'optional_query_ids', 'required_query_ids', 'stale_days', 'verdicts',
    ])),
    applied_scope: projectJson(pick(doc.applied_scope, ['level'])),
  }
}

function projectFindings(doc) {
  return {
    ok: doc.ok,
    schema_version: doc.schema_version,
    run_id: doc.run_id,
    total: doc.total,
    page: doc.page,
    pages: doc.pages,
    page_size: doc.page_size,
    items: (doc.items || []).map(projectFinding),
    applied_scope: projectJson(pick(doc.applied_scope, ['level'])),
    applied_filters: projectJson(doc.applied_filters || {}),
    rejected_params: [...(doc.rejected_params || [])],
    read_only: doc.read_only,
  }
}

function validateSafeRenderedText(value, field, errors, { nullable = false, max = 2000 } = {}) {
  if (nullable && value == null) return
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    errors.push(`${field}: texto contractual requerido`)
    return
  }
  if (EMAIL_VALUE_RE.test(value) || RFC_VALUE_RE.test(value) || CURP_VALUE_RE.test(value)
      || PHONE_VALUE_RE.test(value)) {
    errors.push(`${field}: valor sensible prohibido`)
  }
}

function validateFindingReference(finding, errors, path) {
  const expected = finding.granularity === 'aggregate'
    ? 'AGREGADO (scope completo, contrato v1)'
    : `SUCURSAL branch_config_id=${finding.branch_id}`
  if (finding.entity_reference !== expected) {
    errors.push(`${path}.entity_reference: referencia no contractual`)
  }
}

const expectedFindingId = (finding) => (
  `${finding.rule_code}::global:${finding.branch_id ?? 'all'}::${finding.entity_type}:aggregate`
)

function validateChronology(earlier, later, field, errors) {
  if (isIso(earlier) && isIso(later) && Date.parse(earlier) > Date.parse(later)) {
    errors.push(`${field}: cronologia invalida`)
  }
}

const isFiniteNumberOrNull = (value) => value === null
  || (typeof value === 'number' && Number.isFinite(value))

function deriveSummary(ruleResults, findings) {
  const count = (verdict) => ruleResults.filter((rule) => rule.verdict === verdict).length
  const incidences = (verdict) => ruleResults
    .filter((rule) => rule.verdict === verdict)
    .reduce((total, rule) => total + (isInt(rule.incidences) ? rule.incidences : 0), 0)
  const definitiveRules = count('incumplimiento')
  const warningRules = count('riesgo')
  const exploratoryRules = count('anomalia')
  const compliantRules = count('cumple')
  const notEvaluableRules = count('no_evaluable')
  const definitiveCount = incidences('incumplimiento')
  const warningCount = incidences('riesgo')
  const exploratoryCount = incidences('anomalia')
  const branches = [...new Set(findings
    .map((finding) => finding.branch_id)
    .filter((branchId) => isInt(branchId)))].sort((a, b) => a - b)
  return {
    total_rules: ruleResults.length,
    rules_pass: compliantRules,
    rules_warning: warningRules + exploratoryRules,
    rules_fail: definitiveRules,
    rules_not_evaluable: notEvaluableRules,
    total_incidences: definitiveCount + warningCount + exploratoryCount,
    definitive_incident_rule_count: definitiveRules,
    warning_rule_count: warningRules,
    exploratory_signal_rule_count: exploratoryRules,
    not_evaluable_rule_count: notEvaluableRules,
    compliant_rule_count: compliantRules,
    definitive_incident_count: definitiveCount,
    warning_count: warningCount,
    exploratory_signal_count: exploratoryCount,
    branches_with_findings: branches,
    overall_status: definitiveRules > 0 ? 'RED'
      : warningRules + exploratoryRules > 0 ? 'AMBER'
        : compliantRules === 0 ? 'NOT_EVALUABLE' : 'GREEN',
    unique_records_available: false,
  }
}

function validateKpis(kpis, errors) {
  if (!KPI_FIELDS.every((field) => Object.hasOwn(kpis, field))) {
    errors.push('kpis: faltan campos contractuales')
    return
  }
  const numericFields = KPI_FIELDS.filter((field) => ![
    'coverage', 'offline_events_note', 'offline_events_pending', 'visit_compliance',
  ].includes(field))
  for (const field of numericFields) {
    if (!isInt(kpis[field]) || kpis[field] < 0) errors.push(`kpis.${field}: entero >= 0`)
  }
  if (kpis.offline_events_pending !== null
      && (!isInt(kpis.offline_events_pending) || kpis.offline_events_pending < 0)) {
    errors.push('kpis.offline_events_pending: entero >= 0 o null')
  }
  validateSafeRenderedText(kpis.offline_events_note, 'kpis.offline_events_note', errors)
  const coverage = kpis.coverage
  if (!isPlainObject(coverage)) {
    errors.push('kpis.coverage: objeto requerido')
  } else {
    for (const field of [
      'checklist_applicable_pct', 'departure_km_pct', 'expected_distance_pct',
      'km_pair_pct', 'vehicle_pct',
    ]) {
      if (!Number.isFinite(coverage[field])) errors.push(`kpis.coverage.${field}: numero`)
    }
    validateSafeRenderedText(coverage.note, 'kpis.coverage.note', errors)
  }
  const visit = kpis.visit_compliance
  if (!isPlainObject(visit)) {
    errors.push('kpis.visit_compliance: objeto requerido')
  } else {
    for (const field of ['numerator', 'denominator']) {
      if (!isInt(visit[field]) || visit[field] < 0) errors.push(`kpis.visit_compliance.${field}: entero >= 0`)
    }
    if (!Number.isFinite(visit.value_pct)) errors.push('kpis.visit_compliance.value_pct: numero')
    for (const field of ['universe', 'universe_label', 'rationale']) {
      validateSafeRenderedText(visit[field], `kpis.visit_compliance.${field}`, errors)
    }
    if (!isPlainObject(visit.sensitivity) || !isPlainObject(visit.excluded)) {
      errors.push('kpis.visit_compliance: sensitivity/excluded requeridos')
    } else {
      if (!isInt(visit.excluded.draft_route_stops) || visit.excluded.draft_route_stops < 0) {
        errors.push('kpis.visit_compliance.excluded.draft_route_stops: entero >= 0')
      }
      validateSafeRenderedText(
        visit.excluded.note, 'kpis.visit_compliance.excluded.note', errors,
      )
      for (const name of ['all_active_stops', 'closed_routes', 'published_plus']) {
        const sensitivity = visit.sensitivity[name]
        if (!isPlainObject(sensitivity)
            || !isInt(sensitivity.numerator) || sensitivity.numerator < 0
            || !isInt(sensitivity.denominator) || sensitivity.denominator < 0
            || !Number.isFinite(sensitivity.value_pct)) {
          errors.push(`kpis.visit_compliance.sensitivity.${name}: metricas invalidas`)
        }
        validateSafeRenderedText(
          sensitivity?.note, `kpis.visit_compliance.sensitivity.${name}.note`, errors,
        )
      }
    }
  }
}

function validateEvidenceReference(reference, errors, path) {
  if (!isPlainObject(reference)) {
    errors.push(`${path}: objeto requerido`)
    return
  }
  if (![...REQUIRED_QUERY_IDS, ...OPTIONAL_QUERY_IDS].includes(reference.query_id)) {
    errors.push(`${path}.query_id: fuera de catalogo`)
  }
  if (!Array.isArray(reference.evidence_fields)
      || !reference.evidence_fields.length
      || !reference.evidence_fields.every((field) => (
        typeof field === 'string' && /^[a-z][a-z0-9_]*$/.test(field)
      ))) {
    errors.push(`${path}.evidence_fields: identificadores requeridos`)
  }
  for (const field of ['evidence_sha256', 'manifest_sha256']) {
    if (typeof reference[field] !== 'string' || !SHA256_RE.test(reference[field])) {
      errors.push(`${path}.${field}: sha256 hex`)
    }
  }
  if (typeof reference.auditor_build_sha !== 'string' || !SHA_RE.test(reference.auditor_build_sha)) {
    errors.push(`${path}.auditor_build_sha: hex 7..64`)
  }
  if (reference.contract_build_sha != null
      && (typeof reference.contract_build_sha !== 'string' || !SHA_RE.test(reference.contract_build_sha))) {
    errors.push(`${path}.contract_build_sha: hex 7..64 o null`)
  }
  if (!EVIDENCE_SOURCES.includes(reference.evidence_source)
      || !EVIDENCE_CLASSIFICATIONS.includes(reference.evidence_classification)
      || !isBool(reference.is_production_shell_run)) {
    errors.push(`${path}: fuente/clasificacion/formalidad invalidas`)
  }
}

function validateCorrected(corrected, errors) {
  if (!Array.isArray(corrected)) {
    errors.push('corrected: arreglo requerido')
    return
  }
  for (const [index, item] of corrected.entries()) {
    const path = `corrected.${index}`
    if (!isPlainObject(item) || typeof item.finding_key !== 'string'
        || !RULE_CODE_SET.has(item.rule_code) || item.lifecycle_status !== 'corrected'
        || !isIso(item.first_seen_at) || !isIso(item.last_seen_at)
        || !isInt(item.occurrence_count) || item.occurrence_count < 0) {
      errors.push(`${path}: entrada contractual invalida`)
    }
    const match = typeof item?.finding_key === 'string'
      ? item.finding_key.match(/^(M3-[A-H]-\d{2})::global:(all|[1-9]\d*)::([a-z][a-z0-9_]*):aggregate$/)
      : null
    if (!match || match[1] !== item.rule_code || !RULE_CODE_SET.has(match[1])
        || !ENTITY_TYPES.has(match[3])) {
      errors.push(`${path}.finding_key: formato backend invalido`)
    }
    validateChronology(item?.first_seen_at, item?.last_seen_at, `${path}.first_seen_at/last_seen_at`, errors)
    validateSafeRenderedText(item?.finding_key, `${path}.finding_key`, errors)
    validateSafeRenderedText(item?.rule_code, `${path}.rule_code`, errors)
  }
}

export function classifySchemaVersion(doc) {
  const version = doc?.schema_version
  if (typeof version !== 'string' || !version) return 'missing'
  return M3_SUPPORTED_SCHEMA_VERSIONS.includes(version) ? 'supported' : 'unsupported'
}

function scanForbiddenKeys(value, path, errors, depth = 0) {
  if (depth > 10 || !value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) scanForbiddenKeys(item, path, errors, depth + 1)
    return
  }
  for (const [key, val] of Object.entries(value)) {
    if (M3_FORBIDDEN_KEY_RE.test(key)) errors.push(`${path}.${key}: campo sensible prohibido`)
    scanForbiddenKeys(val, `${path}.${key}`, errors, depth + 1)
  }
}

function validateM3FindingContract(finding, errors, path = 'findings') {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    errors.push(`${path}: entrada invalida`)
    return false
  }
  if (!RULE_CODE_SET.has(finding.rule_code)) {
    errors.push(`${path}.rule_code: fuera del catalogo M3`)
    return false
  }
  if (finding.finding_id !== expectedFindingId(finding)) {
    errors.push(`${path}.finding_id: no coincide con clave estable backend`)
    return false
  }
  if (!['RED', 'AMBER'].includes(finding.status)) {
    errors.push(`${path}: status RED|AMBER`)
    return false
  }
  if (!GRANULARITIES.has(finding.granularity)) {
    errors.push(`${path}: granularity invalida`)
    return false
  }
  if (!CATEGORIES.has(finding.category) || !SEVERITIES.has(finding.severity)) {
    errors.push(`${path}: category/severity fuera de catalogo`)
    return false
  }
  if (!ENTITY_TYPES.has(finding.entity_type)
      || !RESPONSIBLE_AREAS.has(finding.responsible_area)
      || !SOURCE_MODELS.has(finding.source_model)) {
    errors.push(`${path}: entity_type/responsible_area/source_model fuera de catalogo`)
    return false
  }
  if (finding.owner_status !== 'unassigned') {
    errors.push(`${path}: owner_status fuera de contrato v1`)
    return false
  }
  for (const field of ['numerator', 'denominator', 'pct', 'incidences']) {
    if (!isFiniteNumberOrNull(finding[field])) {
      errors.push(`${path}.${field}: numero o null`)
      return false
    }
  }
  if (!isInt(finding.occurrence_count) || finding.occurrence_count < 0) {
    errors.push(`${path}.occurrence_count: entero >= 0`)
    return false
  }
  if (!isIso(finding.first_seen_at) || !isIso(finding.last_seen_at)
      || !isIso(finding.source_timestamp)) {
    errors.push(`${path}: timestamps ISO requeridos`)
    return false
  }
  validateChronology(finding.first_seen_at, finding.last_seen_at, `${path}.first_seen_at/last_seen_at`, errors)
  if (finding.last_seen_at !== finding.source_timestamp) {
    errors.push(`${path}.last_seen_at: no coincide con source_timestamp`)
    return false
  }
  if (finding.lifecycle_status && !LIFECYCLES.has(finding.lifecycle_status)) {
    errors.push(`${path}: lifecycle_status invalido`)
    return false
  }
  if (finding.granularity === 'aggregate'
      && (finding.entity_id != null || finding.branch_id != null || finding.route_id != null)) {
    errors.push(`${path}: aggregate no puede traer branch/route/entity ids`)
    return false
  }
  if ([finding.company_id, finding.route_id, finding.plan_id, finding.stop_id, finding.entity_id]
    .some((value) => value != null)) {
    errors.push(`${path}: contrato v1 no permite IDs record/route/plan/stop/company`)
    return false
  }
  if (finding.granularity === 'branch' && (finding.branch_id == null || !isInt(finding.branch_id))) {
    errors.push(`${path}: branch exige branch_id entero`)
    return false
  }
  const expectedBranchCode = finding.granularity === 'branch'
    ? `branch_config_${finding.branch_id}` : null
  if (finding.branch_code !== expectedBranchCode) {
    errors.push(`${path}.branch_code: no coincide con granularidad`)
    return false
  }
  validateFindingReference(finding, errors, path)
  if (!CLASSIFICATION_SET.has(finding.classification)) {
    errors.push(`${path}: classification requerida y valida`)
    return false
  }
  if (!VERDICT_SET.has(finding.verdict)) {
    errors.push(`${path}: verdict requerido y valido`)
    return false
  }
  if (!CONFIDENCES.has(finding.confidence)) {
    errors.push(`${path}: confidence requerida y valida`)
    return false
  }
  for (const field of EPISTEMIC_TEXT_FIELDS) {
    if (typeof finding[field] !== 'string' || !finding[field].trim()) {
      errors.push(`${path}: ${field} requerido`)
      return false
    }
  }
  if (typeof finding.approved_threshold !== 'boolean') {
    errors.push(`${path}: approved_threshold booleano requerido`)
    return false
  }
  if (finding.classification === 'exploratory' && finding.verdict === 'incumplimiento') {
    errors.push(`${path}: exploratory no puede ser incumplimiento`)
    return false
  }
  if (finding.verdict === 'incumplimiento' && finding.approved_threshold !== true) {
    errors.push(`${path}: incumplimiento exige approved_threshold`)
    return false
  }
  if ((finding.classification === 'not_evaluable' || finding.verdict === 'no_evaluable')
      && finding.incidences > 0) {
    errors.push(`${path}: no_evaluable no puede traer incidencias`)
    return false
  }
  for (const field of [
    'title', 'description', 'observed_value', 'expected_rule', 'recommended_action',
    'incidence_semantics', ...EPISTEMIC_TEXT_FIELDS,
  ]) {
    validateSafeRenderedText(finding[field], `${path}.${field}`, errors)
  }
  validateEvidenceReference(finding.evidence_reference, errors, `${path}.evidence_reference`)
  scanForbiddenKeys(finding, path, errors)
  return errors.length === 0
}

function validateFindingRuleCoherence(finding, ruleByCode, errors, path = 'findings') {
  const rule = ruleByCode.get(finding?.rule_code)
  if (!rule) {
    errors.push(`${path}: regla desconocida ${finding?.rule_code || 'ausente'}`)
    return
  }
  const mismatch = M3_EPISTEMIC_CONTRACT_FIELDS.find(
    (field) => !Object.is(finding[field], rule[field]),
  )
  if (mismatch) {
    errors.push(`${path}: ${finding.rule_code}.${mismatch} contradice a su rule_result`)
  }
}

/** Valida el envelope /latest. Devuelve { ok, errors, schema } (fail-closed). */
export function validateM3Latest(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['envelope: no es un objeto'], schema: 'missing' }
  }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version || 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (doc.read_only !== true) errors.push('read_only: debe ser true')

  const run = doc.run
  if (!run || typeof run !== 'object') {
    errors.push('run: objeto requerido')
  } else {
    if (!isM3RunId(run.run_id)) {
      errors.push('run.run_id: sha256 hex de 64 caracteres')
    }
    if (!ENVIRONMENTS.has(run.environment)) errors.push('run.environment: dev|staging|production')
    if (run.status !== 'PASS' && run.status !== 'FAIL') errors.push('run.status: PASS|FAIL')
    if (!['PASS', 'FAIL', 'STALE'].includes(run.technical_state)) errors.push('run.technical_state: PASS|FAIL|STALE')
    for (const key of ['transaction_read_only', 'write_blocked', 'rollback_confirmed']) {
      if (!isBool(run[key])) errors.push(`run.${key}: booleano`)
    }
    for (const key of ['manifest_sha256', 'evidence_sha256']) {
      if (typeof run[key] !== 'string' || !SHA256_RE.test(run[key])) errors.push(`run.${key}: sha256 hex`)
    }
    // ── Linaje de build: dos hechos distintos, jamás colapsados ─────────────
    // `auditor_build_sha` = el build que MIDIÓ. `contract_build_sha` = el que
    // validó/empaquetó (null si aún no se selló). Un envelope con el antiguo
    // `build_sha` ambiguo se rechaza: no se sabría cuál de los dos afirma.
    if (typeof run.auditor_build_sha !== 'string' || !SHA_RE.test(run.auditor_build_sha)) {
      errors.push('run.auditor_build_sha: hex 7..64 (el build que MIDIÓ)')
    }
    if (run.contract_build_sha != null
        && (typeof run.contract_build_sha !== 'string' || !SHA_RE.test(run.contract_build_sha))) {
      errors.push('run.contract_build_sha: hex 7..64 o null')
    }
    if ('build_sha' in run) {
      errors.push('run.build_sha: campo retirado — usa auditor_build_sha/contract_build_sha')
    }

    // ── Honestidad de evidencia: obligatoria y coherente ────────────────────
    // La UI DEBE poder decir si esto es una corrida formal. Ausente o null se
    // rechaza: el silencio se leería como "sí, es formal".
    if (!isBool(run.is_production_shell_run)) {
      errors.push('run.is_production_shell_run: booleano obligatorio')
    }
    if (!Array.isArray(run.production_shell_run_blocked_by)) {
      errors.push('run.production_shell_run_blocked_by: lista obligatoria')
    }
    if (!EVIDENCE_SOURCES.includes(run.evidence_source)) {
      errors.push('run.evidence_source: inválido')
    }
    if (!EVIDENCE_CLASSIFICATIONS.includes(run.evidence_classification)) {
      errors.push('run.evidence_classification: inválido')
    }
    if (isBool(run.is_production_shell_run) && Array.isArray(run.production_shell_run_blocked_by)) {
      if (run.is_production_shell_run) {
        if (run.production_shell_run_blocked_by.length) {
          errors.push('run: corrida formal no puede declarar bloqueadores')
        }
        if (run.environment !== 'production') {
          errors.push('run: corrida formal exige environment=production')
        }
        if (run.evidence_classification !== 'formal_production_run') {
          errors.push('run: corrida formal debe clasificar como formal_production_run')
        }
      } else {
        // Una evidencia NO formal SIEMPRE dice por qué. Si no lo dice, no se
        // acepta: un bloqueo sin razón se olvida y luego se lee como formal.
        if (!run.production_shell_run_blocked_by.length) {
          errors.push('run: evidencia no formal sin production_shell_run_blocked_by')
        }
        if (run.evidence_classification === 'formal_production_run') {
          errors.push('run: evidencia no formal no puede clasificarse como formal_production_run')
        }
      }
    }
    for (const blocker of run.production_shell_run_blocked_by || []) {
      if (!SHELL_BLOCKERS.includes(blocker)) {
        errors.push(`run.production_shell_run_blocked_by: valor desconocido ${blocker}`)
      }
    }
    if (!isIso(run.started_at) || !isIso(run.finished_at)) errors.push('run.started_at/finished_at: ISO UTC')
    validateChronology(run.started_at, run.finished_at, 'run.started_at/finished_at', errors)
    if (run.ingested_at != null && !isIso(run.ingested_at)) errors.push('run.ingested_at: ISO UTC o null')
    if (run.ingested_at != null) {
      validateChronology(run.finished_at, run.ingested_at, 'run.finished_at/ingested_at', errors)
    }
    if (!isInt(run.duration_ms) || run.duration_ms < 0) errors.push('run.duration_ms: entero >= 0')
    if (!Array.isArray(run.executed_queries) || !Array.isArray(run.skipped_queries)) {
      errors.push('run.executed_queries/skipped_queries: arreglos requeridos')
    } else {
      const allowedQueries = new Set([...REQUIRED_QUERY_IDS, ...OPTIONAL_QUERY_IDS])
      if (![...run.executed_queries, ...run.skipped_queries]
        .every((queryId) => allowedQueries.has(queryId))) {
        errors.push('run.executed_queries/skipped_queries: query fuera de catalogo')
      }
    }
    const scope = run.scope
    if (!scope || typeof scope !== 'object') {
      errors.push('run.scope: objeto requerido')
    } else {
      if (!Array.isArray(scope.company_ids) || !scope.company_ids.every((v) => isInt(v) && v > 0)) {
        errors.push('run.scope.company_ids: enteros positivos')
      }
      if (!isInt(scope.window_days) || scope.window_days < 1 || scope.window_days > 366) {
        errors.push('run.scope.window_days: 1..366')
      }
      if (!isDate(scope.window_start) || !isDate(scope.window_end_exclusive)
          || !isSupportedTimeZone(scope.timezone)) {
        errors.push('run.scope: bordes YYYY-MM-DD y timezone requeridos')
      }
      if (isDate(scope.window_start) && isDate(scope.window_end_exclusive)
          && scope.window_start >= scope.window_end_exclusive) {
        errors.push('run.scope: window_start debe preceder window_end_exclusive')
      }
    }
  }

  if (!isBool(doc.stale)) errors.push('stale: booleano')
  if (!Number.isFinite(doc.age_days) || doc.age_days < 0) errors.push('age_days: numero >= 0')
  if (!doc.kpis || typeof doc.kpis !== 'object') {
    errors.push('kpis: objeto requerido')
  } else {
    const vc = doc.kpis.visit_compliance
    if (!vc || typeof vc !== 'object' || !vc.universe || !vc.rationale) {
      errors.push('kpis.visit_compliance: debe declarar universo y justificación')
    }
    if (doc.kpis.offline_events_pending !== null && doc.kpis.offline_events_pending !== undefined
      && typeof doc.kpis.offline_events_pending !== 'number') {
      errors.push('kpis.offline_events_pending: número o null (jamás 0 inventado)')
    }
    validateKpis(doc.kpis, errors)
  }

  const summary = doc.summary
  if (!summary || typeof summary !== 'object') {
    errors.push('summary: objeto requerido')
  } else {
    if (!STATUSES.has(summary.overall_status)) errors.push('summary.overall_status: inválido')
    for (const key of ['total_rules', 'rules_pass', 'rules_warning', 'rules_fail',
      'rules_not_evaluable', 'total_incidences', 'definitive_incident_rule_count',
      'warning_rule_count', 'exploratory_signal_rule_count', 'not_evaluable_rule_count',
      'compliant_rule_count', 'definitive_incident_count', 'warning_count',
      'exploratory_signal_count']) {
      if (!isInt(summary[key]) || summary[key] < 0) errors.push(`summary.${key}: entero >= 0`)
    }
    // Track P: el total heterogéneo DEBE ser exactamente la suma de sus partes.
    const parts = (summary.definitive_incident_count || 0) + (summary.warning_count || 0)
      + (summary.exploratory_signal_count || 0)
    if (isInt(summary.total_incidences) && summary.total_incidences !== parts) {
      errors.push('summary.total_incidences: debe ser la suma exacta de su desglose')
    }
    if (summary.unique_records_available !== false) {
      errors.push('summary.unique_records_available: debe ser false en contrato v1')
    }
    if (!Array.isArray(summary.branches_with_findings)) {
      errors.push('summary.branches_with_findings: arreglo requerido')
    }
  }

  if (!Array.isArray(doc.rule_results) || !doc.rule_results.length) {
    errors.push('rule_results: arreglo no vacío requerido')
  } else {
    for (const result of doc.rule_results) {
      if (!result || typeof result !== 'object' || !RULE_CODE_SET.has(result.rule_code)
          || !STATUSES.has(result.status)) {
        errors.push('rule_results: entrada inválida')
        break
      }
      // Sin contrato epistémico la UI NO puede pintar nada: fail-closed.
      if (!CLASSIFICATION_SET.has(result.classification)) {
        errors.push('rule_results: classification requerida y válida'); break
      }
      if (!VERDICT_SET.has(result.verdict)) {
        errors.push('rule_results: verdict requerido y válido'); break
      }
      if (!CATEGORIES.has(result.category) || !SEVERITIES.has(result.severity)
          || !GRANULARITIES.has(result.granularity) || !CONFIDENCES.has(result.confidence)) {
        errors.push('rule_results: catalogo fuera de contrato'); break
      }
      for (const field of ['numerator', 'denominator', 'pct', 'incidences']) {
        if (!isFiniteNumberOrNull(result[field])) {
          errors.push(`rule_results.${result.rule_code}.${field}: numero o null`); break
        }
      }
      for (const field of ['name', 'observed_value', ...EPISTEMIC_TEXT_FIELDS]) {
        validateSafeRenderedText(result[field], `rule_results.${result.rule_code}.${field}`, errors)
      }
      if (result.not_evaluable_reason != null) {
        validateSafeRenderedText(
          result.not_evaluable_reason,
          `rule_results.${result.rule_code}.not_evaluable_reason`, errors,
        )
      }
      if (typeof result.universe !== 'string' || !result.universe) {
        errors.push('rule_results: universe requerido'); break
      }
      if (typeof result.approved_threshold !== 'boolean') {
        errors.push('rule_results: approved_threshold booleano requerido'); break
      }
      // Una regla exploratoria JAMÁS puede llegar como incumplimiento.
      if (result.classification === 'exploratory' && result.verdict === 'incumplimiento') {
        errors.push('rule_results: exploratory no puede ser incumplimiento'); break
      }
      // Un incumplimiento definitivo EXIGE umbral aprobado.
      if (result.verdict === 'incumplimiento' && result.approved_threshold !== true) {
        errors.push('rule_results: incumplimiento exige approved_threshold'); break
      }
    }
  }

  if (!Array.isArray(doc.findings)) {
    errors.push('findings: arreglo requerido')
  } else {
    const ruleByCode = new Map((doc.rule_results || []).map((result) => [result.rule_code, result]))
    for (const finding of doc.findings) {
      if (!validateM3FindingContract(finding, errors)) break
      validateFindingRuleCoherence(finding, ruleByCode, errors)
      const reference = finding.evidence_reference || {}
      for (const field of [
        'auditor_build_sha', 'contract_build_sha', 'evidence_classification',
        'evidence_sha256', 'evidence_source', 'is_production_shell_run', 'manifest_sha256',
      ]) {
        if (!Object.is(reference[field], run?.[field])) {
          errors.push(`findings.${finding.finding_id}.evidence_reference.${field}: contradice run`)
          break
        }
      }
      if (!run?.executed_queries?.includes(reference.query_id)) {
        errors.push(`findings.${finding.finding_id}.evidence_reference.query_id: no ejecutada`)
      }
      if (finding.source_timestamp !== run?.finished_at) {
        errors.push(`findings.${finding.finding_id}.source_timestamp: no coincide con run.finished_at`)
      }
      if (errors.length) break
    }
  }

  if (Array.isArray(doc.rule_results) && Array.isArray(doc.findings) && isPlainObject(summary)) {
    const ruleCodes = doc.rule_results.map((rule) => rule.rule_code)
    if (new Set(ruleCodes).size !== ruleCodes.length) errors.push('rule_results: rule_code duplicado')
    const findingIds = doc.findings.map((finding) => finding.finding_id)
    if (new Set(findingIds).size !== findingIds.length) errors.push('findings: finding_id duplicado')
    const derived = deriveSummary(doc.rule_results, doc.findings)
    for (const field of SUMMARY_FIELDS) {
      if (!sameJson(summary[field], derived[field])) {
        errors.push(`summary.${field}: contradice rule_results/findings`)
      }
    }
  }

  validateCorrected(doc.corrected, errors)

  const history = doc.history
  if (!history || typeof history !== 'object' || !isInt(history.runs_count) || history.runs_count < 0) {
    errors.push('history.runs_count: entero >= 0 requerido')
  } else if (!isIso(history.latest_finished_at)
      || (history.previous_finished_at != null && !isIso(history.previous_finished_at))) {
    errors.push('history: latest/previous_finished_at invalidos')
  } else {
    if (history.latest_finished_at !== run?.finished_at) {
      errors.push('history.latest_finished_at: no coincide con run.finished_at')
    }
    if (history.previous_finished_at != null) {
      validateChronology(
        history.previous_finished_at, history.latest_finished_at,
        'history.previous_finished_at/latest_finished_at', errors,
      )
    }
  }

  const capabilities = doc.capabilities
  if (!capabilities || typeof capabilities !== 'object'
    || !Array.isArray(capabilities.required_query_ids)
    || !Array.isArray(capabilities.optional_query_ids)
    || !Array.isArray(capabilities.granularities)) {
    errors.push('capabilities: required/optional_query_ids + granularities requeridos')
  }
  if (isPlainObject(capabilities)) {
    if (!sameJson(capabilities.required_query_ids, REQUIRED_QUERY_IDS)
        || !sameJson(capabilities.optional_query_ids, OPTIONAL_QUERY_IDS)
        || !sameJson(capabilities.granularities, M3_ALLOWED_GRANULARITIES)
        || !sameJson(capabilities.classifications, M3_CLASSIFICATIONS)
        || !sameJson(capabilities.verdicts, M3_VERDICTS)
        || !sameJson(capabilities.features, CAPABILITY_FEATURES)
        || capabilities.findings_max_page_size !== M3_FINDINGS_MAX_PAGE_SIZE
        || capabilities.stale_days !== M3_STALE_DAYS) {
      errors.push('capabilities: debe coincidir exactamente con contrato backend v1')
    }
  }

  if (!sameJson(doc.applied_scope, { level: 'global' })) {
    errors.push('applied_scope: debe ser global en contrato v1')
  }

  scanForbiddenKeys(doc, 'envelope', errors)
  return {
    ok: errors.length === 0,
    errors,
    schema,
    payload: errors.length === 0 ? projectLatest(doc) : undefined,
  }
}

/** Valida la respuesta de /findings. */
const normalizedObject = (value) => JSON.stringify(
  Object.fromEntries(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))),
)

export function validateM3Findings(doc, expectedRequest = null, latestContext = null) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['findings: no es un objeto'], schema: 'missing' }
  }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version || 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (doc.read_only !== true) errors.push('read_only: debe ser true')
  if (!isM3RunId(doc.run_id)) errors.push('run_id: sha256 hex de 64 caracteres')
  if (!isInt(doc.total) || doc.total < 0) errors.push('total: entero >= 0')
  for (const key of ['page', 'pages', 'page_size']) {
    if (!isInt(doc[key]) || doc[key] < 1) errors.push(`${key}: entero >= 1`)
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  if (!doc.applied_filters || typeof doc.applied_filters !== 'object' || Array.isArray(doc.applied_filters)) {
    errors.push('applied_filters: objeto requerido')
  }
  let ruleByCode = null
  let canonicalLatest = null
  if (!latestContext) {
    errors.push('latest_context: requerido')
  } else {
    const latestValidation = validateM3Latest(latestContext)
    if (!latestValidation.ok) {
      errors.push('latest_context: contrato invalido')
    } else if (latestValidation.payload.run.run_id !== doc.run_id) {
      errors.push('latest_context: run_id no coincide')
    } else {
      canonicalLatest = latestValidation.payload
      ruleByCode = new Map(latestValidation.payload.rule_results.map((result) => [result.rule_code, result]))
      if (!sameJson(doc.applied_scope, latestValidation.payload.applied_scope)) {
        errors.push('applied_scope: no coincide con latest')
      }
    }
  }
  if (Array.isArray(doc.items) && ruleByCode) {
    for (const finding of doc.items) {
      if (!validateM3FindingContract(finding, errors, 'items')) break
      validateFindingRuleCoherence(finding, ruleByCode, errors, 'items')
      const reference = finding.evidence_reference || {}
      for (const field of [
        'auditor_build_sha', 'contract_build_sha', 'evidence_classification',
        'evidence_sha256', 'evidence_source', 'is_production_shell_run', 'manifest_sha256',
      ]) {
        if (!Object.is(reference[field], canonicalLatest.run[field])) {
          errors.push(`items.${finding.finding_id}.evidence_reference.${field}: contradice run`)
          break
        }
      }
      if (!canonicalLatest.run.executed_queries.includes(reference.query_id)) {
        errors.push(`items.${finding.finding_id}.evidence_reference.query_id: no ejecutada`)
      }
      if (finding.source_timestamp !== canonicalLatest.run.finished_at) {
        errors.push(`items.${finding.finding_id}.source_timestamp: no coincide con run.finished_at`)
      }
      if (errors.length) break
    }
  }
  if (Array.isArray(doc.items) && isInt(doc.total) && isInt(doc.page)
      && isInt(doc.pages) && isInt(doc.page_size) && doc.page_size > 0) {
    const ids = doc.items.map((finding) => finding?.finding_id)
    if (new Set(ids).size !== ids.length) errors.push('items: finding_id duplicado')
    if (doc.page_size > M3_FINDINGS_MAX_PAGE_SIZE) errors.push('page_size: excede maximo backend')
    if (doc.page > doc.pages) errors.push('page: excede pages')
    const calculatedPages = Math.max(Math.ceil(doc.total / doc.page_size), 1)
    if (doc.pages !== calculatedPages) errors.push('pages: no coincide con total/page_size')
    const expectedLength = doc.total === 0 ? 0
      : doc.page < doc.pages ? doc.page_size
        : doc.total - ((doc.pages - 1) * doc.page_size)
    if (doc.items.length !== expectedLength) {
      errors.push('items: cantidad no coincide con rango de pagina')
    }
    if (doc.items.length > doc.page_size) errors.push('items: excede page_size')
  }
  if (expectedRequest) {
    // El backend pagina despues de filtrar y ajusta una pagina fuera de rango
    // a la ultima disponible; todo lo demas debe coincidir exactamente.
    const requestedPage = isInt(expectedRequest.page) ? expectedRequest.page : 1
    const expectedPage = Math.max(requestedPage, 1)
    const requestedPageSize = isInt(expectedRequest.page_size) && expectedRequest.page_size > 0
      ? expectedRequest.page_size
      : M3_FINDINGS_DEFAULT_PAGE_SIZE
    const expectedPageSize = Math.min(requestedPageSize, M3_FINDINGS_MAX_PAGE_SIZE)
    const expectedPages = isInt(doc.total)
      ? Math.max(Math.ceil(doc.total / expectedPageSize), 1)
      : 1
    const clampedPage = Math.min(expectedPage, expectedPages)
    const expectedFilters = Object.fromEntries(
      Object.entries(expectedRequest).filter(([key, value]) => (
        !['page', 'page_size'].includes(key) && value !== undefined && value !== null && value !== ''
      )),
    )
    if (doc.run_id !== expectedRequest.run_id) errors.push('run_id: no coincide con latest')
    if (doc.pages !== expectedPages) errors.push('pages: no coincide con total/page_size')
    if (doc.page !== clampedPage) errors.push('page: no coincide con request/clamp')
    if (doc.page_size !== expectedPageSize) errors.push('page_size: no coincide con request')
    if (normalizedObject(doc.applied_filters) !== normalizedObject(expectedFilters)) {
      errors.push('applied_filters: no coincide con request')
    }
    if (Array.isArray(doc.rejected_params) && doc.rejected_params.length > 0) {
      errors.push('rejected_params: backend rechazo filtros solicitados')
    }
  }
  scanForbiddenKeys(doc, 'findings', errors)
  return {
    ok: errors.length === 0,
    errors,
    schema,
    payload: errors.length === 0 ? projectFindings(doc) : undefined,
  }
}

/** Recalcula STALE client-side como defensa (el backend ya lo marca). */
export function isRunStale(run, nowIso) {
  const finished = Date.parse(run?.finished_at || '')
  const now = Date.parse(nowIso || '')
  if (!Number.isFinite(finished) || !Number.isFinite(now)) return false
  return (now - finished) / 86400000 > M3_STALE_DAYS
}

export function getM3RunAgeDays(run, nowIso) {
  const finished = Date.parse(run?.finished_at || '')
  const now = Date.parse(nowIso || '')
  if (!Number.isFinite(finished) || !Number.isFinite(now)) return null
  return Math.max((now - finished) / 86400000, 0)
}

export function startM3StaleClock(run, onChange, options = {}) {
  const now = options.now || Date.now
  const setTimer = options.setTimer || setTimeout
  const clearTimer = options.clearTimer || clearTimeout
  let timer = null
  let stopped = false

  const tick = () => {
    if (stopped) return
    const nowMs = Number(now())
    const nowIso = new Date(nowMs).toISOString()
    const stale = isRunStale(run, nowIso)
    onChange(stale, nowIso)
    if (stale) return
    const finished = Date.parse(run?.finished_at || '')
    const deadline = finished + (M3_STALE_DAYS * 86400000)
    const delay = Number.isFinite(deadline)
      ? Math.max(1, Math.min(deadline - nowMs + 1, 60000))
      : 60000
    timer = setTimer(tick, delay)
  }

  tick()
  return () => {
    stopped = true
    if (timer !== null) clearTimer(timer)
  }
}
