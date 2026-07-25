// ─── KOLD OS · M7 — Contrato del envelope (validación defensiva) ─────────────
// El frontend NO confía en el payload: valida el contrato ANTES de renderizar.
// Espeja EXACTAMENTE el backend #211 (content 88c09f49, kold.os.m7.api/1). Un
// campo fantasma renderiza "—" en silencio y se lee como "todo bien" — el bug de
// M4/M5. Aquí resolveM7Metric es la ÚNICA autoridad que interpreta métricas.

export const M7_API_SCHEMA_VERSION = 'kold.os.m7.api/1'
export const M7_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([M7_API_SCHEMA_VERSION])

// Los CUATRO EJES: vocabularios INDEPENDIENTES. Ninguno se deriva de otro.
export const M7_CLASSIFICATIONS = Object.freeze(
  ['definitive', 'caveated', 'exploratory', 'not_evaluable', 'invalid'])
export const M7_VERDICTS = Object.freeze(
  ['incumplimiento', 'riesgo', 'anomalia', 'cumple', 'no_evaluable'])
export const M7_SEVERITIES = Object.freeze(
  ['critical', 'high', 'medium', 'low', 'informational'])
// Espejo de core.LIFECYCLE_STATES: los estados que el backend EMITE. `corrected`
// NO está — ausencia ≠ corrección (ver M7_LIFECYCLE_STATES_UNSUPPORTED).
export const M7_LIFECYCLE_STATES = Object.freeze(['new', 'persistent', 'recurrent'])
export const M7_LIFECYCLE_STATES_UNSUPPORTED = Object.freeze({
  corrected: 'M7 v1 no puede probar una corrección: un hallazgo ausente no trae '
    + 'sus cuatro ejes y la historia no registra qué reglas se evaluaron. '
    + 'Ausencia ≠ corrección.',
})

export const M7_GRANULARITIES = Object.freeze(['aggregate'])

// Niveles de la jerarquía económica (core.PROFITABILITY_LEVELS). v1 = L1.
export const M7_PROFITABILITY_LEVELS = Object.freeze([
  'L0_not_evaluable', 'L1_observable_revenue', 'L2_observable_gross_margin',
  'L3_observable_contribution', 'L4_partial_operating', 'L5_operating_profit',
  'L6_net_profit',
])

// Aristas del CAPABILITY_DAG del backend: capability fuerte -> requisitos.
export const M7_CAPABILITY_DAG = Object.freeze({
  gross_margin_observable: Object.freeze([
    'historical_cogs_observable', 'historical_sales_cost_match_supported',
    'revenue_observable']),
  contribution_margin_observable: Object.freeze([
    'gross_margin_observable', 'variable_costs_observable']),
  operating_profit_observable: Object.freeze([
    'contribution_margin_observable', 'comprehensive_operating_expenses_observable']),
  net_profit_observable: Object.freeze(['operating_profit_observable']),
  currency_normalization_supported: Object.freeze(['historical_fx_available']),
  consolidated_profitability_supported: Object.freeze(['currency_normalization_supported']),
})

// Universos canónicos del backend (core.UNIVERSES).
export const M7_UNIVERSE_IDS = Object.freeze([
  'confirmed_sales_orders_in_scope', 'posted_customer_invoices_in_scope',
  'posted_credit_notes_in_scope', 'posted_invoice_lines_in_scope',
  'discounted_invoice_lines_in_scope', 'active_products_by_company',
  'stock_valuation_layers_in_scope', 'sales_lines_cost_presence_in_scope',
  'terminal_routes_in_scope', 'fleet_cost_records_in_scope',
  'expense_move_lines_in_scope', 'currency_context_in_scope',
  'allocation_policies_in_scope', 'cross_module_handoff_boundary',
])

// KPIs de dominios AJENOS. Si reaparecen, el envelope arrastró otro módulo.
export const M7_FORBIDDEN_FOREIGN_KEYS = Object.freeze([
  'cash_pending', 'reconciliation_signal', 'daily_close_metrics',
  'route_compliance', 'stock_move_metrics', 'product_flow_kpis',
])

// PII: el dominio económico puede contener datos comerciales sensibles.
export const M7_PII_KEYS = Object.freeze([
  'partner_name', 'customer_name', 'employee_name', 'driver_name', 'seller_name',
  'display_name', 'full_name', 'rfc', 'vat', 'clabe', 'iban', 'account_number',
  'card_number', 'phone', 'mobile', 'email', 'street', 'address', 'note', 'memo',
  'comment', 'payment_ref',
])

const SHA256_RE = /^[0-9a-f]{64}$/
const SHA_RE = /^[0-9a-f]{7,64}$/
const CLASSIFICATION_SET = new Set(M7_CLASSIFICATIONS)
const VERDICT_SET = new Set(M7_VERDICTS)
const SEVERITY_SET = new Set(M7_SEVERITIES)
const LIFECYCLE_SET = new Set(M7_LIFECYCLE_STATES)
const UNIVERSE_SET = new Set(M7_UNIVERSE_IDS)

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) }

