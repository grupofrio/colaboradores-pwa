// ─── ScreenRentabilidadCostosM7 — KOLD OS · M7 "Rentabilidad y costos" ───────
// Observatorio READ-ONLY de rentabilidad, costos y desempeño económico.
//
// PREGUNTA RECTORA: ¿dónde generamos valor económico, qué parte del resultado
// PODEMOS OBSERVAR y qué datos faltan para calcular rentabilidad de forma
// confiable? La respuesta HONESTA hoy es NIVEL L1: sólo ingreso observable por
// moneda. Prohibido afirmar utilidad, margen real, rentabilidad completa o
// beneficio neto. Las capabilities gobiernan qué existe: capability=false ⇒ "—"
// + razón, JAMÁS 0. Cero writes, cero botones de acción.
//
// ⚠️ Backend M7 = PR TEMPORAL #211, NO desplegado. En producción esta pantalla
// resuelve `unavailable`; el demo (fixture del core real) sólo vive en DEV/
// Preview con VITE_ENABLE_M7_DEMO. La API real NUNCA ha sido probada.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS } from '../../tokens'
import { fetchM7Latest, fetchM7Findings, fetchM7Runs } from './m7/m7Api'
import { canLoadM7DemoFixture } from './m7/demoGate'
import {
  M7_DEFAULT_FILTERS, M7_FILTER_AXES, activeFilterCount,
} from './m7/filters'
import {
  initSelection, m7SelectionReducer, selectRunAction, clearRunAction,
  planFindingsRequest, planRunsRequest, findingsAnchorMismatch,
  selectedRunContext, isLatestSelected, makeSeqGuard,
} from './m7/runController'
import {
  findingsToCsv, evidenceJson, capabilitiesText, downloadTextFile, exportFilename,
  M7_EXPORT_MAX_ROWS,
} from './m7/exporters'
import {
  M7_VERDICT_ORDER, M7_VERDICT_LABELS, M7_VERDICT_COLORS, M7_VERDICT_HELP,
  M7_CLASSIFICATION_LABELS, M7_SEVERITY_LABELS, M7_LIFECYCLE_LABELS,
  M7_LEVEL_LADDER, M7_CAPABILITY_LABELS, M7_COMPATIBILITY_LABELS,
  M7_INCIDENCES_NOTE, M7_EVIDENCE_SOURCE_LABELS, categoryLabel,
} from './m7/m7Meta'
import { resolveM7Metric, lineageState, M7_LIFECYCLE_STATES_UNSUPPORTED } from './m7/contract'

// El fixture demo se carga por import DINÁMICO tras el gate (nunca estático):
// `virtual:m7-demo-fixture` resuelve a un stub en producción, así el payload
// financiero jamás entra al bundle productivo (ver demoGate + vite.config).
async function loadDemoPayload() {
  const mod = await import('virtual:m7-demo-fixture')
  if (!mod?.demoFixtureAvailable) return null
  return mod.loadM7DemoFixture()   // { payload, provenance } | null
}

const C = TOKENS.colors
const RAD = TOKENS.radius
const STATUS = { GREEN: C.success, AMBER: '#f59e0b', RED: '#ef4444',
  NE: 'rgba(255,255,255,0.45)' }

const fmtInt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-MX') : '—')
const fmtMoney = (n, cur) => (Number.isFinite(Number(n))
  ? `${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`
  : '—')
const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX',
      { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}
const shortHash = (h) => (typeof h === 'string' && h.length > 12 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h || '—')
const curName = (id) => ({ 33: 'MXN', 1: 'USD' }[id] || `cur:${id}`)

