// ─── KOLD OS · M2 — Contrato del run del auditor (kold.tower.m2.run/1) ───────
// Valida ESTRICTAMENTE el JSON que emite el auditor read-only
// `gf_route_compliance/tools/kold_tower_m2_audit_core.py` (JSON_SUMMARY de
// render_report). Fuente canónica del esquema: build fb03840919cf... en
// GrupoVeniu/GrupoFrio. La UI NUNCA consume un run que no valide (fail-closed).
//
// Separación de estados (Fase 9):
//   · ESTADO TÉCNICO del auditor  → PASS / FAIL / STALE / UNAVAILABLE
//   · ESTADO OPERATIVO de datos   → GREEN / AMBER / RED / NOT_EVALUABLE
//     (lo calcula deriveFindings.js; un RED de datos NO es fallo técnico)

export const M2_SCHEMA_VERSION = 'kold.tower.m2.run/1'

// Manifiesto cerrado del auditor: 13 query_ids exactos (orden alfabético).
export const M2_QUERY_IDS = Object.freeze([
  'branch_resolution_metrics',
  'capacity_metrics',
  'forecast_metrics',
  'handoff_metrics',
  'history_metrics',
  'module_status',
  'optimizer_configuration',
  'schema_catalog',
  'scope_validation',
  'snapshot_metrics',
  'solver_evidence_metrics',
  'territory_load_handoff_metrics',
  'weekly_plan_metrics',
])

export const M2_PRODUCTION_DATABASE = 'grupofrio-grupofrio-31972140'
export const M2_PRODUCTION_COMPANY_IDS = Object.freeze([1, 34, 35, 36])
// Antigüedad máxima de un run para considerarlo vigente (días).
export const M2_STALE_DAYS = 7

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const ENVIRONMENTS = Object.freeze(['dev', 'staging', 'production'])
// Espejo del sanitizador del auditor: ningún campo sensible puede aparecer.
export const M2_FORBIDDEN_KEY_RE = /(?:password|passwd|api[_-]?key|token|secret|email|phone|mobile|display_name|partner_name|employee_name|customer_name|raw_value)/i

const isInt = (v) => typeof v === 'number' && Number.isInteger(v)
const isPosInt = (v) => isInt(v) && v > 0
const isBool = (v) => typeof v === 'boolean'
const isIsoDate = (v) => typeof v === 'string' && v.length >= 10 && !Number.isNaN(Date.parse(v))

function isScalar(v) {
  return v === null || isBool(v) || typeof v === 'number' || typeof v === 'string'
}

