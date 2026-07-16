// ─── KOLD OS · M3 — Exportadores read-only (CSV / JSON / resumen / plan-real) ─
// Client-side sobre el envelope validado. Protecciones:
//   · claves sensibles fuera + credenciales [REDACTED];
//   · CSV: neutralización de formula injection (celdas que inician con = + - @
//     o tab/CR/LF se prefijan con apóstrofo ANTES del escaping RFC-4180);
//   · STALE/DEMO en el NOMBRE del archivo y en la metadata;
//   · revokeObjectURL tras la descarga; sin PII (el contrato ya no la trae).

import { M3_FORBIDDEN_KEY_RE, validateM3Latest } from './contract.js'
import { categoryLabel, getM3Lineage } from './m3Meta.js'

export const CREDENTIAL_VALUE_RE = /(?:\bBearer\s+\S+|\b(?:password|passwd|api[_-]?key|token|secret)\s*[=:]\s*\S+|\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+)/i

export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeForExport(item))
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, val] of Object.entries(value)) {
      if (M3_FORBIDDEN_KEY_RE.test(key)) continue
      output[key] = sanitizeForExport(val)
    }
    return output
  }
  if (typeof value === 'string') {
    return CREDENTIAL_VALUE_RE.test(value) ? '[REDACTED]' : value
  }
  return value
}

export function neutralizeCsvCell(raw) {
  if (!raw) return raw
  const first = raw[0]
  if (first === '=' || first === '+' || first === '-' || first === '@'
    || first === '\t' || first === '\r' || first === '\n') {
    return `'${raw}`
  }
  return raw
}

