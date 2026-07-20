// ─── Supervisor V2 · Hoy (vista PURA — centro de mando de la jornada) ─────────
// Extiende la home de #81: encabezado con frescura/capabilities/actualizar,
// situación accionable completa (11 conteos honestos) y prioridades con enlace a
// detalle. Sin window/fetch/hooks ⇒ SSR-testeable. Reglas: null≠0, error≠0,
// unknown≠incumplimiento, sin señal≠detenido.
import { TOKENS } from '../../../../tokens'
import {
  operationalDateLabel, timezoneSourceLabel, moneyText, moneyByCurrencyTexts,
  groupPriorities, priorityCountChip, closeStageLabel, CLOSE_STAGE_ORDER,
  radarSummary, deriveSituation, deriveFreshness,
} from '../presentation.js'

const C = TOKENS.colors
const S = TOKENS.state

const FRESHNESS_TONE = {
  completo: { fg: C.success, bg: C.successSoft, border: 'rgba(34,197,94,0.34)' },
  parcial: S.risk, stale: TOKENS.freshness.stale, no_disponible: S.no_evaluable,
}

function Card({ children, testid, onClick }) {
  return (
    <section data-testid={testid} onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '15px 17px', marginBottom: 13, cursor: onClick ? 'pointer' : 'default',
    }}>{children}</section>
  )
}
function Title({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: C.textSoft, margin: 0 }}>{children}</h2>
      {action}
    </div>
  )
}
function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill, color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}>{text}</span>
}

const SEV = { critical: { tone: S.incumplimiento, word: 'Críticas' }, warning: { tone: S.risk, word: 'Advertencias' }, info: { tone: S.info, word: 'Informativas' } }

function SituationGrid({ situation }) {
  const items = [
    { k: 'Planeadas', m: situation.planeadas, tone: S.info },
    { k: 'Salieron', m: situation.salieron, tone: { fg: C.success } },
    { k: 'Tarde', m: situation.tarde, tone: S.risk },
    { k: 'Sin salir', m: situation.sinSalir, tone: S.risk },
    { k: 'Activas', m: situation.activas, tone: S.signal },
    { k: 'Cerradas', m: situation.cerradas, tone: S.info },
    { k: 'Con incidencia', m: situation.conIncidencia, tone: S.risk },
    { k: 'Sin señal', m: situation.sinSenal, tone: S.no_evaluable },
    { k: 'Cargas pend.', m: situation.cargasPendientes, tone: S.risk },
    { k: 'Cierres pend.', m: situation.cierresPendientes, tone: S.risk },
    { k: 'Sin dato salida', m: situation.sinDatoSalida, tone: S.no_evaluable },
  ]
  return (
    <div data-testid="hoy-situacion" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
      {items.map((it) => (
        <div key={it.k} style={{ textAlign: 'center', padding: '9px 6px', background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: it.m.available ? (it.tone.fg || C.text) : C.textMuted }}>
            {it.m.available ? it.m.value : '—'}
          </div>
          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{it.k}</div>
        </div>
      ))}
    </div>
  )
}