function Pill({ color, children, title }) {
  return (
    <span title={title} style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
      background: `${color}1c`, border: `1px solid ${color}40`, color, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function Block({ title, note, children }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{title}</h2>
      {note && <div style={{ fontSize: 10.5, color: C.textLow, marginBottom: 8, lineHeight: 1.4 }}>{note}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>
    </section>
  )
}

// ── MetricTile: única autoridad = resolveM7Metric. 9 estados, ninguno silencioso.
const STATE_UI = {
  capability_disabled: { glyph: '—', badge: 'no disponible', border: 'dashed', red: false },
  metric_unavailable: { glyph: '—', badge: 'cobertura parcial', border: 'dashed', red: false },
  not_evaluable: { glyph: '—', badge: 'no evaluable', border: 'dashed', red: false },
  backend_unavailable: { glyph: '—', badge: 'sin backend', border: 'dashed', red: false },
  multi_currency_unconsolidated: { glyph: '—', badge: 'sin consolidar', border: 'dashed', red: false },
  contract_error: { glyph: '!', badge: 'ERROR DE CONTRATO', border: 'solid', red: true },
  malformed_metric: { glyph: '!', badge: 'MÉTRICA MALFORMADA', border: 'solid', red: true },
  lineage_mismatch: { glyph: '!', badge: 'LINAJE INCONSISTENTE', border: 'solid', red: true },
}

function MetricTile({ label, payload, query, field, universe, unit, tone, caveat,
                     capability, nullable, money, currency }) {
  const res = resolveM7Metric(payload, { query, field, capability, nullable })
  const base = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: RAD.md,
    padding: '10px 12px', minWidth: 150, flex: '1 1 150px',
  }
  if (res.state !== 'ok') {
    const ui = STATE_UI[res.state] || STATE_UI.backend_unavailable
    return (
      <div data-testid="m7-tile" data-state={res.state} data-query={query} data-field={field}
        title={`${res.reason}\nUniverso: ${universe || '—'}\nFuente: ${query} → ${field}`}
        style={{ ...base, background: ui.red ? 'rgba(239,68,68,0.08)' : C.surfaceSoft,
          border: `1px ${ui.border} ${ui.red ? STATUS.RED : C.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: ui.red ? STATUS.RED : C.textLow }}>{ui.glyph}</div>
        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, marginTop: 3,
          color: ui.red ? STATUS.RED : C.textLow }}>{ui.badge}</div>
        <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>{res.reason}</div>
      </div>
    )
  }
  return (
    <div data-testid="m7-tile" data-state="ok" data-query={query} data-field={field}
      title={`Universo: ${universe || '—'}\nFuente: ${query} → ${field}${caveat ? '\n⚠ ' + caveat : ''}`}
      style={base}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>
        {money ? fmtMoney(res.value, currency) : fmtInt(res.value)}
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
        {label}{unit ? <span style={{ color: C.textLow }}> · {unit}</span> : null}
      </div>
      {universe && <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>
        {String(universe).slice(0, 58)}</div>}
      {caveat && <div style={{ fontSize: 9.5, color: '#fbbf24', marginTop: 2 }}>⚠ con salvedad</div>}
    </div>
  )
}

// tarjeta explícita de "no disponible / no evaluable" (para capabilities false)
function UnavailableCard({ label, reason }) {
  return (
    <div data-testid="m7-unavailable" title={reason} style={{
      background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: RAD.md,
      padding: '10px 12px', minWidth: 150, flex: '1 1 150px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.textLow }}>—</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>{reason}</div>
    </div>
  )
}

// Estado de pantalla completa (loading / unavailable / forbidden / …)
function FullState({ title, detail, tone = C.textMuted }) {
  return (
    <div data-testid="m7-fullstate" style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: RAD.lg,
      padding: '28px 22px', textAlign: 'center', margin: '24px 0' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: tone }}>{title}</div>
      {detail && <div style={{ fontSize: 12, color: C.textLow, marginTop: 6, lineHeight: 1.5 }}>{detail}</div>}
    </div>
  )
}

const STATE_COPY = {
  loading: ['Cargando…', 'Consultando el observatorio de rentabilidad.'],
  unavailable: ['Servicio no disponible', 'El backend M7 (#211) no está desplegado. En producción es el estado esperado; no se muestran cifras de demo.'],
  module_disabled: ['Módulo apagado', 'La bandera gf_kold_os.m7.enabled está en 0.'],
  unauthorized: ['Sesión no válida', 'Inicia sesión para consultar rentabilidad.'],
  forbidden: ['Sin acceso', 'Sólo dirección general puede consultar rentabilidad y costos.'],
  schema_mismatch: ['Versión de contrato desconocida', 'El backend respondió con un schema que este frontend no soporta.'],
  malformed_contract: ['Contrato malformado', 'La respuesta no cumple el contrato kold.os.m7.api/1.'],
  error: ['Error temporal', 'No se pudo consultar el backend. Reintenta.'],
}

export default function ScreenRentabilidadCostosM7({ session, initialLoad, initialSelectedRun = null }) {
  const location = useLocation()
  const demoRequested = useMemo(
    () => new URLSearchParams(location.search).get('demo') === '1', [location.search])
  // Gate de demo: DEV o Preview autorizado, NUNCA producción real. El fixture se
  // carga por import DINÁMICO tras el gate (loadDemoPayload); no entra al bundle.
  const env = typeof import.meta !== 'undefined' ? import.meta.env : null
  const demoAllowed = canLoadM7DemoFixture(env, { authorized: true })

  const [load, setLoad] = useState(initialLoad || { phase: 'loading' })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const loadLatest = useCallback(async () => {
    setLoad({ phase: 'loading' })
    if (demoRequested && demoAllowed) {
      const demo = await loadDemoPayload()
      if (!mounted.current) return
      // Si el gate/loader niega (p. ej. producción), NO se muestran cifras de demo.
      if (demo?.payload) setLoad({ phase: 'ok', payload: demo.payload, demo: true })
      else setLoad({ phase: 'unavailable' })
      return
    }
    const result = await fetchM7Latest()
    if (!mounted.current) return
    if (result.state === 'ok') setLoad({ phase: 'ok', payload: result.payload, demo: false })
    else setLoad({ phase: result.state, errors: result.errors })
  }, [demoRequested, demoAllowed])

  // Con initialLoad inyectado (tests SSR) no se re-dispara el fetch.
  useEffect(() => { if (!initialLoad) loadLatest() }, [initialLoad, loadLatest])

  if (load.phase === 'loading') return <Shell><FullState title={STATE_COPY.loading[0]} detail={STATE_COPY.loading[1]} /></Shell>
  if (load.phase !== 'ok') {
    const [t, d] = STATE_COPY[load.phase] || STATE_COPY.error
    return <Shell><FullState title={t} detail={d} tone={load.phase === 'forbidden' ? STATUS.RED : C.textMuted} /></Shell>
  }
  // key por run_id: si el payload latest cambia, la selección se reinicia limpia.
  return (
    <LoadedM7 key={load.payload?.run?.run_id || 'latest'}
      payload={load.payload} demo={!!load.demo} initialSelectedRun={initialSelectedRun} />
  )
}

// Vista cargada: dueña de la ÚNICA selección de corrida (runController).
function LoadedM7({ payload, demo, initialSelectedRun }) {
  const [selection, dispatch] = useReducer(m7SelectionReducer, undefined, () => {
    const base = initSelection(payload)
    return initialSelectedRun ? m7SelectionReducer(base, selectRunAction(initialSelectedRun)) : base
  })
  const [tab, setTab] = useState('overview')

  const run = payload.run || {}
  const scope = run.scope || {}
  const caps = payload.capabilities || {}
  const feats = caps.features || {}
  const reqs = payload.capability_requirements || {}
  const summary = payload.summary || {}
  const lin = lineageState(payload)
  const level = caps.profitability_level_reached
  const currencies = scope.currency_ids || []
  const invoiceRows = (payload.metrics?.invoice_revenue_by_currency) || []

  const anchor = selectedRunContext(selection)
  const historical = !isLatestSelected(selection)

  return (
    <Shell>
      {/* ── banners de estado del dato ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {demo && <Pill color="#a78bfa" title="Fixture del core real; NO evidencia en vivo">MODO DEMO</Pill>}
        {!lin.is_production_shell_run && <Pill color="#f59e0b" title="Medición read-only; corrida formal odoo-shell inexistente">EVIDENCIA NO FORMAL</Pill>}
        <Pill color="#f59e0b" title="El sello cambia al portar a grupofrio/gf">LINAJE PRE-MIGRACIÓN</Pill>
        {feats.multi_currency_detected && <Pill color="#60a5fa" title="Importes por moneda; sin total global">MULTI-MONEDA SIN CONSOLIDAR</Pill>}
      </div>

      {/* ── aviso de vista histórica PARCIAL ────────────────────────────────── */}
      {historical && <HistoricalNotice anchor={anchor} onClear={() => dispatch(clearRunAction())} />}

      {/* ── HOME: nivel económico observable (SIEMPRE corrida más reciente) ─── */}
      <div style={{ background: C.surfaceStrong || C.surface, border: `1px solid ${C.borderBlue || C.border}`,
        borderRadius: RAD.lg, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textLow }}>NIVEL ECONÓMICO OBSERVABLE</div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.textLow }}>corrida más reciente</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 2 }}>
          L1 · Ingreso observable
        </div>
        <div style={{ fontSize: 12, color: C.textSoft, marginTop: 6, lineHeight: 1.5, maxWidth: 720 }}>
          Actualmente existen datos suficientes para <b>observar ingresos</b> (por moneda), pero
          <b> NO</b> para calcular costo histórico comparable, margen bruto, contribución ni utilidad.
          Una fórmula válida no vuelve válida una cifra: lo que no se puede sostener con evidencia se
          declara como <i>no evaluable</i>, no se estima.
        </div>
        <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
          Corte {fmtDate(run.finished_at)} · ventana [{scope.window_start} → {scope.window_end_exclusive}) ·
          cías {(scope.company_ids || []).join('/')} · monedas {currencies.map(curName).join(' + ')} ·
          medición {M7_EVIDENCE_SOURCE_LABELS[run.measurement_method] || run.measurement_method}
        </div>
      </div>

      {/* ── tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
        {[['overview', 'Resumen'], ['ladder', 'Escalera económica'], ['sections', 'Señales por dominio'],
          ['findings', 'Hallazgos'], ['runs', 'Corridas'], ['scope', 'Alcance']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{
            fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
            background: tab === k ? C.blue || '#2563eb' : 'transparent',
            color: tab === k ? '#fff' : C.textMuted, border: `1px solid ${tab === k ? 'transparent' : C.border}` }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview payload={payload} summary={summary} feats={feats} reqs={reqs} historical={historical} />}
      {tab === 'ladder' && <Ladder level={level} feats={feats} reqs={reqs} />}
      {tab === 'sections' && <Sections payload={payload} feats={feats} invoiceRows={invoiceRows} caps={caps} historical={historical} />}
      {tab === 'findings' && <FindingsTab demo={demo} selection={selection} demoPayload={demo ? payload : null} />}
      {tab === 'runs' && <RunsTab demo={demo} selection={selection} dispatch={dispatch} demoPayload={demo ? payload : null} />}
      {tab === 'scope' && <ScopeTab run={run} scope={scope} caps={caps} lin={lin} anchor={anchor} historical={historical} />}

      {/* ── exports ────────────────────────────────────────────────────────── */}
      <ExportsBar payload={payload} demo={demo} selection={selection} />
    </Shell>
  )
}

// Aviso honesto: al ver una corrida histórica sólo cambian findings + su export.
function HistoricalNotice({ anchor, onClear }) {
  return (
    <div data-testid="m7-historical-notice" style={{
      background: 'rgba(96,165,250,0.08)', border: `1px solid #60a5fa55`, borderRadius: RAD.md,
      padding: '10px 12px', marginBottom: 10, display: 'flex', gap: 10,
      alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 11, color: C.textSoft, lineHeight: 1.5, maxWidth: 760 }}>
        Viendo la corrida histórica <b>{shortHash(anchor?.run_id)}</b> ({fmtDate(anchor?.finished_at)}).
        Los <b>Hallazgos</b> y su <b>exportación</b> corresponden a esta corrida. El <b>Resumen</b>,
        la <b>Escalera</b>, las <b>Señales por dominio</b> y las <b>Capacidades</b> siguen mostrando la
        corrida <b>más reciente</b>: el backend M7 no expone un payload completo por corrida
        (<code>/latest</code> no acepta run_id).
      </div>
      <button onClick={onClear} style={{
        fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
        background: 'transparent', color: '#60a5fa', border: `1px solid #60a5fa66`, whiteSpace: 'nowrap' }}>
        Volver a la más reciente
      </button>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 16px 60px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: '0 0 2px' }}>Rentabilidad y costos</h1>
      <div style={{ fontSize: 12, color: C.textLow, marginBottom: 12 }}>
        Cobertura económica, ingresos observables y camino hacia rentabilidad · observatorio read-only
      </div>
      {children}
    </div>
  )
}

