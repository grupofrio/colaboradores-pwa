// ─── KOLD OS · M6 — Exports (client-side, read-only, sin PII) ────────────────
// Todo export declara su linaje y su estado de evidencia: un archivo sobrevive
// fuera de la app y no puede mentir sobre de dónde salió.

import { M6_PII_KEYS, scanPii } from './contract.js'
import { M6_SHELL_BLOCKER_LABELS, categoryLabel } from './m6Meta.js'

export const M6_EXPORT_MAX_ROWS = 5000

// Neutraliza formula injection ANTES del escaping de CSV: Excel/Sheets ejecutan
// celdas que empiezan con = + - @ (o tab/CR).
export const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/

export function neutralizeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return FORMULA_PREFIX_RE.test(text) ? `'${text}` : text
}

export function csvCell(value) {
  const text = neutralizeCsvCell(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Quita claves PII en cualquier nivel (defensa en profundidad del export). */
export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map(sanitizeForExport)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (M6_PII_KEYS.includes(String(k).toLowerCase())) continue // DROP
      out[k] = sanitizeForExport(v)
    }
    return out
  }
  return value
}

/** Nombre de archivo que DECLARA su naturaleza: DEMO / NONFORMAL / STALE. */
export function exportFilename(base, ext, { demo = false, nonformal = false, stale = false } = {}) {
  const marks = [demo ? 'DEMO' : '', nonformal ? 'NONFORMAL' : '', stale ? 'STALE' : ''].filter(Boolean)
  return `${base}${marks.length ? `_${marks.join('_')}` : ''}.${ext}`
}

/** Cabecera de linaje común a TODOS los exports. */
function lineageLines(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const scope = run.scope || {}
  const nonformal = run.is_production_shell_run !== true
  return [
    demo ? '⚠ ORIGEN: MODO DEMO — fixture emitido por el core real del backend M6. NO es evidencia en vivo.'
         : 'ORIGEN: API autenticada gf_kold_os_m6',
    nonformal
      ? `⚠ EVIDENCIA NO FORMAL: medición ${run.measurement_method || 'read-only'} fuera de odoo-shell productivo. Bloqueada por: ${(run.production_shell_run_blocked_by || []).map((b) => M6_SHELL_BLOCKER_LABELS[b] || b).join(' · ') || '—'}`
      : 'EVIDENCIA FORMAL: corrida odoo-shell de producción',
    `Corte de auditoría : ${run.finished_at || '—'}`,
    `Ventana            : [${scope.window_start || '—'}, ${scope.window_end_exclusive || '—'})`,
    `Compañías (scope)  : ${(scope.company_ids || []).join(', ') || '—'}`,
    `Monedas (scope)    : ${(scope.currency_ids || []).join(', ') || '—'}`,
    `scope_key          : ${run.scope_key || '—'}`,
    `run_id             : ${run.run_id || '—'}`,
    `Auditor (midió)    : ${run.auditor_build_sha || '—'}`,
    `Contrato (empacó)  : ${run.contract_build_sha || 'sin sellar'}`,
    `Manifest sha256    : ${run.manifest_sha256 || '—'}`,
    `Evidencia sha256   : ${run.evidence_sha256 || '—'}`,
  ]
}

export const M6_CSV_COLUMNS = Object.freeze([
  'rule_code', 'category', 'title', 'verdict', 'classification', 'severity',
  'lifecycle_status', 'universe_id', 'incidences', 'numerator', 'denominator',
  'pct', 'coverage', 'approved_threshold', 'threshold_source', 'source_model',
  'source_fields', 'currency_aware', 'responsible_area', 'scope_key',
  'first_seen_at', 'last_seen_at', 'occurrence_count',
])

/** CSV de hallazgos. Sin PII, con neutralización de fórmulas y tope de filas. */
export function findingsToCsv(findings, { maxRows = M6_EXPORT_MAX_ROWS } = {}) {
  const rows = (findings || []).slice(0, maxRows)
  const lines = [M6_CSV_COLUMNS.join(',')]
  for (const f of rows) {
    lines.push(M6_CSV_COLUMNS.map((col) => {
      const v = col === 'source_fields' && Array.isArray(f[col]) ? f[col].join(' ') : f[col]
      return csvCell(v)
    }).join(','))
  }
  return lines.join('\n')
}

/** JSON de evidencia: envelope sanitizado + metadata de exportación. */
export function evidenceJson(payload, extra = {}) {
  return JSON.stringify(sanitizeForExport({
    exported_schema: 'kold.os.m6.export/1',
    exported_at_note: 'Generado client-side desde la API read-only. Cero writes.',
    ...extra,
    payload,
  }), null, 2)
}