export default function HoyView({
  dayControl, radar = null, radarError = null, source = 'live', provenance = null, nowMs = null,
  onRefresh, onOpenPriority, onOpenPendientes, testid = 'supervisor-v2-hoy',
}) {
  const dc = dayControl || {}
  const summary = dc.summary || {}
  const caps = dc.capabilities || {}
  const isDemo = source === 'demo'
  const fresh = deriveFreshness(dc, nowMs)
  const situation = deriveSituation(dc)
  const consolidated = caps.sales_consolidated !== false
  const sales = consolidated
    ? moneyText(summary.sales_day_amount, summary.sales_day_currency, summary.sales_day_available !== false)
    : null
  const salesByCurrency = consolidated ? null : moneyByCurrencyTexts(summary.sales_day_by_currency)
  const priorities = Array.isArray(dc.priorities) ? dc.priorities : []
  const groups = groupPriorities(priorities)
  const rsum = radar ? radarSummary(radar.units, nowMs) : null

  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13 }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.{provenance?.source ? ` (${provenance.source})` : ''}
        </div>
      )}

      <header style={{ marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Hoy</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span data-testid="hoy-freshness"><Chip text={fresh.label} tone={FRESHNESS_TONE[fresh.state]} /></span>
            {onRefresh && <button type="button" onClick={onRefresh} aria-label="Actualizar" style={{ fontSize: 12, fontWeight: 700, color: C.blue3, border: `1px solid ${C.borderBlue}`, borderRadius: TOKENS.radius.pill, padding: '4px 12px', cursor: 'pointer' }}>Actualizar</button>}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span data-testid="hoy-date">{operationalDateLabel(dc.date)}</span>
          {dc.branch?.name && <span>· {dc.branch.name}</span>}
          <span>· {timezoneSourceLabel(dc.timezone_source)}</span>
          {dc.generated_at && <span>· act. {String(dc.generated_at).slice(11, 16)}</span>}
        </div>
      </header>

      <Card testid="hoy-card-venta">
        <Title>Venta del día</Title>
        {consolidated ? (
          <div data-testid="hoy-sales" style={{ fontSize: 22, fontWeight: 800, color: sales.available ? C.text : C.textMuted }}>{sales.text}</div>
        ) : (
          <div data-testid="hoy-sales" data-multicurrency="true">
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Por moneda (sin consolidar):</div>
            {(salesByCurrency || []).length === 0 ? <div style={{ color: C.textMuted }}>Sin dato</div> : salesByCurrency.map((t, i) => <div key={i} style={{ fontSize: 17, fontWeight: 700, color: t.available ? C.text : C.textMuted }}>{t.text}</div>)}
          </div>
        )}
      </Card>

      <Card testid="hoy-card-situacion"><Title>Situación de la jornada</Title><SituationGrid situation={situation} /></Card>

      <Card testid="hoy-card-prioridades">
        <Title action={onOpenPendientes && <button type="button" onClick={onOpenPendientes} style={{ fontSize: 11.5, fontWeight: 700, color: C.blue3, cursor: 'pointer' }}>Ver todos →</button>}>Pendientes prioritarios</Title>
        {priorities.length === 0 ? (
          <div data-testid="hoy-prioridades-empty" style={{ fontSize: 13, color: C.textMuted }}>Sin pendientes marcados en este momento.</div>
        ) : (
          ['critical', 'warning', 'info'].map((sev) => {
            const list = groups[sev] || []
            if (!list.length) return null
            return (
              <div key={sev} style={{ marginBottom: 9 }}>
                <div style={{ marginBottom: 6 }}><Chip text={`${SEV[sev].word} · ${list.length}`} tone={SEV[sev].tone} /></div>
                {list.map((p, i) => {
                  const chip = priorityCountChip(p)
                  const clickable = !!onOpenPriority && p.route_id != null
                  return (
                    <div key={i} data-testid="hoy-priority-item" role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => onOpenPriority(p) : undefined}
                      style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, cursor: clickable ? 'pointer' : 'default' }}>
                      <span style={{ fontSize: 13, color: C.textSoft, flex: 1 }}>{p.reason || 'Pendiente'}</span>
                      {chip.show && <Chip text={chip.text} tone={SEV[sev].tone} />}
                      {clickable && <span aria-hidden style={{ color: C.blue3, fontSize: 13 }}>›</span>}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </Card>

      <Card testid="hoy-card-cierre">
        <Title>Cierre de rutas</Title>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {CLOSE_STAGE_ORDER.map((st) => <Chip key={st} text={`${closeStageLabel(st)}: ${summary.close?.[st] ?? 0}`} tone={S.no_evaluable} />)}
        </div>
        {(() => { const cash = moneyText(summary.close?.cash_pending_amount, summary.close?.cash_pending_currency, true); return (
          <div style={{ fontSize: 12, color: C.textMuted }}>Caja pendiente: <span style={{ color: cash.available ? C.warning : C.textMuted, fontWeight: 700 }}>{cash.text}</span></div>
        ) })()}
      </Card>

      <Card testid="hoy-card-radar">
        <Title>Radar</Title>
        {radarError ? <div style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible: {radarError}</div>
          : !rsum ? <div style={{ fontSize: 13, color: C.textMuted }}>Radar no disponible en esta carga.</div>
          : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip text={`Con señal: ${rsum.withSignal}`} tone={S.signal} />
              <Chip text={`Sin señal: ${rsum.withoutSignal}`} tone={S.no_evaluable} />
              <Chip text={`Unidades: ${rsum.total}`} tone={S.info} />
            </div>}
      </Card>
    </div>
  )
}
