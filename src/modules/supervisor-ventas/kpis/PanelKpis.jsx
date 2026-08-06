// ─── Panel de KPIs v2 (EMBUDO) del supervisor · tema claro ───────────────────
// Rediseño v2 (mockup kpis_final_c_v2.html, Opción C): el embudo HORIZONTAL
// Agendados → Visitados → Compraron es el protagonista; abajo, venta del período
// (delta de "Hoy" etiquetado "parcial", no como caída), compradores por día
// (barras ETIQUETADAS) y calidad de ejecución. Prospección se retira hasta la
// fase 2. Solo `supervisor_ventas`; otros roles no pasan por aquí. Sin números
// escritos a mano: lo que no viene del backend dice "Sin dato".
import { useCallback, useEffect, useState } from 'react'

import { BRAND_TOKENS as T } from '../../../theme/brandTokens'
import StateScreen from '../../../components/kold/StateScreen'
import { getSupervisorKpis } from '../api'
import {
  NO_DATA, PERIODS, fmtInt, fmtMoney,
  buildFunnel, deltaView, buildBars, hasSeries, buildQuality,
  qualityHighRatioNote, periodLabel, periodRangeText,
  collectionPercentageLabels,
} from './kpisModel'

const C = T.colors
const TONE_COLOR = { good: C.success, watch: C.warning, bad: C.error, unknown: C.textMuted }

