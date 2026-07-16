// ─── KOLD OS · M5 — Exportadores read-only (CSV / JSON / resumen) ────────────
// Client-side sobre el envelope validado. Defensa en profundidad:
//   · claves sensibles fuera + credenciales [REDACTED] (espejo del auditor);
//   · CSV: neutralización de formula injection (B7) — celdas que inician con
//     = + - @ (o tab/CR/LF) se prefijan con apóstrofo ANTES del escaping
//     RFC-4180, para que Excel/Sheets las traten como texto;
//   · STALE (B10): el nombre del archivo y la metadata lo marcan — una
//     corrida vieja jamás se exporta como si fuera vigente.

import { M5_FORBIDDEN_KEY_RE } from './contract.js'

export const CREDENTIAL_VALUE_RE = /(?:\bBearer\s+\S+|\b(?:password|passwd|api[_-]?key|token|secret)\s*[=:]\s*\S+|\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+)/i

/** Sanitiza recursivamente un valor para exportación (drop de claves sensibles). */
export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeForExport(item))
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, val] of Object.entries(value)) {
      if (M5_FORBIDDEN_KEY_RE.test(key)) continue // drop silencioso: jamás exporta
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

export const M5_CSV_COLUMNS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity',
  // Contrato epistémico: el veredicto es la lectura autoritativa, no el color.
  'verdict', 'classification', 'approved_threshold',
  // `universe_id` viaja junto a la etiqueta: quien abra el CSV en una hoja de
  // cálculo puede agrupar por universo sin parsear prosa, y sabe que "168 de
  // 752" y "39 de 584" NO comparten población.
  'universe_id', 'universe',
  'status', 'granularity', 'lifecycle_status', 'title', 'entity_type',
  'entity_reference', 'observed_value', 'expected_rule', 'numerator',
  'denominator', 'pct', 'incidences',
  // Sin company_id/branch_id: el contrato v1 no tiene esas dimensiones y ningún
  // hallazgo las porta (columnas siempre vacías = promesa incumplida).
  'responsible_area', 'owner_status', 'first_seen_at', 'last_seen_at',
  'occurrence_count', 'source_model', 'source_timestamp',
])

