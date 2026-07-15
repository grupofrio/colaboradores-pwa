// ─── ScreenVentasM4 — KOLD OS · M4 "Ventas y clientes" ──────────────────────
// Observatorio READ-ONLY de la operación comercial (maestro de clientes, canal,
// leads, pedidos, precio/descuento, recurrencia, portafolio, pérdida/recompra y
// señal M4→M2). Consume EXCLUSIVAMENTE la API autenticada de gf_kold_os_m4
// (GET /pwa-kold-os/m4/{latest,findings,runs}) vía api() — cero writes, cero
// botones de acción (auto_fix=false por contrato). M4 define segmento/motivo/
// oferta de recompra; NO ejecuta campañas/opt-in/automatización (M8, LOCK).
//
// CONTRATO PROVISIONAL: el backend está CONGELADO (978994c4) bajo auditoría de
// Codex. Los KPIs comerciales se derivan de `metrics` (el agregado real del
// contrato); el objeto `kpis` del backend congelado aún tiene forma M3 y emite
// None — gap DECLARADO para la corrección post-auditoría (M4_KNOWN_LIMITATIONS).
//
// La UI muestra VEREDICTOS, no solo colores: solo los INCUMPLIMIENTOS tienen
// umbral aprobado + supuesto verificado; las ANOMALÍAS señalan dónde mirar.
// El banner de evidencia se decide por el DATO (!run.is_production_shell_run),
// no por el modo de entrega.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { fetchM4Latest, fetchM4Findings } from './m4/m4Api'
import { isM4DemoAllowed } from './m4/demoGate'
import { applyFindingFilters, paginate, M4_DEFAULT_FILTERS, M4_PAGE_SIZE } from './m4/filters'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, recurrenceText,
  handoffM4M2Text, downloadTextFile, exportFilename,
} from './m4/exporters'
import {
  M4_CATEGORY_ORDER, M4_STATUS_LABELS, M4_LIFECYCLE_LABELS, M4_SEVERITY_LABELS,
  M4_GRANULARITY_LABELS, M4_VERDICT_ORDER, M4_VERDICT_LABELS, M4_VERDICT_COLORS,
  M4_VERDICT_HELP, M4_CLASSIFICATION_LABELS, M4_EVIDENCE_SOURCE_LABELS,
  M4_SHELL_BLOCKER_LABELS, categoryLabel,
} from './m4/m4Meta'
import { M4_API_FIXTURE_PROVENANCE, M4_API_LATEST_FIXTURE } from './m4/fixtures/apiLatestFixture'

const C = TOKENS.colors
const STATUS_COLORS = {
  GREEN: C.success, AMBER: '#f59e0b', RED: '#ef4444', NOT_EVALUABLE: 'rgba(255,255,255,0.45)',
}
const TECH_COLORS = { PASS: C.success, FAIL: '#ef4444', STALE: '#f59e0b', UNAVAILABLE: 'rgba(255,255,255,0.45)' }

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
const fmtInt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-MX') : '—')
const shortHash = (h) => (typeof h === 'string' && h.length > 14 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h || '—')

function Pill({ color, children, title }) {
  return (
    <span title={title} style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
      background: `${color}1c`, border: `1px solid ${color}40`, color, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function VerdictPill({ verdict }) {
  const color = M4_VERDICT_COLORS[verdict] || C.textMuted
  return <Pill color={color} title={M4_VERDICT_HELP[verdict]}>{M4_VERDICT_LABELS[verdict] || verdict}</Pill>
}

function VerdictTile({ verdict, rules, incidences }) {
  const color = M4_VERDICT_COLORS[verdict]
  return (
    <div title={M4_VERDICT_HELP[verdict]} style={{
      background: C.surface, border: `1px solid ${color}45`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 128, flex: '1 1 128px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.4 }}>{M4_VERDICT_LABELS[verdict]}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{rules} reglas</div>
      <div style={{ fontSize: 10.5, color: C.textMuted }}>{incidences != null ? `${fmtInt(incidences)} incidencias` : ' '}</div>
    </div>
  )
}

// KPI con universo/caveat obligatorios: sin contexto un número miente.
function KpiTile({ label, value, tone, universe, caveat }) {
  const note = [universe ? `Universo: ${universe}` : '', caveat || ''].filter(Boolean).join(' · ')
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 118, flex: '1 1 118px',
    }} title={note || undefined}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
      {universe && <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2 }}>{universe}</div>}
    </div>
  )
}

