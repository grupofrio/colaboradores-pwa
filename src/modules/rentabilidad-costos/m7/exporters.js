// ─── KOLD OS · M7 — Exports (client-side, read-only, sin PII) ────────────────
// Todo export declara linaje y estado de evidencia; neutraliza formula injection;
// jamás exporta PII ni un consolidado MXN/USD.

import { M7_PII_KEYS, lineageState } from './contract.js'
import { M7_INCIDENCES_NOTE, categoryLabel, M7_EVIDENCE_SOURCE_LABELS } from './m7Meta.js'

export const M7_EXPORT_MAX_ROWS = 5000

// Excel/Sheets ejecutan celdas que empiezan con = + - @ (o tab/CR).
export const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/

export function neutralizeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return FORMULA_PREFIX_RE.test(text) ? `'${text}` : text
}

export function csvCell(value) {
  const text = neutralizeCsvCell(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Quita claves PII en cualquier nivel (defensa en profundidad). */
export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map(sanitizeForExport)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (M7_PII_KEYS.includes(String(k).toLowerCase())) continue // DROP
      out[k] = sanitizeForExport(v)
    }
    return out
  }
  return value
}

/** Nombre de archivo que DECLARA su naturaleza. */
export function exportFilename(base, ext, { demo = false, nonformal = false, stale = false, unconsolidated = false } = {}) {
  const marks = [demo ? 'DEMO' : '', nonformal ? 'NONFORMAL' : '',
    stale ? 'STALE' : '', unconsolidated ? 'UNCONSOLIDATED' : ''].filter(Boolean)
  return `${base}${marks.length ? `_${marks.join('_')}` : ''}.${ext}`
}

/** Cabecera de linaje común a TODOS los exports M7.
 *  runContext (opcional): la corrida ANCLADA para findings. Si es histórica, el
 *  backend NO expone el scope económico completo por corrida ⇒ se DECLARA faltante
 *  en vez de copiar el de la corrida más reciente (mentira que M5 nos costó un RED).
 */
function lineageLines(payload, { demo = false, runContext = null } = {}) {
  const run = payload?.run || {}
  const scope = run.scope || {}
  const lin = lineageState(payload)
  const head = [
    demo ? '⚠ ORIGEN: MODO DEMO — fixture del core real del backend M7 #211. NO es evidencia en vivo.'
         : 'ORIGEN: API autenticada gf_kold_os_m7',
    lin.is_production_shell_run
      ? 'EVIDENCIA FORMAL: corrida odoo-shell de producción'
      : `⚠ EVIDENCIA NO FORMAL: ${M7_EVIDENCE_SOURCE_LABELS[run.measurement_method] || run.measurement_method || 'read-only'}. Backend #211 no desplegado; API real no probada.`,
    '⚠ LINAJE PRE-MIGRACIÓN — re-sellado requerido al portar a grupofrio/gf.',
    '⚠ MULTI-MONEDA SIN CONSOLIDAR: importes por moneda (MXN/USD); NO hay total global.',
  ]
  // Corrida histórica anclada: metadata sí, scope económico NO (no lo expone /latest).
  if (runContext && runContext.isLatest === false) {
    return head.concat([
      '⚠ CORRIDA HISTÓRICA: findings de la corrida seleccionada; el backend no expone su scope económico completo.',
      `run_id             : ${runContext.run_id || '—'}`,
      `scope_key          : ${runContext.scope_key || '—'}`,
      `Corte de auditoría : ${runContext.finished_at || '—'}`,
      `Medición           : ${M7_EVIDENCE_SOURCE_LABELS[runContext.measurement_method] || runContext.measurement_method || '—'}`,
      `auditor_build_sha  : ${runContext.auditor_build_sha || '—'}`,
      'Nivel económico    : (no disponible por corrida histórica)',
      'Ventana            : (no disponible por corrida histórica)',
      'Monedas (scope)    : (no disponible por corrida histórica)',
      'date_basis         : (no disponible por corrida histórica)',
      'cost_method        : (no disponible por corrida histórica)',
      'contract_build_sha : (no disponible por corrida histórica)',
    ])
  }
  return head.concat([
    `Nivel económico    : ${payload?.capabilities?.profitability_level_reached || '—'}`,
    `Corte de auditoría : ${run.finished_at || '—'}`,
    `Ventana            : [${scope.window_start || '—'}, ${scope.window_end_exclusive || '—'})`,
    `Compañías (scope)  : ${(scope.company_ids || []).join(', ') || '—'}`,
    `Monedas (scope)    : ${(scope.currency_ids || []).join(', ') || '—'}`,
    `date_basis         : ${scope.date_basis || '—'}`,
    `cost_method        : ${scope.cost_method || '—'}`,
    `scope_key          : ${run.scope_key || '—'}`,
    `run_id             : ${run.run_id || '—'}`,
    `auditor_build_sha  : ${run.auditor_build_sha || '—'}`,
    `contract_build_sha : ${run.contract_build_sha || '—'}`,
  ])
}

/** CSV de findings (sin PII, con nota de incidencias). runContext ancla el linaje. */
export function findingsToCsv(items, payload, { demo = false, runContext = null } = {}) {
  const rows = (items || []).slice(0, M7_EXPORT_MAX_ROWS).map(sanitizeForExport)
  const cols = ['rule_code', 'category', 'title', 'classification', 'verdict',
    'severity', 'lifecycle_status', 'incidences', 'universe_id', 'date_basis',
    'cost_method', 'evidence_limitations', 'recommended_action']
  const out = []
  for (const l of lineageLines(payload, { demo, runContext })) out.push('# ' + l)
  out.push('# NOTA: ' + M7_INCIDENCES_NOTE)
  out.push(cols.join(','))
  for (const r of rows) {
    out.push(cols.map((c) => csvCell(c === 'category' ? categoryLabel(r[c]) : r[c])).join(','))
  }
  return out.join('\n')
}

/** JSON de evidencia (linaje + capabilities + summary, sin PII). */
export function evidenceJson(payload, { demo = false } = {}) {
  const clean = sanitizeForExport(payload || {})
  return JSON.stringify({
    _export: {
      module: 'gf_kold_os_m7', demo,
      lineage: lineageState(payload),
      incidences_note: M7_INCIDENCES_NOTE,
      warning: 'Multi-moneda sin consolidar; evidencia no formal; linaje pre-migración.',
    },
    schema_version: clean.schema_version,
    run: clean.run,
    summary: clean.summary,
    capabilities: clean.capabilities,
    capability_requirements: clean.capability_requirements,
  }, null, 2)
}

/** Texto de capabilities/cobertura (para leer sin herramientas). */
export function capabilitiesText(payload) {
  const caps = payload?.capabilities || {}
  const reqs = payload?.capability_requirements || {}
  const lines = [`Nivel económico alcanzado: ${caps.profitability_level_reached || '—'}`, '']
  for (const [cap, r] of Object.entries(reqs)) {
    lines.push(`${cap}: ${r.enabled ? 'DISPONIBLE' : 'NO disponible'}`)
    if (!r.enabled) lines.push(`  falta: ${(r.unmet_requirements || []).join(', ') || '—'}`)
  }
  return lines.join('\n')
}

export function downloadTextFile(text, filename, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  // revocar el object URL: no dejar handles vivos.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