// ── Resumen: qué hay, qué no, qué falta ──────────────────────────────────────
function Overview({ payload, summary, feats, reqs, historical }) {
  const verdicts = M7_VERDICT_ORDER.map((v) => ({
    v, n: {
      incumplimiento: summary.definitive_incident_rule_count,
      riesgo: summary.warning_rule_count, anomalia: summary.anomaly_rule_count,
      cumple: summary.compliant_rule_count, no_evaluable: summary.not_evaluable_rule_count,
    }[v] || 0,
  }))
  const available = [
    ['revenue_observable', 'Ingreso facturado observable'],
    ['current_standard_cost_presence', 'Presencia de costo estándar actual'],
    ['posted_expense_lines_observable', 'Cobertura contable observada'],
    ['m4_commercial_truth_available', 'Equipo comercial técnico (team_id)'],
  ].filter(([k]) => feats[k] === true)
  const notAvailable = [
    ['historical_cogs_observable', 'COGS histórico'],
    ['gross_margin_observable', 'Margen bruto'],
    ['contribution_margin_observable', 'Margen de contribución'],
    ['consolidated_profitability_supported', 'Rentabilidad consolidada'],
    ['route_cost_observable', 'Costos logísticos / de ruta'],
    ['operating_profit_observable', 'Utilidad operativa'],
    ['net_profit_observable', 'Utilidad neta'],
  ].filter(([k]) => feats[k] !== true)
  return (
    <>
      {historical && <div data-testid="m7-overview-latest-tag" style={{ fontSize: 10, fontWeight: 700,
        color: C.textLow, marginTop: 12 }}>Resumen · corrida más reciente (no la corrida histórica seleccionada).</div>}
      <Block title="Ejes del dictamen (4 ejes independientes)"
        note="classification · verdict · severity · lifecycle no se derivan uno de otro. status=RED NO es incumplimiento.">
        {verdicts.map(({ v, n }) => (
          <div key={v} title={M7_VERDICT_HELP[v]} style={{
            background: C.surface, border: `1px solid ${M7_VERDICT_COLORS[v]}45`, borderRadius: RAD.md,
            padding: '10px 12px', minWidth: 128, flex: '1 1 128px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: M7_VERDICT_COLORS[v], letterSpacing: 0.4 }}>
              {M7_VERDICT_LABELS[v]}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{n} reglas</div>
          </div>
        ))}
      </Block>
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 8, lineHeight: 1.5,
        background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: RAD.sm, padding: '8px 10px' }}>
        <b>{fmtInt(summary.total_rules)} reglas · {fmtInt(summary.total_incidences)} incidencias.</b> {M7_INCIDENCES_NOTE}
      </div>

      <Block title="Qué está disponible">
        {available.map(([k, l]) => (
          <div key={k} style={{ background: C.successSoft || C.surface, border: `1px solid ${C.success}40`,
            borderRadius: RAD.md, padding: '9px 11px', minWidth: 190, flex: '1 1 190px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{l}</div>
            <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2 }}>observable</div>
          </div>
        ))}
      </Block>

      <Block title="Qué NO está disponible (con su razón medida)"
        note="Cada capability en false; nunca se muestra como 0. Ver la escalera para los requisitos que faltan.">
        {notAvailable.map(([k, l]) => (
          <UnavailableCard key={k} label={l}
            reason={reqs[k]?.reason || 'capability=false en el contrato del backend'} />
        ))}
      </Block>
    </>
  )
}