const selectStyle = {
  background: C.bg1, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 190,
}
const pagerBtn = (disabled) => ({
  background: C.surface, border: `1px solid ${C.border}`, color: disabled ? C.textLow : C.textSoft,
  borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
})
const exportBtn = {
  background: C.surface, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
}

function Header({ demo, technical, payload }) {
  const run = payload?.run
  const typo = getTypo ? getTypo() : {}
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ ...typo.h2, fontSize: 19, margin: 0 }}>Ventas y clientes</h1>
        <Pill color={C.blue3}>READ-ONLY</Pill>
        {technical && <Pill color={TECH_COLORS[technical] || C.textMuted}>AUDITOR: {technical}</Pill>}
        {payload?.summary?.overall_status && (
          <Pill color={STATUS_COLORS[payload.summary.overall_status] || C.textMuted}>
            DATOS: {payload.summary.overall_status}
          </Pill>
        )}
        {run && (
          <Pill color={run.is_production_shell_run ? C.success : '#7dd3fc'}>
            {run.is_production_shell_run ? 'EVIDENCIA FORMAL' : 'EVIDENCIA NO FORMAL'}
          </Pill>
        )}
        {demo && <Pill color="#f59e0b">DEMO</Pill>}
      </div>
      {run && (
        <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, lineHeight: 1.55 }}>
          KOLD OS · M4 (señal comercial: clientes, canales y ventas) · observatorio de la operación comercial
          — corte {fmtDateTime(run.finished_at)} · ventana [{run.scope?.window_start} → {run.scope?.window_end_exclusive})
          · compañías {(run.scope?.company_ids || []).join(', ')} · {(run.executed_queries || []).length} consultas
          · midió: {shortHash(run.auditor_build_sha)} · manifest {shortHash(run.manifest_sha256)}
          · evidencia {shortHash(run.evidence_sha256)} · fuente: API autenticada gf_kold_os_m4
        </p>
      )}
    </div>
  )
}

