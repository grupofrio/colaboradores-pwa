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

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/

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
const CLASSIFICATION_SET = new Set(M3_CLASSIFICATIONS)
const VERDICT_SET = new Set(M3_VERDICTS)
const LIFECYCLES = new Set(['new', 'persistent', 'recurrent', 'corrected'])
const GRANULARITIES = new Set(['aggregate', 'branch', 'route', 'stop', 'record'])

const isBool = (v) => typeof v === 'boolean'
const isInt = (v) => typeof v === 'number' && Number.isInteger(v)
const isIso = (v) => typeof v === 'string' && v.length >= 10 && !Number.isNaN(Date.parse(v))

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

  const run = doc.run
  if (!run || typeof run !== 'object') {
    errors.push('run: objeto requerido')
  } else {
    if (typeof run.run_id !== 'string' || !run.run_id) errors.push('run.run_id: requerido')
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
    if (!isIso(run.started_at) || !isIso(run.finished_at)) errors.push('run.started_at/finished_at: ISO')
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
    }
  }

  if (!isBool(doc.stale)) errors.push('stale: booleano')
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
      if (!result || typeof result !== 'object' || !result.rule_code || !STATUSES.has(result.status)) {
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
    for (const finding of doc.findings) {
      if (!finding || typeof finding !== 'object') { errors.push('findings: entrada inválida'); break }
      if (!finding.finding_id || !finding.rule_code) { errors.push('findings: finding_id/rule_code requeridos'); break }
      if (!['RED', 'AMBER'].includes(finding.status)) { errors.push('findings: status RED|AMBER'); break }
      if (!GRANULARITIES.has(finding.granularity)) { errors.push('findings: granularity inválida'); break }
      if (finding.lifecycle_status && !LIFECYCLES.has(finding.lifecycle_status)) {
        errors.push('findings: lifecycle_status inválido'); break
      }
      // Honestidad de granularidad (ambas direcciones):
      if (finding.granularity === 'aggregate'
        && (finding.entity_id != null || finding.branch_id != null || finding.route_id != null)) {
        errors.push('findings: aggregate no puede traer branch/route/entity ids'); break
      }
      if (finding.granularity === 'branch' && (finding.branch_id == null || !isInt(finding.branch_id))) {
        errors.push('findings: branch exige branch_id entero'); break
      }

      // ── Contrato epistémico (Codex ronda 2 §4) ──────────────────────────
      // Un hallazgo con `status: RED` y sin veredicto se lee como
      // incumplimiento aunque su regla sea exploratoria: /findings NO puede
      // degradar lo que /latest garantiza. Mismas invariantes que rule_results.
      if (!CLASSIFICATION_SET.has(finding.classification)) {
        errors.push('findings: classification requerida y válida'); break
      }
      if (!VERDICT_SET.has(finding.verdict)) {
        errors.push('findings: verdict requerido y válido'); break
      }
      if (typeof finding.universe !== 'string' || !finding.universe.trim()) {
        errors.push('findings: universe requerido'); break
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
      if (finding.verdict === 'no_evaluable' && finding.incidences > 0) {
        errors.push('findings: no_evaluable no puede traer incidencias'); break
      }
    }

    // El hallazgo NO puede contradecir a su regla: mismo rule_code ⇒ mismo
    // veredicto y misma clasificación en ambos endpoints.
    const ruleByCode = new Map((doc.rule_results || []).map((r) => [r.rule_code, r]))
    for (const finding of doc.findings) {
      const rule = ruleByCode.get(finding?.rule_code)
      if (!rule) continue
      if (finding.verdict !== rule.verdict || finding.classification !== rule.classification) {
        errors.push(`findings: ${finding.rule_code} contradice a su rule_result`); break
      }
    }
  }

  if (!Array.isArray(doc.corrected)) errors.push('corrected: arreglo requerido')

  const history = doc.history
  if (!history || typeof history !== 'object' || !isInt(history.runs_count) || history.runs_count < 0) {
    errors.push('history.runs_count: entero >= 0 requerido')
  }

  const capabilities = doc.capabilities
  if (!capabilities || typeof capabilities !== 'object'
    || !Array.isArray(capabilities.required_query_ids)
    || !Array.isArray(capabilities.optional_query_ids)
    || !Array.isArray(capabilities.granularities)) {
    errors.push('capabilities: required/optional_query_ids + granularities requeridos')
  }

  if (!doc.applied_scope || typeof doc.applied_scope !== 'object' || !doc.applied_scope.level) {
    errors.push('applied_scope: requerido')
  }

  scanForbiddenKeys(doc, 'envelope', errors)
  return { ok: errors.length === 0, errors, schema }
}

/** Valida la respuesta de /findings. */
export function validateM3Findings(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['findings: no es un objeto'], schema: 'missing' }
  }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    return { ok: false, errors: [`schema_version: ${doc.schema_version || 'ausente'} no soportada`], schema }
  }
  if (doc.ok !== true) errors.push('ok: debe ser true')
  for (const key of ['total', 'page', 'pages', 'page_size']) {
    if (!isInt(doc[key]) || doc[key] < 0) errors.push(`${key}: entero >= 0`)
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  scanForbiddenKeys(doc, 'findings', errors)
  return { ok: errors.length === 0, errors, schema }
}

/** Recalcula STALE client-side como defensa (el backend ya lo marca). */
export function isRunStale(run, nowIso) {
  const finished = Date.parse(run?.finished_at || '')
  const now = Date.parse(nowIso || '')
  if (!Number.isFinite(finished) || !Number.isFinite(now)) return false
  return (now - finished) / 86400000 > M3_STALE_DAYS
}
