// ─── KOLD OS · M5 — contrato del envelope `kold.os.m5.api/1` ─────────────────
// Espejo del backend: GrupoVeniu/GrupoFrio PR #205 (el commit `978994c4` que
// auditó Codex, ya corregido). Si el contrato del backend cambia, se ajusta
// AQUÍ (y en koldOsM5Route.js) sin reescribir la pantalla.
//
// FAIL-CLOSED. El frontend IMPONE la honestidad del backend: rechaza un
// envelope que afirme más de lo que declara poder probar, que traiga PII, que
// arrastre residuos de M3, cuyos KPIs no declaren su universo, o cuyos totales
// no cuadren. Molde: m2/contract.js (mergeado) + contrato epistémico y
// metadata de evidencia del backend M5.

export const M5_API_SCHEMA_VERSION = 'kold.os.m5.api/1'
export const M5_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M5_API_SCHEMA_VERSION])
export const M5_STALE_DAYS = 7

// Detector de claves sensibles (PII). Un envelope con CUALQUIERA de estas
// claves se RECHAZA: ocultar una columna no elimina el dato del browser.
export const M5_FORBIDDEN_KEY_RE = /(?:password|passwd|api[_-]?key|token|secret|email|phone|mobile|display_name|partner_name|employee_name|customer_name|salesperson_name|contact_name|street|address|city_name|zip_code|vat_number|rfc|raw_value|free_text|notes)/i

// Residuos de M3 (rutas/visitas/planes) en un envelope M5. Codex encontró que
// `execution_kpis()` seguía calculando métricas de M3 que M5 jamás produce: el
// objeto `kpis` salía entero en null. Si vuelven a aparecer, el envelope se
// RECHAZA — un KPI de rutas dentro de M5 no es un dato, es un bug.
export const M5_FORBIDDEN_FOREIGN_KPI_KEYS = Object.freeze([
  // M3 (ejecución de rutas): si reaparecen, el envelope arrastra otro dominio.
  'visit_compliance', 'plans_started_overdue_open', 'stops_total', 'stops_visited',
  'closure_compliance', 'boxes_open', 'offline_pending',
  // M4 (comercial): la verdad de pedidos/clientes/canales NO viaja en M5.
  'confirmed_orders', 'customers_with_confirmed_orders', 'recurrent_customers',
  'active_leads_in_scope', 'customers_currently_without_channel',
])

// Universos canónicos del backend (`core.UNIVERSES`). El frontend NO decide qué
// universo le toca a cada regla: RENDERIZA el que el backend declara y valida
// que sea uno conocido. Un `universe_id` desconocido = contrato que derivó.
export const M5_UNIVERSE_IDS = Object.freeze([
  'operational_products_in_window',
  'published_route_plans_in_window',
  'loaded_route_plans_in_window',
  'closed_or_reconciled_plans_in_window',
  'route_load_pickings_in_window',
  'outflow_stop_lines_in_window',
  'refill_requests_in_window',
  'route_reconciliations_in_window',
  'executed_stops_in_window',
  'active_fleet_vehicles',
  'consignments_in_scope',
])

// Cifras del universo PRE-A5. A5 probó que `company_id IN scope` (2,333) dejaba
// FUERA a 410 de los 713 que compran, así que el universo canónico pasó a ser la
// raíz comercial con historial (584 activas / 752 con archivadas). Estas cifras
// describen una población que ya NO se mide: si el backend las envía, el
// envelope viene con texto podrido y se RECHAZA.
// M5 nace CON el catálogo de universos (lección 41 de M4): no hay "cifras del
// universo viejo" que vetar todavía. La constante existe para que el mecanismo
// de rechazo quede armado el día que un universo de M5 se corrija.
export const M5_STALE_UNIVERSE_FIGURES = Object.freeze([])