export default function ScreenVentasM4({ session }) {
  const location = useLocation()
  const demoAllowed = isM4DemoAllowed(import.meta.env)
  const demo = useMemo(
    () => demoAllowed && new URLSearchParams(location.search).get('demo') === '1',
    [demoAllowed, location.search],
  )
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M4_DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [table, setTable] = useState({ phase: 'idle', items: [], total: 0, pages: 1 })
  const [openFindingId, setOpenFindingId] = useState(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false } // descarta resultados tardíos
  }, [])

  // ── /latest ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (demo) {
      setLoad({ phase: 'ok', payload: M4_API_LATEST_FIXTURE, demo: true })
      return
    }
    setLoad({ phase: 'loading' })
    fetchM4Latest().then((result) => {
      if (!aliveRef.current) return
      if (result.state === 'ok') setLoad({ phase: 'ok', payload: result.payload, demo: false })
      else setLoad({ phase: result.state, errors: result.errors || [] })
    })
  }, [demo])

  const payload = load.phase === 'ok' ? load.payload : null
  const runsCount = payload?.history?.runs_count ?? 0
  const hasHistory = runsCount >= 2
  const stale = payload?.stale === true

  // ── /findings (server-side en real; local en demo) ────────────────────────
  const loadTable = useCallback(async () => {
    if (!payload) return
    if (demo) {
      const filtered = applyFindingFilters(payload.findings, filters)
      const local = paginate(filtered, page, M4_PAGE_SIZE)
      setTable({ phase: 'ok', items: local.items, total: local.total, pages: local.pages })
      return
    }
    setTable((prev) => ({ ...prev, phase: 'loading' }))
    const params = { page, page_size: M4_PAGE_SIZE }
    for (const [key, value] of Object.entries(filters)) if (value) params[key] = value
    const result = await fetchM4Findings(params)
    if (!aliveRef.current) return
    if (result.state === 'ok') {
      setTable({ phase: 'ok', items: result.payload.items, total: result.payload.total, pages: result.payload.pages })
    } else {
      setTable({ phase: 'error', items: [], total: 0, pages: 1, state: result.state })
    }
  }, [payload, demo, filters, page])

  useEffect(() => { loadTable() }, [loadTable])

  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }

  const blocks = useMemo(() => {
    if (!payload) return []
    return M4_CATEGORY_ORDER.map((key, index) => {
      const rules = payload.rule_results.filter((r) => r.category === key)
      const byVerdict = (v) => rules.filter((r) => r.verdict === v).length
      const incidences = rules.reduce((acc, r) => acc + (Number.isInteger(r.incidences) ? r.incidences : 0), 0)
      const worst = M4_VERDICT_ORDER.find((v) => byVerdict(v) > 0) || 'no_evaluable'
      return {
        key, order: index + 1, label: categoryLabel(key), rules, incidences, worst,
        incumplimientos: byVerdict('incumplimiento'), riesgos: byVerdict('riesgo'),
        anomalias: byVerdict('anomalia'), cumplen: byVerdict('cumple'),
        noEvaluables: byVerdict('no_evaluable'),
      }
    })
  }, [payload])

  const areas = useMemo(() => [...new Set((payload?.findings || []).map((f) => f.responsible_area))], [payload])
  const entityTypes = useMemo(() => [...new Set((payload?.findings || []).map((f) => f.entity_type))], [payload])
  const openFinding = useMemo(
    () => table.items.find((f) => f.finding_id === openFindingId) || null,
    [table.items, openFindingId],
  )

  // KPIs comerciales derivados de metrics (el agregado REAL del contrato) —
  // el objeto `kpis` del backend congelado tiene forma M3 y emite None (gap
  // declarado). Cada tile porta universo + caveat; el corte va en el header.
  const kpi = useMemo(() => {
    const first = (id) => (payload?.metrics?.[id] || [])[0] || {}
    const master = first('customer_master_metrics')
    const orders = first('order_metrics')
    const rec = first('recurrence_metrics')
    const states = Object.fromEntries((payload?.metrics?.order_state_metrics || [])
      .filter((r) => r && typeof r === 'object').map((r) => [r.state, r.order_count]))
    return { master, orders, rec, states }
  }, [payload])

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '18px 16px 90px', color: C.text }
  const typo = getTypo ? getTypo() : {}

  if (load.phase === 'loading') {
    return <div style={wrap}><p style={{ color: C.textMuted, fontSize: 13 }}>Cargando observatorio comercial…</p></div>
  }

  // ── estados no-ok, honestos y accionables ─────────────────────────────────
  if (!payload) {
    const copy = {
      disabled: ['La API de M4 está apagada (flag)', 'El backend gf_kold_os_m4 responde feature_disabled: el flag gf_kold_os.m4.enabled sigue en "0". Encenderlo requiere S/N.'],
      unavailable: ['Sin fuente de datos disponible', 'La API autenticada de M4 (gf_kold_os_m4) aún no está desplegada o no tiene corridas ingeridas. El backend está CONGELADO (978994c4) bajo auditoría de Codex; el despliegue y la ingesta son gates posteriores.'],
      session_expired: ['Sesión expirada', 'Vuelve a iniciar sesión para consultar M4.'],
      forbidden: ['Sin permiso M4', 'Tu sesión no tiene acceso M4 (direccion_general / admin_plataforma). El acceso es fail-closed.'],
      schema_mismatch: ['Versión de contrato no soportada', 'El backend publica una versión de kold.os.m4.api que esta UI no soporta. Actualiza la PWA (no se intenta adivinar la estructura).'],
      invalid: ['Respuesta inválida del backend', 'El envelope no validó el contrato kold.os.m4.api/1; no se muestra nada derivado de datos corruptos.'],
      error: ['Error de red o servidor', 'No fue posible consultar la API de M4. Reintenta más tarde.'],
    }[load.phase] || ['Estado desconocido', 'No fue posible determinar el estado de la fuente M4.']
    return (
      <div style={wrap}>
        <Header demo={false} technical="UNAVAILABLE" payload={null} />
        <div style={{ marginTop: 18, padding: '18px 16px', borderRadius: TOKENS.radius.lg, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{copy[0]}</div>
          <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, marginTop: 8 }}>{copy[1]}</p>
          {demoAllowed && (
            <p style={{ fontSize: 12, color: C.textLow, marginTop: 6 }}>
              Modo demostración (solo este entorno): <code>?demo=1</code> — fixture PROVISIONAL generado por el core real del backend congelado, no evidencia en vivo.
            </p>
          )}
        </div>
      </div>
    )
  }

  const summary = payload.summary
  const run = payload.run
  const nonformal = run.is_production_shell_run !== true
  const exportMarks = { stale, demo: !!load.demo, nonformal }

  return (
    <div style={wrap}>
      <Header demo={load.demo} technical={run.technical_state} payload={payload} />

      {load.demo && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24',
        }}>
          MODO DEMO ({M4_API_FIXTURE_PROVENANCE.kind}, PROVISIONAL) — envelope generado por el core real del backend
          CONGELADO (GrupoVeniu/GrupoFrio {M4_API_FIXTURE_PROVENANCE.backend_frozen_commit.slice(0, 8)}, bajo auditoría
          de Codex) con los NÚMEROS REALES medidos en producción (XML-RPC read-only 2026-07-15). NO es una corrida
          odoo-shell, NO existe en producción y se regenera si la auditoría cambia el contrato.
        </div>
      )}

      {/* Evidencia NO FORMAL: se decide por el DATO, no por el modo demo. */}
      {nonformal && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12,
          background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.45)', color: '#7dd3fc',
        }}>
          <strong>EVIDENCIA NO FORMAL</strong> — los números son reales
          ({M4_EVIDENCE_SOURCE_LABELS[run.evidence_source] ?? run.evidence_source}), pero
          <strong> esto NO es la corrida formal por odoo-shell en producción</strong>.
          {run.production_shell_run_blocked_by?.length > 0 && (
            <> Bloqueada por: {run.production_shell_run_blocked_by
              .map((b) => M4_SHELL_BLOCKER_LABELS[b] ?? b).join(' · ')}.</>
          )}
          {' '}Midió el build <code>{shortHash(run.auditor_build_sha)}</code>.
        </div>
      )}

      {stale && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
          background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24',
        }}>
          ⚠ CORRIDA STALE — la auditoría tiene {payload.age_days ?? '?'} días (umbral: {payload.capabilities?.stale_days ?? 7}).
          Se puede leer, pero NO representa el estado vigente; los exports quedan marcados STALE.
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12,
        background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.textSoft, lineHeight: 1.5,
      }}>
        <b>Lee los veredictos, no solo los colores:</b> solo los INCUMPLIMIENTOS tienen umbral aprobado y supuesto
        verificado. Las ANOMALÍAS son señales exploratorias (dicen dónde mirar, no prueban una conclusión de negocio).
        M4 define segmento, motivo y oferta de recompra; NO ejecuta campañas ni automatización (eso es M8). M4 observa, no corrige.
      </div>

      {/* Qué prueba la evidencia */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 18 }}>Qué prueba la evidencia</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <VerdictTile verdict="incumplimiento" rules={summary.definitive_incident_rule_count ?? 0} incidences={summary.definitive_incident_count} />
        <VerdictTile verdict="riesgo" rules={summary.warning_rule_count ?? 0} incidences={summary.warning_count} />
        <VerdictTile verdict="anomalia" rules={summary.exploratory_signal_rule_count ?? 0} incidences={summary.exploratory_signal_count} />
        <VerdictTile verdict="cumple" rules={summary.compliant_rule_count ?? 0} incidences={null} />
        <VerdictTile verdict="no_evaluable" rules={summary.not_evaluable_rule_count ?? 0} incidences={null} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        Incidencias detectadas: {fmtInt(summary.total_incidences)} = suma exacta de incumplimientos + riesgos + anomalías.
        Son afectaciones por regla, NO entidades únicas (un mismo cliente/pedido puede aparecer en varias reglas).
        Historial: {runsCount} corrida(s){hasHistory ? '' : ' — tendencias y persistencia aparecen con la segunda'}.
      </div>

      {/* KPIs comerciales (derivados de metrics; universo declarado por tile) */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>Señal comercial — corte {fmtDateTime(run.finished_at)}</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <KpiTile label="Clientes comerciales" value={fmtInt(kpi.rec.customer_count)} universe="customer_rank>0 activos del scope" />
        <KpiTile label="Con compra en ventana" value={fmtInt(kpi.rec.active_in_window_count)} tone={STATUS_COLORS.GREEN} universe="≥1 pedido confirmado en la ventana" />
        <KpiTile label="Recurrentes (≥2 pedidos)" value={fmtInt(kpi.rec.recurrent_count)} universe="pedidos confirmados en ventana" />
        <KpiTile label="Sin compra en ventana" value={fmtInt(kpi.rec.dormant_count)} tone={STATUS_COLORS.AMBER}
          universe="clientes activos del scope" caveat='Definición de "dormido" NO aprobada (exploratorio)' />
        <KpiTile label="Nuevos con pedido" value={fmtInt(kpi.rec.new_with_order_count)} universe="creados en la ventana" />
        <KpiTile label="Nuevos sin 2ª compra" value={fmtInt(kpi.rec.new_without_second_count)} tone={STATUS_COLORS.AMBER}
          universe="nuevos con exactamente 1 pedido" caveat="Objetivo de 2ª compra NO aprobado" />
        <KpiTile label="Candidatos a pérdida" value={fmtInt(kpi.rec.lost_180_365_count)} tone={STATUS_COLORS.AMBER}
          universe="compraron en 365d, no en 180d" caveat='Definición de "perdido" NO aprobada' />
        <KpiTile label="Reactivados" value="—" universe="sin definición aprobada" caveat="Requiere definición + historial (v1.1)" />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <KpiTile label="Pedidos confirmados" value={fmtInt(kpi.orders.confirmed_count)} universe="state=sale en la ventana" />
        <KpiTile label="Cancelados" value={fmtInt(kpi.states.cancel)} universe="state=cancel en la ventana"
          caveat="Sin política de cancelación aprobada (observación)" />
        <KpiTile label="Entregados" value="—" universe="frontera M5" caveat="La verdad de entrega/inventario pertenece a M5" />
        <KpiTile label="Sin vendedor" value={fmtInt(kpi.orders.no_salesperson_count)} tone={STATUS_COLORS.AMBER}
          universe="pedidos confirmados" caveat="Incluye mostrador/PWA sin vendedor individual (riesgo, no incumplimiento)" />
        <KpiTile label="Venta a no-cliente" value={fmtInt(kpi.orders.non_customer_count)} tone={STATUS_COLORS.AMBER}
          universe="partner con customer_rank≤0" />
        <KpiTile label="Clientes sin canal" value={fmtInt(kpi.master.no_channel_count)} tone={STATUS_COLORS.AMBER}
          universe="clientes activos del scope" caveat="El canal vive en el CLIENTE (el pedido no tiene canal propio)" />
        <KpiTile label="Pedidos de clientes sin canal" value={fmtInt(kpi.orders.no_channel_customer_count)}
          universe="confirmados en la ventana" />
        <KpiTile label="Archivados con ventas" value={fmtInt(kpi.master.archived_with_sales_count)}
          universe="customer_rank>0, active=false" caveat="Posible pérdida no clasificada" />
      </div>

      {/* Bloques comerciales */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Bloques comerciales</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 10, marginTop: 10 }}>
        {blocks.map((block) => (
          <div key={block.key} style={{
            background: C.surface, border: `1px solid ${M4_VERDICT_COLORS[block.worst]}38`,
            borderRadius: TOKENS.radius.lg, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{block.order}. {block.label}</div>
              <VerdictPill verdict={block.worst} />
            </div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
              {fmtInt(block.incidences)} incidencias · {block.incumplimientos} incumpl. · {block.riesgos} riesgo ·{' '}
              {block.anomalias} anomalía · {block.cumplen} cumple · {block.noEvaluables} no eval.
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {block.rules.map((r) => (
                <div key={r.rule_code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: C.textSoft }}>
                    {r.rule_code} · {r.name}
                    {!r.approved_threshold && r.verdict !== 'cumple' && r.verdict !== 'no_evaluable' && (
                      <span style={{ color: C.textLow }} title="El umbral de esta regla NO está ratificado por dirección"> · umbral no aprobado</span>
                    )}
                  </span>
                  <span style={{ color: M4_VERDICT_COLORS[r.verdict], fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.observed_value ?? M4_VERDICT_LABELS[r.verdict]}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
              Tendencia: {hasHistory ? 'vs corrida anterior en el detalle' : 'sin historial (primera corrida)'} · Granularidad: AGREGADO (v1)
            </div>
            <button
              onClick={() => { setFilter('category', block.key); document.getElementById('m4-detalle')?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.blue3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver hallazgos de este bloque →
            </button>
          </div>
        ))}
      </div>

      {/* Detalle de regla (agregado v1) */}
      <h2 id="m4-detalle" style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>
        Detalle de regla ({table.total}) <Pill color={C.blue3}>{M4_GRANULARITY_LABELS.aggregate}</Pill>
      </h2>
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>
        El contrato v1 es agregado: aquí se detalla la REGLA, no clientes/pedidos individuales (cero PII por diseño).
        El detalle por cliente/canal/producto llega con la extensión v1.1 del contrato del auditor.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select aria-label="Categoría" style={selectStyle} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">Todas las categorías</option>
          {M4_CATEGORY_ORDER.map((key) => <option key={key} value={key}>{categoryLabel(key)}</option>)}
        </select>
        <select aria-label="Veredicto" style={selectStyle} value={filters.verdict} onChange={(e) => setFilter('verdict', e.target.value)}>
          <option value="">Todo veredicto</option>
          <option value="incumplimiento">Incumplimiento</option>
          <option value="riesgo">Riesgo</option>
          <option value="anomalia">Anomalía</option>
        </select>
        <select aria-label="Clasificación" style={selectStyle} value={filters.classification} onChange={(e) => setFilter('classification', e.target.value)}>
          <option value="">Toda clasificación</option>
          <option value="definitive">Definitiva</option>
          <option value="caveated">Con supuestos</option>
          <option value="exploratory">Exploratoria</option>
        </select>
        <select aria-label="Severidad" style={selectStyle} value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)}>
          <option value="">Toda severidad</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <select aria-label="Ciclo de vida" style={selectStyle} value={filters.lifecycle_status} onChange={(e) => setFilter('lifecycle_status', e.target.value)} disabled={!hasHistory}>
          <option value="">{hasHistory ? 'Todo ciclo de vida' : 'Ciclo de vida (requiere 2ª corrida)'}</option>
          <option value="new">Nuevo</option>
          <option value="persistent">Persistente</option>
          <option value="recurrent">Reincidente</option>
        </select>
        <select aria-label="Entidad" style={selectStyle} value={filters.entity_type} onChange={(e) => setFilter('entity_type', e.target.value)}>
          <option value="">Toda entidad</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Área responsable" style={selectStyle} value={filters.responsible_area} onChange={(e) => setFilter('responsible_area', e.target.value)}>
          <option value="">Toda área</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          aria-label="Buscar"
          placeholder="Buscar regla / referencia…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          style={{ ...selectStyle, minWidth: 170 }}
        />
      </div>

      <div style={{ overflowX: 'auto', marginTop: 10, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surfaceSoft, textAlign: 'left' }}>
              {['Veredicto', 'Regla', 'Hallazgo', 'Clasificación', 'Granularidad', 'Entidad', 'Observado', 'Ciclo', 'Área responsable', 'Última detección'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.phase === 'loading' && (
              <tr><td colSpan={10} style={{ padding: 14, color: C.textMuted }}>Cargando hallazgos…</td></tr>
            )}
            {table.phase === 'error' && (
              <tr><td colSpan={10} style={{ padding: 14, color: '#f87171' }}>No fue posible consultar /findings ({table.state}). Reintenta.</td></tr>
            )}
            {table.phase === 'ok' && table.items.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 14, color: C.textMuted }}>Sin hallazgos con estos filtros.</td></tr>
            )}
            {table.phase === 'ok' && table.items.map((f) => (
              <tr
                key={f.finding_id}
                onClick={() => setOpenFindingId(f.finding_id === openFindingId ? null : f.finding_id)}
                style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: f.finding_id === openFindingId ? C.surfaceSoft : 'transparent' }}
              >
                <td style={{ padding: '8px 10px' }}><VerdictPill verdict={f.verdict} /></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}>{f.rule_code}</td>
                <td style={{ padding: '8px 10px', minWidth: 200 }}>{f.title}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  {M4_CLASSIFICATION_LABELS[f.classification] || f.classification}
                  {!f.approved_threshold && <span style={{ color: C.textLow }} title="Umbral NO ratificado por dirección"> · s/umbral</span>}
                </td>
                <td style={{ padding: '8px 10px' }}><Pill color={C.blue3}>{M4_GRANULARITY_LABELS[f.granularity] || f.granularity}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.entity_type || '—'}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: M4_VERDICT_COLORS[f.verdict] }}>{f.observed_value}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{hasHistory ? (M4_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status) : '—'}</td>
                <td style={{ padding: '8px 10px' }}>{f.responsible_area}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDateTime(f.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button style={pagerBtn(page <= 1)} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Anterior</button>
        <span style={{ fontSize: 12, color: C.textMuted }}>Página {page} de {table.pages}</span>
        <button style={pagerBtn(page >= table.pages)} disabled={page >= table.pages} onClick={() => setPage((p) => Math.min(table.pages, p + 1))}>Siguiente →</button>
        <span style={{ fontSize: 10.5, color: C.textLow }}>Paginación server-side (page_size {M4_PAGE_SIZE}).</span>
      </div>

      {/* Panel de detalle del hallazgo */}
      {openFinding && (
        <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: TOKENS.radius.lg, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>{openFinding.rule_code} · {openFinding.title}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <VerdictPill verdict={openFinding.verdict} />
              <Pill color={openFinding.approved_threshold ? C.success : '#f59e0b'}>
                {openFinding.approved_threshold ? 'UMBRAL APROBADO' : 'UMBRAL NO APROBADO'}
              </Pill>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 18px', marginTop: 10, fontSize: 12, lineHeight: 1.55 }}>
            <div><b>Qué se observó:</b> {openFinding.observed_value || '—'}</div>
            <div><b>Qué se esperaba:</b> {openFinding.expected_rule || '—'}</div>
            <div><b>Universo medido:</b> {openFinding.universe || '—'}</div>
            <div><b>Cobertura:</b> {openFinding.denominator != null ? `${fmtInt(openFinding.numerator)} de ${fmtInt(openFinding.denominator)}${openFinding.pct != null ? ` (${openFinding.pct}%)` : ''}` : 'agregado sin denominador'}</div>
            <div><b>Supuesto de negocio:</b> {openFinding.business_assumption || '—'}</div>
            <div><b>Limitaciones de evidencia:</b> {openFinding.evidence_limitations || '—'}</div>
            <div><b>Umbral:</b> {openFinding.approved_threshold ? 'APROBADO' : 'NO APROBADO'} · fuente: {openFinding.threshold_source || '—'}</div>
            <div><b>Clasificación:</b> {M4_CLASSIFICATION_LABELS[openFinding.classification] || openFinding.classification} · severidad {M4_SEVERITY_LABELS[openFinding.severity] || openFinding.severity}</div>
            <div><b>Entidad:</b> {openFinding.entity_type || '—'} · {openFinding.entity_reference || 'agregado'}</div>
            <div><b>Ciclo de vida:</b> {hasHistory ? `${M4_LIFECYCLE_LABELS[openFinding.lifecycle_status] || openFinding.lifecycle_status} · ${openFinding.occurrence_count ?? 1} aparición(es) · primera ${fmtDateTime(openFinding.first_seen_at)}` : 'sin historial (primera corrida)'}</div>
            <div><b>Área responsable:</b> {openFinding.responsible_area || '—'}</div>
            <div><b>Acción recomendada:</b> {openFinding.recommended_action || '—'} <span style={{ color: C.textLow }}>(M4 observa; no ejecuta)</span></div>
            <div>
              <b>Linaje:</b> midió {shortHash(openFinding.evidence_reference?.auditor_build_sha)} · manifest {shortHash(openFinding.evidence_reference?.manifest_sha256)}
              · evidencia {shortHash(openFinding.evidence_reference?.evidence_sha256)}
              · query <code>{openFinding.evidence_reference?.query_id || '—'}</code>
              · modelo <code>{openFinding.source_model || '—'}</code> · {fmtDateTime(openFinding.source_timestamp)}
            </div>
          </div>
        </div>
      )}

      {/* Exports */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>Exportar (client-side, read-only)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m4_hallazgos', 'csv', exportMarks),
          findingsToCsv(payload.findings), 'text/csv')}>CSV de hallazgos</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m4_evidencia', 'json', exportMarks),
          evidenceJson(payload, load.demo ? { fixture_provenance: M4_API_FIXTURE_PROVENANCE } : {}), 'application/json')}>JSON de evidencia</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m4_resumen', 'txt', exportMarks),
          executiveSummaryText(payload, { demo: !!load.demo }))}>Resumen ejecutivo</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m4_recurrencia', 'txt', exportMarks),
          recurrenceText(payload, { demo: !!load.demo }))}>Recurrencia</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m4_handoff_m2', 'txt', exportMarks),
          handoffM4M2Text(payload, { demo: !!load.demo }))}>Handoff M4→M2</button>
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        Los archivos marcan DEMO / STALE / NONFORMAL en el nombre. Sin PII; celdas neutralizadas contra formula injection.
      </div>
    </div>
  )
}
