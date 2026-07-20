// ─── Supervisor V2 · Rutas (vista PURA — lista ruta-céntrica) ─────────────────
// Lista de rutas del día desde deriveRouteRows(dayControl). Sin window/fetch.
// null≠0 (pendingLoads null ⇒ "sin dato"), unknown≠incumplimiento.
import { TOKENS } from '../../../../tokens'
import {
  deriveRouteRows, departureLabel, departureTone, deviationText, closeStageLabel,
  moneyText, signalLabel,
} from '../presentation.js'

const C = TOKENS.colors
const S = TOKENS.state
const TONE = { ok: { fg: C.success, bg: C.successSoft, border: 'rgba(34,197,94,0.34)' }, risk: S.risk, neutral: S.no_evaluable }

function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: TOKENS.radius.pill, color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}>{text}</span>
}

function RouteRow({ row, onOpen }) {
  const depTone = TONE[departureTone(row.departureStatus)] || S.no_evaluable
  const sales = moneyText(row.sales.amount, row.sales.currency, row.sales.available)
  const sigTone = row.signalStatus === 'recent' || row.signalStatus === 'delayed' ? S.signal : S.no_evaluable
  return (
    <div data-testid="v2-ruta-row" role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(row.planId) : undefined}
      style={{ padding: '12px 14px', marginBottom: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, cursor: onOpen ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{row.routeName}</div>
        <Chip text={departureLabel(row.departureStatus)} tone={depTone} />
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{row.driver} · {row.vehicle}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Chip text={`${row.stopsDone ?? '—'}/${row.stopsTotal ?? '—'} paradas`} tone={S.info} />
        <Chip text={`Venta: ${sales.text}`} tone={sales.available ? TONE.ok : S.no_evaluable} />
        {row.deviationMinutes != null && <Chip text={deviationText(row.deviationMinutes)} tone={depTone} />}
        {row.incidentCount > 0 && <Chip text={`${row.incidentCount} incidencia(s)`} tone={S.risk} />}
        <Chip text={row.pendingLoads == null ? 'Cargas: sin dato' : `Cargas pend.: ${row.pendingLoads}`} tone={row.pendingLoads ? S.risk : S.no_evaluable} />
        <Chip text={signalLabel(row.signalStatus)} tone={sigTone} />
        <Chip text={closeStageLabel(row.closeStage)} tone={S.no_evaluable} />
      </div>
      {row.nextStopName && <div style={{ fontSize: 11.5, color: C.textLow, marginTop: 6 }}>Siguiente: {row.nextStopName}</div>}
    </div>
  )
}

export default function RutasView({ dayControl, source = 'live', onOpenRoute, testid = 'supervisor-v2-rutas' }) {
  const rows = deriveRouteRows(dayControl)
  const isDemo = source === 'demo'
  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
        </div>
      )}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 12px' }}>Rutas</h1>
      {rows.length === 0
        ? <div data-testid="v2-rutas-empty" style={{ fontSize: 13, color: C.textMuted }}>Sin rutas en la jornada.</div>
        : rows.map((r, i) => <RouteRow key={r.planId ?? i} row={r} onOpen={onOpenRoute} />)}
    </div>
  )
}