export const csvCell = (value) => {
  const raw = value === null || value === undefined ? '' : String(value)
  const redacted = CREDENTIAL_VALUE_RE.test(raw) ? '[REDACTED]' : raw
  const neutral = neutralizeCsvCell(redacted).replace(/\r?\n/g, ' ')
  return /[",;]/.test(neutral) ? `"${neutral.replace(/"/g, '""')}"` : neutral
}

export const M3_CSV_COLUMNS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity', 'status', 'verdict',
  'classification', 'approved_threshold', 'granularity', 'lifecycle_status', 'title', 'branch_id', 'branch_code', 'route_id', 'plan_id',
  'entity_type', 'entity_reference', 'observed_value', 'expected_rule',
  'numerator', 'denominator', 'pct', 'incidences', 'responsible_area',
  'owner_status', 'first_seen_at', 'last_seen_at', 'occurrence_count',
  'source_model', 'source_timestamp',
])

function canonicalLatest(payload) {
  const validation = validateM3Latest(payload)
  if (!validation.ok) throw new Error(`M3 payload invalid: ${validation.errors.join('; ')}`)
  return validation.payload
}

export function findingsToCsv(payload) {
  const canonical = canonicalLatest(payload)
  const rows = [M3_CSV_COLUMNS.join(',')]
  for (const finding of canonical.findings) {
    rows.push(M3_CSV_COLUMNS.map((col) => {
      const value = finding?.[col]
      return csvCell(Array.isArray(value) ? value.join('|') : value)
    }).join(','))
  }
  return rows.join('\n')
}

/** Sufijo del archivo según vigencia/origen: STALE/DEMO van en el NOMBRE. */
export function exportFilename(base, ext, { stale = false, demo = false } = {}) {
  const marks = [demo ? 'DEMO' : '', stale ? 'STALE' : ''].filter(Boolean)
  return `${base}${marks.length ? `_${marks.join('_')}` : ''}.${ext}`
}

export function evidenceJson(payload, extra = {}) {
  const canonical = canonicalLatest(payload)
  return JSON.stringify(sanitizeForExport({
    exported_schema: 'kold.os.m3.export/1',
    export_meta: {
      stale: canonical.stale === true,
      age_days: canonical.age_days ?? null,
      technical_state: canonical.run?.technical_state || null,
      ...extra,
    },
    envelope: canonical,
  }), null, 2)
}

/** Resumen ejecutivo imprimible (texto plano). */
export function executiveSummaryText(payload, { demo = false } = {}) {
  payload = canonicalLatest(payload)
  const run = payload?.run || {}
  const summary = payload?.summary || {}
  const kpis = payload?.kpis || {}
  const lineage = getM3Lineage(run)
  const findingHeadline = Number(summary.definitive_incident_rule_count || 0) > 0
    ? 'M3 está funcionando y detectó incumplimientos definitivos: la evidencia cumple el contrato epistémico para afirmarlos.'
    : 'M3 está funcionando y detectó señales operativas: un tablero rojo no prueba por sí solo un incumplimiento.'
  const lines = [
    'KOLD OS · M3 — EJECUCIÓN DE RUTAS (resumen ejecutivo)',
    '=====================================================',
    demo ? '⚠ ORIGEN: MODO DEMO (fixture generado por código real; números de negocio REALES de producción; NO es una corrida odoo-shell)' : 'ORIGEN: API autenticada gf_kold_os_m3',
    payload?.stale ? `⚠ CORRIDA STALE: ${payload?.age_days ?? '?'} días (no vigente)` : 'Corrida vigente',
    '',
    `Corte de auditoría : ${run.finished_at || '—'}`,
    `Ventana            : últimos ${run.scope?.window_days ?? '—'} días`,
    `Compañías (scope)  : ${(run.scope?.company_ids || []).join(', ') || '—'}`,
    `Auditor (midió)       : ${lineage.auditor}`,
    `Contrato (empaquetó)  : ${lineage.contract} · manifest ${run.manifest_sha256 || '—'}`,
    `Evidencia sha256   : ${run.evidence_sha256 || '—'}`,
    '',
    `ESTADO TÉCNICO DEL AUDITOR : ${run.technical_state || '—'}`,
    `ESTADO OPERATIVO DE DATOS  : ${summary.overall_status || '—'}`,
    findingHeadline,
    '',
    'KPIs DE EJECUCIÓN (cada uno cuenta UNA sola entidad):',
    ` - Rutas operativas: ${kpis.plans_operational ?? '—'} · iniciadas y VENCIDAS sin cierre: ${kpis.plans_started_overdue_open ?? '—'} · cerradas: ${kpis.plans_closed ?? '—'}`,
    ` - Cumplimiento de visita: ${kpis.visit_compliance?.value_pct ?? '—'}% (${kpis.visit_compliance?.numerator ?? '—'}/${kpis.visit_compliance?.denominator ?? '—'}) · universo: ${kpis.visit_compliance?.universe_label || '—'}`,
    ` - Ventas: ${kpis.sales_count ?? '—'} · no-ventas: ${kpis.no_sales_count ?? '—'} (sin motivo estructurado: ${kpis.no_sale_without_structured_reason ?? '—'} — el modelo NO exige motivo en no-venta)`,
    ` - Conciliaciones draft sobre ruta CERRADA: ${kpis.reconciliations_draft_on_closed_route ?? '—'} · visitas fuera del plan: ${kpis.offroute_visits_total ?? '—'} (con venta: ${kpis.offroute_visits_with_sale ?? '—'}) · incidentes: ${kpis.incidents_reported ?? '—'}`,
    '',
    'QUÉ PRUEBA LA EVIDENCIA (desglose por veredicto — no todo lo rojo es incumplimiento):',
    ` - INCUMPLIMIENTOS definitivos : ${summary.definitive_incident_rule_count ?? 0} reglas · ${summary.definitive_incident_count ?? 0} incidencias (umbral aprobado + supuesto verificado)`,
    ` - RIESGOS (con supuestos)     : ${summary.warning_rule_count ?? 0} reglas · ${summary.warning_count ?? 0} incidencias`,
    ` - ANOMALÍAS exploratorias     : ${summary.exploratory_signal_rule_count ?? 0} reglas · ${summary.exploratory_signal_count ?? 0} incidencias (señalan dónde mirar; NO prueban conclusión)`,
    ` - CUMPLEN                     : ${summary.compliant_rule_count ?? 0} reglas`,
    ` - NO EVALUABLES               : ${summary.not_evaluable_rule_count ?? 0} reglas (el contrato no permite concluir)`,
    `Incidencias detectadas (total): ${summary.total_incidences ?? 0} = suma exacta del desglose. Son afectaciones por regla, NO entidades únicas.`,
    `Sucursales con hallazgos dimensionales: ${(summary.branches_with_findings || []).join(', ') || '—'}`,
    `Historial: ${payload?.history?.runs_count ?? 0} corrida(s)`,
    '',
    'HALLAZGOS (rojo/ámbar):',
    ...(payload?.findings || []).map((f) =>
      ` - [${(f.verdict || f.status || '').toUpperCase()}] ${f.rule_code} ${f.title}: ${f.observed_value}`
      + ` · ${f.granularity === 'branch' ? `sucursal ${f.branch_code}` : 'agregado'} · área: ${f.responsible_area}`
      + ` · ciclo: ${f.lifecycle_status || 'new'}${f.approved_threshold === false ? ' · UMBRAL NO APROBADO' : ''}`),
    '',
    'M3 observa, no corrige. Cero writes. Generado client-side desde la API read-only.',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Comparación plan vs real (export dedicado, honesto sobre lo medible). */
export function planVsRealText(payload, { demo = false } = {}) {
  payload = canonicalLatest(payload)
  const kpis = payload?.kpis || {}
  const rules = payload?.rule_results || []
  const byCode = Object.fromEntries(rules.map((r) => [r.rule_code, r]))
  const line = (code) => {
    const r = byCode[code]
    if (!r) return ` - ${code}: sin datos`
    return ` - [${r.status}] ${r.rule_code} ${r.name}: ${r.observed_value}${r.not_evaluable_reason ? ` (${r.not_evaluable_reason})` : ''}`
  }
  const lines = [
    'KOLD OS · M3 — COMPARACIÓN PLAN VS REAL',
    '=======================================',
    demo ? '⚠ ORIGEN: MODO DEMO (números de negocio reales; no corrida odoo-shell)' : 'ORIGEN: API autenticada gf_kold_os_m3',
    '',
    `Planeado → ejecutado: ${kpis.plans_operational ?? '—'} rutas operativas · ${kpis.plans_published_pending ?? '—'} publicadas nunca iniciadas · ${kpis.plans_started_overdue_open ?? '—'} iniciadas y VENCIDAS sin cierre`,
    `Paradas (universo ${kpis.visit_compliance?.universe || '—'}): ${kpis.visit_compliance?.denominator ?? '—'} planeadas · ${kpis.visit_compliance?.numerator ?? '—'} visitadas · cumplimiento ${kpis.visit_compliance?.value_pct ?? '—'}%`,
    `  Sensibilidad por universo: ${Object.entries(kpis.visit_compliance?.sensitivity || {}).map(([k, v]) => `${k}=${v.value_pct}%`).join(' · ') || '—'}`,
    `Visitas fuera del plan: ${kpis.offroute_visits_total ?? '—'} (de las cuales ${kpis.offroute_visits_with_sale ?? '—'} terminaron en VENTA — observación, no incumplimiento)`,
    '',
    `COBERTURA de los campos que la comparación necesita (sin cobertura no se concluye):`,
    `  distancia esperada ${kpis.coverage?.expected_distance_pct ?? '—'}% · par de odómetros ${kpis.coverage?.km_pair_pct ?? '—'}% · vehículo ${kpis.coverage?.vehicle_pct ?? '—'}%`,
    '',
    'Reglas de la categoría Plan vs real:',
    line('M3-H-01'),
    line('M3-H-02'),
    line('M3-H-03'),
    '',
    'Los cruces de kilos/tiempo/secuencia plan vs real requieren la extensión',
    'v1.1 del contrato del auditor (declarados NOT_EVALUABLE, no inventados).',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Descarga un blob (sin red, sin writes) y libera el object URL. */
export function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