/** Escanea PII en cualquier nivel del payload (defensa en profundidad). */
export function scanPii(value, path = 'root', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanPii(v, `${path}[${i}]`, out))
  } else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (M7_PII_KEYS.includes(String(k).toLowerCase())) out.push(`${path}.${k}`)
      scanPii(v, `${path}.${k}`, out)
    }
  }
  return out
}

// ─── Resolución de métricas: NUEVE estados, ninguno silencioso ───────────────
// Antes el tile hacía `if (!row || row[field] == null) return null` y varias
// fallas distintas se desvanecían en el mismo silencio. resolveM7Metric es la
// ÚNICA autoridad (misma que valida el envelope). Codex §22: nueve estados
// distinguibles.
export const M7_METRIC_STATES = Object.freeze([
  'ok',                          // hay valor (0 incluido: dato, no vacío)
  'not_evaluable',               // null en campo DECLARADO nullable: "—" + razón
  'contract_error',              // campo requerido ausente / capability inexistente
  'capability_disabled',         // el backend declara la capability = false
  'metric_unavailable',          // la query no vino: cobertura parcial
  'malformed_metric',            // el valor no es del tipo declarado
  'backend_unavailable',         // no hay payload
  'multi_currency_unconsolidated', // se pidió un total consolidado sin normalización
  'lineage_mismatch',            // el linaje del payload no cuadra
])

/**
 * Resuelve UNA métrica del envelope contra su declaración.
 * @param {object|null} payload  envelope de /latest
 * @param {object} spec {query, field, capability?, nullable?, type?,
 *                        requiresConsolidation?, requiresLineageMatch?}
 * @returns {{state, value, reason}}
 */
export function resolveM7Metric(payload, spec) {
  const {
    query, field, capability, nullable = false, type = 'number',
    requiresConsolidation = false, requiresLineageMatch = false,
  } = spec || {}
  if (!query || !field) {
    return { state: 'contract_error', value: null,
      reason: 'tile mal declarado: falta query o field' }
  }
  if (!isObj(payload)) {
    return { state: 'backend_unavailable', value: null, reason: 'sin datos del backend' }
  }
  const feats = payload.capabilities?.features
  if (requiresLineageMatch && lineageState(payload).mismatch) {
    return { state: 'lineage_mismatch', value: null,
      reason: 'el linaje del payload no cuadra con el contrato esperado' }
  }
  if (requiresConsolidation) {
    if (!isObj(feats) || feats.consolidated_profitability_supported !== true) {
      return { state: 'multi_currency_unconsolidated', value: null,
        reason: 'no hay normalización de moneda: un total consolidado sería falso' }
    }
  }
  if (capability) {
    if (!isObj(feats) || !(capability in feats)) {
      return { state: 'contract_error', value: null,
        reason: `la capability \`${capability}\` no existe en el contrato` }
    }
    if (feats[capability] !== true) {
      return { state: 'capability_disabled', value: null,
        reason: `el backend declara \`${capability}\` = false` }
    }
  }
  const metrics = payload.metrics
  if (!isObj(metrics) || !(query in metrics)) {
    return { state: 'metric_unavailable', value: null,
      reason: `la corrida no trae la query \`${query}\` (cobertura parcial)` }
  }
  const rows = metrics[query]
  if (!Array.isArray(rows) || rows.length === 0) {
    return { state: 'metric_unavailable', value: null,
      reason: `la query \`${query}\` no devolvió filas` }
  }
  const row = rows[0]
  if (!isObj(row)) {
    return { state: 'malformed_metric', value: null,
      reason: `la query \`${query}\` no devolvió un objeto` }
  }
  if (!(field in row)) {
    return { state: 'contract_error', value: null,
      reason: `el backend no emite \`${query}.${field}\`: el contrato cambió y `
        + 'esta tarjeta ya no mide lo que dice medir' }
  }
  const value = row[field]
  if (value === null || value === undefined) {
    if (nullable) {
      return { state: 'not_evaluable', value: null,
        reason: `\`${query}.${field}\` vino sin valor (declarado nullable)` }
    }
    return { state: 'contract_error', value: null,
      reason: `\`${query}.${field}\` es requerido y vino null` }
  }
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    return { state: 'malformed_metric', value,
      reason: `\`${query}.${field}\` debía ser un número finito y llegó `
        + `${typeof value}: ${JSON.stringify(value)}` }
  }
  return { state: 'ok', value, reason: '' } // 0 es un VALOR
}

/** Estado del linaje del payload (pre-migración esperado). */
export function lineageState(payload) {
  const run = payload?.run || {}
  const formal = run.is_production_shell_run === true
  return {
    auditor_build_sha: run.auditor_build_sha || null,
    contract_build_sha: run.contract_build_sha || null,
    measurement_method: run.measurement_method || null,
    is_production_shell_run: formal,
    // "mismatch" v1: el fixture es NO formal por diseño. Sólo marca mismatch si
    // el payload afirma formalidad sin las marcas que la sustentan.
    mismatch: formal && !run.evidence_sha256,
    pre_migration: true,
    reseal_required: true,
  }
}