export const M5_CLASSIFICATIONS = Object.freeze(
  ['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M5_VERDICTS = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M5_GRANULARITIES = Object.freeze(
  ['aggregate', 'company', 'branch', 'channel', 'customer_segment', 'customer',
    'order', 'line', 'product'])
const CLASSIFICATION_SET = new Set(M5_CLASSIFICATIONS)
const VERDICT_SET = new Set(M5_VERDICTS)
const GRANULARITY_SET = new Set(M5_GRANULARITIES)
const LIFECYCLE_SET = new Set(['new', 'persistent', 'recurrent', 'corrected'])

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Enums cerrados de evidencia (espejo del backend). Cerrados a
// propósito: texto libre permitiría que una evidencia se auto-describa.
const EVIDENCE_SOURCES = ['odoo_shell_production_run', 'xml_rpc_read_only_measurements']
const EVIDENCE_CLASSIFICATIONS = ['formal_production_run', 'pre_deployment_semantic_validation']
const SHELL_BLOCKERS = ['ssh_key_not_registered', 'module_not_deployed', 'production_shell_unavailable']

const isBool = (v) => typeof v === 'boolean'
const isInt = (v) => Number.isInteger(v)
const isIso = (v) => typeof v === 'string' && ISO_RE.test(v)

export function classifySchemaVersion(doc) {
  const version = doc?.schema_version
  if (typeof version !== 'string' || !version) return 'missing'
  return M5_SUPPORTED_SCHEMA_VERSIONS.includes(version) ? 'supported' : 'unsupported'
}

// Barrido recursivo de claves prohibidas (PII / credenciales).
export function scanForbiddenKeys(value, path = '', found = [], depth = 0) {
  if (depth > 14 || !value || typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) scanForbiddenKeys(item, path, found, depth + 1)
    return found
  }
  for (const [key, val] of Object.entries(value)) {
    if (M5_FORBIDDEN_KEY_RE.test(key)) found.push(`${path}${key}`)
    scanForbiddenKeys(val, `${path}${key}.`, found, depth + 1)
  }
  return found
}

// Barrido recursivo de cifras del universo PRE-A5 en los textos del envelope.
// Solo mira strings: un `584` numérico es un dato legítimo; un "1,620" escrito
// dentro de una frase es una medición copiada a mano que ya no es cierta.
export function scanStaleUniverseFigures(value, path = '', found = [], depth = 0) {
  if (depth > 14 || value == null) return found
  if (typeof value === 'string') {
    for (const figure of M5_STALE_UNIVERSE_FIGURES) {
      if (value.includes(figure)) found.push(`${path}: “…${figure}…”`)
    }
    return found
  }
  if (typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) scanStaleUniverseFigures(item, path, found, depth + 1)
    return found
  }
  for (const [key, val] of Object.entries(value)) {
    scanStaleUniverseFigures(val, path ? `${path}.${key}` : key, found, depth + 1)
  }
  return found
}

