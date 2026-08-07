// ─── Supervisor V2 · Rutas (vista PURA — lista ruta-céntrica) ─────────────────
// Lista de rutas del día desde deriveRouteRows(dayControl). Sin window/fetch.
// null≠0 (pendingLoads null ⇒ "sin dato"), unknown≠incumplimiento.
// Tema CLARO (rebranding PR2): misma forma que TOKENS, paleta institucional.
// Estas vistas solo se montan bajo rutas moduleId="supervisor_ventas"; el
// invariante lo verifica tests/brandTokensScope.test.mjs.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import RowButton from '../components/RowButton'
import {
  deriveRouteRows, departureLabel, departureTone, deviationText, closeStageLabel,
  routeAttention, sortRoutesByAttention,
  moneyText, signalLabel,
} from '../presentation.js'

const OP_TYPE_LABEL = { SO: 'Segmento', SP: 'Subpolígono', P: 'Polígono' }
const C = TOKENS.colors
const S = TOKENS.state
const TONE = { ok: { fg: C.success, bg: C.successSoft, border: 'rgba(34,197,94,0.34)' }, risk: S.risk, neutral: S.no_evaluable }

function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: TOKENS.radius.pill, color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}>{text}</span>
}

function RouteRow({ row, onOpen, onSelect = null, selected = false }) {
  const depTone = TONE[departureTone(row.departureStatus)] || S.no_evaluable
  const sales = moneyText(row.sales.amount, row.sales.currency, row.sales.available)
  const sigTone = row.signalStatus === 'recent' || row.signalStatus === 'delayed' ? S.signal : S.no_evaluable
  const cardStyle = {
    background: selected ? C.surfaceSoft : C.surface,
    // La selección se marca con BORDE + barra lateral, no solo con color:
    // en escritorio cruza columnas (radar ↔ rutas) y debe leerse sin depender
    // de distinguir dos azules.
    border: `1px solid ${selected ? C.blue : C.border}`,
    boxShadow: selected ? `inset 4px 0 0 ${C.blue}` : 'none',
    borderRadius: TOKENS.radius.lg,
  }
  const attention = routeAttention(row)
  const op = row.operationalPlan
  const routeSummary = (
    <div style={{ padding: '12px 14px' }}>
    {/* QUÉ se ejecuta: el plan operativo manda; el vendedor es el subtítulo. */}
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
      {op
        ? <Chip text={`${OP_TYPE_LABEL[op.tipo] || 'Plan'}: ${op.name}`} tone={S.info} />
        : <Chip text="Sin plan operativo" tone={S.no_evaluable} />}
      {attention.reason && (
        <span data-testid="v2-ruta-atencion" style={{
          fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap',
          color: attention.level === 'bad' ? C.error : C.warning,
        }}>⚑ {attention.reason}</span>
      )}
    </div>
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

  if (onSelect) {
    return (
      <div style={{ ...cardStyle, marginBottom: 10, overflow: 'hidden' }}>
        <RowButton
          testid="v2-ruta-row"
          ariaLabel={`Seleccionar ruta ${row.routeName}`}
          ariaPressed={selected}
          onClick={() => onSelect(row.planId)}
          style={{ borderRadius: 0 }}
        >
          {routeSummary}
        </RowButton>
        {onOpen && (
          <button
            type="button"
            aria-label={`Abrir ruta ${row.routeName}`}
            onClick={() => onOpen(row.planId)}
            style={{
              width: '100%', minHeight: 44, cursor: 'pointer', font: 'inherit', fontSize: 12,
              fontWeight: 800, color: C.blue3, background: C.surface,
              border: 'none', borderTop: `1px solid ${C.border}`,
            }}
          >
            Abrir ruta
          </button>
        )}
      </div>
    )
  }

  return (
    <RowButton testid="v2-ruta-row" ariaLabel={onOpen ? `Abrir ruta ${row.routeName}` : undefined}
      onClick={onOpen ? () => onOpen(row.planId) : undefined}
      style={{ marginBottom: 10, ...cardStyle }}>
      {routeSummary}
    </RowButton>
  )
}

// `selectedPlanId` es OPCIONAL: en móvil no se pasa y la lista se ve igual que
// siempre. Solo el tablero de escritorio lo usa para el cruce entre columnas.
export default function RutasView({ dayControl, source = 'live', onOpenRoute, onSelectRoute = null, selectedPlanId = null, title = 'Rutas', testid = 'supervisor-v2-rutas' }) {
  // Orden por ATENCIÓN: lo que la supervisora puede corregir ahora, primero.
  const rows = sortRoutesByAttention(deriveRouteRows(dayControl))
  const isDemo = source === 'demo'
  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.32)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
        </div>
      )}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 12px' }}>{title}</h1>
      {rows.length === 0
        ? <div data-testid="v2-rutas-empty" style={{ fontSize: 13, color: C.textMuted }}>Sin rutas en la jornada.</div>
        : rows.map((r, i) => (
          <RouteRow
            key={r.planId ?? i}
            row={r}
            onOpen={onOpenRoute}
            onSelect={onSelectRoute}
            selected={selectedPlanId != null && r.planId === selectedPlanId}
          />
        ))}
    </div>
  )
}
