// ─── Supervisor V2 · Radar (vista PURA — posiciones de la jornada) ────────────
// Mapa SVG (PositionMap) + LISTA equivalente que SIEMPRE funciona aunque el mapa
// esté vacío. Sin window/fetch/hooks ⇒ SSR-testeable. Reglas duras (heredadas del
// contrato radar/1): null≠0; error≠0; unknown≠incumplimiento; sin señal≠detenido;
// coordenadas NO se inventan (unidad sin posición no va al mapa, sí a la lista);
// umbrales de frescura NO se hardcodean (se leen de radar.thresholds); JAMÁS se
// presenta como "en vivo": se dice "última posición conocida".
// Tema CLARO (rebranding PR2): misma forma que TOKENS, paleta institucional.
// Estas vistas solo se montan bajo rutas moduleId="supervisor_ventas"; el
// invariante lo verifica tests/brandTokensScope.test.mjs.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import {
  orderRadarUnits, RADAR_ORDERS, safeSignalStatus, signalLabel, ageText,
  radarSummary, operationalDateLabel, timezoneSourceLabel,
} from '../presentation.js'
import PositionMap from './PositionMap.jsx'
import { buildRadarPlanOptions, buildSelectedPlanPoints, resolveActivePlanId } from './radarSelection.js'

const C = TOKENS.colors
const S = TOKENS.state

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

const ORDER_LABELS = {
  urgente: 'Urgente', ultima_senal: 'Última señal', menor_avance: 'Menor avance',
  mayor_atraso: 'Mayor atraso', incidencias: 'Incidencias', ruta: 'Ruta', chofer: 'Chofer',
}
const SIGNAL_TONE = { recent: S.signal, delayed: S.risk, no_signal: S.no_evaluable, invalid: S.no_evaluable }
const signalTone = (s) => SIGNAL_TONE[s] || S.no_evaluable

function Card({ children, testid }) {
  return (
    <section data-testid={testid} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '15px 17px', marginBottom: 13,
    }}>{children}</section>
  )
}
function Title({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 10 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: 0 }}>{children}</h2>
      {action}
    </div>
  )
}
function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill, color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}>{text}</span>
}

function UnitRow({ unit, nowMs, selected, onSelectUnit, onOpenRoute }) {
  const planId = unit?.plan_id ?? null
  const safe = safeSignalStatus(unit, nowMs)
  const done = num(unit?.stops?.done)
  const total = num(unit?.stops?.planned_total)
  const missing = num(unit?.stops?.missing_coordinates)
  const clickable = !!onSelectUnit && planId != null
  const selectUnit = () => { if (clickable) onSelectUnit(planId) }
  const handleKeyDown = (e) => {
    if (!clickable || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    selectUnit()
  }
  return (
    <div data-testid="radar-unit-row" role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? selectUnit : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '10px 11px', marginTop: 8, background: C.surfaceSoft,
        border: `1px solid ${selected ? C.borderBlue : C.border}`, borderRadius: TOKENS.radius.md,
        cursor: clickable ? 'pointer' : 'default',
      }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{unit?.route_name || 'Ruta sin nombre'}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          {unit?.name || 'Sin responsable'} · {unit?.vehicle?.name || 'Sin unidad'}
        </div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
          Última señal: <span style={{ color: C.textSoft }}>{ageText(num(unit?.age_seconds))}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
          <Chip text={signalLabel(safe)} tone={signalTone(safe)} />
          <Chip text={`Avance ${done ?? '—'}/${total ?? '—'}`} tone={S.info} />
          {missing != null && missing > 0 && <Chip text={`${missing} sin coord.`} tone={S.no_evaluable} />}
        </div>
      </div>
      {onOpenRoute && planId != null && (
        <button type="button" aria-label="Abrir ruta"
          onClick={(e) => { e.stopPropagation(); onOpenRoute(planId) }}
          style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: C.blue3, border: `1px solid ${C.borderBlue}`, borderRadius: TOKENS.radius.pill, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Abrir ruta
        </button>
      )}
    </div>
  )
}

