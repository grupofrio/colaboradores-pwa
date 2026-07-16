// ─── ScreenInventarioM5 — KOLD OS · M5 "Inventario y flujo" ─────────────────
// Observatorio READ-ONLY del flujo de producto: catálogo/pesos, carga, stock
// de unidad, salidas, refill, devoluciones, mermas/diferencias, kilogramos,
// consignación y handoffs M3/M6/M7. Responde con evidencia: "¿lo cargado,
// vendido, recargado, devuelto y disponible CUADRA?". Consume EXCLUSIVAMENTE
// la API autenticada de gf_kold_os_m5 (GET /pwa-kold-os/m5/{latest,findings,
// runs}) vía api() — cero writes, cero botones de acción (auto_fix=false).
//
// Los KPIs los emite el BACKEND (product_flow_kpis) con su contrato completo
// (value/universe/source_model/source_fields/coverage/caveat/data_as_of): la
// UI NO los deriva ni los inventa. Las capabilities gobiernan qué existe:
// capability=false ⇒ "—" + razón, JAMÁS un 0 (vehicle_inventory, kg esperados
// vs reales, capacidad de carga, conciliación financiera M6, rentabilidad M7).
//
// La UI muestra VEREDICTOS, no solo colores. El banner de evidencia se decide
// por el DATO (!run.is_production_shell_run), no por el modo de entrega.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { fetchM5Latest, fetchM5Findings } from './m5/m5Api'
import { isM5DemoAllowed } from './m5/demoGate'
import { applyFindingFilters, paginate, M5_DEFAULT_FILTERS, M5_PAGE_SIZE } from './m5/filters'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, differencesText,
  handoffM5M6M7Text, downloadTextFile, exportFilename,
} from './m5/exporters'
import {
  M5_CATEGORY_ORDER, M5_STATUS_LABELS, M5_LIFECYCLE_LABELS, M5_SEVERITY_LABELS,
  M5_GRANULARITY_LABELS, M5_VERDICT_ORDER, M5_VERDICT_LABELS, M5_VERDICT_COLORS,
  M5_VERDICT_HELP, M5_CLASSIFICATION_LABELS, M5_EVIDENCE_SOURCE_LABELS,
  M5_SHELL_BLOCKER_LABELS, categoryLabel,
} from './m5/m5Meta'
import { M5_API_FIXTURE_PROVENANCE, M5_API_LATEST_FIXTURE } from './m5/fixtures/apiLatestFixture'

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
  const color = M5_VERDICT_COLORS[verdict] || C.textMuted
  return <Pill color={color} title={M5_VERDICT_HELP[verdict]}>{M5_VERDICT_LABELS[verdict] || verdict}</Pill>
}