/** CSV de hallazgos (RFC-4180 básico + neutralización anti-fórmulas). */
export function findingsToCsv(findings = []) {
  const rows = [M5_CSV_COLUMNS.join(',')]
  for (const raw of Array.isArray(findings) ? findings : []) {
    const finding = sanitizeForExport(raw)
    rows.push(M5_CSV_COLUMNS.map((col) => {
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
    exported_schema: 'kold.os.m5.export/1',
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
    'KOLD OS · M5 — INVENTARIO Y FLUJO DE PRODUCTO (resumen ejecutivo)',
    '=================================================================',
    demo ? '⚠ ORIGEN: MODO DEMO (fixture emitido por el core real del backend GrupoVeniu/GrupoFrio#208; numeros reales medidos por XML-RPC, NO evidencia en vivo)' : 'ORIGEN: API autenticada gf_kold_os_m5',
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
    'M5 observa el flujo de producto: un indicador rojo es un resultado VÁLIDO del observatorio, no un fallo del sistema.',
    '',
    'QUÉ PRUEBA LA EVIDENCIA (lee los veredictos, no solo los colores):',
    ` - INCUMPLIMIENTOS (umbral APROBADO + supuesto verificado) : ${summary.definitive_incident_rule_count ?? 0} reglas · ${summary.definitive_incident_count ?? 0} incidencias`,
    ` - RIESGOS (supuesto declarado, no verificado)             : ${summary.warning_rule_count ?? 0} reglas · ${summary.warning_count ?? 0} incidencias`,
    ` - ANOMALÍAS (señalan, NO prueban)                        : ${summary.anomaly_rule_count ?? 0} reglas · ${summary.anomaly_count ?? 0} incidencias`,
    ` - CUMPLEN                                                 : ${summary.compliant_rule_count ?? 0} reglas`,
    ` - NO EVALUABLES (el contrato v1 no permite concluir)      : ${summary.not_evaluable_rule_count ?? 0} reglas`,
    `Total de incidencias: ${summary.total_incidences ?? 0} = suma exacta de incumplimientos + riesgos + anomalías (NO son entidades únicas).`,
    '',
    'LO MISMO POR CLASIFICACIÓN (otro EJE: qué tan sólida es la evidencia, no qué se concluye):',
    ` - definitive ${summary.classification_rule_counts?.definitive ?? '—'} · caveated ${summary.classification_rule_counts?.caveated ?? '—'} · exploratory ${summary.classification_rule_counts?.exploratory ?? '—'} · not_evaluable ${summary.classification_rule_counts?.not_evaluable ?? '—'}`,
    'OJO: "exploratory" es una CLASIFICACIÓN, no un veredicto. Una regla exploratoria',
    'cuya condición no se cumple queda en CUMPLE: por eso los dos conteos difieren.',
    `Historial: ${payload?.history?.runs_count ?? 0} corrida(s)`,
    '',
    'HALLAZGOS (rojo/ámbar):',
    ...(payload?.findings || []).map((f) =>
      ` - [${String(f.verdict || '').toUpperCase()}${f.approved_threshold ? '' : ' · UMBRAL NO APROBADO'}] ${f.rule_code} ${f.title}: ${f.observed_value} · área: ${f.responsible_area} · ciclo: ${f.lifecycle_status || 'new'} · granularidad: ${f.granularity}`),
    '',
    'M5 NO demuestra un cuadre físico: reporta SEÑALES de lo que los documentos declaran (ver capacidades no disponibles).',
    'M5 observa, no corrige. Cero writes. Generado client-side desde la API read-only.',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Export de DIFERENCIAS REPORTADAS: lo que el documento declara, en 3 niveles.
 *
 *  NIVEL 1 · señales reportadas      -> lo que la conciliación DECLARA.
 *  NIVEL 2 · cobertura de instrumentación -> cuánto de la realidad observamos.
 *  NIVEL 3 · capacidades no disponibles   -> lo que NO se puede afirmar.
 *
 *  Nunca dice "cuadra"/"no cuadra": `physical_reconciliation` es false.
 */
export function differencesText(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const rec = (payload?.metrics?.reconciliation_metrics || [])[0] || {}
  const line = (payload?.metrics?.reconciliation_line_metrics || [])[0] || {}
  const supp = (payload?.metrics?.supplemental_load_metrics || [])[0] || {}
  const out = (payload?.metrics?.outflow_metrics || [])[0] || {}
  const uomc = (payload?.metrics?.uom_category_metrics || [])[0] || {}
  const caps = payload?.capabilities?.features || {}
  const n = (v) => (v === null || v === undefined ? '—' : v)
  const lines = [
    'KOLD OS · M5 — DIFERENCIAS REPORTADAS EN CONCILIACIÓN',
    '=====================================================',
    demo ? '⚠ MODO DEMO (fixture del core real del backend; NO evidencia en vivo)' : 'API autenticada gf_kold_os_m5',
    run.is_production_shell_run !== true ? '⚠ EVIDENCIA NO FORMAL (sin corrida odoo-shell)' : 'EVIDENCIA FORMAL',
    `Ventana: [${run.scope?.window_start || '—'}, ${run.scope?.window_end_exclusive || '—'}) · corte ${run.finished_at || '—'}`,
    '',
    '── NIVEL 1 · SEÑALES REPORTADAS ─────────────────────────────────────────',
    'Cifras REPORTADAS por gf.dispatch.reconciliation. Un total declarado en un',
    'documento no es un hecho físico verificado.',
    '',
    `CONCILIACIONES FINALES (state=done) — las únicas que sostienen lectura: ${n(rec.recon_final_count)} de ${n(rec.recon_count)}`,
    ` - Cargado reportado    : ${n(rec.final_sum_loaded)}`,
    ` - Entregado reportado  : ${n(rec.final_sum_delivered)}`,
    ` - Devuelto reportado   : ${n(rec.final_sum_returned)}`,
    ` - Merma reportada      : ${n(rec.final_sum_scrap)}`,
    ` - Campo difference     : ${n(rec.final_sum_difference)}`,
    ` - Con difference ≠ 0   : ${n(rec.final_with_difference_count)} de ${n(rec.recon_final_count)}`,
    '',
    `CONCILIACIONES ABIERTAS — TRABAJO EN CURSO, sus cifras aún cambian: ${n(rec.recon_open_count)}`,
    ` - Cargado reportado    : ${n(rec.open_sum_loaded)}`,
    ` - Entregado reportado  : ${n(rec.open_sum_delivered)}`,
    ` - Con difference ≠ 0   : ${n(rec.open_with_difference_count)}`,
    'Mezclar abiertas con finales produce un "descuadre" que solo refleja captura pendiente.',
    '',
    `POR PRODUCTO (lo más fino que el documento permite, sin mezclar productos):`,
    ` - Líneas de conciliaciones finales   : ${n(line.final_line_count)}`,
    ` - Con difference ≠ 0                 : ${n(line.final_line_with_difference_count)}`,
    ` - Productos distintos                : ${n(line.final_product_groups)}`,
    '',
    '── NIVEL 2 · COBERTURA DE INSTRUMENTACIÓN ───────────────────────────────',
    `Aceptación de entrega confirmada : ${n(out.received_count)} de ${n(out.line_count)} líneas de salida`,
    `Planes con carga adicional       : ${n(supp.plans_with_supplemental_pickings)} de ${n(supp.plans_with_pickings)} (hasta ${n(supp.max_pickings_per_plan)} pickings)`,
    `Categorías de UOM conciliadas    : ${n(uomc.uom_category_count)} (1 = cantidades comparables como conteo)`,
    '',
    '── NIVEL 3 · CAPACIDADES NO DISPONIBLES ─────────────────────────────────',
    'Lo que esta corrida NO puede afirmar, y por qué:',
    ` - Cuadre físico integral      : ${caps.physical_reconciliation === false ? 'NO DISPONIBLE' : '—'} · no hay base física comparable (M5-G-08 = no evaluable)`,
    ` - Normalización por UOM       : ${caps.uom_normalized_reconciliation === false ? 'NO DISPONIBLE' : '—'} · las sumas no se normalizan`,
    ` - Aceptación de entrega       : ${caps.delivery_acceptance_confirmed === false ? 'NO DISPONIBLE' : '—'} · la recepción casi no se usa`,
    ` - Inventario por vehículo     : ${caps.vehicle_inventory === false ? 'NO DISPONIBLE' : '—'} · no existe el modelo`,
    ` - Atribución de carga adicional: ${caps.supplemental_load_attribution === false ? 'NO DISPONIBLE' : '—'} · entra por picking, no por el documento`,
    ` - Cobertura del modelo refill : ${caps.refill_model_coverage === false ? 'NO DISPONIBLE' : '—'} · van.refill.request no captura las recargas reales`,
    '',
    'Los umbrales de diferencia aceptable NO están aprobados: cada caso es señal exploratoria.',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Export del HANDOFF M5→M6/M7: lo que finanzas y rentabilidad deben consumir.
 *  M5 OBSERVA y entrega señal; no ejecuta conciliaciones ni calcula margen. */
export function handoffM5M6M7Text(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const rec = (payload?.metrics?.reconciliation_metrics || [])[0] || {}
  const wgt = (payload?.metrics?.weight_metrics || [])[0] || {}
  const lines = [
    'KOLD OS · M5 → M6/M7 — SEÑAL DEL FLUJO FÍSICO (handoff observado)',
    '==================================================================',
    demo ? '⚠ MODO DEMO (fixture del core real del backend; NO evidencia en vivo)' : 'API autenticada gf_kold_os_m5',
    run.is_production_shell_run !== true ? '⚠ EVIDENCIA NO FORMAL (sin corrida odoo-shell)' : 'EVIDENCIA FORMAL',
    `Ventana: [${run.scope?.window_start || '—'}, ${run.scope?.window_end_exclusive || '—'}) · corte ${run.finished_at || '—'}`,
    '',
    'PARA M6 (caja/cobranza/conciliación — módulo NO iniciado):',
    ` - Conciliaciones FINALES con difference reportado ≠ 0 : ${rec.final_with_difference_count ?? '—'} de ${rec.recon_final_count ?? '—'}`,
    ` - De ellas, con difference negativo                   : ${rec.final_negative_difference_count ?? '—'}`,
    ` - Suma del campo difference (señal REPORTADA)         : ${rec.final_sum_difference ?? '—'}`,
    '',
    'PARA M7 (rentabilidad — módulo NO iniciado):',
    ` - Paradas completadas                                 : ${wgt.executed_stop_count ?? '—'}`,
    ` - Con actual_kg PRESENTE (≠ pesaje verificado)        : ${wgt.executed_with_actual_kg_count ?? '—'}`,
    ` - Sin actual_kg (hueco para margen/kg)                : ${wgt.executed_missing_actual_kg_count ?? '—'}`,
    '',
    'M5 solo OBSERVA: no ejecuta conciliaciones financieras ni calcula margen.',
    'M6/M7 deben leer esto como SEÑAL REPORTADA, jamás como un cuadre demostrado.',
  ]
  return lines.join('\n')
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
