// ─── KOLD OS · M2 — Exportadores read-only (CSV / JSON / resumen) ────────────
// Client-side sobre el envelope validado. Defensa en profundidad:
//   · claves sensibles fuera + credenciales [REDACTED] (espejo del auditor);
//   · CSV: neutralización de formula injection (B7) — celdas que inician con
//     = + - @ (o tab/CR/LF) se prefijan con apóstrofo ANTES del escaping
//     RFC-4180, para que Excel/Sheets las traten como texto;
//   · STALE (B10): el nombre del archivo y la metadata lo marcan — una
//     corrida vieja jamás se exporta como si fuera vigente.

import { M2_FORBIDDEN_KEY_RE } from './contract.js'

export const CREDENTIAL_VALUE_RE = /(?:\bBearer\s+\S+|\b(?:password|passwd|api[_-]?key|token|secret)\s*[=:]\s*\S+|\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+)/i

/** Sanitiza recursivamente un valor para exportación (drop de claves sensibles). */
export function sanitizeForExport(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeForExport(item))
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, val] of Object.entries(value)) {
      if (M2_FORBIDDEN_KEY_RE.test(key)) continue // drop silencioso: jamás exporta
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

export const M2_CSV_COLUMNS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity', 'status', 'granularity',
  'lifecycle_status', 'title', 'entity_type', 'entity_reference',
  'observed_value', 'expected_rule', 'numerator', 'denominator', 'pct',
  'incidences', 'company_id', 'branch_id', 'responsible_area', 'owner_status',
  'first_seen_at', 'last_seen_at', 'occurrence_count', 'source_model',
  'source_timestamp',
])

/** CSV de hallazgos (RFC-4180 básico + neutralización anti-fórmulas). */
export function findingsToCsv(findings = []) {
  const rows = [M2_CSV_COLUMNS.join(',')]
  for (const raw of Array.isArray(findings) ? findings : []) {
    const finding = sanitizeForExport(raw)
    rows.push(M2_CSV_COLUMNS.map((col) => {
      const value = finding?.[col]
      return csvCell(Array.isArray(value) ? value.join('|') : value)
    }).join(','))
  }
  return rows.join('\n')
}

/** Sufijo de archivo según vigencia (B10): STALE va en el NOMBRE. */
export function exportFilename(base, ext, { stale = false, demo = false } = {}) {
  const marks = [demo ? 'DEMO' : '', stale ? 'STALE' : ''].filter(Boolean)
  return `${base}${marks.length ? `_${marks.join('_')}` : ''}.${ext}`
}

/** JSON de evidencia: envelope completo + metadata de exportación. */
export function evidenceJson(payload, extra = {}) {
  return JSON.stringify(sanitizeForExport({
    exported_schema: 'kold.os.m2.export/1',
    export_meta: {
      stale: payload?.stale === true,
      age_days: payload?.age_days ?? null,
      technical_state: payload?.run?.technical_state || null,
      ...extra,
    },
    envelope: payload,
  }), null, 2)
}

/** Resumen ejecutivo imprimible (texto plano). */
export function executiveSummaryText(payload, { demo = false } = {}) {
  const run = payload?.run || {}
  const summary = payload?.summary || {}
  const lines = [
    'KOLD OS · M2 — PLANEACIÓN Y READINESS (resumen ejecutivo)',
    '========================================================',
    demo ? '⚠ ORIGEN: MODO DEMO (fixture generado por código real; NO evidencia en vivo)' : 'ORIGEN: API autenticada gf_kold_os_m2',
    payload?.stale ? `⚠ CORRIDA STALE: ${payload?.age_days ?? '?'} días de antigüedad (no vigente)` : 'Corrida vigente',
    '',
    `Corte de auditoría : ${run.finished_at || '—'}`,
    `Ambiente           : ${run.environment || '—'}`,
    `Ventana            : últimos ${run.scope?.window_days ?? '—'} días`,
    `Compañías (scope)  : ${(run.scope?.company_ids || []).join(', ') || '—'}`,
    `Duración           : ${run.duration_ms ?? '—'} ms · consultas ${(run.executed_queries || []).length}`,
    `Auditor (build)    : ${run.build_sha || '—'}`,
    `Manifest sha256    : ${run.manifest_sha256 || '—'}`,
    `Evidencia sha256   : ${run.evidence_sha256 || '—'}`,
    '',
    `ESTADO TÉCNICO DEL AUDITOR : ${run.technical_state || '—'}`,
    `ESTADO OPERATIVO DE DATOS  : ${summary.overall_status || '—'}`,
    'M2 está funcionando y detectó incumplimientos: un indicador rojo es un resultado VÁLIDO del observatorio, no un fallo del sistema.',
    '',
    `Reglas evaluadas       : ${summary.total_rules ?? 0} (verde ${summary.rules_pass ?? 0} · ámbar ${summary.rules_warning ?? 0} · rojo ${summary.rules_fail ?? 0} · no evaluable ${summary.rules_not_evaluable ?? 0})`,
    `Incidencias detectadas : ${summary.total_incidences ?? 0} (NO son entidades únicas: una misma entidad puede participar en varias reglas; deduplicar exige IDs reales = contrato v1.1)`,
    `Historial              : ${payload?.history?.runs_count ?? 0} corrida(s)`,
    '',
    'HALLAZGOS (rojo/ámbar):',
    ...(payload?.findings || []).map((f) =>
      ` - [${f.status}] ${f.rule_code} ${f.title}: ${f.observed_value} · área: ${f.responsible_area} · ciclo: ${f.lifecycle_status || 'new'} · granularidad: ${f.granularity}`),
    '',
    'M2 observa, no corrige. Cero writes. Generado client-side desde la API read-only.',
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