// ── Escalera + DAG de requisitos ─────────────────────────────────────────────
function Ladder({ level, feats, reqs }) {
  return (
    <>
      <Block title="Escalera económica" note="Sólo L1 está activo con la evidencia actual. Sin barra de progreso: no es un % de rentabilidad.">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {M7_LEVEL_LADDER.map((lv) => {
            const active = lv.id === level
            const reached = M7_LEVEL_LADDER.findIndex((x) => x.id === level) >= M7_LEVEL_LADDER.findIndex((x) => x.id === lv.id)
            return (
              <div key={lv.id} data-testid="m7-ladder-row" data-active={active} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
                background: active ? (C.successSoft || C.surface) : C.surfaceSoft,
                border: `1px solid ${active ? C.success + '55' : C.border}`, borderRadius: RAD.sm }}>
                <span aria-hidden style={{ fontSize: 14, marginTop: 1 }}>{reached ? (active ? '●' : '○') : '·'}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? C.text : C.textMuted }}>
                    {lv.label}{active && <span style={{ color: C.success, marginLeft: 8, fontSize: 10 }}>ACTUAL</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 2, lineHeight: 1.4 }}>{lv.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Block>

      <Block title="Requisitos por capability (DAG del backend)"
        note="Prerequisites + compatibilidades (moneda · UOM · fecha · granularidad · compañía · match histórico). Ningún nivel se activa manualmente.">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(reqs).map(([cap, r]) => (
            <div key={cap} data-testid="m7-dag-cap" data-cap={cap} data-enabled={r.enabled} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: RAD.sm, padding: '9px 11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                  {M7_CAPABILITY_LABELS[cap] || cap}</span>
                <Pill color={r.enabled ? C.success : STATUS.NE}>{r.enabled ? 'DISPONIBLE' : 'NO disponible'}</Pill>
              </div>
              {!r.enabled && (
                <div style={{ fontSize: 10, color: C.textLow, marginTop: 5, lineHeight: 1.5 }}>
                  <b>Falta:</b> {(r.unmet_requirements || []).map((u) =>
                    M7_CAPABILITY_LABELS[u] || M7_COMPATIBILITY_LABELS[u] || u).join(' · ') || '—'}
                </div>
              )}
            </div>
          ))}
        </div>
      </Block>
    </>
  )
}