function PeriodSwitcher({ value, onChange, busy }) {
  return (
    <div
      role="tablist" aria-label="Período" data-testid="kpis-period-switcher"
      style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 999,
        background: C.surfaceStrong, border: `1px solid ${C.border}`,
      }}
    >
      {PERIODS.map((p) => {
        const active = p.key === value
        return (
          <button
            key={p.key} type="button" role="tab" aria-selected={active}
            disabled={busy} onClick={() => onChange(p.key)}
            data-testid={`kpis-period-${p.key}`}
            style={{
              flex: 1, cursor: busy ? 'wait' : 'pointer', border: 'none',
              padding: '8px 14px', minHeight: 40, borderRadius: 999,
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: active ? C.blue : 'transparent',
              color: active ? '#FFFFFF' : C.textMuted,
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

function Card({ children, testid, style }) {
  return (
    <div
      data-testid={testid}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: '16px', boxShadow: '0 1px 2px rgba(15,42,61,0.05)', ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted, margin: '4px 2px' }}>
      {children}
    </div>
  )
}

// ── 1 · Embudo ───────────────────────────────────────────────────────────────
function FunnelCircle({ circle }) {
  const d = circle.diameter
  const sinDato = circle.value == null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        data-testid={`funnel-circle-${circle.key}`}
        style={{
          width: d, height: d, borderRadius: '50%', flexShrink: 0,
          background: sinDato ? C.surfaceStrong : 'rgba(0,119,187,0.10)',
          border: `2px solid ${sinDato ? C.border : C.blue}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span data-testid={`funnel-value-${circle.key}`} style={{ fontSize: Math.max(16, Math.round(d * 0.24)), fontWeight: 800, color: sinDato ? C.textMuted : C.text, letterSpacing: '-0.02em' }}>
          {sinDato ? NO_DATA : fmtInt(circle.value)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>{circle.label}</span>
      </div>
    </div>
  )
}

// Conector entre círculos: flecha + pill (caída %, palabra de estado). La flecha
// es → en fila (pantalla amplia) y ↓ al apilar, vía CSS.
function DropPill({ drop }) {
  const color = TONE_COLOR[drop.tone] || C.textMuted
  const pct = drop.pct == null ? NO_DATA : `${drop.pct}%`
  return (
    <div className="kpis-drop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden="true" className="kpis-arrow" style={{ color: C.textLow, fontSize: 16 }} />
      <span
        data-testid={`funnel-drop-${drop.key}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: C.surface, border: `1px solid ${color}`, color: C.text, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: C.textMuted, fontWeight: 600 }}>{drop.label}</span>
        <b>{pct}</b>
        {/* Semáforo con PALABRA + ícono, nunca color solo. */}
        <span style={{ color, fontWeight: 700 }}>{drop.toneIcon} {drop.toneWord}</span>
      </span>
    </div>
  )
}

// Embudo HORIZONTAL (mockup Opción C): Agendados → [Cobertura] → Visitados →
// [Conversión] → Compraron, en fila con diámetros proporcionales. Se apila antes
// de que el contenido pueda envolverse en dos filas. Semáforo en palabra.
function Funnel({ payload }) {
  const f = buildFunnel(payload)
  return (
    <Card testid="funnel">
      <style>{`
        .kpis-funnel{display:flex;flex-direction:row;align-items:center;justify-content:space-around;gap:6px;flex-wrap:nowrap}
        .kpis-arrow::before{content:"\\2192"}
        @media (max-width:900px){
          .kpis-funnel{flex-direction:column;gap:2px}
          .kpis-arrow::before{content:"\\2193"}
        }
      `}</style>
      <div className="kpis-funnel" data-testid="funnel-row">
        <FunnelCircle circle={f.circles[0]} />
        <DropPill drop={f.drops[0]} />
        <FunnelCircle circle={f.circles[1]} />
        <DropPill drop={f.drops[1]} />
        <FunnelCircle circle={f.circles[2]} />
      </div>
      <div data-testid="funnel-closing" style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'center' }}>
        {f.closing}
      </div>
    </Card>
  )
}

// ── 2 · Venta del período (fila de 3) ────────────────────────────────────────
function DeltaChip({ delta, period }) {
  const v = deltaView(delta, period)
  // En "Hoy" el comparativo es parcial: se muestra neutro, no como caída roja.
  if (v.partial) return <span data-testid="delta-partial" style={{ fontSize: 11, fontWeight: 600, color: C.textLow }}>{v.text}</span>
  if (!v.show) return <span style={{ fontSize: 11, color: C.textLow }}>{v.text}</span>
  return (
    <span data-testid="delta-chip" style={{ fontSize: 11, fontWeight: 700, color: TONE_COLOR[v.tone] }}>{v.text}</span>
  )
}

function SalesRow({ payload, period }) {
  const sales = payload?.kpis?.sales || {}
  const coll = payload?.kpis?.collection || {}
  const cur = sales.currency || coll.currency || null
  const cashPct = typeof coll.cash_pct === 'number' ? coll.cash_pct : null
  const labels = collectionPercentageLabels(cashPct)
  const creditPct = labels == null ? null : Math.round((100 - cashPct) * 10) / 10
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      <Card testid="sales-total" style={{ padding: '14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>Venta del período</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 4 }}>{fmtMoney(sales.total, cur)}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          {typeof sales.orders === 'number' ? `${fmtInt(sales.orders)} pedidos · ticket ${fmtMoney(sales.avg_ticket, cur)}` : 'Sin pedidos'}
        </div>
        <div style={{ marginTop: 6 }}><DeltaChip delta={payload?.sales_delta} period={period} /></div>
      </Card>

      <Card testid="sales-collection" style={{ padding: '14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>Cómo se cobró</div>
        {labels == null ? (
          <div style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>{NO_DATA}</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, minHeight: 12, fontSize: 10, fontWeight: 700, color: C.textMuted }}>
              {labels.cash.outside ? (
                <span data-testid="collection-cash-outside-label">{labels.cash.outside}</span>
              ) : <span />}
              {labels.credit.outside ? (
                <span data-testid="collection-credit-outside-label">{labels.credit.outside}</span>
              ) : <span />}
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginTop: 4, border: `1px solid ${C.border}` }}>
              <div style={{ width: `${cashPct}%`, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                {labels.cash.outside ? '' : labels.cash.inside}
              </div>
              <div style={{ width: `${creditPct}%`, background: C.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                {labels.credit.outside ? '' : labels.credit.inside}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: C.textMuted, flexWrap: 'wrap' }}>
              <span><span style={{ color: C.success }}>■</span> Contado {fmtMoney(coll.cash, cur)}</span>
              <span><span style={{ color: C.warning }}>■</span> Crédito {fmtMoney(coll.credit, cur)}</span>
            </div>
          </>
        )}
      </Card>

      <Card testid="sales-buyers" style={{ padding: '14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>Compraron</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 4 }}>{fmtInt(payload?.funnel?.compraron)}</div>
        <div style={{ marginTop: 6 }}><DeltaChip delta={payload?.buyers_delta} period={period} /></div>
      </Card>
    </div>
  )
}

// ── 3 · Barras etiquetadas ───────────────────────────────────────────────────
function LabeledBars({ series, testid, primary = true }) {
  const bars = buildBars(series)
  if (!hasSeries(series)) {
    return <div data-testid={`${testid}-empty`} style={{ fontSize: 12, color: C.textMuted, padding: '8px 2px' }}>Sin dato para la gráfica en este período.</div>
  }
  return (
    <div data-testid={testid} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, paddingTop: 18 }}>
      {bars.map((b, i) => {
        const fill = b.isCurrent && primary ? C.blue : (primary ? 'rgba(0,119,187,0.35)' : C.warning)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: b.missing ? C.textLow : C.text }}>{b.missing ? '—' : b.valueText}</span>
            <div
              role="img"
              aria-label={`${b.label}: ${b.missing ? 'sin dato' : b.valueText}`}
              style={{ width: '100%', height: b.height, background: fill, borderRadius: '4px 4px 0 0', minHeight: b.missing ? 0 : 3 }}
            />
            <span style={{ fontSize: 9, color: b.isCurrent ? C.text : C.textMuted, fontWeight: b.isCurrent ? 700 : 500, whiteSpace: 'nowrap' }}>{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── 4 · Calidad de ejecución ─────────────────────────────────────────────────
function QualitySection({ payload }) {
  const q = buildQuality(payload)
  const highNote = qualityHighRatioNote(payload)
  if (!q.available) {
    return (
      <Card testid="quality-unavailable">
        <SectionTitle>Calidad de ejecución</SectionTitle>
        <div style={{ fontSize: 13, color: C.textMuted }}>La fuente de calidad no está disponible en este período.</div>
      </Card>
    )
  }
  return (
    <>
      {highNote && (
        <div data-testid="quality-note" role="note" style={{ fontSize: 12, lineHeight: 1.5, color: C.textMuted, padding: '10px 12px', borderRadius: 12, background: C.chipNeutralBg, border: `1px solid ${C.border}` }}>
          {highNote}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card testid="quality-review">
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted }}>Visitas a revisar</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span data-testid="quality-count" style={{ fontSize: 30, fontWeight: 800, color: q.aRevisarNum ? C.warning : C.textMuted }}>{q.aRevisar}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>de {q.totalVisitas} visitas</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5, marginTop: 8 }}>{q.definition}</div>
          {q.routesCount > 0 && (
            <div style={{ fontSize: 11.5, color: C.text, marginTop: 8 }}>Cayeron en {q.routesCount} ruta(s).</div>
          )}
          {q.sellers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {q.sellers.map((s) => (
                <span key={s} data-testid="quality-seller-chip" style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: C.chipNeutralBg, color: C.textMuted }}>{s}</span>
              ))}
            </div>
          )}
        </Card>
        <Card testid="quality-trend">
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, marginBottom: 4 }}>Tendencia 7 días</div>
          <LabeledBars series={payload?.quality_series} testid="quality-bars" primary={false} />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
            {typeof payload?.quality_yesterday === 'number' ? `Ayer fueron ${fmtInt(payload.quality_yesterday)}` : 'Sin dato de ayer'}
          </div>
        </Card>
      </div>
    </>
  )
}

