// ─── KOLD OS · M2 — Exportadores read-only (CSV / JSON / resumen) ────────────
// Todo se genera client-side a partir del run validado. Antes de exportar se
// aplica una sanitización defensa-en-profundidad (el auditor YA sanitiza, pero
// el exportador nunca confía: claves sensibles fuera, texto credencial fuera).

import { M2_FORBIDDEN_KEY_RE } from './contract.js'

// Espejo del patrón de credenciales del auditor.
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

const csvCell = (value) => {
  const raw = value === null || value === undefined ? '' : String(value)
  const clean = (CREDENTIAL_VALUE_RE.test(raw) ? '[REDACTED]' : raw).replace(/\r?\n/g, ' ')
  return /[",;]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean
}

export const M2_CSV_COLUMNS = Object.freeze([
  'finding_id', 'rule_code', 'category', 'severity', 'status', 'lifecycle_status',
  'title', 'entity_type', 'entity_reference', 'observed_value', 'expected_rule',
  'numerator', 'denominator', 'pct', 'company_scope', 'responsible_area',
  'owner_status', 'first_seen_at', 'last_seen_at', 'occurrence_count',
  'source_model', 'source_timestamp',
])

/** CSV de hallazgos (separador coma, RFC-4180 básico). */
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

/** JSON de evidencia: run completo + hallazgos derivados, sanitizado. */
export function evidenceJson(report, derived, extra = {}) {
  return JSON.stringify(sanitizeForExport({
    exported_schema: 'kold.tower.m2.export/1',
    run: report,
    derived: {
      summary: derived?.summary || null,
      findings: derived?.findings || [],
    },
    ...extra,
  }), null, 2)
}

/** Resumen ejecutivo imprimible (texto plano). */
export function executiveSummaryText(report, derived) {
  const s = derived?.summary || {}
  const lines = [
    'KOLD OS · M2 — PLANEACIÓN Y READINESS (resumen ejecutivo)',
    '========================================================',
    `Corte de auditoría : ${report?.finished_at || '—'}`,
    `Base de datos      : ${report?.environment || '—'}`,
    `Ventana            : últimos ${report?.scope?.window_days ?? '—'} días`,
    `Compañías (scope)  : ${(report?.scope?.company_ids || []).join(', ') || '—'}`,
    `Duración           : ${report?.duration_ms ?? '—'} ms · consultas ${(report?.executed_queries || []).length}/13`,
    `Auditor (build)    : ${report?.build_sha || '—'}`,
    `Manifest sha256    : ${report?.manifest_sha256 || '—'}`,
    `Evidencia sha256   : ${report?.evidence_sha256 || '—'}`,
    '',
    `ESTADO TÉCNICO DEL AUDITOR : ${report?.status || '—'} (read-only=${report?.transaction_read_only}, write-block=${report?.write_blocked}, rollback=${report?.rollback_confirmed})`,
    `ESTADO OPERATIVO DE DATOS  : ${s.overall_status || '—'}`,
    'M2 está funcionando y detectó incumplimientos: un indicador rojo es un resultado VÁLIDO del observatorio, no un fallo del sistema.',
    '',
    `Reglas evaluadas   : ${s.total_rules ?? 0} (verde ${s.rules_pass ?? 0} · ámbar ${s.rules_warning ?? 0} · rojo ${s.rules_fail ?? 0} · no evaluable ${s.rules_not_evaluable ?? 0})`,
    `Registros afectados: ${s.total_affected_records ?? 0} (agregado del scope; atribución por sucursal = contrato v1.1)`,
    '',
    'HALLAZGOS (rojo/ámbar):',
    ...(derived?.findings || []).map((f) =>
      ` - [${f.status}] ${f.rule_code} ${f.title}: ${f.observed_value} · área: ${f.responsible_area} · ciclo: ${f.lifecycle_status || 'new'}`),
    '',
    'M2 observa, no corrige. Cero writes. Generado client-side desde la evidencia del auditor.',
  ]
  return sanitizeForExport(lines.join('\n'))
}

/** Dispara la descarga de un blob en el navegador (sin red, sin writes). */
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