// ── Señales por dominio ──────────────────────────────────────────────────────
function Sections({ payload, feats, invoiceRows, caps, historical }) {
  return (
    <>
      {historical && <div data-testid="m7-sections-latest-tag" style={{ fontSize: 10, fontWeight: 700,
        color: C.textLow, marginTop: 12 }}>Señales por dominio · corrida más reciente (no la corrida histórica seleccionada).</div>}
      <Block title="1 · Ingresos observables (POR MONEDA — jamás sumados)"
        note="Pedido ≠ ingreso; factura ≠ cobro. Importes siempre con su moneda; sin total global.">
        <MetricTile label="Pedidos confirmados" unit="pedidos" payload={payload}
          query="sale_order_metrics" field="confirmed_count" universe="confirmed_sales_orders_in_scope" />
        <MetricTile label="Pedidos sin facturar por completo" unit="pedidos" payload={payload} tone={STATUS.AMBER}
          query="sale_order_metrics" field="uninvoiced_count" universe="confirmed_sales_orders_in_scope"
          caveat="invoice_status != invoiced; brecha comercial-facturación, no fuga probada." />
        <MetricTile label="Facturas publicadas · MXN" unit="documentos" payload={payload}
          query="invoice_revenue_by_currency" field="invoice_count" universe="posted_customer_invoices_in_scope" />
        {invoiceRows.map((row) => (
          <div key={row.currency_id} style={{ background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: RAD.md, padding: '10px 12px', minWidth: 170, flex: '1 1 170px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
              {fmtMoney(row.untaxed_total, curName(row.currency_id))}</div>
            <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
              Ingreso facturado · {curName(row.currency_id)}</div>
            <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2 }}>
              {fmtInt(row.invoice_count)} facturas · sin normalización FX</div>
          </div>
        ))}
        <MetricTile label="Notas de crédito publicadas · MXN" unit="documentos" payload={payload}
          query="credit_note_by_currency" field="credit_note_count" universe="posted_credit_notes_in_scope"
          caveat="Ingreso neto = facturas − NC (0 en ventana)." />
      </Block>

      <Block title="2 · Presencia de costo estándar ACTUAL (NO es COGS ni margen)"
        note="Indica presencia del costo configurado hoy. No representa costo histórico de venta, COGS ni margen.">
        <MetricTile label="Líneas con costo estándar actual" unit="líneas" payload={payload}
          query="sales_lines_current_cost_presence" field="with_current_standard_price_count"
          universe="sales_lines_cost_presence_in_scope" />
        <MetricTile label="Líneas SIN costo estándar actual" unit="líneas" payload={payload} tone={STATUS.AMBER}
          query="sales_lines_current_cost_presence" field="without_current_standard_price_count"
          universe="sales_lines_cost_presence_in_scope" />
      </Block>

      <Block title="3 · Match de costo histórico"
        note="No existe un algoritmo validado para vincular cada línea de venta con su costo histórico comparable.">
        <div style={{ background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: RAD.md,
          padding: '10px 12px', minWidth: 220, flex: '1 1 220px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.textLow }}>—</div>
          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>Match histórico</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.textLow, marginTop: 3 }}>NO EVALUABLE</div>
          <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 3, lineHeight: 1.4 }}>
            count = <b>null</b> · denominador = {fmtInt(caps.historical_sales_cost_match_denominator)} ·
            pct = <b>null</b> · supported = false. Un null jamás se pinta como 0.
          </div>
        </div>
      </Block>

      <Block title="4 · Señales de capas de valoración"
        note="Fecha técnica svl_create_date (creación de la capa), NO fecha económica/contable de valuación.">
        <MetricTile label="Capas con costo unitario no positivo" unit="capas" payload={payload} tone={STATUS.AMBER}
          query="valuation_layer_metrics" field="nonpositive_unit_cost_count" universe="stock_valuation_layers_in_scope"
          caveat="En el universo observado; clasificación exploratoria/caveated, sin interpretación automática." />
      </Block>

      <Block title="5 · Gastos contabilizados (universo/ventana observados)"
        note="Si es cero: no se observaron líneas dentro de la ventana y clasificación definidas. No afirma ausencia de gastos.">
        <MetricTile label="Líneas de gasto publicadas" unit="líneas" payload={payload}
          query="expense_analytic_metrics" field="expense_line_count" universe="expense_move_lines_in_scope" />
        <UnavailableCard label="Utilidad operativa"
          reason="comprehensive_operating_expenses_observable=false; operating_profit_observable=false" />
      </Block>

      <Block title="6 · Moneda y consolidación"
        note="No hay cobertura suficiente de tasas históricas aplicables para consolidar monedas.">
        <MetricTile label="Monedas detectadas" unit="monedas" payload={payload}
          query="currency_metrics" field="currency_count" universe="currency_context_in_scope" />
        <MetricTile label="Tasas FX aplicables en ventana" unit="tasas" payload={payload}
          query="currency_metrics" field="applicable_rate_count_in_window" universe="currency_context_in_scope"
          caveat="0 ⇒ sin normalización; no se suma MXN+USD ni se convierte con tasa actual." />
        <UnavailableCard label="Rentabilidad consolidada"
          reason="currency_normalization_supported=false; consolidated_profitability_supported=false" />
      </Block>

      <Block title="7 · Cobertura de equipo comercial técnico (team_id)"
        note="team_id es EQUIPO comercial técnico, no un canal comercial validado ni segmentación.">
        <MetricTile label="Pedidos con equipo técnico" unit="pedidos" payload={payload}
          query="sale_order_metrics" field="with_team_count" universe="confirmed_sales_orders_in_scope" />
        <MetricTile label="Pedidos sin equipo técnico" unit="pedidos" payload={payload}
          query="sale_order_metrics" field="missing_team_count" universe="confirmed_sales_orders_in_scope" />
      </Block>

      <Block title="8 · Flota y rutas (señales; sin costo observable)"
        note="No se calcula costo por km/ruta/kg sin costo observable: esa capability queda no disponible.">
        <MetricTile label="Vehículos activos" unit="vehículos" payload={payload}
          query="fleet_cost_metrics" field="vehicle_count" universe="fleet_cost_records_in_scope" />
        <MetricTile label="Vehículos sin compañía" unit="vehículos" payload={payload}
          query="fleet_cost_metrics" field="vehicles_without_company_count" universe="fleet_cost_records_in_scope" />
        <MetricTile label="Rutas terminales con distancia" unit="rutas" payload={payload}
          query="route_readiness_metrics" field="with_distance_count" universe="terminal_routes_in_scope" />
        <UnavailableCard label="Costo por ruta / km / kg"
          reason="route_cost_observable=false; allocation_supported=false (sin política aprobada)" />
      </Block>
    </>
  )
}

