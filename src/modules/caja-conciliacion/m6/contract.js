// ─── KOLD OS · M6 — Contrato del envelope (validación defensiva) ─────────────
// El frontend NO confía en el payload: valida el contrato ANTES de renderizar.
// Un campo fantasma (una clave que el backend no emite) renderiza "—" en
// silencio y se lee como "todo bien" — ése fue el bug 8 de M4/M5.

export const M6_API_SCHEMA_VERSION = 'kold.os.m6.api/1'
export const M6_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M6_API_SCHEMA_VERSION])

// Los CUATRO EJES: vocabularios INDEPENDIENTES. Ninguno se deriva de otro.
export const M6_CLASSIFICATIONS = Object.freeze(
  ['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M6_VERDICTS = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M6_SEVERITIES = Object.freeze(
  ['critical', 'high', 'medium', 'low', 'informational'])
export const M6_LIFECYCLE_STATES = Object.freeze(
  ['new', 'persistent', 'corrected', 'recurrent'])

// v1 es AGREGADO: el backend declara granularities == ['aggregate'].
export const M6_GRANULARITIES = Object.freeze(['aggregate'])

// Universos canónicos del backend (core.UNIVERSES). El frontend NO decide qué
// universo le toca a cada regla: RENDERIZA el que el backend declara y valida
// que sea uno conocido. Un universe_id desconocido = contrato que derivó.
export const M6_UNIVERSE_IDS = Object.freeze([
  'posted_customer_invoices_in_scope',
  'open_receivables_in_scope',
  'posted_inbound_payments_in_window',
  'route_cash_boxes_in_window',
  'cash_closings_in_window',
  'branch_daily_closes_in_window',
  'ar_customer_snapshots_in_scope',
  'open_receivable_move_lines_in_window',
  'bank_statement_lines_in_window',
  'cross_module_handoff_boundary',
])

// KPIs de dominios AJENOS. Si reaparecen, el envelope arrastra otro módulo.
export const M6_FORBIDDEN_FOREIGN_KEYS = Object.freeze([
  // M3 (ejecución de rutas)
  'visit_compliance', 'plans_started_overdue_open', 'closure_compliance',
  // M4 (comercial)
  'confirmed_orders', 'recurrent_customers', 'customers_with_confirmed_orders',
  'active_leads_in_scope', 'customer_segment',
  // M5 (físico)
  'final_reported_units_loaded', 'physical_reconciliation', 'uom_category_count',
])

// Claves que JAMÁS pueden viajar: PII del dominio más sensible de la empresa.
export const M6_PII_KEYS = Object.freeze([
  'partner_name', 'customer_name', 'employee_name', 'display_name', 'full_name',
  'rfc', 'vat', 'clabe', 'iban', 'account_number', 'card_number', 'phone',
  'mobile', 'email', 'address', 'note', 'memo', 'reference_text',
])

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const CLASSIFICATION_SET = new Set(M6_CLASSIFICATIONS)
const VERDICT_SET = new Set(M6_VERDICTS)
const SEVERITY_SET = new Set(M6_SEVERITIES)
const LIFECYCLE_SET = new Set(M6_LIFECYCLE_STATES)
const UNIVERSE_SET = new Set(M6_UNIVERSE_IDS)

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) }

/** Escanea PII en cualquier nivel del payload (defensa en profundidad). */
export function scanPii(value, path = 'root', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanPii(v, `${path}[${i}]`, out))
  } else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (M6_PII_KEYS.includes(String(k).toLowerCase())) out.push(`${path}.${k}`)
      scanPii(v, `${path}.${k}`, out)
    }
  }
  return out
}

