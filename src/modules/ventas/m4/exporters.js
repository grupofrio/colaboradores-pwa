// ─── KOLD OS · M4 — Exportadores read-only (CSV / JSON / resumen) ────────────
// Client-side sobre el envelope validado. Defensa en profundidad:
//   · claves sensibles fuera + credenciales [REDACTED] (espejo del auditor);
//   · CSV: neutralización de formula injection (B7) — celdas que inician con
//     = + - @ (o tab/CR/LF) se prefijan con apóstrofo ANTES del escaping
//     RFC-4180, para que Excel/Sheets las traten como texto;
//   · STALE (B10): el nombre del archivo y la metadata lo marcan — una
//     corrida vieja jamás se exporta como si fuera vigente.

import { M4_FORBIDDEN_KEY_RE } from './contract.js'

export const CREDENTIAL_VALUE_RE = /(?:\bBearer\s+\S+|\b(?:password|passwd|api[_-]?key|token|secret)\s*[=:]\s*\S+|\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+)/i

/** Sanitiza recursivamente un valor para exportación (drop de claves sensibles). */
export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeForExport(item))
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, val] of Object.entries(value)) {
      if (M4_FORBIDDEN_KEY_RE.test(key)) continue // drop silencioso: jamás exporta
      output[key] = sanitizeForExport(val)
    }
    return output
  }
  if (typeof value === 'string') {
    return CREDENTIAL_VALUE_RE.test(value) ? '[REDACTED]' : value
  }
  return value
}

// B7: neutraliza formula injection ANTES del escaping CSV.
// Cubre = + - @ iniciales y también tab/CR/LF iniciales (variantes conocidas).
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

export const M4_CSV_COLUMNS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity',
  // Contrato epistémico: el veredicto es la lectura autoritativa, no el color.
  'verdict', 'classification', 'approved_threshold', 'universe',
  'status', 'granularity', 'lifecycle_status', 'title', 'entity_type',
  'entity_reference', 'observed_value', 'expected_rule', 'numerator',
  'denominator', 'pct', 'incidences', 'company_id', 'branch_id',
  'responsible_area', 'owner_status', 'first_seen_at', 'last_seen_at',
  'occurrence_count', 'source_model', 'source_timestamp',
])

/** CSV de hallazgos (RFC-4180 básico + neutralización anti-fórmulas). */
export function findingsToCsv(findings = []) {
  const rows = [M4_CSV_COLUMNS.join(',')]
  for (const raw of Array.isArray(findings) ? findings : []) {
    const finding = sanitizeForExport(raw)
    rows.push(M4_CSV_COLUMNS.map((col) => {
      const value = finding?.[col]
      return csvCell(Array.isArray(value) ? value.join('|') : value)
    }).join(','))
  }
  return rows.join('\n')
}

/** Sufijo de archivo: DEMO / STALE / NONFORMAL van en el NOMBRE — una corrida
 *  vieja, de demo o sin corrida formal jamás se exporta como si fuera vigente
 *  y formal. */
export function exportFilename(base, ext, { stale = false, demo = false, nonformal = false } = {}) {
  const marks = [demo ? 'DEMO' : '', stale ? 'STALE' : '', nonformal ? 'NONFORMAL' : ''].filter(Boolean)
  return `${base}${marks.length ? `_${marks.join('_')}` : ''}.${ext}`
}

/** JSON de evidencia: envelope completo + metadata de exportación. */
export function evidenceJson(payload, extra = {}) {
  return JSON.stringify(sanitizeForExport({
    exported_schema: 'kold.os.m4.export/1',
    export_meta: {
      stale: payload?.stale === true,
      age_days: payload?.age_days ?? null,
      technical_state: payload?.run?.technical_state || null,
      ...extra,
    },
    envelope: payload,
  }), null, 2)
}

