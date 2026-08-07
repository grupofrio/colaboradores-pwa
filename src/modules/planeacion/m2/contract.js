// ─── KOLD OS · M2 — Contrato del envelope de la API (kold.os.m2.api/1) ───────
// Valida la respuesta de GET /pwa-kold-os/m2/latest (backend gf_kold_os_m2,
// GrupoVeniu/GrupoFrio PR #201). Fail-closed: la UI jamás renderiza un
// envelope que no valide.
//
// Versionado (B8): la versión se lee de `schema_version` EXPLÍCITO — nunca se
// infiere por estructura. Versión futura no soportada ⇒ error CONTROLADO
// ('unsupported_schema'), campos adicionales compatibles se ignoran, y las
// queries nuevas del auditor llegan como opcionales vía `capabilities`
// (required_query_ids / optional_query_ids) sin romper el run.
//
// Scope (B9): NO se fija database/compañías/ventana — la seguridad valida que
// el scope entregado esté dentro del autorizado (applied_scope del backend),
// no que sea exactamente [1,34,35,36].

export const M2_API_SCHEMA_VERSION = 'kold.os.m2.api/1'
export const M2_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M2_API_SCHEMA_VERSION])
// Antigüedad máxima de un run vigente (días) — espejo del backend.
export const M2_STALE_DAYS = 7

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
export const M2_FORBIDDEN_KEY_RE = /(?:password|passwd|api[_-]?key|token|secret|email|phone|mobile|display_name|partner_name|employee_name|customer_name|raw_value)/i

const STATUSES = new Set(['GREEN', 'AMBER', 'RED', 'NOT_EVALUABLE'])
const LIFECYCLES = new Set(['new', 'persistent', 'recurrent', 'corrected'])
const GRANULARITIES = new Set(['aggregate', 'branch', 'record'])

const isBool = (v) => typeof v === 'boolean'
const isInt = (v) => typeof v === 'number' && Number.isInteger(v)
const isIso = (v) => typeof v === 'string' && v.length >= 10 && !Number.isNaN(Date.parse(v))

/** Clasifica la versión: 'supported' | 'unsupported' | 'missing'. */
export function classifySchemaVersion(doc) {
  const version = doc?.schema_version
  if (typeof version !== 'string' || !version) return 'missing'
  return M2_SUPPORTED_SCHEMA_VERSIONS.includes(version) ? 'supported' : 'unsupported'
}

function scanForbiddenKeys(value, path, errors, depth = 0) {
  if (depth > 10 || !value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) scanForbiddenKeys(item, path, errors, depth + 1)
    return
  }
  for (const [key, val] of Object.entries(value)) {
    if (M2_FORBIDDEN_KEY_RE.test(key)) errors.push(`${path}.${key}: campo sensible prohibido`)
    scanForbiddenKeys(val, `${path}.${key}`, errors, depth + 1)
  }
}

/** Valida el envelope /latest. Devuelve { ok, errors, schema } (fail-closed). */
export function validateM2Latest(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['envelope: no es un objeto'], schema: 'missing' }
  }
  const schema = classifySchemaVersion(doc)
  if (schema !== 'supported') {
    // Error CONTROLADO: la UI lo comunica como incompatibilidad de versión,
    // sin intentar adivinar la estructura.
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
    if (typeof run.build_sha !== 'string' || !SHA_RE.test(run.build_sha)) errors.push('run.build_sha: hex 7..64')
    if (!isIso(run.started_at) || !isIso(run.finished_at)) errors.push('run.started_at/finished_at: ISO')
    const scope = run.scope
    if (!scope || typeof scope !== 'object') {
      errors.push('run.scope: objeto requerido')
    } else {
      // B9: forma, no valores fijos — cualquier conjunto autorizado de
      // compañías es válido; el backend ya aplicó el scope del usuario.
      if (!Array.isArray(scope.company_ids) || !scope.company_ids.every((v) => isInt(v) && v > 0)) {
        errors.push('run.scope.company_ids: enteros positivos')
      }
      if (!isInt(scope.window_days) || scope.window_days < 1 || scope.window_days > 366) {
        errors.push('run.scope.window_days: 1..366')
      }
    }
  }

  if (!isBool(doc.stale)) errors.push('stale: booleano')
  if (doc.age_days !== null && doc.age_days !== undefined && typeof doc.age_days !== 'number') {
    errors.push('age_days: número o null')
  }

  const summary = doc.summary
  if (!summary || typeof summary !== 'object') {
    errors.push('summary: objeto requerido')
  } else {
    if (!STATUSES.has(summary.overall_status)) errors.push('summary.overall_status: inválido')
    for (const key of ['total_rules', 'rules_pass', 'rules_warning', 'rules_fail', 'rules_not_evaluable', 'total_incidences']) {
      if (!isInt(summary[key]) || summary[key] < 0) errors.push(`summary.${key}: entero >= 0`)
    }
    if (summary.unique_records_available !== false) {
      errors.push('summary.unique_records_available: debe ser false en contrato agregado v1')
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
      // Honestidad de granularidad: un hallazgo agregado NO trae IDs.
      if (finding.granularity === 'aggregate'
        && (finding.entity_id != null || finding.company_id != null || finding.branch_id != null)) {
        errors.push('findings: aggregate no puede traer entity/company/branch ids'); break
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
    || !Array.isArray(capabilities.optional_query_ids)) {
    errors.push('capabilities: required/optional_query_ids requeridos')
  }

  if (!doc.applied_scope || typeof doc.applied_scope !== 'object' || !doc.applied_scope.level) {
    errors.push('applied_scope: requerido')
  }

  scanForbiddenKeys(doc, 'envelope', errors)
  return { ok: errors.length === 0, errors, schema }
}

/** Valida la respuesta de /findings. */
export function validateM2Findings(doc) {
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
  return (now - finished) / 86400000 > M2_STALE_DAYS
}