// ── Hallazgos (server-side + ANCLADOS a la corrida seleccionada) ─────────────
// El run_id/scope_key vienen del anchor (runController), NO de los filtros: cambiar
// filtro o página conserva la corrida. Guarda de carrera: una respuesta tardía de
// otra corrida no pisa la vista. Defensa: se verifica el run_id que ecoa el backend.
function FindingsTab({ demo, selection, demoPayload }) {
  const anchor = selectedRunContext(selection)
  const [filters, setFilters] = useState(M7_DEFAULT_FILTERS)
  const [state, setState] = useState({ phase: 'loading' })
  const mounted = useRef(true)
  const guard = useRef(makeSeqGuard())
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback(async (f) => {
    const token = guard.current.next()
    setState({ phase: 'loading' })
    if (demo) {
      const items = (demoPayload?.findings) || []
      if (guard.current.isStale(token) || !mounted.current) return
      setState({ phase: 'ok', demo: true, items, total: items.length, page: 1, pages: 1,
        rejected: [], runId: anchor?.run_id })
      return
    }
    const res = await fetchM7Findings(planFindingsRequest(selection, f))
    if (guard.current.isStale(token) || !mounted.current) return // respuesta fuera de orden ⇒ descartar
    if (res.state !== 'ok') { setState({ phase: res.state }); return }
    if (findingsAnchorMismatch(res.payload, selection)) { setState({ phase: 'run_mismatch' }); return }
    setState({ phase: 'ok', demo: false, items: res.payload.items, total: res.payload.total,
      page: res.payload.page, pages: res.payload.pages, rejected: res.payload.rejected_params || [],
      runId: res.payload.run_id })
  }, [demo, demoPayload, selection, anchor])

  // Cambiar de corrida anclada reinicia la paginación (no el run).
  useEffect(() => { setFilters((s) => ({ ...s, page: 1 })) }, [anchor?.run_id, anchor?.scope_key])
  useEffect(() => { load(filters) }, [load, filters])

  const setPage = (p) => setFilters((s) => ({ ...s, page: Math.max(1, p) }))

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10.5, color: C.textLow, marginBottom: 6 }}>
        Hallazgos de la corrida <b>{shortHash(anchor?.run_id)}</b>
        {anchor && !anchor.isLatest ? ' (histórica)' : ' (más reciente)'} · anclados por run_id + scope_key.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {M7_FILTER_AXES.map((ax) => (
          <label key={ax.key} style={{ fontSize: 11, color: C.textMuted }}>
            <span style={{ marginRight: 4 }}>{ax.label}</span>
            <select aria-label={ax.label} value={filters[ax.key]}
              onChange={(e) => setFilters((s) => ({ ...s, [ax.key]: e.target.value, page: 1 }))}
              style={selectStyle}>
              <option value="">(todos)</option>
              {ax.options.map((o) => <option key={o} value={o}>{ax.labels[o] || o}</option>)}
            </select>
          </label>
        ))}
        <span style={{ fontSize: 10.5, color: C.textLow }}>{activeFilterCount(filters)} filtros · server-side</span>
      </div>

      {demo && <div style={{ fontSize: 10.5, color: '#fbbf24', marginTop: 6 }}>
        ⚠ En demo el filtrado server-side NO se simula: se muestra el conjunto completo del fixture.</div>}

      {state.phase === 'ok' && state.rejected?.length > 0 && (
        <div style={{ fontSize: 11, color: STATUS.RED, marginTop: 6, background: 'rgba(239,68,68,0.08)',
          border: `1px solid ${STATUS.RED}40`, borderRadius: RAD.sm, padding: '6px 8px' }}>
          Parámetros rechazados por el backend: {state.rejected.join(', ')} — la lista NO se filtró por ellos.
        </div>
      )}

      {state.phase === 'loading' && <FullState title="Cargando hallazgos…" />}
      {state.phase === 'run_mismatch' && <FullState tone={STATUS.RED}
        title="Corrida no coincide"
        detail="El backend devolvió una corrida distinta a la seleccionada. No se muestran datos que no correspondan al run pedido." />}
      {state.phase !== 'ok' && state.phase !== 'loading' && state.phase !== 'run_mismatch' &&
        <FullState title={(STATE_COPY[state.phase] || STATE_COPY.error)[0]}
          detail={(STATE_COPY[state.phase] || STATE_COPY.error)[1]} />}

      {state.phase === 'ok' && (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ color: C.textLow, textAlign: 'left' }}>
                {['Regla', 'Categoría', 'Título', 'Clasif.', 'Veredicto', 'Sev.', 'Ciclo', 'Incid.'].map((h) => (
                  <th key={h} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.items.map((it) => (
                <tr key={it.finding_key} title={it.evidence_limitations || ''}>
                  <td style={td}>{it.rule_code}</td>
                  <td style={td}>{categoryLabel(it.category)}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{it.title}</td>
                  <td style={td}>{M7_CLASSIFICATION_LABELS[it.classification] || it.classification}</td>
                  <td style={{ ...td, color: M7_VERDICT_COLORS[it.verdict], fontWeight: 700 }}>
                    {M7_VERDICT_LABELS[it.verdict] || it.verdict}</td>
                  <td style={td}>{M7_SEVERITY_LABELS[it.severity] || it.severity}</td>
                  <td style={td}>{M7_LIFECYCLE_LABELS[it.lifecycle_status] || it.lifecycle_status}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtInt(it.incidences)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            {!demo && (
              <>
                <button disabled={state.page <= 1} onClick={() => setPage(state.page - 1)}
                  style={pagerStyle(state.page <= 1)}>‹ anterior</button>
                <button disabled={state.page >= state.pages} onClick={() => setPage(state.page + 1)}
                  style={pagerStyle(state.page >= state.pages)}>siguiente ›</button>
              </>
            )}
            <span style={{ fontSize: 10.5, color: C.textLow }}>
              {fmtInt(state.total)} hallazgos · página {state.page}/{state.pages} · {M7_INCIDENCES_NOTE}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Corridas (selección que RE-ANCLA findings/export; summary sigue latest) ──
function RunsTab({ demo, selection, dispatch, demoPayload }) {
  const anchor = selectedRunContext(selection)
  const latestRunId = selection?.latest?.run_id
  const [state, setState] = useState({ phase: 'loading' })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  useEffect(() => {
    (async () => {
      if (demo) {
        const r = demoPayload?.run || {}
        setState({ phase: 'ok', demo: true, items: [{
          run_id: r.run_id, scope_key: r.scope_key, finished_at: r.finished_at,
          is_production_shell_run: !!r.is_production_shell_run,
          measurement_method: r.measurement_method || 'xml_rpc_read_only',
          auditor_build_sha: r.auditor_build_sha,
          finding_count: (demoPayload?.findings || []).length }] })
        return
      }
      const res = await fetchM7Runs(planRunsRequest())
      if (!mounted.current) return
      setState(res.state === 'ok' ? { phase: 'ok', items: res.payload.items } : { phase: res.state })
    })()
  }, [demo, demoPayload])

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
        Selecciona una corrida: sus <b>Hallazgos</b> y su <b>exportación</b> se anclan a ese
        <b> run_id</b> (+ scope_key). El <b>Resumen</b> y las <b>Capacidades</b> siguen mostrando la
        corrida más reciente — el backend M7 no expone un payload completo por corrida. Un run_id
        desconocido produce error visible; jamás cae a la última corrida.
      </div>
      {state.phase === 'loading' && <FullState title="Cargando corridas…" />}
      {state.phase !== 'ok' && state.phase !== 'loading' &&
        <FullState title={(STATE_COPY[state.phase] || STATE_COPY.error)[0]}
          detail={(STATE_COPY[state.phase] || STATE_COPY.error)[1]} />}
      {state.phase === 'ok' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead><tr style={{ color: C.textLow, textAlign: 'left' }}>
              {['run_id', 'scope_key', 'Corte', 'Evidencia', 'auditor', 'Hallazgos', ''].map((h) => (
                <th key={h} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {state.items.map((r) => {
                const isAnchor = anchor?.run_id === r.run_id
                const isLatest = latestRunId === r.run_id
                return (
                  <tr key={r.run_id} data-selected={isAnchor}>
                    <td style={td}>{shortHash(r.run_id)}{isLatest &&
                      <span style={{ marginLeft: 6, fontSize: 9, color: C.textLow }}>· más reciente</span>}</td>
                    <td style={td}>{shortHash(r.scope_key)}</td>
                    <td style={td}>{fmtDate(r.finished_at)}</td>
                    <td style={td}>{r.is_production_shell_run
                      ? <Pill color={C.success}>FORMAL</Pill> : <Pill color="#f59e0b">NO FORMAL</Pill>}</td>
                    <td style={td}>{shortHash(r.auditor_build_sha)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtInt(r.finding_count)}</td>
                    <td style={td}>
                      {isAnchor
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>viendo</span>
                        : <button onClick={() => dispatch(selectRunAction(r))} style={{
                            fontSize: 10.5, padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                            background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` }}>
                            Ver</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {anchor && !anchor.isLatest && (
            <button onClick={() => dispatch(clearRunAction())} style={{
              marginTop: 8, fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              cursor: 'pointer', background: 'transparent', color: '#60a5fa', border: `1px solid #60a5fa66` }}>
              Volver a la corrida más reciente
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ── Alcance (scope técnico legible, sin PII) ─────────────────────────────────
// El scope económico completo (ventana/monedas/date_basis…) SÓLO existe para la
// corrida más reciente. Para una corrida histórica anclada, el backend no lo
// expone: se muestra su metadata y se DECLARA el faltante (no se inventa).
function ScopeTab({ run, scope, caps, lin, anchor, historical }) {
  const rows = [
    ['Compañías', (scope.company_ids || []).join(', ')],
    ['Sucursales', (scope.branch_ids || []).join(', ') || '(agregado, sin sucursal)'],
    ['Monedas', (scope.currency_ids || []).map(curName).join(' + ')],
    ['Base temporal', scope.date_basis],
    ['Ventana', `[${scope.window_start} → ${scope.window_end_exclusive})`],
    ['Granularidad', 'aggregate'],
    ['Método de costo', scope.cost_method],
    ['Política de asignación', scope.allocation_policy_id],
    ['scope_key', run.scope_key],
    ['run_id', run.run_id],
    ['Nivel económico', caps.profitability_level_reached],
    ['auditor_build_sha', run.auditor_build_sha],
    ['contract_build_sha', run.contract_build_sha || '(sin sellar)'],
    ['evidence_sha256', run.evidence_sha256],
    ['Medición', run.measurement_method],
    ['Corrida formal', String(run.is_production_shell_run)],
    ['Linaje', `pre-migración · re-sellado requerido: ${lin.reseal_required}`],
  ]
  return (
    <section style={{ marginTop: 16 }}>
      {historical && anchor && (
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 8, background: 'rgba(96,165,250,0.08)',
          border: `1px solid #60a5fa55`, borderRadius: RAD.sm, padding: '8px 10px', lineHeight: 1.5 }}>
          <b>Corrida anclada</b> (findings/export): run_id {shortHash(anchor.run_id)} · scope_key
          {' '}{shortHash(anchor.scope_key)} · corte {fmtDate(anchor.finished_at)} ·
          {' '}auditor {shortHash(anchor.auditor_build_sha)}. El <b>scope económico completo</b>
          {' '}(ventana, monedas, date_basis, cost_method) NO está disponible por corrida histórica:
          el backend sólo lo expone para la corrida más reciente (mostrada abajo).
        </div>
      )}
      <div style={{ fontSize: 10, color: C.textLow, marginBottom: 4 }}>
        Alcance de la corrida <b>más reciente</b>{historical ? ' (no la anclada)' : ''}:
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ ...td, color: C.textLow, whiteSpace: 'nowrap', fontWeight: 700 }}>{k}</td>
              <td style={{ ...td, wordBreak: 'break-all' }}>{v ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ── Exports: findings ANCLADOS a la corrida vista; evidencia/capacidades=latest ──
function ExportsBar({ payload, demo, selection }) {
  const lin = lineageState(payload)
  const anchor = selectedRunContext(selection)
  const historical = !isLatestSelected(selection)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Reúne TODOS los hallazgos de la corrida anclada (no sólo la página visible).
  async function collectAnchoredFindings() {
    if (demo) return payload.findings || []
    const acc = []
    let page = 1
    for (;;) {
      const res = await fetchM7Findings({ ...planFindingsRequest(selection, {}), page, page_size: 200 })
      if (res.state !== 'ok') throw new Error(res.state)
      if (findingsAnchorMismatch(res.payload, selection)) throw new Error('run_mismatch')
      acc.push(...(res.payload.items || []))
      if (page >= (res.payload.pages || 1) || acc.length >= M7_EXPORT_MAX_ROWS) break
      page += 1
    }
    return acc
  }

  const doExport = async (kind) => {
    if (busy) return
    setErr('')
    const base = { demo, nonformal: !lin.is_production_shell_run, unconsolidated: true }
    try {
      if (kind === 'findings') {
        setBusy(true)
        const items = await collectAnchoredFindings()
        const runTag = shortHash(anchor?.run_id).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'run'
        downloadTextFile(
          findingsToCsv(items, payload, { demo, runContext: anchor }),
          exportFilename(`m7_hallazgos_${runTag}`, 'csv', { ...base, stale: historical }), 'text/csv')
      } else if (kind === 'evidence') {
        // evidencia/summary/capabilities SÓLO existen para la corrida más reciente.
        downloadTextFile(evidenceJson(payload, { demo }),
          exportFilename('m7_evidencia_latest', 'json', base), 'application/json')
      } else if (kind === 'capabilities') {
        downloadTextFile(capabilitiesText(payload),
          exportFilename('m7_capabilities_latest', 'txt', base), 'text/plain')
      }
    } catch (e) {
      setErr(String(e?.message || 'error'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.textLow }}>Exportar (sin PII · por moneda · linaje declarado):</span>
        {[['findings', 'Hallazgos CSV'], ['evidence', 'Evidencia JSON (latest)'], ['capabilities', 'Capabilities TXT (latest)']].map(([k, l]) => (
          <button key={k} disabled={busy} onClick={() => doExport(k)} style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 999, cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1, background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` }}>{l}</button>
        ))}
        {busy && <span style={{ fontSize: 10.5, color: C.textLow }}>preparando export…</span>}
      </div>
      {historical && <div style={{ fontSize: 10, color: C.textLow, marginTop: 6 }}>
        El CSV de hallazgos corresponde a la corrida anclada {shortHash(anchor?.run_id)}. Evidencia y
        capacidades corresponden a la corrida más reciente (el backend no expone ese payload por corrida).</div>}
      {err && <div style={{ fontSize: 10.5, color: STATUS.RED, marginTop: 6 }}>No se pudo exportar: {err}</div>}
    </div>
  )
}

const pagerStyle = (disabled) => ({
  fontSize: 10.5, padding: '3px 10px', borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1, background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`,
})

const td = { padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.textSoft }
const selectStyle = {
  background: C.bg1, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '5px 7px', fontSize: 11.5, maxWidth: 170,
}