export default function RadarView({
  radar = null, dayControl = null, radarError = null, source = 'live', nowMs = null,
  order = 'urgente', onSelectOrder, selectedId = null, onSelectUnit, onOpenRoute,
  testid = 'supervisor-v2-radar',
}) {
  const isDemo = source === 'demo'
  const ctx = dayControl || radar || {}
  const currentOrder = RADAR_ORDERS.includes(order) ? order : 'urgente'
  const units = Array.isArray(radar?.units) ? radar.units : []
  const rsum = radar ? radarSummary(units, nowMs) : null
  const planOptions = buildRadarPlanOptions(units)
  const activePlanId = resolveActivePlanId(units, selectedId)
  const points = radar ? buildSelectedPlanPoints(radar, activePlanId, nowMs) : []
  const ordered = radar ? orderRadarUnits(units, currentOrder, nowMs) : []
  // Solo se rutan al mapa los puntos de UNIDAD (ids numéricos = plan_id); los
  // puntos de parada (ids 'stop:*') no seleccionan unidad.
  const handleMapSelect = (id) => { if (typeof id === 'number' && onSelectUnit) onSelectUnit(id) }
  const handlePlanSelect = (event) => {
    const planId = Number(event.target.value)
    if (onSelectUnit && planOptions.some((option) => option.planId === planId)) onSelectUnit(planId)
  }

  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.32)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
        </div>
      )}

      <header style={{ marginBottom: 13 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Radar</h1>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span data-testid="radar-date">{operationalDateLabel(ctx.date)}</span>
          {ctx.branch?.name && <span>· {ctx.branch.name}</span>}
          {ctx.timezone_source && <span>· {timezoneSourceLabel(ctx.timezone_source)}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
          Última posición conocida del dispositivo del responsable — puede tener retraso.
        </div>
      </header>

      {radarError ? (
        <Card testid="radar-error">
          <div style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible: {radarError}</div>
        </Card>
      ) : !radar ? (
        <Card testid="radar-unavailable">
          <div style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible en esta carga.</div>
        </Card>
      ) : (
        <>
          <Card testid="radar-summary">
            <Title>Resumen</Title>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip text={`Con señal: ${rsum.withSignal}`} tone={S.signal} />
              <Chip text={`Sin señal: ${rsum.withoutSignal}`} tone={S.no_evaluable} />
              <Chip text={`Unidades: ${rsum.total}`} tone={S.info} />
            </div>
          </Card>

          <Card testid="radar-map">
            <Title>Mapa de posiciones</Title>
            {activePlanId != null && (
              <label style={{ fontSize: 11.5, color: C.textMuted, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                Plan diario
                <select data-testid="radar-plan-select" value={activePlanId} onChange={handlePlanSelect}
                  style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.pill, padding: '4px 8px' }}>
                  {planOptions.map((option) => <option key={option.planId} value={option.planId}>{option.label}</option>)}
                </select>
              </label>
            )}
            <PositionMap points={points} selectedId={activePlanId} onSelect={onSelectUnit ? handleMapSelect : undefined} />
          </Card>

          <Card testid="radar-list">
            <Title action={(
              <label style={{ fontSize: 11.5, color: C.textMuted, display: 'flex', gap: 6, alignItems: 'center' }}>
                Orden
                <select data-testid="radar-order-select" value={currentOrder}
                  onChange={(e) => { if (onSelectOrder) onSelectOrder(e.target.value) }}
                  style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.pill, padding: '4px 8px' }}>
                  {RADAR_ORDERS.map((o) => <option key={o} value={o}>{ORDER_LABELS[o] || o}</option>)}
                </select>
              </label>
            )}>Unidades</Title>
            {ordered.length === 0 ? (
              <div data-testid="radar-empty" style={{ fontSize: 13, color: C.textMuted }}>Sin unidades en la jornada operativa.</div>
            ) : (
              ordered.map((u) => (
                <UnitRow key={u?.plan_id ?? `${u?.employee_id}-${u?.route_name}`} unit={u} nowMs={nowMs}
                  selected={u?.plan_id != null && u.plan_id === activePlanId}
                  onSelectUnit={onSelectUnit} onOpenRoute={onOpenRoute} />
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}
