// ─── KOLD OS · M4 — contrato del envelope `kold.os.m4.api/1` ─────────────────
// Espejo del backend: GrupoVeniu/GrupoFrio PR #205 (el commit `978994c4` que
// auditó Codex, ya corregido). Si el contrato del backend cambia, se ajusta
// AQUÍ (y en koldOsM4Route.js) sin reescribir la pantalla.
//
// FAIL-CLOSED. El frontend IMPONE la honestidad del backend: rechaza un
// envelope que afirme más de lo que declara poder probar, que traiga PII, que
// arrastre residuos de M3, cuyos KPIs no declaren su universo, o cuyos totales
// no cuadren. Molde: m2/contract.js (mergeado) + contrato epistémico y
// metadata de evidencia del backend M4.

import { M4_RULE_CATALOG, M4_RULE_CODES } from './ruleCatalog.js'
import {
  M4_CANONICAL_CAPABILITIES, M4_KPI_NAMES, M4_MODULE_NAMES, M4_MODULE_STATES,
  M4_OPTIONAL_QUERY_IDS, M4_ORDER_STATES, M4_REQUIRED_QUERY_IDS,
  M4_RUN_ENVIRONMENTS, M4_SCHEMA_CATALOG, getM4KpiMetadata, matchesM4KpiMetadata,
} from './metadataCatalog.js'

export const M4_API_SCHEMA_VERSION = 'kold.os.m4.api/1'
export const M4_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M4_API_SCHEMA_VERSION])
export const M4_STALE_DAYS = 7

// Detector de claves sensibles (PII). Un envelope con CUALQUIERA de estas
// claves se RECHAZA: ocultar una columna no elimina el dato del browser.
export const M4_FORBIDDEN_KEY_RE = /(?:password|passwd|api[_-]?key|token|secret|email|phone|mobile|display_name|partner_name|employee_name|customer_name|salesperson_name|contact_name|street|address|city_name|zip_code|vat_number|rfc|raw_value|free_text|notes)/i

// Residuos de M3 (rutas/visitas/planes) en un envelope M4. Codex encontró que
// `execution_kpis()` seguía calculando métricas de M3 que M4 jamás produce: el
// objeto `kpis` salía entero en null. Si vuelven a aparecer, el envelope se
// RECHAZA — un KPI de rutas dentro de M4 no es un dato, es un bug.
export const M4_FORBIDDEN_M3_KPI_KEYS = Object.freeze([
  'visit_compliance', 'plans_started_overdue_open', 'plans_started', 'plans_closed',
  'stops_total', 'stops_visited', 'stops_pending', 'closure_compliance',
  'routes_without_closure', 'boxes_open', 'offline_pending', 'plan_start_metrics',
  'closure_metrics', 'stop_universe_metrics',
])

// Universos canónicos del backend (`core.UNIVERSES`). El frontend NO decide qué
// universo le toca a cada regla: RENDERIZA el que el backend declara y valida
// que sea uno conocido. Un `universe_id` desconocido = contrato que derivó.
export const M4_UNIVERSE_IDS = Object.freeze([
  'active_commercial_customer_roots_in_scope',
  'commercial_customer_roots_in_scope',
  'new_customer_roots_first_order_in_window',
  'confirmed_orders_in_window',
  'cancelled_orders_in_window',
  'confirmed_order_lines_in_window',
  'leads_in_scope',
])

// Copy PRE-A5: detectamos la forma obsoleta, no sus conteos medidos. Los números
// pertenecen a cada corrida y nunca al contrato desplegado en el navegador.
const M4_PRE_A5_COPY_RE = /^\d[\d,.]*\s*\/\s*\d[\d,.]*\s*\(\d+(?:\.\d+)?%\)\s*sin compra en \d+d;\s*sin definici[oó]n aprobada\.?$/i