/** Resumen ejecutivo — TRES NIVELES, jamás una conclusión global. */
export function executiveSummaryText(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const s = payload?.summary || {}
  const caps = payload?.capabilities?.features || {}
  const cls = s.classification_rule_counts || {}
  const sev = s.severity_rule_counts || {}
  const lines = [
    'KOLD OS · M6 — CAJA, COBRANZA Y CONCILIACIÓN (resumen ejecutivo)',
    '===============================================================',
    ...lineageLines(payload, { demo }),
    '',
    '── QUÉ RESPONDE Y QUÉ NO ────────────────────────────────────────────────',
    'Pregunta: "¿dónde está el dinero y qué falta para cerrar financiera y',
    'administrativamente?". M6 v1 presenta SEÑALES REPORTADAS por las fuentes',
    'observadas, su cobertura de instrumentación y lo que NO puede afirmar.',
    'NO emite una conclusión global de cuadre.',
    '',
    '── NIVEL 1 · ESTADO FINANCIERO REPORTADO (por veredicto) ─────────────────',
    ` - INCUMPLIMIENTOS (umbral APROBADO + supuesto verificado) : ${s.definitive_incident_rule_count ?? 0} reglas · ${s.definitive_incident_count ?? 0} incidencias`,
    ` - RIESGOS (supuesto declarado, no verificado)             : ${s.warning_rule_count ?? 0} reglas · ${s.warning_count ?? 0} incidencias`,
    ` - ANOMALÍAS (exploratorias: señalan, NO prueban)          : ${s.anomaly_rule_count ?? 0} reglas · ${s.anomaly_count ?? 0} incidencias`,
    ` - CUMPLEN                                                 : ${s.compliant_rule_count ?? 0} reglas`,
    ` - NO EVALUABLES (el contrato v1 no permite concluir)      : ${s.not_evaluable_rule_count ?? 0} reglas`,
    `Total de incidencias: ${s.total_incidences ?? 0} = suma exacta de incumplimientos + riesgos + anomalías.`,
    'Son afectaciones POR REGLA, NO entidades únicas ni importes.',
    '',
    'LAS MISMAS REGLAS POR CLASIFICACIÓN (otro EJE: solidez de la evidencia):',
    ` - ${Object.entries(cls).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`,
    'LAS MISMAS REGLAS POR SEVERIDAD (otro EJE: gravedad si es real):',
    ` - ${Object.entries(sev).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`,
    '"exploratory" es una CLASIFICACIÓN, no un veredicto: los conteos difieren.',
    '',
    '── NIVEL 3 · CAPACIDADES NO DISPONIBLES ─────────────────────────────────',
    ` - Total consolidado global  : ${caps.consolidated_global_total === false ? 'NO DISPONIBLE' : '—'} · hay varias monedas sin normalización autorizada`,
    ` - Normalización de moneda   : ${caps.currency_normalization_supported === false ? 'NO DISPONIBLE' : '—'}`,
    ` - Modelo de depósito        : ${caps.deposit_model === false ? 'NO DISPONIBLE' : '—'} · sin fuente canónica ratificada`,
    ` - Cash pending de M1        : ${caps.m1_cash_pending_reconciliation === false ? 'NO DISPONIBLE' : '—'} · es SEÑAL operativa, no saldo`,
    ` - Puente físico→financiero  : ${caps.physical_to_financial_bridge === false ? 'NO DISPONIBLE' : '—'} · la diferencia física de M5 NO es financiera`,
    ` - Costo financiero para M7  : ${caps.m7_financial_cost_available === false ? 'NO DISPONIBLE' : '—'} · M7 no iniciado`,
    '',
    'M6 observa, no corrige. Cero writes. Generado client-side desde la API read-only.',
  ]
  return sanitizeCsvText(lines.join('\n'))
}

/** Cartera y aging — el aging viene YA COMPUTADO por el snapshot del backend. */
export function agingText(payload, { demo = false } = {}) {
  const ar = (payload?.metrics?.ar_aging_metrics || [])[0] || {}
  const n = (v) => (v === null || v === undefined ? '—' : v)
  const lines = [
    'KOLD OS · M6 — CARTERA Y AGING',
    '==============================',
    ...lineageLines(payload, { demo }),
    '',
    'FUENTE CANÓNICA: gf.ar.customer.snapshot — el aging lo computa el snapshot.',
    'El frontend NO lo recalcula por fecha ni suma monedas distintas.',
    '',
    `Clientes con snapshot            : ${n(ar.snapshot_count)}`,
    `Con saldo vencido                : ${n(ar.overdue_count)}`,
    `Con más de 30 días de atraso     : ${n(ar.over_30_count)}`,
    `Con más de 60 días de atraso     : ${n(ar.over_60_count)}`,
    `Con más de 90 días de atraso     : ${n(ar.over_90_count)}`,
    `Con saldo y sin límite de crédito: ${n(ar.no_limit_with_balance_count)}`,
    `Saldo pendiente SIN vencimiento  : ${n(ar.pending_without_due_count)} (aging NO evaluable para esos)`,
    '',
    'Son CONTEOS DE CLIENTES, no importes: los importes viven por moneda y no se',
    'consolidan. Sin identidad del cliente (PII fuera del observatorio).',
  ]
  return sanitizeCsvText(lines.join('\n'))
}

