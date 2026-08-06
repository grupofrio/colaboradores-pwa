// ─── Supervisor V2 · Detalle de ruta (vista PURA) ────────────────────────────
// Resumen de actividades (entrada del checador · primera visita · brecha ·
// clientes por hora) + línea de tiempo + paradas ENRIQUECIDAS (duración de
// visita, hueco de trayecto, importe de venta, marca de visita sospechosa).
// Estados por forma+texto (no solo color). Tema CLARO de marca. null≠0: "—".
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { deriveRouteTimeline, departureLabel, closeStageLabel } from '../presentation.js'
import { isVisited, noSaleReasonDisplay, stopResultLabel } from './stopLabels'
import {
  centerTime, durationLabel, gapLabel, travelGaps, visitsByHour, isSuspicious, isSale,
} from './rutaDetalleModel'
import { buildBars, hasSeries, fmtMoney } from '../../kpis/kpisModel'

const C = TOKENS.colors

const STATUS_GLYPH = { done: '✓', pending: '○', unknown: '—', not_available: '∅' }
const STATUS_TONE = {
  done: { fg: C.success }, pending: { fg: C.warning }, unknown: { fg: C.textMuted }, not_available: { fg: C.textMuted },
}

// Mini barras "clientes por hora" (reusa buildBars puro de KPIs).
function HourBars({ stops }) {
  const series = visitsByHour(stops)
  if (!hasSeries(series)) {
    return <div style={{ fontSize: 11.5, color: C.textMuted }}>Sin horas de visita registradas.</div>
  }
  const bars = buildBars(series, { maxHeight: 54 })
  return (
    <div data-testid="ruta-hour-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 76, paddingTop: 14 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.text }}>{b.valueText}</span>
          <div role="img" aria-label={`${b.label}: ${b.valueText}`} style={{ width: '100%', height: b.height, background: C.blue, borderRadius: '3px 3px 0 0', minHeight: 3 }} />
          <span style={{ fontSize: 9, color: C.textMuted, whiteSpace: 'nowrap' }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function ResumenActividades({ planSummary, stops }) {
  const ps = planSummary || {}
  const entrada = centerTime(ps.seller_check_in)
  const primera = centerTime(ps.first_visit)
  const brecha = gapLabel(ps.start_gap_min)
  const cards = [
    ['Entrada (checador)', entrada],
    ['Primera visita', primera],
    ['Arranque', brecha === '—' ? '—' : `tardó ${brecha}`],
  ]
  return (
    <section data-testid="ruta-resumen" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px', marginBottom: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: '0 0 10px' }}>Resumen de actividades</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {cards.map(([label, val]) => (
          <div key={label} style={{ flex: '1 1 30%', minWidth: 96, background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: val === '—' ? C.textMuted : C.text, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
      {ps.attendance_available === false && (
        <div style={{ fontSize: 11, color: C.textLow, marginTop: 6 }}>Sin fuente de asistencia (checador) en este entorno.</div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, margin: '12px 0 2px' }}>Clientes visitados por hora</div>
      <HourBars stops={stops} />
    </section>
  )
}

function StopRow({ st, gap }) {
  const visited = isVisited(st)
  const motivo = noSaleReasonDisplay(st)
  const suspicious = isSuspicious(st)
  const start = centerTime(st?.actual_start_time)
  const dur = durationLabel(st?.visit_duration_min)
  const travel = st?.actual_start_time ? gapLabel(gap) : '—'
  const showSale = isSale(st) && st?.sale_amount != null
  return (
    <div style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: C.textMuted, width: 22 }}>{st?.sequence ?? '·'}</span>
        <span style={{ fontSize: 12.5, color: C.textSoft, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st?.name || 'Cliente'}</span>
        {suspicious && (
          <span data-testid="ruta-stop-suspect" title="Visita <1 min y check-in lejos" style={{ fontSize: 10, fontWeight: 700, color: C.warning, background: C.warningSoft, border: '1px solid rgba(180,83,9,0.3)', borderRadius: TOKENS.radius.pill, padding: '1px 7px', whiteSpace: 'nowrap' }}>⚠ revisar</span>
        )}
        <span data-testid="v2-stop-state" style={{ fontSize: 11, color: visited ? C.success : C.textMuted, whiteSpace: 'nowrap' }}>{stopResultLabel(st)}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 30, marginTop: 3, fontSize: 11, color: C.textMuted }}>
        {start !== '—' && <span data-testid="ruta-stop-start">🕒 {start}</span>}
        <span data-testid="ruta-stop-duration">Visita: {dur}</span>
        <span data-testid="ruta-stop-travel">Trayecto: {travel}</span>
        {showSale && <span data-testid="ruta-stop-sale" style={{ color: C.success, fontWeight: 700 }}>Venta: {fmtMoney(st.sale_amount, 'MXN')}</span>}
        {motivo.show && (
          <span data-testid="v2-stop-reason" style={{ fontStyle: motivo.missing ? 'italic' : 'normal', color: motivo.missing ? C.textMuted : C.textSoft }}>
            {motivo.text}
          </span>
        )}
      </div>
    </div>
  )
}

export default function RutaDetalle({
  route, capabilities = {}, stops = null, planSummary = null, stopsError = null, source = 'live', onBack, testid = 'supervisor-v2-ruta-detalle',
}) {
  const r = route || {}
  const timeline = deriveRouteTimeline(r, capabilities)
  const isDemo = source === 'demo'
  const gaps = travelGaps(stops)
  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.32)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {onBack && <button type="button" onClick={onBack} aria-label="Volver" style={{ fontSize: 13, color: C.blue3, cursor: 'pointer', border: `1px solid ${C.borderBlue}`, borderRadius: TOKENS.radius.pill, padding: '4px 12px' }}>← Rutas</button>}
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{r.route_name || 'Ruta'}</h1>
      </div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14 }}>
        {r.driver?.name || 'Sin responsable'} · {r.vehicle?.name || 'Sin unidad'} · {departureLabel(r.departure?.status)} · {closeStageLabel(r.close?.stage)}
      </div>

      {/* Resumen de actividades — la "primera parte" de abrir ruta. */}
      <ResumenActividades planSummary={planSummary} stops={stops || []} />

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
          : stops.map((st, i) => <StopRow key={st?.stop_id ?? i} st={st} gap={gaps[st?.stop_id ?? `i${i}`]} />)}
      </section>
    </div>
  )
}