export const M4_CLASSIFICATIONS = Object.freeze(
  ['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M4_VERDICTS = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M4_GRANULARITIES = Object.freeze(
  ['aggregate', 'company', 'branch', 'channel', 'customer_segment', 'customer',
    'order', 'line', 'product'])
const CLASSIFICATION_SET = new Set(M4_CLASSIFICATIONS)
const VERDICT_SET = new Set(M4_VERDICTS)
const GRANULARITY_SET = new Set(M4_GRANULARITIES)
const RULE_CODE_SET = new Set(M4_RULE_CODES)
const SEVERITY_SET = new Set(['high', 'medium', 'low'])
const STATUS_SET = new Set(['GREEN', 'AMBER', 'RED', 'NOT_EVALUABLE'])
const LIFECYCLE_SET = new Set(['new', 'persistent', 'recurrent', 'corrected'])
const CONFIDENCE_SET = new Set(['high', 'medium', 'low', 'n/a'])
const AGGREGATE_ENTITY_REFERENCE = 'AGREGADO (scope completo, contrato v1)'
const FORBIDDEN_FINDING_DIMENSIONS = [
  'company_id', 'branch_id', 'branch_code', 'route_id', 'plan_id', 'stop_id', 'vehicle_id',
]
const FINDING_TEXT_FIELDS = [
  'entity_reference', 'title', 'description', 'observed_value', 'expected_rule',
  'business_assumption', 'evidence_limitations', 'threshold_source',
  'responsible_area', 'recommended_action',
]
const EMAIL_VALUE_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const RFC_VALUE_RE = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{8,}\d/g
const FINDING_ID_RE = /^(M4-[A-I]-\d{2})::[0-9a-f]{64}::([a-z_]+):aggregate$/
const INCIDENCE_SEMANTICS = 'Incidencias detectadas, NO entidades únicas.'
const RULE_RESULT_FIELDS = Object.freeze([
  'approved_threshold', 'business_assumption', 'category', 'classification', 'confidence',
  'denominator', 'evidence_limitations', 'granularity', 'incidences', 'name',
  'not_evaluable_reason', 'numerator', 'observed_value', 'pct', 'rule_code', 'severity',
  'status', 'threshold_source', 'universe', 'universe_id', 'verdict',
])
const FINDING_FIELDS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity', 'status', 'granularity', 'title',
  'description', 'entity_type', 'entity_id', 'entity_reference', 'observed_value',
  'expected_rule', 'numerator', 'denominator', 'pct', 'incidences', 'incidence_semantics',
  'responsible_area', 'owner_status', 'recommended_action', 'classification', 'verdict',
  'confidence', 'universe_id', 'universe', 'business_assumption', 'evidence_limitations',
  'approved_threshold', 'threshold_source', 'lifecycle_status', 'occurrence_count',
  'first_seen_at', 'last_seen_at', 'source_model', 'source_timestamp', 'evidence_reference',
])
const EVIDENCE_FIELDS = Object.freeze([
  'query_id', 'evidence_fields', 'evidence_sha256', 'manifest_sha256',
  'auditor_build_sha', 'contract_build_sha', 'evidence_source',
  'evidence_classification', 'is_production_shell_run',
])
const RULE_STATIC_FIELDS = Object.freeze([
  'category', 'classification', 'confidence', 'granularity', 'severity', 'universe_id',
  'universe', 'business_assumption', 'evidence_limitations', 'approved_threshold',
  'threshold_source',
])
const FINDING_STATIC_FIELDS = Object.freeze([
  'category', 'severity', 'granularity', 'entity_type', 'expected_rule',
  'responsible_area', 'recommended_action', 'classification', 'confidence', 'universe_id',
  'universe', 'business_assumption', 'evidence_limitations', 'approved_threshold',
  'threshold_source', 'source_model',
])
const FINDING_DYNAMIC_FIELDS = Object.freeze([
  'category', 'severity', 'status', 'granularity', 'observed_value', 'numerator',
  'denominator', 'pct', 'incidences', 'classification', 'verdict', 'confidence',
  'universe_id', 'universe', 'business_assumption', 'evidence_limitations',
  'approved_threshold', 'threshold_source',
])
const LATEST_FIELDS = Object.freeze([
  'ok', 'schema_version', 'capabilities', 'run', 'stale', 'age_days', 'kpis',
  'metrics', 'summary', 'rule_results', 'findings', 'corrected', 'history',
  'applied_scope', 'read_only',
])
const RUN_FIELDS = Object.freeze([
  'run_id', 'status', 'technical_state', 'environment', 'auditor_build_sha',
  'contract_build_sha', 'is_production_shell_run', 'production_shell_run_blocked_by',
  'evidence_source', 'evidence_classification', 'manifest_sha256', 'evidence_sha256',
  'started_at', 'finished_at', 'duration_ms', 'scope', 'executed_queries',
  'skipped_queries', 'transaction_read_only', 'write_blocked', 'rollback_confirmed',
  'ingested_at',
])
const RUN_SCOPE_FIELDS = Object.freeze([
  'company_ids', 'timezone', 'window_days', 'window_end_exclusive', 'window_start',
])
const SUMMARY_FIELDS = Object.freeze([
  'overall_status', 'total_rules', 'definitive_incident_rule_count', 'warning_rule_count',
  'exploratory_signal_rule_count', 'not_evaluable_rule_count', 'compliant_rule_count',
  'definitive_incident_count', 'warning_count', 'exploratory_signal_count',
  'total_incidences', 'unique_records_available', 'rules_pass', 'rules_warning',
  'rules_fail', 'rules_not_evaluable',
])
const HISTORY_FIELDS = Object.freeze(['runs_count', 'previous_finished_at', 'latest_finished_at'])
const APPLIED_SCOPE_FIELDS = Object.freeze(['level'])
const CAPABILITY_FIELDS = Object.freeze([
  'required_query_ids', 'optional_query_ids', 'granularities', 'features', 'stale_days',
  'findings_max_page_size', 'classifications', 'verdicts',
])
const CAPABILITY_FEATURE_FIELDS = Object.freeze([
  'history', 'findings_pagination', 'aggregate', 'company_dimension', 'branch_dimension',
  'channel_dimension', 'customer_dimension', 'order_dimension', 'product_dimension',
  'entity_detail', 'confirmed_orders', 'delivered_orders', 'invoiced_orders',
  'paid_orders', 'pos_sales', 'returns', 'margin', 'historical_order_channel',
  'pricelist_evaluation', 'campaign_execution',
])
const KPI_REQUIRED_FIELDS = Object.freeze([
  'value', 'universe', 'source_model', 'source_fields', 'data_as_of',
])
const KPI_OPTIONAL_FIELDS = Object.freeze(['coverage', 'caveat'])
const KPI_FIELDS = Object.freeze([...KPI_REQUIRED_FIELDS, ...KPI_OPTIONAL_FIELDS])
const KPI_NAMES = new Set(M4_KPI_NAMES)
const METRIC_ROW_FIELDS = Object.freeze({
  crm_metrics: ['lead_count', 'no_owner_count', 'no_stage_count', 'no_team_count'],
  customer_dup_metrics: ['contact_dup_groups', 'vat_dup_groups'],
  customer_master_metrics: [
    'archived_with_sales_count', 'customer_count', 'no_channel_count', 'no_country_count',
    'no_geo_count', 'non_commercial_rank_count', 'root_count',
  ],
  module_status: ['name', 'state', 'version'],
  order_line_metrics: [
    'discount_ge50_count', 'discount_ge90_count', 'discount_gt0_count', 'no_product_count',
    'price_lt_zero_count', 'price_zero_count', 'product_line_count', 'qty_le_zero_count',
  ],
  order_metrics: [
    'confirmed_count', 'no_analytic_count', 'no_channel_customer_count',
    'no_salesperson_count', 'non_customer_count',
  ],
  order_state_metrics: ['order_count', 'state'],
  recurrence_metrics: [
    'active_in_window_count', 'customer_count', 'dormant_count', 'lost_prior_window_count',
    'new_with_order_count', 'new_without_second_count', 'recurrent_count',
  ],
  schema_catalog: ['column_name', 'table_name'],
  scope_validation: ['customer_count'],
})
const CORRECTED_RAW_FIELDS = Object.freeze([
  'finding_key', 'rule_code', 'lifecycle_status', 'first_seen_at', 'last_seen_at',
  'occurrence_count',
])
const CORRECTED_CANONICAL_FIELDS = Object.freeze([...CORRECTED_RAW_FIELDS, 'corrected_at'])
const FINDINGS_PAGE_FIELDS = Object.freeze([
  'ok', 'schema_version', 'run_id', 'total', 'page', 'pages', 'page_size', 'items',
  'applied_scope', 'applied_filters', 'rejected_params', 'read_only',
])
const RUNS_ENVELOPE_FIELDS = Object.freeze([
  'ok', 'schema_version', 'runs', 'applied_scope', 'read_only',
])
const RUN_META_FIELDS = Object.freeze([
  'run_id', 'status', 'environment', 'finished_at', 'ingested_at',
  'manifest_sha256', 'evidence_sha256', 'auditor_build_sha', 'contract_build_sha',
  'is_production_shell_run', 'production_shell_run_blocked_by', 'evidence_source',
  'evidence_classification', 'findings_count',
])

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Enums cerrados de evidencia (espejo del backend). Cerrados a
// propósito: texto libre permitiría que una evidencia se auto-describa.
const EVIDENCE_SOURCES = ['odoo_shell_production_run', 'xml_rpc_read_only_measurements']
const EVIDENCE_CLASSIFICATIONS = ['formal_production_run', 'pre_deployment_semantic_validation']
const SHELL_BLOCKERS = ['ssh_key_not_registered', 'module_not_deployed', 'production_shell_unavailable']
const LEGACY_A5_REASON_RE = /^A5 refutó la premisa: company_id vacío en el maestro es el diseño multiempresa de Odoo \(\d+ partners compartidos\), no un defecto\. El auditor no mide este campo hasta que exista una política aprobada\.$/

const isBool = (v) => typeof v === 'boolean'
const isInt = (v) => Number.isInteger(v)
const isIso = (v) => {
  if (typeof v !== 'string' || !ISO_RE.test(v) || !Number.isFinite(Date.parse(v))) return false
  const [, year, month, day] = v.match(/^(\d{4})-(\d{2})-(\d{2})/) || []
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  if (monthNumber < 1 || monthNumber > 12) return false
  return dayNumber >= 1 && dayNumber <= new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate()
}
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const sameValue = (left, right) => Object.is(left, right)
const sameArray = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => value === right[index])
const sameSet = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && new Set(left).size === left.length
  && left.every((value) => right.includes(value))