function VerdictTile({ verdict, rules, incidences }) {
  const color = M5_VERDICT_COLORS[verdict]
  return (
    <div title={M5_VERDICT_HELP[verdict]} style={{
      background: C.surface, border: `1px solid ${color}45`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 128, flex: '1 1 128px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.4 }}>{M5_VERDICT_LABELS[verdict]}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{rules} reglas</div>
      <div style={{ fontSize: 10.5, color: C.textMuted }}>{incidences != null ? `${fmtInt(incidences)} incidencias` : ' '}</div>
    </div>
  )
}

// KpiTile: presenta un KPI del BACKEND con su contrato completo. `kpi` es el
// objeto {value, universe, source_model, source_fields, coverage, caveat,
// data_as_of}. Si es undefined (el backend no lo emitió) el tile no se renderiza.
function KpiTile({ label, kpi, tone, format = fmtInt }) {
  if (!kpi) return null
  const note = [
    `Universo: ${kpi.universe}`,
    `Fuente: ${kpi.source_model} (${(kpi.source_fields || []).join(', ')})`,
    kpi.coverage != null ? `Cobertura: ${kpi.coverage}%` : '',
    kpi.caveat ? `⚠ ${kpi.caveat}` : '',
    `Corte: ${fmtDateTime(kpi.data_as_of)}`,
  ].filter(Boolean).join('\n')
  return (
    <div title={note} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 132, flex: '1 1 132px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>{format(kpi.value)}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>
        {String(kpi.universe).slice(0, 64)}{String(kpi.universe).length > 64 ? '…' : ''}
      </div>
      {kpi.coverage != null && (
        <div style={{ fontSize: 9.5, color: C.textLow }}>cobertura {kpi.coverage}%</div>
      )}
      {kpi.caveat && <div style={{ fontSize: 9.5, color: '#fbbf24', marginTop: 2 }}>⚠ con salvedad</div>}
    </div>
  )
}

// Lo que el contrato declara FUERA de alcance: se muestra "—" con su razón,
// JAMÁS un 0 (capability=false no es un cero).
function NotEvaluableTile({ label, reason }) {
  return (
    <div title={reason} style={{
      background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 132, flex: '1 1 132px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.textLow }}>—</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>{reason}</div>
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
        <h1 style={{ ...typo.h2, fontSize: 19, margin: 0 }}>Inventario y flujo</h1>
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
          KOLD OS · M5 (inventario y flujo de producto) · observatorio del flujo carga→salida→devolución→cuadre
          — corte {fmtDateTime(run.finished_at)} · ventana [{run.scope?.window_start} → {run.scope?.window_end_exclusive})
          · compañías {(run.scope?.company_ids || []).join(', ')} · {(run.executed_queries || []).length} consultas
          · midió: {shortHash(run.auditor_build_sha)} · manifest {shortHash(run.manifest_sha256)}
          · evidencia {shortHash(run.evidence_sha256)} · fuente: API autenticada gf_kold_os_m5
        </p>
      )}
    </div>
  )
}

export default function ScreenInventarioM5({ session }) {
  const location = useLocation()
  const demoAllowed = isM5DemoAllowed(import.meta.env)
  const demo = useMemo(
    () => demoAllowed && new URLSearchParams(location.search).get('demo') === '1',
    [demoAllowed, location.search],
  )
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M5_DEFAULT_FILTERS)
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
      setLoad({ phase: 'ok', payload: M5_API_LATEST_FIXTURE, demo: true })
      return
    }
    setLoad({ phase: 'loading' })
    fetchM5Latest().then((result) => {
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
      const local = paginate(filtered, page, M5_PAGE_SIZE)
      setTable({ phase: 'ok', items: local.items, total: local.total, pages: local.pages })
      return
    }
    setTable((prev) => ({ ...prev, phase: 'loading' }))
    const params = { page, page_size: M5_PAGE_SIZE }
    for (const [key, value] of Object.entries(filters)) if (value) params[key] = value
    const result = await fetchM5Findings(params)
    if (!aliveRef.current) return
    if (result.state === 'ok') {
      setTable({
        phase: 'ok', items: result.payload.items, total: result.payload.total,
        pages: result.payload.pages,
        // Un filtro rechazado por el backend NO puede quedarse callado: la UI lo
        // mostraría aplicado sobre una lista que no lo cumple. Con las allowlists
        // alineadas esto debe venir siempre vacío; si aparece, es divergencia de
        // contrato y el usuario tiene que verla, no sufrirla.
        rejected: (result.payload.rejected_params || []).filter(
          (p) => p !== 'page' && p !== 'page_size'),
      })
    } else {
      setTable({ phase: 'error', items: [], total: 0, pages: 1, state: result.state, rejected: [] })
    }
  }, [payload, demo, filters, page])

  useEffect(() => { loadTable() }, [loadTable])

  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }

  const blocks = useMemo(() => {
    if (!payload) return []
    return M5_CATEGORY_ORDER.map((key, index) => {
      const rules = payload.rule_results.filter((r) => r.category === key)
      const byVerdict = (v) => rules.filter((r) => r.verdict === v).length
      const incidences = rules.reduce((acc, r) => acc + (Number.isInteger(r.incidences) ? r.incidences : 0), 0)
      const worst = M5_VERDICT_ORDER.find((v) => byVerdict(v) > 0) || 'no_evaluable'
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

  // Los KPIs los emite el backend con su contrato (value/universe/source_model/
  // source_fields/coverage/caveat/data_as_of). La UI solo los presenta: si el
  // backend no emitió un KPI (fuente inexistente), aquí no aparece.
  const kpis = payload?.kpis || {}
  const caps = payload?.capabilities?.features || {}

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '18px 16px 90px', color: C.text }
  const typo = getTypo ? getTypo() : {}

  if (load.phase === 'loading') {
    return <div style={wrap}><p style={{ color: C.textMuted, fontSize: 13 }}>Cargando observatorio de inventario…</p></div>
  }

  // ── estados no-ok, honestos y accionables ─────────────────────────────────
  if (!payload) {
    const copy = {
      disabled: ['La API de M5 está apagada (flag)', 'El backend gf_kold_os_m5 responde feature_disabled: el flag gf_kold_os.m5.enabled sigue en "0". Encenderlo requiere S/N.'],
      unavailable: ['Sin fuente de datos disponible', 'La API autenticada de M5 (gf_kold_os_m5) no está disponible o aún no tiene corridas ingeridas. El backend está versionado en GrupoVeniu/GrupoFrio#208; la instalación, validación runtime e ingesta son gates separados.'],
      session_expired: ['Sesión expirada', 'Vuelve a iniciar sesión para consultar M5.'],
      forbidden: ['Sin permiso M5', 'Tu sesión no tiene acceso M5 (direccion_general / admin_plataforma). El acceso es fail-closed.'],
      schema_mismatch: ['Versión de contrato no soportada', 'El backend publica una versión de kold.os.m5.api que esta UI no soporta. Actualiza la PWA (no se intenta adivinar la estructura).'],
      invalid: ['Respuesta inválida del backend', 'El envelope no validó el contrato kold.os.m5.api/1; no se muestra nada derivado de datos corruptos.'],
      error: ['Error de red o servidor', 'No fue posible consultar la API de M5. Reintenta más tarde.'],
    }[load.phase] || ['Estado desconocido', 'No fue posible determinar el estado de la fuente M5.']
    return (
      <div style={wrap}>
        <Header demo={false} technical="UNAVAILABLE" payload={null} />
        <div style={{ marginTop: 18, padding: '18px 16px', borderRadius: TOKENS.radius.lg, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{copy[0]}</div>
          <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, marginTop: 8 }}>{copy[1]}</p>
          {demoAllowed && (
            <p style={{ fontSize: 12, color: C.textLow, marginTop: 6 }}>
              Modo demostración (solo este entorno): <code>?demo=1</code> — fixture generado por el core real del backend #208, no evidencia en vivo.
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
          MODO DEMO ({M5_API_FIXTURE_PROVENANCE.kind}) — envelope generado por el core real del backend
          ({M5_API_FIXTURE_PROVENANCE.backend_pr}, midió {M5_API_FIXTURE_PROVENANCE.measuring_commit.slice(0, 8)}) con
          los NÚMEROS REALES medidos en producción (XML-RPC read-only 2026-07-15). NO es una corrida odoo-shell, NO
          existe en producción y se regenera si el contrato del backend cambia.
        </div>
      )}

      {/* Evidencia NO FORMAL: se decide por el DATO, no por el modo demo. */}
      {nonformal && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12,
          background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.45)', color: '#7dd3fc',
        }}>
          <strong>EVIDENCIA NO FORMAL</strong> — los números son reales
          ({M5_EVIDENCE_SOURCE_LABELS[run.evidence_source] ?? run.evidence_source}), pero
          <strong> esto NO es la corrida formal por odoo-shell en producción</strong>.
          {run.production_shell_run_blocked_by?.length > 0 && (
            <> Bloqueada por: {run.production_shell_run_blocked_by
              .map((b) => M5_SHELL_BLOCKER_LABELS[b] ?? b).join(' · ')}.</>
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
        M5 NO corrige inventario: no crea movimientos, no valida pickings, no ajusta existencias ni pesos. M5 observa, no corrige.
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
        Son afectaciones por regla, NO entidades únicas ni unidades de producto (un mismo plan/línea puede aparecer en varias reglas; la condición agregada del cuadre cuenta 1).
        Historial: {runsCount} corrida(s){hasHistory ? '' : ' — tendencias y persistencia aparecen con la segunda'}.
      </div>

      {/* KPIs DEL FLUJO emitidos por el backend (cada uno con su contrato) */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>
        ¿El flujo cuadra? — corte {fmtDateTime(run.finished_at)}
      </h2>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 4, marginBottom: 8 }}>
        Cada indicador declara su universo, su fuente y su salvedad (pasa el cursor por encima).
        Las <b>sumas de unidades mezclan UOM heterogéneas</b>: señal direccional del cuadre, no
        unidades físicas comparables. Lo que el contrato v1 no puede evaluar se muestra como “—”, nunca como 0.
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, marginTop: 6 }}>El cuadre (reconciliación)</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <KpiTile label="Unidades cargadas (suma)" kpi={kpis.units_loaded_sum} />
        <KpiTile label="Unidades entregadas (suma)" kpi={kpis.units_delivered_sum} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Unidades devueltas (suma)" kpi={kpis.units_returned_sum} />
        <KpiTile label="Merma (suma)" kpi={kpis.units_scrap_sum} />
        <KpiTile label="Diferencia (suma)" kpi={kpis.units_difference_sum} tone={STATUS_COLORS.RED} />
        <KpiTile label="Reconciliaciones" kpi={kpis.reconciliations} />
        <KpiTile label="Con diferencia ≠ 0" kpi={kpis.reconciliations_with_difference} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Con diferencia negativa" kpi={kpis.reconciliations_negative_difference} tone={STATUS_COLORS.RED} />
        <KpiTile label="Cerradas (done)" kpi={kpis.reconciliations_done} />
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, marginTop: 12 }}>Carga</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <KpiTile label="Planes publicados" kpi={kpis.published_plans} />
        <KpiTile label="Con carga vinculada" kpi={kpis.loaded_plans} tone={STATUS_COLORS.GREEN} />
        <KpiTile label="Sin carga" kpi={kpis.plans_without_load} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Pickings de carga" kpi={kpis.load_pickings} />
        <KpiTile label="Realizados (done)" kpi={kpis.load_pickings_done} />
        <KpiTile label="Abiertos" kpi={kpis.load_pickings_open} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Cancelados" kpi={kpis.load_pickings_cancelled} />
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, marginTop: 12 }}>Catálogo, salidas y refill</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <KpiTile label="Productos operativos" kpi={kpis.operational_products} />
        <KpiTile label="Sin peso" kpi={kpis.operational_products_without_weight} />
        <KpiTile label="Sin SKU" kpi={kpis.operational_products_without_sku} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Líneas de salida" kpi={kpis.outflow_lines} />
        <KpiTile label="Recepción pendiente" kpi={kpis.outflow_lines_pending_reception} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Líneas de devolución" kpi={kpis.outflow_return_lines} />
        <KpiTile label="Líneas de merma" kpi={kpis.outflow_scrap_lines} />
        <KpiTile label="Refills (ventana)" kpi={kpis.refill_requests_window} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Refills (histórico)" kpi={kpis.refill_requests_all_time} />
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, marginTop: 12 }}>Kilogramos y flota</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <KpiTile label="Paradas ejecutadas" kpi={kpis.executed_stops} />
        <KpiTile label="Con actual_kg" kpi={kpis.executed_stops_with_actual_kg} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Vehículos activos" kpi={kpis.active_vehicles} />
        <KpiTile label="Con capacidad kg" kpi={kpis.vehicles_with_capacity_kg} />
        <KpiTile label="Snapshots de sucursal" kpi={kpis.branch_stock_snapshots} />
        <KpiTile label="Consignaciones activas" kpi={kpis.consignments_active} />
      </div>

      {/* Fronteras del contrato: NO se convierten en 0 (capabilities=false) */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft, marginTop: 12 }}>
        Fuera del contrato v1
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        {!caps.vehicle_inventory && <NotEvaluableTile label="Stock por unidad" reason="No existe modelo de inventario por vehículo: no es observable" />}
        {!caps.expected_vs_actual_kg && <NotEvaluableTile label="Kg esperados vs reales" reason="Umbral no aprobado + cobertura dispar (v1.1)" />}
        {!caps.load_capacity_check && <NotEvaluableTile label="Carga vs capacidad" reason="Kg por carga no computados en v1" />}
        {!caps.warehouse_stock_audit && <NotEvaluableTile label="Stock de almacén" reason="Cadencia de snapshots no ratificada" />}
        {!caps.financial_reconciliation && <NotEvaluableTile label="Conciliación financiera" reason="La verdad financiera es de M6 (no iniciado)" />}
        {!caps.profitability && <NotEvaluableTile label="Rentabilidad por kg" reason="La rentabilidad es de M7 (no iniciado)" />}
      </div>

      {/* Bloques del flujo */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Bloques del flujo de producto</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 10, marginTop: 10 }}>
        {blocks.map((block) => (
          <div key={block.key} style={{
            background: C.surface, border: `1px solid ${M5_VERDICT_COLORS[block.worst]}38`,
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
                  <span style={{ color: M5_VERDICT_COLORS[r.verdict], fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.observed_value ?? M5_VERDICT_LABELS[r.verdict]}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
              Tendencia: {hasHistory ? 'vs corrida anterior en el detalle' : 'sin historial (primera corrida)'} · Granularidad: AGREGADO (v1)
            </div>
            <button
              onClick={() => { setFilter('category', block.key); document.getElementById('m5-detalle')?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.blue3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver hallazgos de este bloque →
            </button>
          </div>
        ))}
      </div>

      {/* Detalle de regla (agregado v1) */}
      <h2 id="m5-detalle" style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>
        Detalle de regla ({table.total}) <Pill color={C.blue3}>{M5_GRANULARITY_LABELS.aggregate}</Pill>
      </h2>
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>
        El contrato v1 es agregado: aquí se detalla la REGLA, no productos/movimientos individuales (cero PII por diseño).
        El detalle por producto/vehículo/almacén llega con la extensión v1.1 del contrato del auditor.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select aria-label="Categoría" style={selectStyle} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">Todas las categorías</option>
          {M5_CATEGORY_ORDER.map((key) => <option key={key} value={key}>{categoryLabel(key)}</option>)}
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

      {/* Divergencia de contrato: el backend ignoró un filtro que esta UI envió.
          Con las allowlists alineadas no debería ocurrir jamás; si ocurre, la
          lista NO cumple el filtro que se ve puesto y hay que decirlo. */}
      {table.rejected?.length > 0 && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5',
        }}>
          ⚠ El backend RECHAZÓ {table.rejected.length === 1 ? 'el filtro' : 'los filtros'}{' '}
          <code>{table.rejected.join(', ')}</code>: la lista de abajo <b>NO</b> los aplica.
          Es una divergencia entre el contrato de esta PWA y el de la API — no filtres por ahí hasta corregirla.
        </div>
      )}

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
                  {M5_CLASSIFICATION_LABELS[f.classification] || f.classification}
                  {!f.approved_threshold && <span style={{ color: C.textLow }} title="Umbral NO ratificado por dirección"> · s/umbral</span>}
                </td>
                <td style={{ padding: '8px 10px' }}><Pill color={C.blue3}>{M5_GRANULARITY_LABELS[f.granularity] || f.granularity}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.entity_type || '—'}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: M5_VERDICT_COLORS[f.verdict] }}>{f.observed_value}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{hasHistory ? (M5_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status) : '—'}</td>
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
        <span style={{ fontSize: 10.5, color: C.textLow }}>Paginación server-side (page_size {M5_PAGE_SIZE}).</span>
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
            <div><b>Clasificación:</b> {M5_CLASSIFICATION_LABELS[openFinding.classification] || openFinding.classification} · severidad {M5_SEVERITY_LABELS[openFinding.severity] || openFinding.severity}</div>
            <div><b>Entidad:</b> {openFinding.entity_type || '—'} · {openFinding.entity_reference || 'agregado'}</div>
            <div><b>Ciclo de vida:</b> {hasHistory ? `${M5_LIFECYCLE_LABELS[openFinding.lifecycle_status] || openFinding.lifecycle_status} · ${openFinding.occurrence_count ?? 1} aparición(es) · primera ${fmtDateTime(openFinding.first_seen_at)}` : 'sin historial (primera corrida)'}</div>
            <div><b>Área responsable:</b> {openFinding.responsible_area || '—'}</div>
            <div><b>Acción recomendada:</b> {openFinding.recommended_action || '—'} <span style={{ color: C.textLow }}>(M5 observa; no ejecuta)</span></div>
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
          exportFilename('kold_os_m5_hallazgos', 'csv', exportMarks),
          findingsToCsv(payload.findings), 'text/csv')}>CSV de hallazgos</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m5_evidencia', 'json', exportMarks),
          evidenceJson(payload, load.demo ? { fixture_provenance: M5_API_FIXTURE_PROVENANCE } : {}), 'application/json')}>JSON de evidencia</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m5_resumen', 'txt', exportMarks),
          executiveSummaryText(payload, { demo: !!load.demo }))}>Resumen ejecutivo</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m5_diferencias', 'txt', exportMarks),
          differencesText(payload, { demo: !!load.demo }))}>Diferencias y cuadre</button>
        <button style={exportBtn} onClick={() => downloadTextFile(
          exportFilename('kold_os_m5_handoff_m6_m7', 'txt', exportMarks),
          handoffM5M6M7Text(payload, { demo: !!load.demo }))}>Handoff M5→M6/M7</button>
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        Los archivos marcan DEMO / STALE / NONFORMAL en el nombre. Sin PII; celdas neutralizadas contra formula injection.
      </div>
    </div>
  )
}