/** Pagos y conciliación — señal CAVEATED, jamás "faltante". */
export function paymentsText(payload, { demo = false } = {}) {
  const p = (payload?.metrics?.payment_metrics || [])[0] || {}
  const r = (payload?.metrics?.reconciliation_metrics || [])[0] || {}
  const n = (v) => (v === null || v === undefined ? '—' : v)
  const lines = [
    'KOLD OS · M6 — PAGOS Y CONCILIACIÓN',
    '===================================',
    ...lineageLines(payload, { demo }),
    '',
    `Pagos entrantes (state=paid)                : ${n(p.payment_count)}`,
    `Sin conciliación identificada en la fuente  : ${n(p.unreconciled_count)}`,
    `Sin journal                                 : ${n(p.no_journal_count)}`,
    `Con monto no positivo                       : ${n(p.non_positive_count)}`,
    `Apuntes de CxC                              : ${n(r.receivable_line_count)}`,
    `Apuntes abiertos sin conciliar              : ${n(r.unreconciled_open_count)}`,
    '',
    'LIMITACIONES DECLARADAS — un pago sin conciliación identificada NO es un',
    'faltante ni un pago perdido. Causas posibles NO descartadas:',
    ' · anticipo; · pago no aplicado; · conciliación parcial; · pago reversado;',
    ' · flujo contable alternativo; · cobertura del propio modelo de conciliación.',
    'Sin SLA de conciliación aprobado, esto es señal de cobertura, no incumplimiento.',
  ]
  return sanitizeCsvText(lines.join('\n'))
}

/** Cierres y liquidaciones — las cajas abiertas son CAVEATED. */
export function closuresText(payload, { demo = false } = {}) {
  const sc = (payload?.metrics?.seller_cashbox_metrics || [])[0] || {}
  const cc = (payload?.metrics?.cash_closing_metrics || [])[0] || {}
  const bc = (payload?.metrics?.branch_close_metrics || [])[0] || {}
  const n = (v) => (v === null || v === undefined ? '—' : v)
  const lines = [
    'KOLD OS · M6 — CIERRES Y LIQUIDACIONES',
    '======================================',
    ...lineageLines(payload, { demo }),
    '',
    'CAJA DE RUTA (gf.seller.cashbox):',
    ` - Cajas en la ventana                : ${n(sc.cashbox_count)}`,
    ` - Con estado ABIERTO en la fuente    : ${n(sc.still_open_count)}`,
    ` - Con estado cerrado                 : ${n(sc.closed_count)}`,
    ` - Sin ruta vinculada                 : ${n(sc.no_route_count)}`,
    '',
    'CAVEAT — "estado abierto" es lo que la fuente REPORTA. Puede representar una',
    'caja operativa permanente o una sesión sin cierre: requiere validación',
    'funcional. NO son cajas abandonadas, ni un faltante, ni un incumplimiento:',
    'no existe política de cierre aprobada contra la cual medirlo.',
    '',
    'CIERRE DE CAJA (gf.cash.closing):',
    ` - Cierres en la ventana              : ${n(cc.closing_count)}`,
    ` - Cerrados                           : ${n(cc.closed_count)}`,
    ` - Con diferencia reportada           : ${n(cc.with_difference_count)}`,
    'La diferencia es la que el ARQUEO declara — distinta de la diferencia FÍSICA de M5.',
    '',
    'CIERRE ADMINISTRATIVO (gf.branch.daily.close):',
    ` - Cierres en la ventana              : ${n(bc.close_count)}`,
    ` - Cerrados                           : ${n(bc.closed_count)}`,
    ` - Sin arrancar (draft/auto_loaded)   : ${n(bc.not_started_count)}`,
    ` - Bajo revisión                      : ${n(bc.under_review_count)}`,
  ]
  return sanitizeCsvText(lines.join('\n'))
}

/** Capacidades y cobertura — qué se puede y qué NO. */
export function capabilitiesText(payload, { demo = false } = {}) {
  const caps = payload?.capabilities?.features || {}
  const rows = Object.entries(caps).map(([k, v]) => ` - ${k.padEnd(38)} ${v === true ? 'SÍ' : v === false ? 'NO' : String(v)}`)
  return sanitizeCsvText([
    'KOLD OS · M6 — CAPACIDADES Y COBERTURA',
    '======================================',
    ...lineageLines(payload, { demo }),
    '',
    'Una capability en false NO es un cero: es algo que este contrato NO puede',
    'afirmar. La UI lo muestra como "—" con su razón.',
    '',
    ...rows,
  ].join('\n'))
}

/** Última red: ninguna PII textual sale en un export de texto. */
export function sanitizeCsvText(text) {
  let out = String(text)
  for (const key of M6_PII_KEYS) {
    out = out.replace(new RegExp(`("?${key}"?\\s*[:=]\\s*)("[^"]*"|[^,\\n]*)`, 'gi'), '$1[REDACTED]')
  }
  return out
}

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

export { scanPii }
