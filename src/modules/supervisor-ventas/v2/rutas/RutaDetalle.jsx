// ─── Supervisor V2 · Detalle de ruta (vista PURA — línea de tiempo 14 hitos) ──
// deriveRouteTimeline(route, capabilities). Estados por forma+texto (no solo
// color): done ✓ · pending ○ · unknown — · not_available ∅. unknown/faltante
// NUNCA es incumplimiento. Declara validated ≠ recepción física.
import { TOKENS } from '../../../../tokens'
import { deriveRouteTimeline, departureLabel, closeStageLabel } from '../presentation.js'

const C = TOKENS.colors
const S = TOKENS.state

const STATUS_GLYPH = { done: '✓', pending: '○', unknown: '—', not_available: '∅' }
const STATUS_TONE = {
  done: { fg: C.success }, pending: { fg: C.warning }, unknown: { fg: C.textMuted }, not_available: { fg: C.textMuted },
}

function StopRow({ st }) {
  const visited = st?.state === 'done' || st?.has_checkin || st?.actual_end_time
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 11, color: C.textMuted, width: 22 }}>{st?.sequence ?? '·'}</span>
      <span style={{ fontSize: 12.5, color: C.textSoft, flex: 1 }}>{st?.name || 'Cliente'}</span>
      <span style={{ fontSize: 11, color: visited ? C.success : C.textMuted }}>{visited ? (st?.result_status || 'visitado') : 'pendiente'}</span>
    </div>
  )
}

export default function RutaDetalle({
  route, capabilities = {}, stops = null, stopsError = null, source = 'live', onBack, testid = 'supervisor-v2-ruta-detalle',
}) {
  const r = route || {}
  const timeline = deriveRouteTimeline(r, capabilities)
  const isDemo = source === 'demo'
  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {onBack && <button type="button" onClick={onBack} aria-label="Volver" style={{ fontSize: 13, color: C.blue3, cursor: 'pointer', border: `1px solid ${C.borderBlue}`, borderRadius: TOKENS.radius.pill, padding: '4px 12px' }}>← Rutas</button>}
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{r.route_name || 'Ruta'}</h1>
      </div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14 }}>
        {r.driver?.name || 'Sin responsable'} · {r.vehicle?.name || 'Sin unidad'} · {departureLabel(r.departure?.status)} · {closeStageLabel(r.close?.stage)}
      </div>

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px', marginBottom: 14 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: '0 0 10px' }}>Línea de tiempo de la ruta</h2>
        {timeline.map((step, i) => {
          const g = STATUS_GLYPH[step.status] || '—'
          const tone = STATUS_TONE[step.status] || STATUS_TONE.unknown
          return (
            <div key={step.key} data-testid="v2-timeline-step" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <span aria-hidden style={{ fontSize: 14, fontWeight: 800, color: tone.fg, width: 18, textAlign: 'center' }}>{g}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textSoft }}>{step.label}</div>
                {step.detail && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{step.detail}</div>}
              </div>
            </div>
          )
        })}
      </section>

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px' }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: '0 0 8px' }}>Paradas</h2>
        {stopsError ? <div data-testid="v2-ruta-stops-error" style={{ fontSize: 13, color: C.textMuted }}>Paradas no disponibles: {stopsError}</div>
          : stops == null ? <div style={{ fontSize: 13, color: C.textMuted }}>Paradas no cargadas.</div>
          : stops.length === 0 ? <div style={{ fontSize: 13, color: C.textMuted }}>Sin paradas registradas.</div>
          : stops.map((st, i) => <StopRow key={st?.stop_id ?? i} st={st} />)}
      </section>
    </div>
  )
}
