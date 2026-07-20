// ─── Day Control · Vista PURA de la home de operaciones ──────────────────────
// Componente de PRESENTACIÓN sin efectos, sin fetch, sin window ni hooks: recibe
// los payloads del contrato (day_control/1 + radar/1) por props y los renderiza
// vía los helpers PUROS de ./presentation.js. Por ser puro es SSR-testeable con
// el fixture directo. Reglas duras heredadas del contrato:
//   · null/ausente ≠ 0 → se nombra "Sin dato" (jamás $0 inventado);
//   · la moneda viene del contrato (nunca se asume MXN);
//   · enum desconocido → estado neutral explícito (nunca crash, nunca verde);
//   · datos de DEMO (source='demo') → banner sintético visible.
import { TOKENS } from '../../../tokens'
import {
  operationalDateLabel,
  timezoneSourceLabel,
  journeyBuckets,
  departureLabel,
  departureTone,
  deviationText,
  moneyText,
  moneyByCurrencyTexts,
  groupPriorities,
  priorityCountChip,
  closeStageLabel,
  CLOSE_STAGE_ORDER,
  signalLabel,
  safeSignalStatus,
  ageText,
  radarSummary,
} from './presentation.js'

const C = TOKENS.colors
const S = TOKENS.state

// Tono abstracto de presentation.js → token visual concreto.
const TONE = {
  ok: { fg: C.success, bg: C.successSoft, border: 'rgba(34,197,94,0.34)' },
  risk: S.risk,
  neutral: S.no_evaluable,
}
function toneStyle(tone) {
  return TONE[tone] || S.no_evaluable
}

const SEVERITY_ORDER = ['critical', 'warning', 'info']
const SEVERITY_META = {
  critical: { tone: S.incumplimiento, word: 'Críticas' },
  warning: { tone: S.risk, word: 'Advertencias' },
  info: { tone: S.info, word: 'Informativas' },
}

function Card({ children, testid, style }) {
  return (
    <section
      data-testid={testid}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: TOKENS.radius.lg, padding: '16px 18px', marginBottom: 14, ...style,
      }}
    >
      {children}
    </section>
  )
}

function CardTitle({ children }) {
  return <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: '0 0 10px', letterSpacing: 0.2 }}>{children}</h2>
}

