// ─── Panel de KPIs NATIVO del supervisor (tema claro) ────────────────────────
// Reemplaza el iframe de Metabase + el mock hardcodeado para `supervisor_ventas`.
// Los demás roles NO pasan por aquí: su /kpis sigue exactamente igual.
//
// Sin marco de "navegador falso", sin dashboard simulado, sin un solo número
// escrito a mano. Lo que no viene del backend dice "Sin dato".
import { useCallback, useEffect, useState } from 'react'

import { BRAND_TOKENS as T } from '../../../theme/brandTokens'
import StateScreen from '../../../components/kold/StateScreen'
import { getSupervisorKpis } from '../api'
import {
  NO_DATA, PERIODS, TODAY_BADGE, TONE_LABELS,
  buildKpiCards, isEmptyPanel, isSnapshot, panelNotices, periodLabel, periodRangeText,
} from './kpisModel'

const C = T.colors

const TONE_COLOR = {
  good: C.success,
  watch: C.warning,
  bad: C.error,
  unknown: C.textMuted,
}

function PeriodSwitcher({ value, onChange, busy }) {
  return (
    <div
      role="tablist"
      aria-label="Período"
      data-testid="kpis-period-switcher"
      style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 999,
        background: C.surfaceStrong, border: `1px solid ${C.border}`,
      }}
    >
      {PERIODS.map((p) => {
        const active = p.key === value
        return (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={busy}
            onClick={() => onChange(p.key)}
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

function KpiCard({ card }) {
  const color = TONE_COLOR[card.tone] || C.textMuted
  const sinDato = card.value === NO_DATA
  return (
    <div
      data-testid={`kpi-card-${card.key}`}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(15,42,61,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted }}>
          {card.title}
        </span>
        {/* La etiqueta "al día de hoy" va en los KPIs que NO se mueven con el
            selector: son saldo actual. Sin ella, en "Mes" se leerían como del mes. */}
        {isSnapshot(card) && (
          <span
            data-testid={`kpi-badge-${card.key}`}
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: C.chipNeutralBg, color: C.textMuted, whiteSpace: 'nowrap',
            }}
          >
            {TODAY_BADGE}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
        <span
          data-testid={`kpi-value-${card.key}`}
          style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em',
            color: sinDato ? C.textMuted : (card.neutral ? C.text : color),
          }}
        >
          {card.value}
        </span>
        {/* Semáforo CON PALABRA. El color solo no basta: se ve bajo el sol y
            hay quien no distingue rojo de verde. */}
        {!card.neutral && (
          <span
            data-testid={`kpi-tone-${card.key}`}
            style={{ fontSize: 11, fontWeight: 700, color }}
          >
            {TONE_LABELS[card.tone]}
          </span>
        )}
      </div>

      {card.progress != null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(card.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 6, borderRadius: 4, background: C.surfaceStrong, overflow: 'hidden', marginTop: 10 }}
        >
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, card.progress))}%`, background: color, borderRadius: 4 }} />
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textMuted, marginTop: card.progress != null ? 8 : 6 }}>
        {card.detail}
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div
      data-testid="kpi-skeleton"
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: '14px 16px', display: 'grid', gap: 10,
      }}
    >
      {[40, 70, 55].map((w, i) => (
        <div key={i} style={{ height: i === 1 ? 22 : 10, width: `${w}%`, borderRadius: 6, background: C.surfaceStrong }} />
      ))}
    </div>
  )
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
        // `api()` desenvuelve el envelope; se acepta cualquiera de las dos
        // formas para no depender de esa capa.
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
      data-testid="kpis-panel"
      data-theme="brand-light"
      style={{
        minHeight: '100%', background: C.bg0, padding: '16px 16px 24px',
        display: 'grid', gap: 12, alignContent: 'start',
      }}
    >
      <PeriodSwitcher value={period} onChange={setPeriod} busy={state.status === 'loading'} />
      {children}
    </div>
  )

  if (state.status === 'loading') {
    return shell(
      <div style={{ display: 'grid', gap: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
      </div>,
    )
  }

  if (state.status === 'error') {
    // Error ≠ vacío: aquí SÍ se ofrece reintentar, porque puede ser transitorio.
    return shell(
      <StateScreen
        tokens={T}
        tone="error"
        testid="kpis-error"
        title="No se pudieron cargar los indicadores"
        detail={`El servidor respondió ${state.error}. No se muestran números para no inventarlos.`}
        actionLabel="Reintentar"
        onAction={() => load(period)}
      />,
    )
  }

  const { payload } = state
  const cards = buildKpiCards(payload)
  const notices = panelNotices(payload)

  return shell(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{periodLabel(payload)}</span>
        <span data-testid="kpis-range" style={{ fontSize: 11, color: C.textMuted }}>
          {periodRangeText(payload)}
        </span>
      </div>

      {notices.map((n) => (
        <div
          key={n.key}
          data-testid={`kpis-notice-${n.key}`}
          role="note"
          style={{
            fontSize: 12, lineHeight: 1.5, color: C.textMuted, padding: '10px 12px',
            borderRadius: 12, background: C.chipNeutralBg, border: `1px solid ${C.border}`,
          }}
        >
          {n.text}
        </div>
      ))}

      {isEmptyPanel(payload) ? (
        <StateScreen
          tokens={T}
          testid="kpis-empty"
          title="Sin operación en este período"
          detail="No hay rutas ni movimientos que medir en el rango seleccionado. No es un error: no hubo actividad."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {cards.map((card) => <KpiCard key={card.key} card={card} />)}
        </div>
      )}
    </>,
  )
}