/** Valida el documento del run. Devuelve { ok, errors, report } (fail-closed). */
export function validateM2Report(doc) {
  const errors = []
  const fail = (msg) => { errors.push(msg) }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['run: no es un objeto'], report: null }
  }

  if (doc.status !== 'PASS' && doc.status !== 'FAIL') fail('status: debe ser PASS|FAIL')
  for (const key of ['transaction_read_only', 'write_blocked', 'rollback_confirmed']) {
    if (!isBool(doc[key])) fail(`${key}: debe ser booleano`)
  }
  if (!ENVIRONMENTS.includes(doc.environment)) fail('environment: inválido')
  for (const key of ['manifest_sha256', 'evidence_sha256', 'run_id_sha256']) {
    if (typeof doc[key] !== 'string' || !SHA256_RE.test(doc[key])) fail(`${key}: debe ser sha256 hex`)
  }
  if (typeof doc.build_sha !== 'string' || !SHA_RE.test(doc.build_sha)) fail('build_sha: hex 7..64')
  if (!isIsoDate(doc.started_at)) fail('started_at: fecha ISO inválida')
  if (!isIsoDate(doc.finished_at)) fail('finished_at: fecha ISO inválida')
  if (!isInt(doc.duration_ms) || doc.duration_ms < 0) fail('duration_ms: entero >= 0')

  const scope = doc.scope
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    fail('scope: debe ser objeto')
  } else {
    if (!isBool(scope.aggregate_all_companies)) fail('scope.aggregate_all_companies: booleano')
    if (!Array.isArray(scope.company_ids) || !scope.company_ids.every(isPosInt)) {
      fail('scope.company_ids: enteros positivos')
    }
    if (!Array.isArray(scope.branch_ids) || !scope.branch_ids.every(isPosInt)) {
      fail('scope.branch_ids: enteros positivos')
    }
    if (!isInt(scope.window_days) || scope.window_days < 1 || scope.window_days > 366) {
      fail('scope.window_days: 1..366')
    }
  }

  if (!Array.isArray(doc.executed_queries)) {
    fail('executed_queries: arreglo requerido')
  } else {
    const seen = new Set()
    for (const id of doc.executed_queries) {
      if (!M2_QUERY_IDS.includes(id)) fail(`executed_queries: query desconocida ${id}`)
      if (seen.has(id)) fail(`executed_queries: duplicada ${id}`)
      seen.add(id)
    }
  }
  if (!Array.isArray(doc.skipped_queries)) {
    fail('skipped_queries: arreglo requerido')
  } else {
    for (const item of doc.skipped_queries) {
      if (!item || typeof item !== 'object' || !M2_QUERY_IDS.includes(item.query_id) || typeof item.reason !== 'string') {
        fail('skipped_queries: entrada inválida')
      }
    }
  }
  if (Array.isArray(doc.executed_queries) && Array.isArray(doc.skipped_queries)) {
    const covered = new Set([
      ...doc.executed_queries,
      ...doc.skipped_queries.map((s) => s && s.query_id),
    ])
    for (const id of M2_QUERY_IDS) {
      if (!covered.has(id)) fail(`manifiesto: query ${id} ni ejecutada ni omitida`)
    }
  }

  const metrics = doc.metrics
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    fail('metrics: debe ser objeto')
  } else {
    for (const [queryId, rows] of Object.entries(metrics)) {
      if (!M2_QUERY_IDS.includes(queryId)) { fail(`metrics: query desconocida ${queryId}`); continue }
      if (!Array.isArray(rows)) { fail(`metrics.${queryId}: debe ser arreglo de filas`); continue }
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          fail(`metrics.${queryId}: fila inválida`); continue
        }
        for (const [key, value] of Object.entries(row)) {
          if (M2_FORBIDDEN_KEY_RE.test(key)) fail(`metrics.${queryId}.${key}: campo sensible prohibido`)
          if (!isScalar(value)) fail(`metrics.${queryId}.${key}: valor no escalar`)
        }
      }
    }
  }

  if (!Array.isArray(doc.findings)) fail('findings (auditor): arreglo requerido')

  if (doc.environment === 'production') {
    const pc = doc.production_contract
    if (!pc || pc.contract_satisfied !== true || pc.database_match !== true || pc.scope_exact !== true) {
      fail('production_contract: debe declarar 3/3 true en producción')
    }
    if (scope && Array.isArray(scope.company_ids)) {
      const expected = M2_PRODUCTION_COMPANY_IDS.join(',')
      if (scope.company_ids.join(',') !== expected) fail('scope producción: company_ids debe ser 1,34,35,36')
      if (scope.branch_ids.length !== 0) fail('scope producción: branch_ids debe ser vacío')
      if (scope.window_days > 90) fail('scope producción: window_days <= 90')
    }
  }

  return { ok: errors.length === 0, errors, report: errors.length === 0 ? doc : null }
}

/** Estado TÉCNICO del auditor (no confundir con el estado operativo de datos). */
export function technicalStateFor(report, nowIso) {
  if (!report) return 'UNAVAILABLE'
  const { ok } = validateM2Report(report)
  if (!ok) return 'UNAVAILABLE'
  const guardsPass = report.status === 'PASS'
    && report.transaction_read_only === true
    && report.write_blocked === true
    && report.rollback_confirmed === true
  if (!guardsPass) return 'FAIL'
  const now = Date.parse(nowIso || '')
  const finished = Date.parse(report.finished_at)
  if (Number.isFinite(now) && Number.isFinite(finished)) {
    const ageDays = (now - finished) / 86400000
    if (ageDays > M2_STALE_DAYS) return 'STALE'
  }
  return 'PASS'
}

/** Filas de una query (o null si la query no viene en metrics). */
export function metricRows(report, queryId) {
  const rows = report?.metrics?.[queryId]
  return Array.isArray(rows) ? rows : null
}