const isNullableFinite = (value) => value === null || Number.isFinite(value)
const isKnownTimeZone = (value) => {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

function requireOwnFields(value, fields, label, errors) {
  for (const field of fields) {
    if (!hasOwn(value, field)) errors.push(`${label}.${field}: campo requerido`)
  }
}

function validateExactKeys(value, fields, label, errors, { requireAll = true } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label}: objeto requerido`)
    return false
  }
  if (requireAll) requireOwnFields(value, fields, label, errors)
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) errors.push(`${label}.${key}: campo no permitido`)
  }
  return true
}

const pickFields = (value, fields) => Object.fromEntries(
  fields.filter((field) => hasOwn(value, field)).map((field) => [field, value[field]]),
)

function expectedVerdict(classification, status) {
  if (status === 'NOT_EVALUABLE' || classification === 'not_evaluable' || classification === 'invalid') {
    return 'no_evaluable'
  }
  if (status === 'GREEN') return 'cumple'
  if (classification === 'definitive') return status === 'RED' ? 'incumplimiento' : 'riesgo'
  if (classification === 'caveated') return 'riesgo'
  if (classification === 'exploratory') return 'anomalia'
  return null
}

function validateNumericProjection(value, label, errors) {
  for (const field of ['numerator', 'denominator', 'pct']) {
    if (!isNullableFinite(value[field])) errors.push(`${label}.${field}: número finito o null`)
  }
  if (value.incidences !== null && (!isInt(value.incidences) || value.incidences < 0)) {
    errors.push(`${label}.incidences: entero >= 0 o null`)
  }
  if (Number.isFinite(value.numerator) && Number.isFinite(value.denominator)
    && value.denominator > 0 && value.numerator > value.denominator) {
    errors.push(`${label}: numerator no puede exceder denominator`)
  }
}

function validateObservedValue(value, label, errors) {
  if (value.verdict === 'no_evaluable' || value.status === 'NOT_EVALUABLE') {
    if (value.observed_value !== 'No evaluable en el contrato v1') {
      errors.push(`${label}.observed_value: plantilla no evaluable requerida`)
    }
    return
  }
  if (Number.isFinite(value.numerator) && Number.isFinite(value.denominator)) {
    const match = typeof value.observed_value === 'string'
      ? value.observed_value.match(/^(-?\d+(?:\.\d+)?) de (-?\d+(?:\.\d+)?) \((-?\d+(?:\.\d+)?)%\)$/)
      : null
    if (!match || Number(match[1]) !== value.numerator || Number(match[2]) !== value.denominator
      || Number(match[3]) !== value.pct) {
      errors.push(`${label}.observed_value: plantilla numerator de denominator (pct%) incoherente`)
    }
    return
  }
  if (Number.isFinite(value.numerator)) {
    if (String(value.numerator) !== value.observed_value) {
      errors.push(`${label}.observed_value: valor agregado numérico incoherente`)
    }
    return
  }
  errors.push(`${label}.observed_value: proyección agregada no reconocida`)
}

export function classifySchemaVersion(doc) {
  const version = doc?.schema_version
  if (typeof version !== 'string' || !version) return 'missing'
  return M4_SUPPORTED_SCHEMA_VERSIONS.includes(version) ? 'supported' : 'unsupported'
}

// Barrido recursivo de claves prohibidas (PII / credenciales).
export function scanForbiddenKeys(value, path = '', found = [], depth = 0) {
  if (depth > 14 || !value || typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) scanForbiddenKeys(item, path, found, depth + 1)
    return found
  }
  for (const [key, val] of Object.entries(value)) {
    if (M4_FORBIDDEN_KEY_RE.test(key)) found.push(`${path}${key}`)
    scanForbiddenKeys(val, `${path}${key}.`, found, depth + 1)
  }
  return found
}

// Barrido recursivo del copy PRE-A5 en los textos del envelope.
export function scanPreA5Figures(value, path = '', found = [], depth = 0) {
  if (depth > 14 || value == null) return found
  if (typeof value === 'string') {
    if (M4_PRE_A5_COPY_RE.test(value)) found.push(`${path}: copy pre-A5`)
    return found
  }
  if (typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) scanPreA5Figures(item, path, found, depth + 1)
    return found
  }
  for (const [key, val] of Object.entries(value)) {
    scanPreA5Figures(val, path ? `${path}.${key}` : key, found, depth + 1)
  }
  return found
}

function validateRun(run, errors) {
  if (!run || typeof run !== 'object') {
    errors.push('run: objeto requerido')
    return
  }
  validateExactKeys(run, RUN_FIELDS, 'run', errors)
  if (typeof run.run_id !== 'string' || !SHA256_RE.test(run.run_id)) {
    errors.push('run.run_id: sha256 hex requerido')
  }
  if (run.status !== 'PASS' && run.status !== 'FAIL') errors.push('run.status: PASS|FAIL')
  if (!['PASS', 'FAIL', 'STALE'].includes(run.technical_state)) {
    errors.push('run.technical_state: PASS|FAIL|STALE')
  }
  for (const key of ['transaction_read_only', 'write_blocked', 'rollback_confirmed']) {
    if (!isBool(run[key])) errors.push(`run.${key}: booleano`)
  }
  if (!M4_RUN_ENVIRONMENTS.includes(run.environment)) errors.push('run.environment: enum inválido')
  if (!Number.isFinite(run.duration_ms) || run.duration_ms < 0) {
    errors.push('run.duration_ms: número >= 0')
  }
  if (run.ingested_at != null && !isIso(run.ingested_at)) errors.push('run.ingested_at: ISO o null')
  if (!sameSet(run.executed_queries, M4_REQUIRED_QUERY_IDS)) {
    errors.push('run.executed_queries: debe coincidir con queries requeridas M4 v1')
  }
  if (!sameSet(run.skipped_queries, M4_OPTIONAL_QUERY_IDS)) {
    errors.push('run.skipped_queries: debe coincidir con queries opcionales M4 v1')
  }
  for (const key of ['manifest_sha256', 'evidence_sha256']) {
    if (typeof run[key] !== 'string' || !SHA256_RE.test(run[key])) {
      errors.push(`run.${key}: sha256 hex`)
    }
  }

  // ── Linaje de build: dos hechos distintos, jamás colapsados ───────────────
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

  // ── Honestidad de evidencia: obligatoria y coherente ──────────────────────
  if (!isBool(run.is_production_shell_run)) {
    errors.push('run.is_production_shell_run: booleano obligatorio')
  }
  if (!Array.isArray(run.production_shell_run_blocked_by)) {
    errors.push('run.production_shell_run_blocked_by: lista obligatoria')
  }
  if (!EVIDENCE_SOURCES.includes(run.evidence_source)) errors.push('run.evidence_source: inválido')
  if (!EVIDENCE_CLASSIFICATIONS.includes(run.evidence_classification)) {
    errors.push('run.evidence_classification: inválido')
  }
  if (isBool(run.is_production_shell_run) && Array.isArray(run.production_shell_run_blocked_by)) {
    if (run.is_production_shell_run) {
      if (run.production_shell_run_blocked_by.length) {
        errors.push('run: corrida formal no puede declarar bloqueadores')
      }
      if (run.environment !== 'production') errors.push('run: corrida formal exige environment=production')
      if (run.evidence_classification !== 'formal_production_run') {
        errors.push('run: corrida formal debe clasificar como formal_production_run')
      }
    } else {
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

  if (!isIso(run.started_at) || !isIso(run.finished_at)) {
    errors.push('run.started_at/finished_at: ISO')
  } else if (Date.parse(run.started_at) > Date.parse(run.finished_at)) {
    errors.push('run: started_at no puede ser posterior a finished_at')
  }
  if (isIso(run.finished_at) && isIso(run.ingested_at)
    && Date.parse(run.finished_at) > Date.parse(run.ingested_at)) {
    errors.push('run: finished_at no puede ser posterior a ingested_at')
  }

  // ── Scope: ventana ABSOLUTA. Flexible en compañías (no fija ids) ──────────
  const scope = run.scope
  if (!scope || typeof scope !== 'object') {
    errors.push('run.scope: objeto requerido')
  } else {
    validateExactKeys(scope, RUN_SCOPE_FIELDS, 'run.scope', errors)
    if (!Array.isArray(scope.company_ids) || !scope.company_ids.length
      || !scope.company_ids.every((id) => isInt(id) && id > 0)) {
      errors.push('run.scope.company_ids: enteros > 0')
    }
    if (!isKnownTimeZone(scope.timezone)) errors.push('run.scope.timezone: zona IANA válida requerida')
    if (!isInt(scope.window_days) || scope.window_days < 1) {
      errors.push('run.scope.window_days: entero >= 1')
    }
    if (typeof scope.window_start !== 'string' || !DATE_RE.test(scope.window_start)
      || typeof scope.window_end_exclusive !== 'string' || !DATE_RE.test(scope.window_end_exclusive)
      || scope.window_start >= scope.window_end_exclusive) {
      errors.push('run.scope: window_start < window_end_exclusive (YYYY-MM-DD) requeridos')
    }
  }
}

function validateRuleResults(doc, errors) {
  if (!Array.isArray(doc.rule_results) || !doc.rule_results.length) {
    errors.push('rule_results: arreglo no vacío requerido')
    return
  }
  const seen = new Set()
  for (const result of doc.rule_results) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      errors.push('rule_results: entrada inválida')
      continue
    }
    validateExactKeys(result, RULE_RESULT_FIELDS, `rule_results.${result.rule_code || '?'}`, errors)
    requireOwnFields(result, RULE_RESULT_FIELDS, 'rule_results', errors)
    const catalog = M4_RULE_CATALOG[result.rule_code]
    if (!catalog || !RULE_CODE_SET.has(result.rule_code)) {
      errors.push(`rule_results: rule_code desconocido (${result.rule_code})`)
      continue
    }
    if (seen.has(result.rule_code)) errors.push(`rule_results: regla duplicada ${result.rule_code}`)
    seen.add(result.rule_code)
    for (const field of RULE_STATIC_FIELDS) {
      if (!sameValue(result[field], catalog[field])) {
        errors.push(`rule_results.${result.rule_code}.${field}: no coincide con catálogo`)
      }
    }
    if (result.name !== catalog.name) errors.push(`rule_results.${result.rule_code}.name: copy no canónico`)
    const expectedReason = catalog.threshold?.reason ?? null
    const acceptedLegacyReason = result.rule_code === 'M4-A-08'
      && typeof result.not_evaluable_reason === 'string'
      && LEGACY_A5_REASON_RE.test(result.not_evaluable_reason)
    if (result.not_evaluable_reason !== expectedReason && !acceptedLegacyReason) {
      errors.push(`rule_results.${result.rule_code}.not_evaluable_reason: no canónico`)
    }
    if (!STATUS_SET.has(result.status)) errors.push(`rule_results.${result.rule_code}.status: enum inválido`)
    if (!SEVERITY_SET.has(result.severity)) errors.push(`rule_results.${result.rule_code}.severity: enum inválido`)
    if (!CLASSIFICATION_SET.has(result.classification)) errors.push(`rule_results.${result.rule_code}.classification: enum inválido`)
    if (!VERDICT_SET.has(result.verdict)) errors.push(`rule_results.${result.rule_code}.verdict: enum inválido`)
    const verdict = expectedVerdict(result.classification, result.status)
    if (verdict && result.verdict !== verdict) {
      errors.push(`rule_results.${result.rule_code}: status/classification exige verdict=${verdict}`)
    }
    if (typeof result.observed_value !== 'string' || !result.observed_value.trim()) {
      errors.push(`rule_results.${result.rule_code}.observed_value: string requerido`)
    }
    validateNumericProjection(result, `rule_results.${result.rule_code}`, errors)
    validateObservedValue(result, `rule_results.${result.rule_code}`, errors)
    if (result.verdict === 'no_evaluable' && Number(result.incidences) > 0) {
      errors.push(`rule_results.${result.rule_code}: no_evaluable no puede traer incidencias`)
    }
  }
  for (const code of M4_RULE_CODES) {
    if (!seen.has(code)) errors.push(`rule_results: falta regla canónica ${code}`)
  }
}

// Cada KPI debe declarar su contrato completo. Un número sin universo ni fuente
// es una afirmación sin respaldo: se rechaza el envelope entero, no se muestra
// "por si acaso". `coverage`/`caveat` son opcionales (no todo KPI tiene
// denominador ni salvedad); el resto es obligatorio.
function validateKpis(doc, errors) {
  const kpis = doc.kpis
  if (!kpis || typeof kpis !== 'object' || Array.isArray(kpis)) {
    errors.push('kpis: objeto requerido')
    return
  }
  for (const key of M4_FORBIDDEN_M3_KPI_KEYS) {
    if (key in kpis) errors.push(`kpis.${key}: residuo de M3 — M4 no mide rutas/visitas/planes`)
  }
  for (const [key, kpi] of Object.entries(kpis)) {
    if (!KPI_NAMES.has(key)) {
      errors.push(`kpis.${key}: KPI no permitido`)
      continue
    }
    if (kpi === null || kpi === undefined) {
      errors.push(`kpis.${key}: null — un KPI sin fuente NO se emite (se omite la clave)`)
      continue
    }
    if (typeof kpi !== 'object' || Array.isArray(kpi)) {
      errors.push(`kpis.${key}: objeto con contrato requerido (no un número suelto)`)
      continue
    }
    validateExactKeys(kpi, KPI_FIELDS, `kpis.${key}`, errors, { requireAll: false })
    requireOwnFields(kpi, KPI_REQUIRED_FIELDS, `kpis.${key}`, errors)
    const metadata = getM4KpiMetadata(key, doc.run?.scope)
    if (!metadata) {
      errors.push(`kpis.${key}: metadata canónica no disponible`)
      continue
    }
    if (!Number.isFinite(kpi.value)) errors.push(`kpis.${key}.value: número finito requerido`)
    for (const field of ['universe', 'source_model']) {
      if (!matchesM4KpiMetadata(key, field, kpi[field], doc.run?.scope)) {
        errors.push(`kpis.${key}.${field}: no canónico`)
      }
    }
    if (!matchesM4KpiMetadata(key, 'source_fields', kpi.source_fields, doc.run?.scope)) {
      errors.push(`kpis.${key}.source_fields: no canónicos`)
    }
    if (kpi.data_as_of !== doc.run?.finished_at || !isIso(kpi.data_as_of)) {
      errors.push(`kpis.${key}.data_as_of: debe coincidir con run.finished_at`)
    }
    if (hasOwn(kpi, 'coverage')
      && kpi.coverage !== null
      && (!Number.isFinite(kpi.coverage) || kpi.coverage < 0 || kpi.coverage > 100)) {
      errors.push(`kpis.${key}.coverage: número 0..100 o null`)
    }
    if (hasOwn(kpi, 'caveat') && kpi.caveat !== metadata.caveat) {
      errors.push(`kpis.${key}.caveat: no canónico`)
    }
  }
}

function validateMetrics(doc, errors) {
  const metrics = doc.metrics
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    errors.push('metrics: objeto requerido')
    return
  }
  validateExactKeys(metrics, Object.keys(METRIC_ROW_FIELDS), 'metrics', errors, { requireAll: false })
  for (const [metricName, rows] of Object.entries(metrics)) {
    const fields = METRIC_ROW_FIELDS[metricName]
    if (!fields) continue
    if (!Array.isArray(rows)) {
      errors.push(`metrics.${metricName}: arreglo requerido`)
      continue
    }
    for (const [index, row] of rows.entries()) {
      if (!validateExactKeys(row, fields, `metrics.${metricName}[${index}]`, errors)) continue
      for (const [field, value] of Object.entries(row)) {
        const isTechnicalText = metricName === 'module_status'
          || metricName === 'schema_catalog'
          || (metricName === 'order_state_metrics' && field === 'state')
        if (isTechnicalText) {
          const validModuleName = metricName !== 'module_status' || field !== 'name'
            || M4_MODULE_NAMES.includes(value)
          const validModuleState = metricName !== 'module_status' || field !== 'state'
            || M4_MODULE_STATES.includes(value)
          const validModuleVersion = metricName !== 'module_status' || field !== 'version'
            || (typeof value === 'string' && /^\d+(?:\.\d+){1,4}$/.test(value))
          const validOrderState = metricName !== 'order_state_metrics' || field !== 'state'
            || M4_ORDER_STATES.includes(value)
          const validSchemaValue = metricName !== 'schema_catalog'
            || (field === 'table_name'
              ? Object.hasOwn(M4_SCHEMA_CATALOG, value)
              : M4_SCHEMA_CATALOG[row.table_name]?.includes(value))
          if (typeof value !== 'string' || !validModuleName || !validModuleState
            || !validModuleVersion || !validOrderState || !validSchemaValue) {
            errors.push(`metrics.${metricName}[${index}].${field}: identificador técnico inválido`)
          }
        } else if (!Number.isFinite(value)) {
          errors.push(`metrics.${metricName}[${index}].${field}: número finito requerido`)
        }
      }
    }
  }
}

// Las capabilities gobiernan la UI: si el backend declara que NO puede medir
// algo, la pantalla muestra "—", nunca un 0. Aquí se exige que las declare.
function validateCapabilities(doc, errors) {
  const caps = doc.capabilities
  if (!caps || typeof caps !== 'object') {
    errors.push('capabilities: objeto requerido')
    return
  }
  validateExactKeys(caps, CAPABILITY_FIELDS, 'capabilities', errors)
  for (const field of ['required_query_ids', 'optional_query_ids', 'granularities', 'classifications', 'verdicts']) {
    if (!sameArray(caps[field], M4_CANONICAL_CAPABILITIES[field])) {
      errors.push(`capabilities.${field}: no coincide con contrato M4 v1`)
    }
  }
  for (const field of ['stale_days', 'findings_max_page_size']) {
    if (caps[field] !== M4_CANONICAL_CAPABILITIES[field]) {
      errors.push(`capabilities.${field}: no coincide con contrato M4 v1`)
    }
  }
  if (!caps.features || typeof caps.features !== 'object') {
    errors.push('capabilities.features: objeto requerido (qué puede y qué NO puede medir M4)')
    return
  }
  validateExactKeys(caps.features, CAPABILITY_FEATURE_FIELDS, 'capabilities.features', errors)
  for (const [feature, expected] of Object.entries(M4_CANONICAL_CAPABILITIES.features)) {
    if (caps.features[feature] !== expected) {
      errors.push(`capabilities.features.${feature}: no coincide con contrato M4 v1`)
    }
  }
}

// La granularidad declarada por un finding no puede exceder lo que las
// capabilities dicen que el auditor sabe producir.
function validateGranularityCoherence(doc, errors) {
  const caps = doc.capabilities
  const declared = Array.isArray(caps?.granularities) ? new Set(caps.granularities) : null
  if (!declared) return
  for (const finding of doc.findings || []) {
    if (finding?.granularity && !declared.has(finding.granularity)) {
      errors.push(`findings: granularidad ${finding.granularity} no declarada en capabilities.granularities`)
      break
    }
  }
  if (caps.features?.branch_dimension === false
    && (doc.findings || []).some((f) => f?.granularity === 'branch' || f?.branch_id != null)) {
    errors.push('findings: hay dimensión de sucursal pero capabilities.features.branch_dimension=false')
  }
}

function deriveSummary(ruleResults) {
  const results = Array.isArray(ruleResults) ? ruleResults : []
  const byVerdict = (verdict) => results.filter((rule) => rule?.verdict === verdict)
  const definitive = byVerdict('incumplimiento')
  const risks = byVerdict('riesgo')
  const anomalies = byVerdict('anomalia')
  const compliant = byVerdict('cumple')
  const notEvaluable = byVerdict('no_evaluable')
  const incidences = (rules) => rules.reduce(
    (total, rule) => total + (Number.isInteger(rule?.incidences) ? rule.incidences : 0), 0)
  const definitiveCount = incidences(definitive)
  const warningCount = incidences(risks)
  const exploratoryCount = incidences(anomalies)
  return {
    overall_status: definitive.length ? 'RED'
      : risks.length ? 'AMBER'
        : compliant.length ? 'GREEN' : 'NOT_EVALUABLE',
    total_rules: results.length,
    definitive_incident_rule_count: definitive.length,
    warning_rule_count: risks.length,
    exploratory_signal_rule_count: anomalies.length,
    not_evaluable_rule_count: notEvaluable.length,
    compliant_rule_count: compliant.length,
    definitive_incident_count: definitiveCount,
    warning_count: warningCount,
    exploratory_signal_count: exploratoryCount,
    total_incidences: definitiveCount + warningCount + exploratoryCount,
    unique_records_available: false,
    rules_pass: compliant.length,
    rules_warning: risks.length + anomalies.length,
    rules_fail: definitive.length,
    rules_not_evaluable: notEvaluable.length,
  }
}

function validateSummary(doc, errors) {
  const summary = doc.summary
  if (!summary || typeof summary !== 'object') {
    errors.push('summary: objeto requerido')
    return
  }
  validateExactKeys(summary, SUMMARY_FIELDS, 'summary', errors)
  for (const key of SUMMARY_FIELDS.filter(
    (field) => field !== 'overall_status' && field !== 'unique_records_available')) {
    if (!isInt(summary[key]) || summary[key] < 0) errors.push(`summary.${key}: entero >= 0`)
  }
  const expected = deriveSummary(doc.rule_results)
  for (const field of SUMMARY_FIELDS) {
    if (!sameValue(summary[field], expected[field])) {
      errors.push(`summary.${field}: no coincide con rule_results`)
    }
  }
}

function validateFindings(doc, errors) {
  if (!Array.isArray(doc.findings)) {
    errors.push('findings: arreglo requerido')
    return
  }
  const ruleByCode = new Map((doc.rule_results || []).map((r) => [r?.rule_code, r]))
  for (const finding of doc.findings) {
    if (!validateFinding(finding, errors, ruleByCode, doc.run)) break
  }
}

function validateHistory(doc, errors) {
  const history = doc.history
  if (!history || typeof history !== 'object' || !isInt(history.runs_count)
    || history.runs_count < 1) {
    errors.push('history.runs_count: entero >= 1 requerido')
    return
  }
  validateExactKeys(history, HISTORY_FIELDS, 'history', errors)
  for (const field of ['previous_finished_at', 'latest_finished_at']) {
    if (history[field] != null && !isIso(history[field])) errors.push(`history.${field}: ISO o null`)
  }
  if (history.latest_finished_at !== doc.run?.finished_at) {
    errors.push('history.latest_finished_at: debe coincidir con run.finished_at')
  }
  if (history.runs_count === 1 && history.previous_finished_at !== null) {
    errors.push('history.previous_finished_at: debe ser null con una corrida')
  }
  if (history.runs_count >= 2) {
    if (!isIso(history.previous_finished_at)) {
      errors.push('history.previous_finished_at: requerido desde la segunda corrida')
    } else if (isIso(doc.run?.started_at)
      && Date.parse(history.previous_finished_at) >= Date.parse(doc.run.started_at)) {
      errors.push('history.previous_finished_at: debe ser estrictamente anterior al inicio actual')
    }
  }
}

function validateCorrected(doc, errors) {
  if (!Array.isArray(doc.corrected)) {
    errors.push('corrected: arreglo requerido')
    return
  }
  const seen = new Set()
  const previousAt = isIso(doc.history?.previous_finished_at)
    ? Date.parse(doc.history.previous_finished_at) : null
  for (const [index, corrected] of doc.corrected.entries()) {
    if (!validateExactKeys(
      corrected, CORRECTED_CANONICAL_FIELDS, `corrected[${index}]`, errors,
      { requireAll: false },
    )) continue
    requireOwnFields(corrected, CORRECTED_RAW_FIELDS, `corrected[${index}]`, errors)
    const catalog = M4_RULE_CATALOG[corrected.rule_code]
    if (!catalog) errors.push(`corrected[${index}].rule_code: desconocido`)
    const match = typeof corrected.finding_key === 'string'
      ? corrected.finding_key.match(FINDING_ID_RE) : null
    if (!match || match[1] !== corrected.rule_code || match[2] !== catalog?.entity_type) {
      errors.push(`corrected[${index}].finding_key: regla/entity_type/granularidad no canónicos`)
    }
    if (seen.has(corrected.finding_key)) {
      errors.push(`corrected[${index}].finding_key: duplicado`)
    }
    seen.add(corrected.finding_key)
    if (corrected.lifecycle_status !== 'corrected') {
      errors.push(`corrected[${index}].lifecycle_status: debe ser corrected`)
    }
    if (!isIso(corrected.first_seen_at) || !isIso(corrected.last_seen_at)) {
      errors.push(`corrected[${index}]: first_seen_at/last_seen_at ISO requeridos`)
    } else {
      const firstAt = Date.parse(corrected.first_seen_at)
      const lastAt = Date.parse(corrected.last_seen_at)
      if (firstAt > lastAt) errors.push(`corrected[${index}]: first_seen_at posterior a last_seen_at`)
      if (previousAt == null || lastAt > previousAt) {
        errors.push(`corrected[${index}].last_seen_at: posterior a la corrida previa`)
      }
    }
    if (!isInt(corrected.occurrence_count) || corrected.occurrence_count < 1) {
      errors.push(`corrected[${index}].occurrence_count: entero >= 1`)
    } else if (isInt(doc.history?.runs_count)
      && corrected.occurrence_count >= doc.history.runs_count) {
      errors.push(`corrected[${index}].occurrence_count: excede el historial previo`)
    }
    if (hasOwn(corrected, 'corrected_at')) {
      if (!isIso(corrected.corrected_at)) {
        errors.push(`corrected[${index}].corrected_at: ISO requerido`)
      } else if (corrected.corrected_at !== doc.run?.finished_at) {
        errors.push(`corrected[${index}].corrected_at: debe coincidir con run.finished_at`)
      }
    }
  }
}

function containsPiiValue(value) {
  if (typeof value !== 'string' || !value) return false
  if (EMAIL_VALUE_RE.test(value) || RFC_VALUE_RE.test(value)) return true
  PHONE_CANDIDATE_RE.lastIndex = 0
  for (const match of value.matchAll(PHONE_CANDIDATE_RE)) {
    const digits = match[0].replace(/\D/g, '')
    if (digits.length >= 10 && digits.length <= 15) return true
  }
  return false
}

function validateFinding(finding, errors, ruleByCode = null, run = null) {
  const initialErrorCount = errors.length
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    errors.push('findings: entrada inválida')
    return false
  }
  requireOwnFields(finding, FINDING_FIELDS, 'findings', errors)
  for (const key of Object.keys(finding)) {
    if (!FINDING_FIELDS.includes(key)) errors.push(`findings.${key}: campo no permitido`)
  }
  const catalog = M4_RULE_CATALOG[finding.rule_code]
  if (!catalog) errors.push(`findings: rule_code desconocido (${finding.rule_code})`)
  const idMatch = typeof finding.finding_id === 'string' ? finding.finding_id.match(FINDING_ID_RE) : null
  if (!idMatch || idMatch[1] !== finding.rule_code || idMatch[2] !== finding.entity_type) {
    errors.push('findings: finding_id no corresponde a rule_code/entity_type agregado')
  }
  if (!SEVERITY_SET.has(finding.severity)) errors.push('findings: severity enum inválido')
  if (!['RED', 'AMBER'].includes(finding.status)) errors.push('findings: status RED|AMBER')
  if (finding.granularity !== 'aggregate') {
    errors.push('findings: contrato v1 solo admite granularity=aggregate')
  }
  if (finding.entity_id != null) errors.push('findings: aggregate no puede traer entity_id')
  if (finding.responsible_employee_id != null) {
    errors.push('findings: aggregate no puede exponer responsible_employee_id')
  }
  for (const dimension of FORBIDDEN_FINDING_DIMENSIONS) {
    if (finding[dimension] != null) errors.push(`findings: dimensión no soportada ${dimension}`)
  }
  if (finding.entity_reference !== AGGREGATE_ENTITY_REFERENCE) {
    errors.push('findings: entity_reference agregado canónico requerido')
  }
  if (!LIFECYCLE_SET.has(finding.lifecycle_status)) {
    errors.push('findings: lifecycle_status inválido')
  }
  if (finding.owner_status !== 'unassigned') errors.push('findings: owner_status debe ser unassigned')
  if (!isInt(finding.occurrence_count) || finding.occurrence_count < 1) {
    errors.push('findings: occurrence_count entero >= 1')
  }
  for (const field of ['first_seen_at', 'last_seen_at', 'source_timestamp']) {
    if (!isIso(finding[field])) errors.push(`findings: ${field} ISO requerido`)
  }
  if (isIso(finding.first_seen_at) && isIso(finding.last_seen_at)
    && Date.parse(finding.first_seen_at) > Date.parse(finding.last_seen_at)) {
    errors.push('findings: first_seen_at no puede ser posterior a last_seen_at')
  }
  if (finding.incidence_semantics !== INCIDENCE_SEMANTICS) {
    errors.push('findings: incidence_semantics no canónica')
  }
  if (!CLASSIFICATION_SET.has(finding.classification)) {
    errors.push('findings: classification requerida y válida')
  }
  if (!VERDICT_SET.has(finding.verdict)) errors.push('findings: verdict requerido y válido')
  if (!CONFIDENCE_SET.has(finding.confidence)) errors.push('findings: confidence requerida y válida')
  if (typeof finding.universe !== 'string' || !finding.universe.trim()) {
    errors.push('findings: universe requerido')
  }
  if (!M4_UNIVERSE_IDS.includes(finding.universe_id)) {
    errors.push(`findings: universe_id desconocido (${finding.universe_id})`)
  }
  for (const field of ['business_assumption', 'evidence_limitations', 'threshold_source']) {
    if (typeof finding[field] !== 'string' || !finding[field].trim()) {
      errors.push(`findings: ${field} requerido`)
    }
  }
  if (typeof finding.approved_threshold !== 'boolean') {
    errors.push('findings: approved_threshold booleano requerido')
  }
  if (finding.classification === 'exploratory' && finding.verdict === 'incumplimiento') {
    errors.push('findings: exploratory no puede ser incumplimiento')
  }
  const requiredVerdict = expectedVerdict(finding.classification, finding.status)
  if (requiredVerdict && finding.verdict !== requiredVerdict) {
    errors.push(`findings: ${finding.classification}/${finding.status} exige verdict=${requiredVerdict}`)
  }
  if (finding.verdict === 'incumplimiento' && finding.approved_threshold !== true) {
    errors.push('findings: incumplimiento exige approved_threshold')
  }
  if (finding.verdict === 'no_evaluable' && Number(finding.incidences) > 0) {
    errors.push('findings: no_evaluable no puede traer incidencias')
  }
  for (const field of FINDING_TEXT_FIELDS) {
    if (containsPiiValue(finding[field])) errors.push(`findings: PII detectada en ${field}`)
  }

  validateNumericProjection(finding, `findings.${finding.rule_code || '?'}`, errors)
  validateObservedValue(finding, `findings.${finding.rule_code || '?'}`, errors)

  if (catalog) {
    if (finding.title !== catalog.name) errors.push(`findings.${finding.rule_code}.title: copy no canónico`)
    if (finding.description !== catalog.description) errors.push(`findings.${finding.rule_code}.description: copy no canónico`)
    for (const field of FINDING_STATIC_FIELDS) {
      if (!sameValue(finding[field], catalog[field])) {
        errors.push(`findings.${finding.rule_code}.${field}: no coincide con catálogo`)
      }
    }
    const evidence = finding.evidence_reference
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
      errors.push(`findings.${finding.rule_code}.evidence_reference: objeto requerido`)
    } else {
      requireOwnFields(evidence, EVIDENCE_FIELDS, 'findings.evidence_reference', errors)
      for (const key of Object.keys(evidence)) {
        if (!EVIDENCE_FIELDS.includes(key)) {
          errors.push(`findings.evidence_reference.${key}: campo no permitido`)
        }
      }
      if (evidence.query_id !== catalog.query_id) errors.push('findings.evidence_reference.query_id: no canónico')
      if (!sameArray(evidence.evidence_fields, catalog.evidence_fields)) {
        errors.push('findings.evidence_reference.evidence_fields: no canónicos')
      }
      for (const key of ['evidence_sha256', 'manifest_sha256']) {
        if (typeof evidence[key] !== 'string' || !SHA256_RE.test(evidence[key])) {
          errors.push(`findings.evidence_reference.${key}: sha256 hex`)
        }
      }
      if (typeof evidence.auditor_build_sha !== 'string' || !SHA_RE.test(evidence.auditor_build_sha)) {
        errors.push('findings.evidence_reference.auditor_build_sha: SHA requerido')
      }
      if (evidence.contract_build_sha != null
        && (typeof evidence.contract_build_sha !== 'string' || !SHA_RE.test(evidence.contract_build_sha))) {
        errors.push('findings.evidence_reference.contract_build_sha: SHA o null')
      }
      if (!EVIDENCE_SOURCES.includes(evidence.evidence_source)) errors.push('findings.evidence_reference.evidence_source: inválido')
      if (!EVIDENCE_CLASSIFICATIONS.includes(evidence.evidence_classification)) errors.push('findings.evidence_reference.evidence_classification: inválido')
      if (!isBool(evidence.is_production_shell_run)) errors.push('findings.evidence_reference.is_production_shell_run: booleano')
      if (run) {
        for (const field of ['evidence_sha256', 'manifest_sha256', 'auditor_build_sha',
          'contract_build_sha', 'evidence_source', 'evidence_classification', 'is_production_shell_run']) {
          if (!sameValue(evidence[field], run[field])) {
            errors.push(`findings.evidence_reference.${field}: contradice run`)
          }
        }
      }
    }
  }

  const rule = ruleByCode?.get(finding.rule_code)
  if (rule) {
    for (const field of FINDING_DYNAMIC_FIELDS) {
      if (!sameValue(finding[field], rule[field])) {
        errors.push(`findings: ${finding.rule_code}.${field} contradice a su rule_result`)
      }
    }
    if (finding.title !== rule.name) errors.push(`findings: ${finding.rule_code}.title contradice a su rule_result`)
  }
  if (run && finding.source_timestamp !== run.finished_at) {
    errors.push(`findings: ${finding.rule_code}.source_timestamp contradice run.finished_at`)
  }
  if (run && isIso(finding.last_seen_at) && isIso(run.finished_at)
    && Date.parse(finding.last_seen_at) > Date.parse(run.finished_at)) {
    errors.push(`findings: ${finding.rule_code}.last_seen_at posterior a la corrida`)
  }
  return errors.length === initialErrorCount
}

/** Valida el envelope de GET /pwa-kold-os/m4/latest. Devuelve {ok, errors, schema}. */
export function validateM4Latest(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  validateExactKeys(doc, LATEST_FIELDS, 'payload', errors)
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (doc.read_only !== true) errors.push('read_only: debe ser true')

  validateRun(doc.run, errors)

  if (!isBool(doc.stale)) errors.push('stale: booleano')
  if (doc.age_days != null && (!Number.isFinite(doc.age_days) || doc.age_days < 0)) {
    errors.push('age_days: número >= 0 o null')
  }
  validateMetrics(doc, errors)

  validateKpis(doc, errors)
  validateSummary(doc, errors)
  validateRuleResults(doc, errors)
  validateFindings(doc, errors)
  validateCapabilities(doc, errors)
  validateGranularityCoherence(doc, errors)

  validateHistory(doc, errors)
  validateCorrected(doc, errors)
  if (!doc.applied_scope || typeof doc.applied_scope !== 'object' || !doc.applied_scope.level) {
    errors.push('applied_scope.level: requerido')
  } else {
    validateExactKeys(doc.applied_scope, APPLIED_SCOPE_FIELDS, 'applied_scope', errors)
    if (doc.applied_scope.level !== 'global') errors.push('applied_scope.level: debe ser global')
  }

  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)

  // Texto podrido: una cifra del universo pre-A5 en CUALQUIER parte del envelope
  // significa que alguien escribió el número del día a mano y la medición cambió
  // debajo. El número tiene que salir de numerator/denominator/pct.
  const stale = scanPreA5Figures(doc)
  if (stale.length) {
    errors.push(`cifras del universo pre-A5 en el envelope: ${stale.slice(0, 3).join(', ')}`)
  }

  return { ok: errors.length === 0, errors, schema }
}

const cloneAllowed = (value) => {
  if (Array.isArray(value)) return value.map(cloneAllowed)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAllowed(item)]))
}

function canonicalizeRuleResult(rule) {
  const catalog = M4_RULE_CATALOG[rule.rule_code]
  const canonical = pickFields(rule, RULE_RESULT_FIELDS)
  canonical.name = catalog.name
  canonical.not_evaluable_reason = catalog.threshold?.reason ?? null
  for (const field of RULE_STATIC_FIELDS) canonical[field] = catalog[field]
  return canonical
}

function canonicalizeFinding(finding) {
  const catalog = M4_RULE_CATALOG[finding.rule_code]
  const canonical = pickFields(finding, FINDING_FIELDS)
  canonical.title = catalog.name
  canonical.description = catalog.description
  for (const field of FINDING_STATIC_FIELDS) canonical[field] = catalog[field]
  canonical.evidence_reference = pickFields(finding.evidence_reference, EVIDENCE_FIELDS)
  return canonical
}

/** Devuelve únicamente el contrato validado; nunca serializa el envelope crudo. */
export function canonicalizeM4Latest(doc) {
  if (!validateM4Latest(doc).ok) return null
  const run = pickFields(doc.run, RUN_FIELDS)
  run.scope = pickFields(doc.run.scope, RUN_SCOPE_FIELDS)
  const capabilities = {
    ...M4_CANONICAL_CAPABILITIES,
    required_query_ids: [...M4_CANONICAL_CAPABILITIES.required_query_ids],
    optional_query_ids: [...M4_CANONICAL_CAPABILITIES.optional_query_ids],
    granularities: [...M4_CANONICAL_CAPABILITIES.granularities],
    classifications: [...M4_CANONICAL_CAPABILITIES.classifications],
    verdicts: [...M4_CANONICAL_CAPABILITIES.verdicts],
    features: { ...M4_CANONICAL_CAPABILITIES.features },
  }
  const metrics = Object.fromEntries(Object.entries(doc.metrics).map(([name, rows]) => [
    name,
    rows.map((row) => pickFields(row, METRIC_ROW_FIELDS[name])),
  ]))
  const kpis = Object.fromEntries(Object.entries(doc.kpis).map(([name, kpi]) => {
    const metadata = getM4KpiMetadata(name, doc.run.scope)
    const canonical = {
      value: kpi.value,
      universe: metadata.universe,
      source_model: metadata.source_model,
      source_fields: [...metadata.source_fields],
      data_as_of: doc.run.finished_at,
    }
    if (hasOwn(kpi, 'coverage')) canonical.coverage = kpi.coverage
    if (hasOwn(kpi, 'caveat')) canonical.caveat = metadata.caveat
    return [name, canonical]
  }))
  const findings = doc.findings.map(canonicalizeFinding)
  return cloneAllowed({
    ...pickFields(doc, ['ok', 'schema_version', 'stale', 'age_days', 'read_only']),
    capabilities,
    run,
    kpis,
    metrics,
    summary: deriveSummary(doc.rule_results),
    rule_results: doc.rule_results.map(canonicalizeRuleResult),
    findings,
    corrected: doc.corrected.map((item) => ({
      ...pickFields(item, CORRECTED_RAW_FIELDS),
      corrected_at: doc.run.finished_at,
    })),
    history: pickFields(doc.history, HISTORY_FIELDS),
    applied_scope: pickFields(doc.applied_scope, APPLIED_SCOPE_FIELDS),
  })
}

/** Valida el envelope de GET /pwa-kold-os/m4/findings (paginado server-side). */
export function validateM4Findings(doc, {
  ruleResults = null, run = null, allowCatalogOnly = false, requestContext = null,
} = {}) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  validateExactKeys(doc, FINDINGS_PAGE_FIELDS, 'findings_page', errors)
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (typeof doc.run_id !== 'string' || !SHA256_RE.test(doc.run_id)) errors.push('run_id: sha256 requerido')
  if (run?.run_id && doc.run_id !== run.run_id) errors.push('run_id: contradice el latest validado')
  if (requestContext) {
    if (doc.run_id !== requestContext.run_id) errors.push('run_id: no coincide con la solicitud')
    const requestedPageSize = isInt(requestContext.page_size) && requestContext.page_size > 0
      ? requestContext.page_size
      : 25
    const expectedPageSize = Math.min(requestedPageSize, 100)
    const requestedPage = isInt(requestContext.page) ? requestContext.page : 1
    const expectedPage = isInt(doc.pages)
      ? Math.min(Math.max(requestedPage, 1), doc.pages)
      : Math.max(requestedPage, 1)
    if (doc.page !== expectedPage) errors.push('page: no coincide con la normalización del backend')
    if (doc.page_size !== expectedPageSize) {
      errors.push('page_size: no coincide con la normalización del backend')
    }
  }
  if (!isInt(doc.total) || doc.total < 0) errors.push('total: entero >= 0')
  for (const key of ['page', 'pages', 'page_size']) {
    if (!isInt(doc[key]) || doc[key] < 1) errors.push(`${key}: entero >= 1`)
  }
  if (isInt(doc.page_size) && doc.page_size > 100) errors.push('page_size: máximo 100')
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  else {
    let ruleByCode = null
    if (doc.items.length) {
      if ((!Array.isArray(ruleResults) || !ruleResults.length || !run) && !allowCatalogOnly) {
        errors.push('items: catálogo runtime de /latest y run requeridos')
      } else if (Array.isArray(ruleResults) && ruleResults.length) {
        validateRun(run, errors)
        validateRuleResults({ rule_results: ruleResults }, errors)
        ruleByCode = new Map(ruleResults.map((rule) => [rule.rule_code, rule]))
      }
    }
    for (const finding of doc.items) {
      if (!validateFinding(finding, errors, ruleByCode, run)) break
    }
    const ids = doc.items.map((item) => item?.finding_id)
    if (new Set(ids).size !== ids.length) errors.push('items: finding_id duplicado')
    if (isInt(doc.page_size) && doc.items.length > doc.page_size) {
      errors.push('items: excede page_size')
    }
    if (isInt(doc.total) && doc.total >= 0 && isInt(doc.page_size) && doc.page_size > 0
      && isInt(doc.page) && isInt(doc.pages)) {
      const expectedPages = Math.max(1, Math.ceil(doc.total / doc.page_size))
      if (doc.pages !== expectedPages) errors.push('pages: no coincide con ceil(total/page_size)')
      if (doc.page < 1 || doc.page > expectedPages) errors.push('page: fuera del rango de pages')
      const remaining = Math.max(doc.total - ((doc.page - 1) * doc.page_size), 0)
      const expectedItems = doc.total === 0 ? 0 : Math.min(doc.page_size, remaining)
      if (doc.items.length !== expectedItems) errors.push('items: rango inconsistente con total/page/page_size')
    }
  }
  if (doc.read_only !== true) errors.push('read_only: debe ser true')
  if (!validateExactKeys(doc.applied_scope, APPLIED_SCOPE_FIELDS, 'applied_scope', errors)
    || doc.applied_scope?.level !== 'global') {
    errors.push('applied_scope.level: debe ser global')
  }
  if (!doc.applied_filters || typeof doc.applied_filters !== 'object' || Array.isArray(doc.applied_filters)) {
    errors.push('applied_filters: objeto requerido')
  } else if (requestContext) {
    const expectedFilters = Object.fromEntries(Object.entries(requestContext)
      .filter(([key]) => key !== 'page' && key !== 'page_size'))
    validateExactKeys(
      doc.applied_filters, Object.keys(expectedFilters), 'applied_filters', errors,
    )
    for (const [key, expected] of Object.entries(expectedFilters)) {
      if (doc.applied_filters[key] !== expected) {
        errors.push(`applied_filters.${key}: no coincide con la solicitud`)
      }
    }
  } else {
    validateExactKeys(doc.applied_filters, [], 'applied_filters', errors)
  }
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  else if (doc.rejected_params.length) {
    errors.push('rejected_params: el cliente normalizado no puede tener rechazos')
  }
  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors, schema }
}

export function canonicalizeM4Findings(doc, options = {}) {
  if (!validateM4Findings(doc, options).ok) return null
  const requestContext = options.requestContext || null
  const appliedFilters = requestContext
    ? Object.fromEntries(Object.entries(requestContext)
      .filter(([key]) => key !== 'page' && key !== 'page_size'))
    : {}
  return cloneAllowed({
    ...pickFields(doc, [
      'ok', 'schema_version', 'run_id', 'total', 'page', 'pages', 'page_size', 'read_only',
    ]),
    items: doc.items.map(canonicalizeFinding),
    applied_scope: { level: 'global' },
    applied_filters: appliedFilters,
    rejected_params: [],
  })
}

function validateRunMeta(run, index, errors) {
  const label = `runs[${index}]`
  if (!validateExactKeys(run, RUN_META_FIELDS, label, errors)) return
  if (typeof run.run_id !== 'string' || !SHA256_RE.test(run.run_id)) errors.push(`${label}.run_id: sha256`)
  if (!['PASS', 'FAIL'].includes(run.status)) errors.push(`${label}.status: PASS|FAIL`)
  if (!M4_RUN_ENVIRONMENTS.includes(run.environment)) errors.push(`${label}.environment: enum inválido`)
  if (!isIso(run.finished_at)) errors.push(`${label}.finished_at: ISO requerido`)
  if (!isIso(run.ingested_at)) errors.push(`${label}.ingested_at: ISO requerido`)
  if (isIso(run.finished_at) && isIso(run.ingested_at)
    && Date.parse(run.finished_at) > Date.parse(run.ingested_at)) {
    errors.push(`${label}: finished_at posterior a ingested_at`)
  }
  for (const field of ['manifest_sha256', 'evidence_sha256']) {
    if (typeof run[field] !== 'string' || !SHA256_RE.test(run[field])) errors.push(`${label}.${field}: sha256`)
  }
  if (typeof run.auditor_build_sha !== 'string' || !SHA_RE.test(run.auditor_build_sha)) {
    errors.push(`${label}.auditor_build_sha: SHA requerido`)
  }
  if (run.contract_build_sha != null
    && (typeof run.contract_build_sha !== 'string' || !SHA_RE.test(run.contract_build_sha))) {
    errors.push(`${label}.contract_build_sha: SHA o null`)
  }
  if (!isBool(run.is_production_shell_run)) errors.push(`${label}.is_production_shell_run: booleano`)
  if (!Array.isArray(run.production_shell_run_blocked_by)
    || new Set(run.production_shell_run_blocked_by).size !== run.production_shell_run_blocked_by.length
    || run.production_shell_run_blocked_by.some((item) => !SHELL_BLOCKERS.includes(item))) {
    errors.push(`${label}.production_shell_run_blocked_by: lista canónica sin duplicados`)
  }
  if (!EVIDENCE_SOURCES.includes(run.evidence_source)) errors.push(`${label}.evidence_source: inválido`)
  if (!EVIDENCE_CLASSIFICATIONS.includes(run.evidence_classification)) {
    errors.push(`${label}.evidence_classification: inválido`)
  }
  if (run.is_production_shell_run === true) {
    if (run.environment !== 'production' || run.production_shell_run_blocked_by?.length
      || run.evidence_classification !== 'formal_production_run') {
      errors.push(`${label}: metadata formal incoherente`)
    }
  } else if (run.is_production_shell_run === false
    && (!run.production_shell_run_blocked_by?.length
      || run.evidence_classification === 'formal_production_run')) {
    errors.push(`${label}: metadata no formal incoherente`)
  }
  if (!isInt(run.findings_count) || run.findings_count < 0) {
    errors.push(`${label}.findings_count: entero >= 0`)
  }
}

/** Valida el envelope de GET /pwa-kold-os/m4/runs (historial de corridas). */
export function validateM4Runs(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  validateExactKeys(doc, RUNS_ENVELOPE_FIELDS, 'runs_payload', errors)
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (doc.read_only !== true) errors.push('read_only: debe ser true')
  if (!validateExactKeys(doc.applied_scope, APPLIED_SCOPE_FIELDS, 'applied_scope', errors)
    || doc.applied_scope?.level !== 'global') {
    errors.push('applied_scope.level: debe ser global')
  }
  if (!Array.isArray(doc.runs)) errors.push('runs: arreglo requerido')
  else {
    const ids = new Set()
    for (const [index, run] of doc.runs.entries()) {
      validateRunMeta(run, index, errors)
      if (ids.has(run?.run_id)) errors.push(`runs[${index}].run_id: duplicado`)
      ids.add(run?.run_id)
      if (index > 0 && isIso(doc.runs[index - 1]?.finished_at) && isIso(run?.finished_at)
        && Date.parse(doc.runs[index - 1].finished_at) < Date.parse(run.finished_at)) {
        errors.push('runs: debe venir ordenado por finished_at descendente')
      }
    }
  }
  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors, schema }
}

export function canonicalizeM4Runs(doc) {
  if (!validateM4Runs(doc).ok) return null
  return cloneAllowed({
    ok: true,
    schema_version: M4_API_SCHEMA_VERSION,
    runs: doc.runs.map((run) => pickFields(run, RUN_META_FIELDS)),
    applied_scope: { level: 'global' },
    read_only: true,
  })
}

/** Recompute defensivo de STALE client-side (no confía ciegamente en el server). */
export function isRunStale(run, nowIso) {
  const finished = Date.parse(run?.finished_at ?? '')
  const now = Date.parse(nowIso ?? '')
  if (!Number.isFinite(finished) || !Number.isFinite(now)) return false
  return (now - finished) / 86400000 > M4_STALE_DAYS
}
