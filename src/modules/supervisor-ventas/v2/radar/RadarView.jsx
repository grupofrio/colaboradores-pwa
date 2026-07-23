// ─── Supervisor V2 · Radar (vista PURA — posiciones de la jornada) ────────────
// Mapa SVG (PositionMap) + LISTA equivalente que SIEMPRE funciona aunque el mapa
// esté vacío. Sin window/fetch/hooks ⇒ SSR-testeable. Reglas duras (heredadas del
// contrato radar/1): null≠0; error≠0; unknown≠incumplimiento; sin señal≠detenido;
// coordenadas NO se inventan (unidad sin posición no va al mapa, sí a la lista);
// umbrales de frescura NO se hardcodean (se leen de radar.thresholds); JAMÁS se
// presenta como "en vivo": se dice "última posición conocida".
import { TOKENS } from '../../../../tokens'
import {
  orderRadarUnits, RADAR_ORDERS, safeSignalStatus, signalLabel, ageText,
  radarSummary, operationalDateLabel, timezoneSourceLabel,
} from '../presentation.js'
import PositionMap from './PositionMap.jsx'

const C = TOKENS.colors
const S = TOKENS.state

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const isCoord = (v) => typeof v === 'number' && Number.isFinite(v)

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

// ── Construcción HONESTA de puntos del mapa ───────────────────────────────────
// Solo coordenadas VÁLIDAS entran; nada se inventa. Unidades sin posición se
// omiten del mapa (van a la lista). CEDIS solo si el branch trae coords (el
// contrato radar/1 no las expone ⇒ en la práctica se omite).
function buildPoints(radar, nowMs) {
  const points = []
  const units = Array.isArray(radar?.units) ? radar.units : []
  const b = radar?.branch
  if (b && isCoord(b.latitude) && isCoord(b.longitude)) {
    points.push({ id: `cedis:${b.branch_config_id}`, lat: b.latitude, lng: b.longitude, kind: 'cedis', label: b.name || 'CEDIS' })
  }
  for (const u of units) {
    if (isCoord(u.latitude) && isCoord(u.longitude)) {
      const safe = safeSignalStatus(u, nowMs)
      points.push({
        id: u.plan_id,
        lat: u.latitude, lng: u.longitude,
        kind: safe === 'recent' ? 'unit' : 'unit_stale', // recent→unit, resto (con coords)→stale
        label: u.route_name || u.name || 'Unidad',
      })
    }
    const planned = Array.isArray(u.stops?.planned) ? u.stops.planned : []
    for (const st of planned) {
      if (isCoord(st.latitude) && isCoord(st.longitude)) {
        points.push({
          id: `stop:${st.stop_id}`,
          lat: st.latitude, lng: st.longitude,
          kind: st.done ? 'stop_done' : 'stop_pending',
          label: st.name || '',
        })
      }
    }
  }
  return points
}

function UnitRow({ unit, nowMs, selected, onSelectUnit, onOpenRoute }) {
  const planId = unit?.plan_id ?? null
  const safe = safeSignalStatus(unit, nowMs)
  const done = num(unit?.stops?.done)
  const total = num(unit?.stops?.planned_total)
  const missing = num(unit?.stops?.missing_coordinates)
  const clickable = !!onSelectUnit && planId != null
  return (
    <div data-testid="radar-unit-row" role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onSelectUnit(planId) : undefined}
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
  const points = radar ? buildPoints(radar, nowMs) : []
  const ordered = radar ? orderRadarUnits(units, currentOrder, nowMs) : []
  // Solo se rutan al mapa los puntos de UNIDAD (ids numéricos = plan_id); los
  // puntos de parada (ids 'stop:*') no seleccionan unidad.
  const handleMapSelect = (id) => { if (typeof id === 'number' && onSelectUnit) onSelectUnit(id) }

  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>
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
            <PositionMap points={points} selectedId={selectedId} onSelect={onSelectUnit ? handleMapSelect : undefined} />
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
                  selected={u?.plan_id != null && u.plan_id === selectedId}
                  onSelectUnit={onSelectUnit} onOpenRoute={onOpenRoute} />
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}