/** Resumen ejecutivo imprimible (texto plano) — desglosado por VEREDICTO. */
export function executiveSummaryText(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const summary = payload?.summary || {}
  const nonformal = run.is_production_shell_run !== true
  const lines = [
    'KOLD OS · M4 — VENTAS, CLIENTES Y CANALES (resumen ejecutivo)',
    '=============================================================',
    demo ? '⚠ ORIGEN: MODO DEMO (fixture emitido por el core real del backend GrupoVeniu/GrupoFrio#205; numeros reales medidos por XML-RPC, NO evidencia en vivo)' : 'ORIGEN: API autenticada gf_kold_os_m4',
    payload?.stale ? `⚠ CORRIDA STALE: ${payload?.age_days ?? '?'} días de antigüedad (no vigente)` : 'Corrida vigente',
    nonformal
      ? `⚠ EVIDENCIA NO FORMAL: no es corrida odoo-shell de producción. Bloqueada por: ${(run.production_shell_run_blocked_by || []).join(' · ') || '—'}`
      : 'EVIDENCIA FORMAL: corrida odoo-shell de producción',
    '',
    `Corte de auditoría : ${run.finished_at || '—'}`,
    `Ambiente           : ${run.environment || '—'}`,
    `Ventana            : [${run.scope?.window_start || '—'}, ${run.scope?.window_end_exclusive || '—'})`,
    `Compañías (scope)  : ${(run.scope?.company_ids || []).join(', ') || '—'}`,
    `Duración           : ${run.duration_ms ?? '—'} ms · consultas ${(run.executed_queries || []).length}`,
    `Auditor (build)    : ${run.auditor_build_sha || '—'} · empaquetó: ${run.contract_build_sha || 'sin sellar'}`,
    `Manifest sha256    : ${run.manifest_sha256 || '—'}`,
    `Evidencia sha256   : ${run.evidence_sha256 || '—'}`,
    '',
    `ESTADO TÉCNICO DEL AUDITOR : ${run.technical_state || '—'}`,
    `ESTADO OPERATIVO DE DATOS  : ${summary.overall_status || '—'}`,
    'M4 observa la operación comercial: un indicador rojo es un resultado VÁLIDO del observatorio, no un fallo del sistema.',
    '',
    'QUÉ PRUEBA LA EVIDENCIA (lee los veredictos, no solo los colores):',
    ` - INCUMPLIMIENTOS (umbral APROBADO + supuesto verificado) : ${summary.definitive_incident_rule_count ?? 0} reglas · ${summary.definitive_incident_count ?? 0} incidencias`,
    ` - RIESGOS (supuesto declarado, no verificado)             : ${summary.warning_rule_count ?? 0} reglas · ${summary.warning_count ?? 0} incidencias`,
    ` - ANOMALÍAS (exploratorias: señalan, NO prueban)          : ${summary.exploratory_signal_rule_count ?? 0} reglas · ${summary.exploratory_signal_count ?? 0} incidencias`,
    ` - CUMPLEN                                                 : ${summary.compliant_rule_count ?? 0} reglas`,
    ` - NO EVALUABLES (el contrato v1 no permite concluir)      : ${summary.not_evaluable_rule_count ?? 0} reglas`,
    `Total de incidencias: ${summary.total_incidences ?? 0} = suma exacta de incumplimientos + riesgos + anomalías (NO son entidades únicas).`,
    `Historial: ${payload?.history?.runs_count ?? 0} corrida(s)`,
    '',
    'HALLAZGOS (rojo/ámbar):',
    ...(payload?.findings || []).map((f) =>
      ` - [${String(f.verdict || '').toUpperCase()}${f.approved_threshold ? '' : ' · UMBRAL NO APROBADO'}] ${f.rule_code} ${f.title}: ${f.observed_value} · área: ${f.responsible_area} · ciclo: ${f.lifecycle_status || 'new'} · granularidad: ${f.granularity}`),
    '',
    'M4 define segmento/motivo/oferta de recompra; NO ejecuta campañas, opt-in ni automatización (eso es M8, LOCK).',
    'M4 observa, no corrige. Cero writes. Generado client-side desde la API read-only.',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Export de RECURRENCIA: el bloque F en texto plano, con universos declarados. */
export function recurrenceText(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const rec = (payload?.metrics?.recurrence_metrics || [])[0] || {}
  const rules = (payload?.rule_results || []).filter((r) => r.category === 'recurrencia')
  const lines = [
    'KOLD OS · M4 — RECURRENCIA DE CLIENTES',
    '======================================',
    demo ? '⚠ MODO DEMO (fixture del core real del backend; NO evidencia en vivo)' : 'API autenticada gf_kold_os_m4',
    run.is_production_shell_run !== true ? '⚠ EVIDENCIA NO FORMAL (sin corrida odoo-shell)' : 'EVIDENCIA FORMAL',
    `Ventana: [${run.scope?.window_start || '—'}, ${run.scope?.window_end_exclusive || '—'}) · corte ${run.finished_at || '—'}`,
    '',
    'UNIVERSO (clientes comerciales activos del scope):',
    ` - Clientes comerciales           : ${rec.customer_count ?? '—'}`,
    ` - Con compra en la ventana       : ${rec.active_in_window_count ?? '—'}`,
    ` - Recurrentes (>=2 pedidos)      : ${rec.recurrent_count ?? '—'}`,
    ` - Sin compra en la ventana       : ${rec.dormant_count ?? '—'} (definición de "dormido" NO aprobada: exploratorio)`,
    ` - Nuevos con pedido              : ${rec.new_with_order_count ?? '—'}`,
    ` - Nuevos SIN segunda compra      : ${rec.new_without_second_count ?? '—'} (objetivo de 2ª compra NO aprobado)`,
    ` - Candidatos a pérdida (365→180) : ${rec.lost_180_365_count ?? '—'} (definición de "perdido" NO aprobada)`,
    '',
    'VEREDICTOS DE LAS REGLAS DE RECURRENCIA:',
    ...rules.map((r) =>
      ` - ${r.rule_code} ${r.name}: ${String(r.verdict || '').toUpperCase()} · ${r.observed_value ?? '—'} · umbral ${r.approved_threshold ? 'APROBADO' : 'NO APROBADO'}`),
    '',
    'Las definiciones de dormido/perdido/reactivado requieren ratificación de dirección comercial;',
    'hasta entonces estas señales son EXPLORATORIAS (señalan dónde mirar, no prueban conclusión).',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Export del HANDOFF M4→M2: la señal comercial que planeación debe consumir.
 *  M4 solo OBSERVA el handoff; jamás escribe en M2. */
export function handoffM4M2Text(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const rec = (payload?.metrics?.recurrence_metrics || [])[0] || {}
  const orders = (payload?.metrics?.order_metrics || [])[0] || {}
  const master = (payload?.metrics?.customer_master_metrics || [])[0] || {}
  const rules = (payload?.rule_results || []).filter((r) => r.category === 'senal_m4_m2')
  const lines = [
    'KOLD OS · M4 → M2 — SEÑAL COMERCIAL PARA PLANEACIÓN (handoff observado)',
    '=======================================================================',
    demo ? '⚠ MODO DEMO (fixture provisional; NO evidencia en vivo)' : 'API autenticada gf_kold_os_m4',
    run.is_production_shell_run !== true ? '⚠ EVIDENCIA NO FORMAL (sin corrida odoo-shell)' : 'EVIDENCIA FORMAL',
    `Ventana: [${run.scope?.window_start || '—'}, ${run.scope?.window_end_exclusive || '—'}) · corte ${run.finished_at || '—'}`,
    '',
    'SEÑAL COMERCIAL (insumo de demanda para M2):',
    ` - Clientes comerciales activos      : ${rec.customer_count ?? '—'}`,
    ` - Compraron en la ventana           : ${rec.active_in_window_count ?? '—'}`,
    ` - Base recurrente (>=2 pedidos)     : ${rec.recurrent_count ?? '—'}`,
    ` - Candidatos a pérdida              : ${rec.lost_180_365_count ?? '—'} (aún podrían estar planeados)`,
    ` - Pedidos confirmados en la ventana : ${orders.confirmed_count ?? '—'}`,
    ` - Clientes sin canal                : ${master.no_channel_count ?? '—'} (canal es dimensión de forecast)`,
    '',
    'ESTADO DE LAS REGLAS DEL HANDOFF (I):',
    ...rules.map((r) =>
      ` - ${r.rule_code} ${r.name}: ${String(r.verdict || '').toUpperCase()} — ${r.evidence_limitations ?? ''}`),
    '',
    'FRONTERA: M4 produce la señal; M2 decide la planeación. Este export NO escribe',
    'en M2 ni ejecuta acciones: es el insumo observado para la conversación M4↔M2.',
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