function BarSkeleton() {
  return (
    <div data-testid="kpi-skeleton" style={{ display: 'grid', gap: 12 }}>
      <div style={{ height: 320, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}` }} />
      <div style={{ height: 96, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}` }} />
    </div>
  )
}

function isEmptyV2(payload) {
  const f = payload?.funnel || {}
  const sales = payload?.kpis?.sales || {}
  return f.agendados == null && sales.total == null && !hasSeries(payload?.buyers_series)
}

export default function PanelKpis() {
  const [period, setPeriod] = useState('hoy')
  const [state, setState] = useState({ status: 'loading', payload: null, error: null })

  const load = useCallback((key) => {
    let cancelled = false
    setState((prev) => ({ ...prev, status: prev.payload ? 'refreshing' : 'loading' }))
    getSupervisorKpis(key)
      .then((res) => {
        if (cancelled) return
        const payload = res?.kpis ? res : (res?.data || null)
        if (!payload || !payload.kpis) {
          setState({ status: 'error', payload: null, error: 'RESPUESTA_SIN_KPIS' })
          return
        }
        setState({ status: 'ready', payload, error: null })
      })
      .catch((e) => {
        if (cancelled) return
        setState({ status: 'error', payload: null, error: String(e?.code || e?.message || e) })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => load(period), [period, load])

  const shell = (children) => (
    <div
      data-testid="kpis-panel" data-theme="brand-light"
      style={{ minHeight: '100%', background: C.bg0, padding: '16px 16px 24px', display: 'grid', gap: 12, alignContent: 'start' }}
    >
      <PeriodSwitcher value={period} onChange={setPeriod} busy={state.status === 'loading'} />
      {children}
    </div>
  )

  if (state.status === 'loading') return shell(<BarSkeleton />)

  if (state.status === 'error') {
    return shell(
      <StateScreen
        tokens={T} tone="error" testid="kpis-error"
        title="No se pudieron cargar los indicadores"
        detail={`El servidor respondió ${state.error}. No se muestran números para no inventarlos.`}
        actionLabel="Reintentar" onAction={() => load(period)}
      />,
    )
  }

  const { payload } = state

  return shell(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{periodLabel(payload)}</span>
        <span data-testid="kpis-range" style={{ fontSize: 11, color: C.textMuted }}>{periodRangeText(payload)}</span>
      </div>

      {isEmptyV2(payload) ? (
        <StateScreen
          tokens={T} testid="kpis-empty"
          title="Sin operación en este período"
          detail="No hay rutas ni movimientos que medir en el rango seleccionado. No es un error: no hubo actividad."
        />
      ) : (
        <>
          <Funnel payload={payload} />

          <SectionTitle>Venta del período</SectionTitle>
          <SalesRow payload={payload} period={period} />

          <SectionTitle>Compradores por día</SectionTitle>
          <Card testid="buyers-chart"><LabeledBars series={payload?.buyers_series} testid="buyers-bars" /></Card>

          <SectionTitle>Calidad de ejecución</SectionTitle>
          <QualitySection payload={payload} />

          {/* Prospección: retirada hasta fase 2 (fuente B2B no escopada por
              supervisora). No se deja un cuadro vacío; se re-agrega al conectar. */}
        </>
      )}
    </>,
  )
}
