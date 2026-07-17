// ─── ModuleHeader — encabezado común de módulo (Etapa 0A) ────────────────────
// Capa 1: título · estado del dato en lenguaje claro · periodo · compañías · alcance
// · salvedades de DECISIÓN · frescura. La telemetría forense y el auditor bajan a
// EvidenceSection. Recibe un objeto PresentationMeta (readMxPresentationMeta), no
// seis payloads ad-hoc. No inventa copy: un campo ausente muestra su estado.
import { TOKENS, COMPANY_LABELS } from '../../tokens'
import DataFreshness from './DataFreshness'
import EvidenceSection from './EvidenceSection'

const C = TOKENS.colors

// overall_status técnico → palabra clara de capa 1 (el valor técnico va a Evidencia).
const STATUS_WORD = {
  RED: { word: 'Requieren atención', tone: TOKENS.state.incumplimiento },
  AMBER: { word: 'Con observaciones', tone: TOKENS.state.risk },
  GREEN: { word: 'Sin alertas', tone: TOKENS.state.info },
}

function fmtPeriod(period) {
  if (!period) return null
  if (period.kind === 'range') return `${period.start || '—'} → ${period.endExclusive || '—'}`
  if (period.kind === 'days') return `últimos ${period.days} días`
  return null
}

function companiesLabel(ids) {
  if (!ids || ids.length === 0) return null
  return ids.map((id) => COMPANY_LABELS[id] || `#${id}`).join(' · ')
}

export default function ModuleHeader({ meta, title, subtitle, staleAfterHours = null, nowMs, testid = 'kold-module-header' }) {
  const m = meta || {}
  const statusInfo = m.status ? (STATUS_WORD[m.status] || { word: m.status, tone: TOKENS.state.no_evaluable }) : null
  const period = fmtPeriod(m.period)
  const companies = companiesLabel(m.companies)

  return (
    <header data-testid={testid} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>{title || m.title || '—'}</h1>
        {statusInfo && (
          <span data-testid="kold-status-chip" style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: TOKENS.radius.pill,
            color: statusInfo.tone.fg, background: statusInfo.tone.bg, border: `1px solid ${statusInfo.tone.border}`,
          }}>Datos: {statusInfo.word}</span>
        )}
      </div>

      {subtitle && <div style={{ fontSize: 12, color: C.textLow, marginTop: 3 }}>{subtitle}</div>}

      {/* Línea de alcance (capa 1): periodo · compañías · sucursal. Sin jerga. */}
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {period && <span>{period}</span>}
        {companies && <span>· {companies}</span>}
        {m.branchScope && <span>· {m.branchScope}</span>}
      </div>

      {/* Frescura (canal propio, descriptivo en 0A) + salvedades de DECISIÓN. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        <DataFreshness dataAsOf={m.dataAsOf} staleAfterHours={staleAfterHours} nowMs={nowMs} source={m.source} />
        {(m.decisionCaveats || []).map((cav, i) => (
          <span key={i} data-testid="kold-decision-caveat" style={{
            fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: TOKENS.radius.pill,
            color: TOKENS.state.risk.fg, background: TOKENS.state.risk.bg, border: `1px solid ${TOKENS.state.risk.border}`,
          }}>⚠ {cav}</span>
        ))}
      </div>

      {/* Evidencia técnica (colapsada): auditor + telemetría + hashes. */}
      <EvidenceSection evidence={m.technicalEvidence} auditor={m.auditor} source={m.source} />
    </header>
  )
}