function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`,
    }}>{text}</span>
  )
}

// ── Venta del día: consolidada (una moneda) o listada por moneda ──────────────
function SalesBlock({ summary, capabilities }) {
  const consolidated = capabilities?.sales_consolidated !== false
  if (consolidated) {
    const m = moneyText(summary?.sales_day_amount, summary?.sales_day_currency, summary?.sales_day_available !== false)
    return (
      <div data-testid="dc-sales" style={{ fontSize: 22, fontWeight: 800, color: m.available ? C.text : C.textMuted }}>
        {m.text}
      </div>
    )
  }
  const texts = moneyByCurrencyTexts(summary?.sales_day_by_currency)
  return (
    <div data-testid="dc-sales" data-multicurrency="true">
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Venta por moneda (sin consolidar):</div>
      {texts.length === 0
        ? <div style={{ fontSize: 14, color: C.textMuted }}>Sin dato</div>
        : texts.map((t, i) => (
          <div key={i} style={{ fontSize: 17, fontWeight: 700, color: t.available ? C.text : C.textMuted }}>{t.text}</div>
        ))}
    </div>
  )
}

function JourneyBlock({ summary }) {
  const b = journeyBuckets(summary)
  const items = [
    { k: 'Rutas', v: b.total, tone: S.info },
    { k: 'Salieron', v: b.departed, tone: TONE.ok },
    { k: 'Tarde', v: b.late, tone: S.risk },
    { k: 'Sin salir', v: b.notDeparted, tone: S.risk },
    { k: 'Sin dato', v: b.unknown, tone: S.no_evaluable },
  ]
  return (
    <div data-testid="dc-journey" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <div key={it.k} style={{
          flex: '1 1 88px', minWidth: 88, textAlign: 'center', padding: '10px 8px',
          background: C.surfaceSoft, border: `1px solid ${it.tone.border || C.border}`, borderRadius: TOKENS.radius.md,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: it.tone.fg || C.text }}>{it.v}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{it.k}</div>
        </div>
      ))}
    </div>
  )
}

function PrioritiesBlock({ priorities }) {
  const groups = groupPriorities(priorities)
  const total = (priorities || []).length
  if (total === 0) {
    return <div data-testid="dc-priorities-empty" style={{ fontSize: 13, color: C.textMuted }}>Sin pendientes marcados en este momento.</div>
  }
  return (
    <div data-testid="dc-priorities">
      {SEVERITY_ORDER.map((sev) => {
        const list = groups[sev] || []
        if (list.length === 0) return null
        const meta = SEVERITY_META[sev]
        return (
          <div key={sev} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Chip text={`${meta.word} · ${list.length}`} tone={meta.tone} />
            </div>
            {list.map((p, i) => {
              const chip = priorityCountChip(p)
              return (
                <div key={i} data-testid="dc-priority-item" style={{
                  display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 13, color: C.textSoft, flex: 1 }}>{p?.reason || 'Pendiente sin descripción'}</span>
                  {chip.show && <Chip text={chip.text} tone={meta.tone} />}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function CloseBlock({ summary }) {
  const close = summary?.close || {}
  const cash = moneyText(close.cash_pending_amount, close.cash_pending_currency, true)
  return (
    <div data-testid="dc-close">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {CLOSE_STAGE_ORDER.map((stage) => (
          <Chip key={stage} text={`${closeStageLabel(stage)}: ${close[stage] ?? 0}`} tone={S.no_evaluable} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted }}>
        Caja pendiente: <span style={{ color: cash.available ? C.warning : C.textMuted, fontWeight: 700 }}>{cash.text}</span>
      </div>
    </div>
  )
}

function RadarBlock({ radar, radarError, nowMs }) {
  if (radarError) {
    return <div data-testid="dc-radar-error" style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible: {radarError}</div>
  }
  if (!radar) {
    return <div data-testid="dc-radar-empty" style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible en esta carga.</div>
  }
  const units = radar.units || []
  const sum = radarSummary(units, nowMs)
  return (
    <div data-testid="dc-radar">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip text={`Con señal: ${sum.withSignal}`} tone={S.signal} />
        <Chip text={`Sin señal: ${sum.withoutSignal}`} tone={S.no_evaluable} />
        <Chip text={`Unidades: ${sum.total}`} tone={S.info} />
      </div>
      {units.map((u, i) => {
        const safe = safeSignalStatus(u, nowMs)
        return (
          <div key={i} data-testid="dc-radar-unit" style={{
            display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 13, color: C.textSoft, flex: 1 }}>{u?.route_name || 'Ruta sin nombre'}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{ageText(u?.age_seconds)}</span>
            <Chip text={signalLabel(safe)} tone={safe === 'recent' || safe === 'delayed' ? S.signal : S.no_evaluable} />
          </div>
        )
      })}
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
        Posiciones del dispositivo del responsable; no es tiempo real (ver hora de captura).
      </div>
    </div>
  )
}

export default function OperationsHomeView({
  dayControl, radar = null, radarError = null, source = 'live', provenance = null, nowMs = null,
  testid = 'supervisor-operations-home',
}) {
  const dc = dayControl || {}
  const summary = dc.summary || {}
  const caps = dc.capabilities || {}
  const isDemo = source === 'demo'

  return (
    <div data-testid={testid} data-source={source} style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32 }}>
      {isDemo && (
        <div data-testid="dc-demo-banner" role="note" style={{
          fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)',
          border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 14,
        }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
          {provenance?.source ? ` (${provenance.source})` : ''}
        </div>
      )}

      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>Día operativo</h1>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span data-testid="dc-date">{operationalDateLabel(dc.date)}</span>
          {dc.branch?.name && <span>· {dc.branch.name}</span>}
          <span>· {timezoneSourceLabel(dc.timezone_source)}</span>
        </div>
      </header>

      <Card testid="dc-card-sales">
        <CardTitle>Venta del día</CardTitle>
        <SalesBlock summary={summary} capabilities={caps} />
      </Card>

      <Card testid="dc-card-journey">
        <CardTitle>Jornada de rutas</CardTitle>
        <JourneyBlock summary={summary} />
      </Card>

      <Card testid="dc-card-priorities">
        <CardTitle>Pendientes prioritarios</CardTitle>
        <PrioritiesBlock priorities={dc.priorities} />
      </Card>

      <Card testid="dc-card-close">
        <CardTitle>Cierre de rutas</CardTitle>
        <CloseBlock summary={summary} />
      </Card>

      <Card testid="dc-card-radar">
        <CardTitle>Radar de unidades</CardTitle>
        <RadarBlock radar={radar} radarError={radarError} nowMs={nowMs} />
      </Card>
    </div>
  )
}