/** Valida el envelope de /latest. Devuelve {ok, errors, schema}. */
export function validateM7Latest(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M7_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (doc.read_only !== true) errors.push('read_only: debe ser true (M7 es observatorio)')

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
    const rr = Array.isArray(doc.rule_results) ? doc.rule_results : []
    const derived = rr
      .filter((r) => ['incumplimiento', 'riesgo', 'anomalia'].includes(r?.verdict)
        && Number.isInteger(r?.incidences))
      .reduce((acc, r) => acc + r.incidences, 0)
    if (s.total_incidences !== derived) {
      errors.push(`summary.total_incidences ${s.total_incidences} != suma derivada ${derived}`)
    }
    // La nota anti-doble-lectura DEBE viajar y mencionar "pesos" (Codex).
    const note = String(s.total_incidences_note || '')
    if (!/registros únicos/.test(note) || !/pesos/.test(note)) {
      errors.push('summary.total_incidences_note: falta la nota (registros únicos / pesos)')
    }
    if (!isObj(s.classification_rule_counts)) errors.push('summary.classification_rule_counts: requerido')
    if (!isObj(s.severity_rule_counts)) errors.push('summary.severity_rule_counts: requerido')
  }

  const caps = doc.capabilities
  if (!isObj(caps) || !isObj(caps.features)) {
    errors.push('capabilities.features: requerido')
  } else {
    if (!M7_PROFITABILITY_LEVELS.includes(caps.profitability_level_reached)) {
      errors.push('capabilities.profitability_level_reached: fuera del catálogo')
    }
    // BLOCKER contractual: L2+ exige COGS histórico. Si el payload dice L2 sin
    // historical_cogs_observable, el frontend NO lo renderiza como válido.
    if (String(caps.profitability_level_reached || '').startsWith('L2')
        && caps.features.historical_cogs_observable !== true) {
      errors.push('nivel L2 sin historical_cogs_observable: contrato inconsistente')
    }
    // El match histórico DEBE ser null (no 0) mientras no esté soportado.
    if (caps.features.historical_sales_cost_match_supported !== true
        && caps.historical_sales_cost_match_count !== null) {
      errors.push('historical_sales_cost_match_count debe ser null cuando no está soportado')
    }
  }

  // capability_requirements: contrato del DAG.
  if (!isObj(doc.capability_requirements)) {
    errors.push('capability_requirements: requerido')
  }

  for (const r of (Array.isArray(doc.rule_results) ? doc.rule_results : [])) {
    if (!CLASSIFICATION_SET.has(r?.classification)) errors.push(`${r?.rule_code}: classification inválida`)
    if (!VERDICT_SET.has(r?.verdict)) errors.push(`${r?.rule_code}: verdict inválido`)
    if (!SEVERITY_SET.has(r?.severity)) errors.push(`${r?.rule_code}: severity inválida`)
    if (!UNIVERSE_SET.has(r?.universe_id)) errors.push(`${r?.rule_code}: universe_id fuera del catálogo`)
    if (r?.verdict === 'incumplimiento' && !r?.approved_threshold) {
      errors.push(`${r?.rule_code}: incumplimiento sin umbral aprobado`)
    }
  }

  const pii = scanPii(doc)
  if (pii.length) errors.push(`PII en el payload: ${pii.slice(0, 3).join(', ')}`)

  const blob = JSON.stringify(doc)
  for (const k of M7_FORBIDDEN_FOREIGN_KEYS) {
    if (blob.includes(`"${k}"`)) errors.push(`clave de otro módulo en el envelope: ${k}`)
  }

  return { ok: errors.length === 0, errors }
}

/** Valida la página de /findings. */
export function validateM7Findings(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M7_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  for (const k of ['total', 'page', 'pages', 'page_size']) {
    if (!Number.isInteger(doc[k])) errors.push(`${k}: entero requerido`)
  }
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  if (doc.items?.length > doc.page_size) errors.push('items excede page_size (paginación rota)')
  const pii = scanPii(doc)
  if (pii.length) errors.push(`PII en findings: ${pii.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors }
}

/** Valida /runs. */
export function validateM7Runs(doc) {
  const errors = []
  if (!isObj(doc)) return { ok: false, errors: ['payload: debe ser objeto'] }
  if (!M7_SUPPORTED_SCHEMA_VERSIONS.includes(doc.schema_version)) {
    return { ok: false, errors: [`schema_version desconocida: ${doc.schema_version}`], schema: 'unsupported' }
  }
  if (!Array.isArray(doc.items)) errors.push('items: arreglo requerido')
  if (!Array.isArray(doc.rejected_params)) errors.push('rejected_params: arreglo requerido')
  const pii = scanPii(doc)
  if (pii.length) errors.push(`PII en runs: ${pii.slice(0, 3).join(', ')}`)
  return { ok: errors.length === 0, errors }
}