/** Valida el envelope de /latest. Devuelve {ok, errors, schema}. */
export function validateM6Latest(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M6_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (doc.read_only !== true) errors.push('read_only: debe ser true (M6 es observatorio)')

  const run = doc.run
  if (!isObj(run)) {
    errors.push('run: objeto requerido')
  } else {
    if (!SHA256_RE.test(String(run.scope_key || ''))) errors.push('run.scope_key: sha256 requerido')
    if (run.auditor_build_sha && !SHA_RE.test(String(run.auditor_build_sha))) {
      errors.push('run.auditor_build_sha: hex 7..64')
    }
    if (typeof run.is_production_shell_run !== 'boolean') {
      errors.push('run.is_production_shell_run: booleano requerido (la formalidad se DERIVA del dato)')
    }
    if (!isObj(run.scope)) errors.push('run.scope: objeto requerido')
    else if (!Array.isArray(run.scope.company_ids) || !run.scope.company_ids.length) {
      errors.push('run.scope.company_ids: requerido')
    }
  }

  const s = doc.summary
  if (!isObj(s)) {
    errors.push('summary: objeto requerido')
  } else {
    // El total DEBE ser la suma exacta recomputada de rule_results.
    const rr = Array.isArray(doc.rule_results) ? doc.rule_results : []
    const derived = rr
      .filter((r) => ['incumplimiento', 'riesgo', 'anomalia'].includes(r?.verdict)
        && Number.isInteger(r?.incidences))
      .reduce((acc, r) => acc + r.incidences, 0)
    if (s.total_incidences !== derived) {
      errors.push(`summary.total_incidences ${s.total_incidences} != suma derivada ${derived}`)
    }
    if (s.unique_records_available !== false) {
      errors.push('summary.unique_records_available: debe ser false (incidencias != únicos)')
    }
    // Los DOS ejes de conteo deben publicarse por separado.
    if (!isObj(s.classification_rule_counts)) errors.push('summary.classification_rule_counts: requerido')
    if (!isObj(s.severity_rule_counts)) errors.push('summary.severity_rule_counts: requerido')
    if ('exploratory_signal_rule_count' in s) {
      errors.push('summary: nombre de clasificación sobre un conteo de veredictos (ejes colapsados)')
    }
  }

  if (!isObj(doc.capabilities) || !isObj(doc.capabilities.features)) {
    errors.push('capabilities.features: requerido')
  }

  for (const r of (Array.isArray(doc.rule_results) ? doc.rule_results : [])) {
    if (!CLASSIFICATION_SET.has(r?.classification)) errors.push(`${r?.rule_code}: classification inválida`)
    if (!VERDICT_SET.has(r?.verdict)) errors.push(`${r?.rule_code}: verdict inválido`)
    if (!SEVERITY_SET.has(r?.severity)) errors.push(`${r?.rule_code}: severity inválida`)
    if (!LIFECYCLE_SET.has(r?.lifecycle_status)) errors.push(`${r?.rule_code}: lifecycle_status inválido`)
    if (!UNIVERSE_SET.has(r?.universe_id)) errors.push(`${r?.rule_code}: universe_id fuera del catálogo`)
    // Invariante epistémico: incumplimiento exige umbral APROBADO.
    if (r?.verdict === 'incumplimiento' && !r?.approved_threshold) {
      errors.push(`${r?.rule_code}: incumplimiento sin umbral aprobado`)
    }
    // Una exploratoria jamás afirma un incumplimiento.
    if (r?.classification === 'exploratory' && r?.verdict === 'incumplimiento') {
      errors.push(`${r?.rule_code}: exploratoria no puede ser incumplimiento`)
    }
    if (['cumple', 'no_evaluable'].includes(r?.verdict)
        && Number.isInteger(r?.incidences) && r.incidences > 0) {
      errors.push(`${r?.rule_code}: ${r.verdict} no aporta incidencias`)
    }
  }

  const pii = scanPii(doc)
  if (pii.length) errors.push(`PII en el payload: ${pii.slice(0, 3).join(', ')}`)

  const blob = JSON.stringify(doc)
  for (const k of M6_FORBIDDEN_FOREIGN_KEYS) {
    if (blob.includes(`"${k}"`)) errors.push(`clave de otro módulo en el envelope: ${k}`)
  }

  return { ok: errors.length === 0, errors }
}

/** Valida la página de /findings. */
export function validateM6Findings(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M6_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  for (const k of ['total', 'page', 'pages', 'page_size']) {
    if (!Number.isInteger(doc[k])) errors.push(`${k}: entero requerido`)
  }
  // rejected_params DEBE viajar: un filtro rechazado en silencio es una mentira.
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  if (doc.items?.length > doc.page_size) errors.push('items excede page_size (paginación rota)')
  const pii = scanPii(doc)
  if (pii.length) errors.push(`PII en findings: ${pii.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors }
}

/** Valida el historial de /runs. */
export function validateM6Runs(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M6_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (!Array.isArray(doc.runs)) errors.push('runs: arreglo requerido')
  if (!SHA256_RE.test(String(doc.scope_key || ''))) errors.push('scope_key: sha256 requerido')
  // El historial jamás mezcla scopes.
  for (const r of (doc.runs || [])) {
    if (r?.scope_key && r.scope_key !== doc.scope_key) {
      errors.push('runs: el historial mezcla scope_key distintos')
      break
    }
  }
  return { ok: errors.length === 0, errors }
}
