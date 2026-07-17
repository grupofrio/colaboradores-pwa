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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { fetchM7Latest, fetchM7Findings, fetchM7Runs } from './m7/m7Api'
import { isM7DemoAllowed } from './m7/demoGate'
import {
  M7_DEFAULT_FILTERS, M7_PAGE_SIZE, M7_FILTER_AXES, M7_UNSUPPORTED_FILTERS,
  buildFindingsParams, activeFilterCount,
} from './m7/filters'
import {
  findingsToCsv, evidenceJson, capabilitiesText, downloadTextFile, exportFilename,
} from './m7/exporters'
import {
  M7_VERDICT_ORDER, M7_VERDICT_LABELS, M7_VERDICT_COLORS, M7_VERDICT_HELP,
  M7_CLASSIFICATION_LABELS, M7_SEVERITY_LABELS, M7_LIFECYCLE_LABELS,
  M7_LEVEL_LADDER, M7_CAPABILITY_LABELS, M7_COMPATIBILITY_LABELS,
  M7_INCIDENCES_NOTE, M7_EVIDENCE_SOURCE_LABELS, categoryLabel,
} from './m7/m7Meta'
import { resolveM7Metric, lineageState, M7_LIFECYCLE_STATES_UNSUPPORTED } from './m7/contract'
import { M7_API_FIXTURE_PROVENANCE, M7_API_LATEST_FIXTURE } from './m7/fixtures/apiLatestFixture'

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