function validateRun(run, errors) {
  if (!run || typeof run !== 'object') {
    errors.push('run: objeto requerido')
    return
  }
  if (typeof run.run_id !== 'string' || !run.run_id) errors.push('run.run_id: requerido')
  if (run.status !== 'PASS' && run.status !== 'FAIL') errors.push('run.status: PASS|FAIL')
  if (!['PASS', 'FAIL', 'STALE'].includes(run.technical_state)) {
    errors.push('run.technical_state: PASS|FAIL|STALE')
  }
  for (const key of ['transaction_read_only', 'write_blocked', 'rollback_confirmed']) {
    if (!isBool(run[key])) errors.push(`run.${key}: booleano`)
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

  if (!isIso(run.started_at) || !isIso(run.finished_at)) errors.push('run.started_at/finished_at: ISO')

  // ── Scope: ventana ABSOLUTA. Flexible en compañías (no fija ids) ──────────
  const scope = run.scope
  if (!scope || typeof scope !== 'object') {
    errors.push('run.scope: objeto requerido')
  } else {
    if (!Array.isArray(scope.company_ids) || !scope.company_ids.length
      || !scope.company_ids.every((id) => isInt(id) && id > 0)) {
      errors.push('run.scope.company_ids: enteros > 0')
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
  for (const result of doc.rule_results) {
    if (!result || typeof result !== 'object') { errors.push('rule_results: entrada inválida'); break }
    if (!result.rule_code) { errors.push('rule_results: rule_code requerido'); break }
    if (!CLASSIFICATION_SET.has(result.classification)) {
      errors.push('rule_results: classification requerida y válida'); break
    }
    if (!VERDICT_SET.has(result.verdict)) { errors.push('rule_results: verdict requerido y válido'); break }
    if (typeof result.universe !== 'string' || !result.universe.trim()) {
      errors.push('rule_results: universe requerido'); break
    }
    if (!M5_UNIVERSE_IDS.includes(result.universe_id)) {
      errors.push(`rule_results: universe_id desconocido (${result.universe_id})`); break
    }
    if (typeof result.business_assumption !== 'string' || !result.business_assumption.trim()) {
      errors.push('rule_results: business_assumption requerido'); break
    }
    if (typeof result.evidence_limitations !== 'string' || !result.evidence_limitations.trim()) {
      errors.push('rule_results: evidence_limitations requerido'); break
    }
    if (typeof result.approved_threshold !== 'boolean') {
      errors.push('rule_results: approved_threshold booleano requerido'); break
    }
    if (typeof result.threshold_source !== 'string' || !result.threshold_source.trim()) {
      errors.push('rule_results: threshold_source requerido'); break
    }
    // Invariantes del contrato epistémico
    if (result.classification === 'exploratory' && result.verdict === 'incumplimiento') {
      errors.push('rule_results: exploratory no puede ser incumplimiento'); break
    }
    if (result.verdict === 'incumplimiento' && result.approved_threshold !== true) {
      errors.push('rule_results: incumplimiento exige approved_threshold'); break
    }
    if (result.verdict === 'no_evaluable' && Number(result.incidences) > 0) {
      errors.push('rule_results: no_evaluable no puede traer incidencias'); break
    }
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
  for (const key of M5_FORBIDDEN_FOREIGN_KPI_KEYS) {
    if (key in kpis) errors.push(`kpis.${key}: residuo de M3 — M5 no mide rutas/visitas/planes`)
  }
  for (const [key, kpi] of Object.entries(kpis)) {
    if (kpi === null || kpi === undefined) {
      errors.push(`kpis.${key}: null — un KPI sin fuente NO se emite (se omite la clave)`)
      continue
    }
    if (typeof kpi !== 'object' || Array.isArray(kpi)) {
      errors.push(`kpis.${key}: objeto con contrato requerido (no un número suelto)`)
      continue
    }
    if (!Number.isFinite(Number(kpi.value))) errors.push(`kpis.${key}.value: número finito requerido`)
    if (typeof kpi.universe !== 'string' || !kpi.universe.trim()) {
      errors.push(`kpis.${key}.universe: requerido (un número sin universo no significa nada)`)
    }
    if (typeof kpi.source_model !== 'string' || !kpi.source_model.trim()) {
      errors.push(`kpis.${key}.source_model: requerido`)
    }
    if (!Array.isArray(kpi.source_fields) || !kpi.source_fields.length) {
      errors.push(`kpis.${key}.source_fields: lista no vacía requerida`)
    }
    if (!isIso(kpi.data_as_of)) errors.push(`kpis.${key}.data_as_of: ISO requerido`)
    if (kpi.coverage != null && !Number.isFinite(Number(kpi.coverage))) {
      errors.push(`kpis.${key}.coverage: número o null`)
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
  if (!Array.isArray(caps.required_query_ids)) errors.push('capabilities.required_query_ids: requerido')
  if (!Array.isArray(caps.granularities) || !caps.granularities.length) {
    errors.push('capabilities.granularities: lista no vacía requerida')
  } else if (!caps.granularities.every((g) => GRANULARITY_SET.has(g))) {
    errors.push('capabilities.granularities: valor fuera del enum')
  }
  if (!caps.features || typeof caps.features !== 'object') {
    errors.push('capabilities.features: objeto requerido (qué puede y qué NO puede medir M5)')
    return
  }
  // Fronteras que M5 v1 NO cruza. Declararlas en `true` sería afirmar de más:
  // la verdad de entrega es de M5, la financiera de M6, el margen de M7.
  for (const feature of ['delivered_orders', 'invoiced_orders', 'paid_orders', 'margin']) {
    if (caps.features[feature] === true) {
      errors.push(`capabilities.features.${feature}: M5 v1 no mide esto — es de otro módulo`)
    }
  }
  // Las dimensiones viven en `features` (espejo de core.capabilities()).
  for (const dim of ['aggregate', 'branch_dimension', 'company_dimension', 'entity_detail']) {
    if (!isBool(caps.features[dim])) errors.push(`capabilities.features.${dim}: booleano requerido`)
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

function validateSummary(doc, errors) {
  const summary = doc.summary
  if (!summary || typeof summary !== 'object') {
    errors.push('summary: objeto requerido')
    return
  }
  for (const key of ['definitive_incident_count', 'warning_count', 'exploratory_signal_count',
    'total_incidences', 'total_rules']) {
    if (!isInt(summary[key]) || summary[key] < 0) errors.push(`summary.${key}: entero >= 0`)
  }
  if (summary.unique_records_available !== false) {
    errors.push('summary.unique_records_available: DEBE ser false (incidencias ≠ registros únicos)')
  }
  // TOTAL = suma EXACTA de su desglose, recomputada desde rule_results.
  if (Array.isArray(doc.rule_results)) {
    const sumFor = (verdict) => doc.rule_results
      .filter((r) => r?.verdict === verdict)
      .reduce((acc, r) => acc + (Number.isFinite(Number(r.incidences)) ? Number(r.incidences) : 0), 0)
    const expected = {
      definitive_incident_count: sumFor('incumplimiento'),
      warning_count: sumFor('riesgo'),
      exploratory_signal_count: sumFor('anomalia'),
    }
    for (const [key, value] of Object.entries(expected)) {
      if (isInt(summary[key]) && summary[key] !== value) {
        errors.push(`summary.${key}: ${summary[key]} ≠ suma de rule_results (${value})`)
      }
    }
    const total = expected.definitive_incident_count + expected.warning_count
      + expected.exploratory_signal_count
    if (isInt(summary.total_incidences) && summary.total_incidences !== total) {
      errors.push(`summary.total_incidences: ${summary.total_incidences} ≠ suma exacta (${total})`)
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
    if (!finding || typeof finding !== 'object') { errors.push('findings: entrada inválida'); break }
    if (!finding.finding_id || !finding.rule_code) {
      errors.push('findings: finding_id/rule_code requeridos'); break
    }
    if (!['RED', 'AMBER'].includes(finding.status)) { errors.push('findings: status RED|AMBER'); break }
    if (!GRANULARITY_SET.has(finding.granularity)) { errors.push('findings: granularity inválida'); break }
    if (finding.lifecycle_status && !LIFECYCLE_SET.has(finding.lifecycle_status)) {
      errors.push('findings: lifecycle_status inválido'); break
    }
    // Granularidad honesta (ambas direcciones): un agregado no trae ids; una
    // dimensión declarada exige su id.
    if (finding.granularity === 'aggregate'
      && (finding.entity_id != null || finding.branch_id != null)) {
      errors.push('findings: aggregate no puede traer branch/entity ids'); break
    }
    if (finding.granularity === 'branch' && (finding.branch_id == null || !isInt(finding.branch_id))) {
      errors.push('findings: branch exige branch_id entero'); break
    }
    // Contrato epistémico también en findings (no se degrada vs rule_results)
    if (!CLASSIFICATION_SET.has(finding.classification)) {
      errors.push('findings: classification requerida y válida'); break
    }
    if (!VERDICT_SET.has(finding.verdict)) { errors.push('findings: verdict requerido y válido'); break }
    if (typeof finding.universe !== 'string' || !finding.universe.trim()) {
      errors.push('findings: universe requerido'); break
    }
    if (!M5_UNIVERSE_IDS.includes(finding.universe_id)) {
      errors.push(`findings: universe_id desconocido (${finding.universe_id})`); break
    }
    if (typeof finding.approved_threshold !== 'boolean') {
      errors.push('findings: approved_threshold booleano requerido'); break
    }
    if (finding.classification === 'exploratory' && finding.verdict === 'incumplimiento') {
      errors.push('findings: exploratory no puede ser incumplimiento'); break
    }
    if (finding.verdict === 'incumplimiento' && finding.approved_threshold !== true) {
      errors.push('findings: incumplimiento exige approved_threshold'); break
    }
    if (finding.verdict === 'no_evaluable' && Number(finding.incidences) > 0) {
      errors.push('findings: no_evaluable no puede traer incidencias'); break
    }
    // El hallazgo NO contradice a su regla.
    const rule = ruleByCode.get(finding.rule_code)
    if (rule && (finding.verdict !== rule.verdict || finding.classification !== rule.classification)) {
      errors.push(`findings: ${finding.rule_code} contradice a su rule_result`); break
    }
    // /latest y /findings tienen que contar la MISMA historia del mismo número:
    // si difieren en universo, la pantalla y el drill-down se contradicen.
    if (rule && (finding.universe_id !== rule.universe_id || finding.universe !== rule.universe)) {
      errors.push(`findings: ${finding.rule_code} declara otro universo que su regla`); break
    }
    // El numerador tiene que caber en su denominador. M5-A-04 dividía archivados
    // (168, NO activos) entre activos (584): aritmética válida, población errónea.
    if (Number.isFinite(Number(finding.numerator)) && Number.isFinite(Number(finding.denominator))
      && Number(finding.denominator) > 0 && Number(finding.numerator) > Number(finding.denominator)) {
      errors.push(`findings: ${finding.rule_code} numerador ${finding.numerator} > denominador ${finding.denominator}`); break
    }
  }
}

/** Valida el envelope de GET /pwa-kold-os/m5/latest. Devuelve {ok, errors, schema}. */
export function validateM5Latest(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (doc.read_only !== true) errors.push('read_only: debe ser true')

  validateRun(doc.run, errors)

  if (!isBool(doc.stale)) errors.push('stale: booleano')
  if (doc.age_days != null && (!isInt(doc.age_days) || doc.age_days < 0)) {
    errors.push('age_days: entero >= 0 o null')
  }
  if (!doc.metrics || typeof doc.metrics !== 'object') errors.push('metrics: objeto requerido')

  validateKpis(doc, errors)
  validateSummary(doc, errors)
  validateRuleResults(doc, errors)
  validateFindings(doc, errors)
  validateCapabilities(doc, errors)
  validateGranularityCoherence(doc, errors)

  if (!Array.isArray(doc.corrected)) errors.push('corrected: arreglo requerido')
  const history = doc.history
  if (!history || typeof history !== 'object' || !isInt(history.runs_count) || history.runs_count < 0) {
    errors.push('history.runs_count: entero >= 0 requerido')
  }
  if (!doc.applied_scope || typeof doc.applied_scope !== 'object' || !doc.applied_scope.level) {
    errors.push('applied_scope.level: requerido')
  }

  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)

  // Texto podrido: una cifra del universo pre-A5 en CUALQUIER parte del envelope
  // significa que alguien escribió el número del día a mano y la medición cambió
  // debajo. El número tiene que salir de numerator/denominator/pct.
  const stale = scanStaleUniverseFigures(doc)
  if (stale.length) {
    errors.push(`cifras de universo obsoleto en el envelope: ${stale.slice(0, 3).join(', ')}`)
  }

  return { ok: errors.length === 0, errors, schema }
}

/** Valida el envelope de GET /pwa-kold-os/m5/findings (paginado server-side). */
export function validateM5Findings(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  for (const key of ['total', 'page', 'pages', 'page_size']) {
    if (!isInt(doc[key]) || doc[key] < 0) errors.push(`${key}: entero >= 0`)
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors, schema }
}

/** Valida el envelope de GET /pwa-kold-os/m5/runs (historial de corridas). */
export function validateM5Runs(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['payload: no es un objeto'], schema: 'missing' }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version ?? 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  if (!Array.isArray(doc.runs)) errors.push('runs: arreglo requerido')
  const forbidden = scanForbiddenKeys(doc)
  if (forbidden.length) errors.push(`claves sensibles detectadas: ${forbidden.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors, schema }
}

/** Recompute defensivo de STALE client-side (no confía ciegamente en el server). */
export function isRunStale(run, nowIso) {
  const finished = Date.parse(run?.finished_at ?? '')
  const now = Date.parse(nowIso ?? '')
  if (!Number.isFinite(finished) || !Number.isFinite(now)) return false
  return (now - finished) / 86400000 > M5_STALE_DAYS
}