export default function ScreenRentabilidadCostosM7({ session }) {
  const typo = getTypo ? getTypo() : {}
  const location = useLocation()
  const demoRequested = useMemo(
    () => new URLSearchParams(location.search).get('demo') === '1', [location.search])
  const demoAllowed = isM7DemoAllowed(import.meta.env)

  const [load, setLoad] = useState({ phase: 'loading' })
  const [tab, setTab] = useState('overview')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const loadLatest = useCallback(async () => {
    setLoad({ phase: 'loading' })
    if (demoRequested && demoAllowed) {
      setLoad({ phase: 'ok', payload: M7_API_LATEST_FIXTURE, demo: true })
      return
    }
    const result = await fetchM7Latest()
    if (!mounted.current) return
    if (result.state === 'ok') setLoad({ phase: 'ok', payload: result.payload, demo: false })
    else setLoad({ phase: result.state, errors: result.errors })
  }, [demoRequested, demoAllowed])

  useEffect(() => { loadLatest() }, [loadLatest])

  if (load.phase === 'loading') return <Shell><FullState title={STATE_COPY.loading[0]} detail={STATE_COPY.loading[1]} /></Shell>
  if (load.phase !== 'ok') {
    const [t, d] = STATE_COPY[load.phase] || STATE_COPY.error
    return <Shell><FullState title={t} detail={d} tone={load.phase === 'forbidden' ? STATUS.RED : C.textMuted} /></Shell>
  }

  const payload = load.payload
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

  return (
    <Shell>
      {/* ── banners de estado del dato ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {load.demo && <Pill color="#a78bfa" title="Fixture del core real; NO evidencia en vivo">MODO DEMO</Pill>}
        {!lin.is_production_shell_run && <Pill color="#f59e0b" title="Medición read-only; corrida formal odoo-shell inexistente">EVIDENCIA NO FORMAL</Pill>}
        <Pill color="#f59e0b" title="El sello cambia al portar a grupofrio/gf">LINAJE PRE-MIGRACIÓN</Pill>
        {feats.multi_currency_detected && <Pill color="#60a5fa" title="Importes por moneda; sin total global">MULTI-MONEDA SIN CONSOLIDAR</Pill>}
      </div>

      {/* ── HOME: nivel económico observable ────────────────────────────────── */}
      <div style={{ background: C.surfaceStrong || C.surface, border: `1px solid ${C.borderBlue || C.border}`,
        borderRadius: RAD.lg, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textLow }}>NIVEL ECONÓMICO OBSERVABLE</div>
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

      {tab === 'overview' && <Overview payload={payload} summary={summary} feats={feats} reqs={reqs} />}
      {tab === 'ladder' && <Ladder level={level} feats={feats} reqs={reqs} />}
      {tab === 'sections' && <Sections payload={payload} feats={feats} invoiceRows={invoiceRows} caps={caps} />}
      {tab === 'findings' && <FindingsTab demo={load.demo} runId={run.run_id} scopeKey={run.scope_key} />}
      {tab === 'runs' && <RunsTab demo={load.demo} currentRunId={run.run_id} />}
      {tab === 'scope' && <ScopeTab run={run} scope={scope} caps={caps} lin={lin} />}

      {/* ── exports ────────────────────────────────────────────────────────── */}
      <ExportsBar payload={payload} demo={load.demo} />
    </Shell>
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
function Overview({ payload, summary, feats, reqs }) {
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
function Sections({ payload, feats, invoiceRows, caps }) {
  return (
    <>
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

// ── Hallazgos (filtros server-side) ──────────────────────────────────────────
function FindingsTab({ demo, scopeKey }) {
  const [filters, setFilters] = useState(M7_DEFAULT_FILTERS)
  const [state, setState] = useState({ phase: 'loading' })
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const run = useCallback(async (f) => {
    setState({ phase: 'loading' })
    if (demo) {
      // El demo NO simula filtrado server-side: lo declara y muestra el fixture entero.
      const items = M7_API_LATEST_FIXTURE.findings || []
      setState({ phase: 'ok', demo: true, items, total: items.length, page: 1, pages: 1, rejected: [] })
      return
    }
    const res = await fetchM7Findings(buildFindingsParams(f))
    if (!mounted.current) return
    if (res.state === 'ok') setState({ phase: 'ok', demo: false, items: res.payload.items,
      total: res.payload.total, page: res.payload.page, pages: res.payload.pages,
      rejected: res.payload.rejected_params || [] })
    else setState({ phase: res.state })
  }, [demo])

  useEffect(() => { run(filters) }, [run, filters])

  return (
    <section style={{ marginTop: 16 }}>
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
      {state.phase !== 'ok' && state.phase !== 'loading' &&
        <FullState title={(STATE_COPY[state.phase] || STATE_COPY.error)[0]} />}

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
          <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
            {fmtInt(state.total)} hallazgos · página {state.page}/{state.pages} · {M7_INCIDENCES_NOTE}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Corridas (selección real por run_id) ─────────────────────────────────────
function RunsTab({ demo, currentRunId }) {
  const [state, setState] = useState({ phase: 'loading' })
  const [selected, setSelected] = useState('')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  useEffect(() => {
    (async () => {
      if (demo) {
        setState({ phase: 'ok', demo: true, items: [{
          run_id: currentRunId, scope_key: M7_API_LATEST_FIXTURE.run.scope_key,
          finished_at: M7_API_LATEST_FIXTURE.run.finished_at,
          is_production_shell_run: false, measurement_method: 'xml_rpc_read_only',
          auditor_build_sha: M7_API_LATEST_FIXTURE.run.auditor_build_sha, finding_count: 36 }] })
        return
      }
      const res = await fetchM7Runs()
      if (!mounted.current) return
      setState(res.state === 'ok' ? { phase: 'ok', items: res.payload.items } : { phase: res.state })
    })()
  }, [demo, currentRunId])

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>
        Selecciona una corrida por <b>run_id</b>: la vista carga EXACTAMENTE ese run. Un run_id
        desconocido produce error visible; jamás cae silenciosamente a la última corrida.
      </div>
      {state.phase === 'loading' && <FullState title="Cargando corridas…" />}
      {state.phase !== 'ok' && state.phase !== 'loading' &&
        <FullState title={(STATE_COPY[state.phase] || STATE_COPY.error)[0]} />}
      {state.phase === 'ok' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead><tr style={{ color: C.textLow, textAlign: 'left' }}>
              {['run_id', 'scope_key', 'Corte', 'Evidencia', 'auditor', 'Hallazgos', ''].map((h) => (
                <th key={h} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {state.items.map((r) => (
                <tr key={r.run_id} data-selected={selected === r.run_id}>
                  <td style={td}>{shortHash(r.run_id)}</td>
                  <td style={td}>{shortHash(r.scope_key)}</td>
                  <td style={td}>{fmtDate(r.finished_at)}</td>
                  <td style={td}>{r.is_production_shell_run
                    ? <Pill color={C.success}>FORMAL</Pill> : <Pill color="#f59e0b">NO FORMAL</Pill>}</td>
                  <td style={td}>{shortHash(r.auditor_build_sha)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtInt(r.finding_count)}</td>
                  <td style={td}><button onClick={() => setSelected(r.run_id)} style={{
                    fontSize: 10.5, padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                    background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` }}>
                    Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Alcance (scope técnico legible, sin PII) ─────────────────────────────────
function ScopeTab({ run, scope, caps, lin }) {
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

function ExportsBar({ payload, demo }) {
  const lin = lineageState(payload)
  const doExport = (kind) => {
    const opts = { demo, nonformal: !lin.is_production_shell_run, unconsolidated: true }
    if (kind === 'findings') {
      downloadTextFile(findingsToCsv(payload.findings, payload, { demo }),
        exportFilename('m7_hallazgos', 'csv', opts), 'text/csv')
    } else if (kind === 'evidence') {
      downloadTextFile(evidenceJson(payload, { demo }),
        exportFilename('m7_evidencia', 'json', opts), 'application/json')
    } else if (kind === 'capabilities') {
      downloadTextFile(capabilitiesText(payload),
        exportFilename('m7_capabilities', 'txt', opts), 'text/plain')
    }
  }
  return (
    <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: C.textLow }}>Exportar (sin PII · por moneda · linaje declarado):</span>
      {[['findings', 'Hallazgos CSV'], ['evidence', 'Evidencia JSON'], ['capabilities', 'Capabilities TXT']].map(([k, l]) => (
        <button key={k} onClick={() => doExport(k)} style={{
          fontSize: 11, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
          background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` }}>{l}</button>
      ))}
    </div>
  )
}

const td = { padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.textSoft }
const selectStyle = {
  background: C.bg1, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '5px 7px', fontSize: 11.5, maxWidth: 170,
}
