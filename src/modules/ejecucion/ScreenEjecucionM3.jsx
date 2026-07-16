// ─── ScreenEjecucionM3 — KOLD OS · M3 "Ejecución de rutas" ───────────────────
// Observatorio READ-ONLY del cumplimiento de ejecución en campo: arranque,
// paradas, resultado comercial, carga/inventario, incidentes, cierre, offline
// y plan vs real. Consume EXCLUSIVAMENTE la API autenticada de gf_kold_os_m3
// (GET /pwa-kold-os/m3/latest y /findings) vía el mecanismo canónico api() —
// cero archivos públicos, cero writes, cero botones de acción (auto_fix=false).
//
// Estados honestos:
//   · técnico (auditor):   PASS / FAIL / STALE / UNAVAILABLE (+disabled/etc.)
//   · operativo (datos):   GREEN / AMBER / RED / NOT_EVALUABLE
// "M3 está funcionando y detectó señales operativas" — jamás "M3 falló" porque
// una ruta no se cerró. STALE se muestra prominente y marca los exports.
//
// KPIs: cada tarjeta cuenta UNA sola entidad (rutas O paradas O cajas); el
// total mixto se llama "Incidencias detectadas" (no entidades únicas).
// Granularidad declarada por hallazgo: AGREGADO / SUCURSAL (badge); el detalle
// se llama "Detalle de regla" (jamás finge detalle por registro).
//
// Demo (?demo=1): SOLO con isM3DemoAllowed (DEV o VITE_ENABLE_M3_DEMO en
// Preview autorizado). En producción el parámetro se IGNORA.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { createLatestRequestGate, fetchM3Latest, fetchM3Findings } from './m3/m3Api'
import { isM3DemoAllowed } from './m3/demoGate'
import {
  M3_CLASSIFICATIONS, M3_VERDICTS, getM3RunAgeDays, startM3StaleClock,
  validateM3Latest,
} from './m3/contract'
import { applyFindingFilters, paginate, M3_DEFAULT_FILTERS, M3_PAGE_SIZE } from './m3/filters'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, planVsRealText,
  downloadTextFile, exportFilename,
} from './m3/exporters'
import {
  M3_CATEGORY_ORDER, M3_OPERATIONAL_STATUS_LABELS, M3_LIFECYCLE_LABELS, M3_SEVERITY_LABELS,
  M3_GRANULARITY_LABELS, M3_VERDICT_LABELS, M3_VERDICT_COLORS, M3_VERDICT_HELP,
  M3_CLASSIFICATION_LABELS, M3_EVIDENCE_SOURCE_LABELS, M3_SHELL_BLOCKER_LABELS,
  categoryLabel, getM3FindingSemanticLabel, getM3Lineage,
} from './m3/m3Meta'
import { M3_API_FIXTURE_PROVENANCE, M3_API_LATEST_FIXTURE } from '#m3-demo-fixture'

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

function KpiTile({ label, value, tone, note }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 104, flex: '1 1 104px',
    }} title={note || undefined}>
      <div style={{ fontSize: 19, fontWeight: 800, color: tone || C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function VerdictTile({ verdict, rules, items }) {
  const color = M3_VERDICT_COLORS[verdict]
  return (
    <div title={M3_VERDICT_HELP[verdict]} style={{
      background: C.surface, border: `1px solid ${color}45`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 150, flex: '1 1 150px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.3 }}>{M3_VERDICT_LABELS[verdict]}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{rules ?? 0} <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>reglas</span></div>
      {items !== null && items !== undefined && (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          {Number(items).toLocaleString('es-MX')} incidencias
        </div>
      )}
    </div>
  )
}

const selectStyle = {
  background: C.bg1, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 180,
}
const pagerBtn = (disabled) => ({
  background: C.surface, border: `1px solid ${C.border}`, color: disabled ? C.textLow : C.textSoft,
  borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
})

export default function ScreenEjecucionM3({ session }) {
  const location = useLocation()
  const demoAllowed = isM3DemoAllowed(import.meta.env)
  const demo = useMemo(
    () => demoAllowed && new URLSearchParams(location.search).get('demo') === '1',
    [demoAllowed, location.search],
  )
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M3_DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [table, setTable] = useState({ phase: 'idle', items: [], total: 0, pages: 1 })
  const [openFindingId, setOpenFindingId] = useState(null)
  const [staleClock, setStaleClock] = useState({ stale: false, nowIso: null })
  const aliveRef = useRef(true)
  const tableRequestGate = useRef(createLatestRequestGate())

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false } // descarta resultados tardíos
  }, [])

  useEffect(() => {
    if (demo) {
      const fixture = validateM3Latest(M3_API_LATEST_FIXTURE)
      setLoad(fixture.ok
        ? { phase: 'ok', payload: fixture.payload, demo: true }
        : { phase: 'invalid', errors: fixture.errors })
      return
    }
    setLoad({ phase: 'loading' })
    fetchM3Latest().then((result) => {
      if (!aliveRef.current) return
      if (result.state === 'ok') setLoad({ phase: 'ok', payload: result.payload, demo: false })
      else setLoad({ phase: result.state, errors: result.errors || [] })
    })
  }, [demo])

  const payload = load.phase === 'ok' ? load.payload : null
  const runsCount = payload?.history?.runs_count ?? 0
  const hasHistory = runsCount >= 2
  const tableQueryKey = JSON.stringify({
    run_id: payload?.run?.run_id || null, demo, filters, page,
  })
  const tableQueryKeyRef = useRef(tableQueryKey)
  tableQueryKeyRef.current = tableQueryKey

  useEffect(() => {
    if (!payload?.run) {
      setStaleClock({ stale: false, nowIso: null })
      return undefined
    }
    return startM3StaleClock(payload.run, (stale, nowIso) => {
      setStaleClock({ stale, nowIso })
    })
  }, [payload?.run])

  const localStale = staleClock.stale
  const stale = payload?.stale === true || localStale
  const effectivePayload = useMemo(() => {
    if (!payload) return null
    const localAge = getM3RunAgeDays(payload.run, staleClock.nowIso)
    return {
      ...payload,
      stale,
      age_days: localAge === null ? payload.age_days : Math.max(Number(payload.age_days) || 0, localAge),
    }
  }, [payload, stale, staleClock.nowIso])

  const loadTable = useCallback(async () => {
    const requestId = tableRequestGate.current.begin()
    const requestQueryKey = tableQueryKey
    if (!payload) return
    if (demo) {
      const filtered = applyFindingFilters(payload.findings, filters)
      const local = paginate(filtered, page, M3_PAGE_SIZE)
      if (aliveRef.current && tableRequestGate.current.isLatest(requestId)) {
        setTable({ phase: 'ok', items: local.items, total: local.total, pages: local.pages })
      }
      return
    }
    if (tableRequestGate.current.isLatest(requestId)) {
      setTable((prev) => ({ ...prev, phase: 'loading' }))
    }
    const params = { run_id: payload.run.run_id, page, page_size: M3_PAGE_SIZE }
    for (const [key, value] of Object.entries(filters)) if (value) params[key] = value
    const result = await fetchM3Findings(params, { latestPayload: payload })
    if (!aliveRef.current
      || !tableRequestGate.current.isLatest(requestId)
      || tableQueryKeyRef.current !== requestQueryKey) return
    if (result.state === 'ok') {
      if (result.payload.page !== page) {
        setPage(result.payload.page)
        return
      }
      setTable({
        phase: 'ok',
        items: result.payload.items,
        total: result.payload.total,
        pages: result.payload.pages,
      })
    } else {
      setTable({
        phase: 'error', items: [], total: 0, pages: 1, state: result.state,
        rejectedParams: result.rejected_params || [],
      })
    }
  }, [payload, demo, filters, page, tableQueryKey])

  useEffect(() => { loadTable() }, [loadTable])

  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }
  const clearFilters = () => { setFilters(M3_DEFAULT_FILTERS); setPage(1) }

  const blocks = useMemo(() => {
    if (!payload) return []
    return M3_CATEGORY_ORDER.map((key, index) => {
      const rules = payload.rule_results.filter((r) => r.category === key)
      const red = rules.filter((r) => r.status === 'RED').length
      const amber = rules.filter((r) => r.status === 'AMBER').length
      const notEvaluable = rules.filter((r) => r.status === 'NOT_EVALUABLE').length
      const incidences = rules.reduce((acc, r) => acc + (Number.isInteger(r.incidences) ? r.incidences : 0), 0)
      const branches = [...new Set((payload.findings || [])
        .filter((f) => f.category === key && f.branch_id != null)
        .map((f) => f.branch_id))]
      let status = 'GREEN'
      if (red) status = 'RED'
      else if (amber) status = 'AMBER'
      else if (notEvaluable === rules.length) status = 'NOT_EVALUABLE'
      return { key, order: index + 1, label: categoryLabel(key), rules, red, amber, notEvaluable,
        incidences, status, branches, green: rules.filter((r) => r.status === 'GREEN').length }
    })
  }, [payload])

  const areas = useMemo(() => [...new Set((payload?.findings || []).map((f) => f.responsible_area))], [payload])
  const branches = useMemo(() => payload?.summary?.branches_with_findings || [], [payload])
  const openFinding = useMemo(
    () => table.items.find((f) => f.finding_id === openFindingId) || null,
    [table.items, openFindingId],
  )

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '18px 16px 90px', color: C.text }
  const typo = getTypo ? getTypo() : {}

  if (load.phase === 'loading') {
    return <div style={wrap}><p style={{ color: C.textMuted, fontSize: 13 }}>Cargando auditoría de ejecución…</p></div>
  }

  if (!payload) {
    const copy = {
      disabled: ['La API de M3 está apagada (flag)', 'El backend gf_kold_os_m3 responde feature_disabled: el flag gf_kold_os.m3.enabled sigue en "0". Encenderlo requiere S/N.'],
      unavailable: ['Sin fuente de datos disponible', 'La API autenticada de M3 (gf_kold_os_m3, PR GrupoVeniu/GrupoFrio#202) aún no está desplegada o no tiene corridas ingeridas. Deploy e ingesta son gates de Sebastián (ver runbook del backend).'],
      session_expired: ['Sesión expirada', 'Vuelve a iniciar sesión para consultar M3.'],
      forbidden: ['Sin permiso M3', 'Tu sesión no tiene acceso M3 (direccion_general / admin_plataforma). El acceso es fail-closed.'],
      schema_mismatch: ['Versión de contrato no soportada', 'El backend publica una versión de kold.os.m3.api que esta UI no soporta. Actualiza la PWA (no se intenta adivinar la estructura).'],
      invalid: ['Respuesta inválida del backend', 'El envelope no validó el contrato kold.os.m3.api/1; no se muestra nada derivado de datos corruptos.'],
      error: ['Error de red o servidor', 'No fue posible consultar la API de M3. Reintenta más tarde.'],
    }[load.phase] || ['Estado desconocido', 'No fue posible determinar el estado de la fuente M3.']
    return (
      <div style={wrap}>
        <Header demo={false} technical="UNAVAILABLE" payload={null} />
        <div style={{ marginTop: 18, padding: '18px 16px', borderRadius: TOKENS.radius.lg, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{copy[0]}</div>
          <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, marginTop: 8 }}>{copy[1]}</p>
          {demoAllowed && (
            <p style={{ fontSize: 12, color: C.textLow, marginTop: 6 }}>
              Modo demostración (solo este entorno): <code>?demo=1</code> — fixture generado por código real con los números reales medidos en producción.
            </p>
          )}
        </div>
      </div>
    )
  }

  const summary = payload.summary
  const run = payload.run
  const lineage = getM3Lineage(run, shortHash)
  const kpis = payload.kpis || {}

  return (
    <div style={wrap}>
      <Header demo={load.demo} technical={run.technical_state === 'PASS' && stale ? 'STALE' : run.technical_state} payload={effectivePayload} />

      {load.demo && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24',
        }}>
          MODO DEMO ({M3_API_FIXTURE_PROVENANCE.kind}) — envelope generado por el core real del auditor y del backend
          (PR GrupoVeniu/GrupoFrio#202) con los NÚMEROS REALES medidos en producción (XML-RPC read-only 2026-07-15).
          NO es una corrida odoo-shell y NO existe en producción.
        </div>
      )}

      {/* Aviso de EVIDENCIA NO FORMAL. Se decide por el DATO (run), no por el
          modo de entrega: una corrida no formal ingerida en producción tendría
          demo=false y debe advertir igual. Sin esto, "sale de producción" se
          leería como "es evidencia formal". */}
      {!run.is_production_shell_run && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12,
          background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.45)', color: '#7dd3fc',
        }}>
          <strong>EVIDENCIA NO FORMAL</strong> — los números son reales
          ({M3_EVIDENCE_SOURCE_LABELS[run.evidence_source] ?? run.evidence_source}), pero
          <strong> esto NO es la corrida formal por odoo-shell en producción</strong>.
          {run.production_shell_run_blocked_by?.length > 0 && (
            <> Bloqueada por: {run.production_shell_run_blocked_by
              .map((b) => M3_SHELL_BLOCKER_LABELS[b] ?? b).join(' · ')}.</>
          )}
          {' '}Medido por el build <code>{String(run.auditor_build_sha).slice(0, 12)}</code>.
        </div>
      )}

      {stale && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
          background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24',
        }}>
          ⚠ CORRIDA STALE — la auditoría tiene {effectivePayload.age_days ?? '?'} días (umbral: {payload.capabilities?.stale_days ?? 7}).
          Se puede leer, pero NO representa el estado vigente; los exports quedan marcados STALE.
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12,
        background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.textSoft, lineHeight: 1.5,
      }}>
        <b>M3 está funcionando y detectó señales operativas.</b> El semáforo describe el estado de la EJECUCIÓN en campo, no del
        sistema: una ruta sin cerrar es un hallazgo válido del observatorio, no un fallo de M3. M3 observa, no corrige.
        <br />
        <b>Lee los veredictos, no solo los colores:</b> solo los <span style={{ color: M3_VERDICT_COLORS.incumplimiento, fontWeight: 700 }}>INCUMPLIMIENTOS</span> tienen
        umbral aprobado y supuesto verificado. Las <span style={{ color: M3_VERDICT_COLORS.anomalia, fontWeight: 700 }}>ANOMALÍAS</span> son
        señales exploratorias: indican dónde mirar, no prueban una conclusión de negocio.
      </div>

      {/* KPIs — cada tarjeta cuenta UNA sola entidad y declara su universo */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <KpiTile label="Rutas operativas (ventana)" value={fmtInt(kpis.plans_operational)} />
        <KpiTile label="Publicadas nunca iniciadas" value={fmtInt(kpis.plans_published_pending)} />
        <KpiTile label="Rutas cerradas" value={fmtInt(kpis.plans_closed)} />
        <KpiTile label="Iniciadas y vencidas sin cierre" value={fmtInt(kpis.plans_started_overdue_open)} tone={M3_VERDICT_COLORS.incumplimiento} note="Incumplimiento DEFINITIVO: jornada vencida con la ruta aún en progreso." />
        <KpiTile
          label={`Cumplimiento de visita`}
          value={`${kpis.visit_compliance?.value_pct ?? '—'}%`}
          tone={M3_VERDICT_COLORS.riesgo}
          note={`${kpis.visit_compliance?.universe_label || ''} — ${kpis.visit_compliance?.rationale || ''}`}
        />
        <KpiTile label="Paradas visitadas / planeadas (rutas iniciadas)" value={`${fmtInt(kpis.visit_compliance?.numerator)} / ${fmtInt(kpis.visit_compliance?.denominator)}`} />
        <KpiTile label="Ventas" value={fmtInt(kpis.sales_count)} />
        <KpiTile label="No-ventas" value={fmtInt(kpis.no_sales_count)} note={`Sin motivo estructurado: ${fmtInt(kpis.no_sale_without_structured_reason)} — el modelo NO exige motivo en no-venta (brecha de instrumentación, no falta del operador).`} />
        <KpiTile label="Conciliaciones en borrador sobre ruta cerrada" value={fmtInt(kpis.reconciliations_draft_on_closed_route)} tone={M3_VERDICT_COLORS.incumplimiento} note="Excluye borradores de rutas aún abiertas (son legítimos)." />
        <KpiTile label="Visitas fuera del plan" value={fmtInt(kpis.offroute_visits_total)} tone={M3_VERDICT_COLORS.anomalia} note={`Anomalía exploratoria: ${fmtInt(kpis.offroute_visits_with_sale)} terminaron en VENTA. Sin campo de autorización no se puede llamar incumplimiento.`} />
        <KpiTile label="Incidentes registrados" value={fmtInt(kpis.incidents_reported)} note="El modelo no tiene ciclo de vida de incidente: no se afirma desatención." />
        <KpiTile
          label="Eventos offline pendientes"
          value={kpis.offline_events_pending === null || kpis.offline_events_pending === undefined ? '—' : fmtInt(kpis.offline_events_pending)}
          note={kpis.offline_events_note || 'Sin telemetría server-side.'}
        />
      </div>

      {/* Desglose por veredicto — PROHIBIDO un total heterogéneo (Track P) */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>Qué prueba la evidencia</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <VerdictTile verdict="incumplimiento" rules={summary.definitive_incident_rule_count} items={summary.definitive_incident_count} />
        <VerdictTile verdict="riesgo" rules={summary.warning_rule_count} items={summary.warning_count} />
        <VerdictTile verdict="anomalia" rules={summary.exploratory_signal_rule_count} items={summary.exploratory_signal_count} />
        <VerdictTile verdict="cumple" rules={summary.compliant_rule_count} items={null} />
        <VerdictTile verdict="no_evaluable" rules={summary.not_evaluable_rule_count} items={null} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6, lineHeight: 1.55 }}>
        <b>Incidencias detectadas: {fmtInt(summary.total_incidences)}</b> = {fmtInt(summary.definitive_incident_count)} de
        incumplimientos definitivos + {fmtInt(summary.warning_count)} de riesgos + {fmtInt(summary.exploratory_signal_count)} de
        anomalías exploratorias. Son afectaciones por regla, <b>no entidades únicas</b> (una misma ruta/parada puede aparecer en
        varias reglas). Solo las <b>definitivas</b> tienen umbral aprobado y supuesto verificado; las anomalías señalan dónde
        mirar, no prueban una conclusión de negocio.
        {hasHistory ? '' : ' Historial: 1 corrida — tendencias y persistencia aparecen con la segunda.'}
      </div>

      {/* Bloques */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Bloques de ejecución</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, marginTop: 10 }}>
        {blocks.map((block) => (
          <div key={block.key} style={{
            background: C.surface, border: `1px solid ${STATUS_COLORS[block.status]}35`,
            borderRadius: TOKENS.radius.lg, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{block.order}. {block.label}</div>
              <Pill color={STATUS_COLORS[block.status]}>{M3_OPERATIONAL_STATUS_LABELS[block.status]}</Pill>
            </div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
              {fmtInt(block.incidences)} incidencias · {block.red} rojo · {block.amber} ámbar ·{' '}
              {block.green} verde · {block.notEvaluable} no evaluable
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {block.rules.map((r) => (
                <div key={r.rule_code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: C.textSoft }}>{r.rule_code} · {r.name}</span>
                  <span style={{ color: STATUS_COLORS[r.status], fontWeight: 700, whiteSpace: 'nowrap' }}>{r.observed_value}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
              Tendencia: {hasHistory ? 'vs corrida anterior en el detalle' : 'sin historial (primera corrida)'} ·{' '}
              {block.branches.length ? `Sucursales: ${block.branches.map((b) => `#${b}`).join(', ')}` : 'Granularidad: AGREGADO (v1)'}
            </div>
            <button
              onClick={() => { setFilter('category', block.key); document.getElementById('m3-detalle')?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.blue3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver hallazgos de este bloque →
            </button>
          </div>
        ))}
      </div>

      {/* Detalle de regla */}
      <h2 id="m3-detalle" style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>
        Detalle de regla ({table.total})
      </h2>
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>
        El contrato v1 es agregado/sucursal: aquí se detalla la REGLA observada (badge de granularidad por fila).
        El detalle por ruta/parada/registro se habilita cuando el contrato v1.1 entregue esas dimensiones.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select aria-label="Categoría" style={selectStyle} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">Todas las categorías</option>
          {M3_CATEGORY_ORDER.map((key) => <option key={key} value={key}>{categoryLabel(key)}</option>)}
        </select>
        <select aria-label="Sucursal" style={selectStyle} value={filters.branch_id} onChange={(e) => setFilter('branch_id', e.target.value)}>
          <option value="">Toda sucursal</option>
          {branches.map((b) => <option key={b} value={b}>Sucursal #{b}</option>)}
        </select>
        <select aria-label="Severidad" style={selectStyle} value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)}>
          <option value="">Toda severidad</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
        </select>
        <select aria-label="Veredicto" style={selectStyle} value={filters.verdict} onChange={(e) => setFilter('verdict', e.target.value)}>
          <option value="">Todo veredicto</option>
          {M3_VERDICTS.map((verdict) => (
            <option key={verdict} value={verdict}>{M3_VERDICT_LABELS[verdict]}</option>
          ))}
        </select>
        <select aria-label="Clasificación" style={selectStyle} value={filters.classification} onChange={(e) => setFilter('classification', e.target.value)}>
          <option value="">Toda clasificación</option>
          {M3_CLASSIFICATIONS.map((classification) => (
            <option key={classification} value={classification}>{M3_CLASSIFICATION_LABELS[classification]}</option>
          ))}
        </select>
        <select aria-label="Ciclo de vida" style={selectStyle} value={filters.lifecycle_status} onChange={(e) => setFilter('lifecycle_status', e.target.value)} disabled={!hasHistory}>
          <option value="">{hasHistory ? 'Todo ciclo de vida' : 'Ciclo de vida (requiere 2ª corrida)'}</option>
          <option value="new">Nuevo</option>
          <option value="persistent">Persistente</option>
          <option value="recurrent">Reincidente</option>
        </select>
        <select aria-label="Granularidad" style={selectStyle} value={filters.granularity} onChange={(e) => setFilter('granularity', e.target.value)}>
          <option value="">Toda granularidad</option>
          <option value="aggregate">Agregado</option>
          <option value="branch">Sucursal</option>
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
        <button type="button" onClick={clearFilters} style={pagerBtn(false)}>Limpiar filtros</button>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 10, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surfaceSoft, textAlign: 'left' }}>
              {['Veredicto', 'Regla', 'Hallazgo', 'Clasificación', 'Granularidad', 'Sucursal', 'Observado', 'Ciclo', 'Área responsable', 'Última detección'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.phase === 'loading' && (
              <tr><td colSpan={10} style={{ padding: 14, color: C.textMuted }}>Cargando hallazgos…</td></tr>
            )}
            {table.phase === 'error' && (
              <tr><td colSpan={10} style={{ padding: 14, color: STATUS_COLORS.AMBER }}>
                {table.state === 'invalid_request'
                  ? <>Filtros rechazados por el backend. La tabla se cerró sin mostrar resultados. <button type="button" onClick={clearFilters} style={pagerBtn(false)}>Restablecer filtros</button></>
                  : <>No fue posible consultar /findings ({table.state}). Reintenta.</>}
              </td></tr>
            )}
            {table.phase === 'ok' && table.items.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 14, color: C.textMuted }}>Sin hallazgos con estos filtros.</td></tr>
            )}
            {table.phase === 'ok' && table.items.map((f) => (
              <tr
                key={f.finding_id}
                onClick={() => setOpenFindingId(openFindingId === f.finding_id ? null : f.finding_id)}
                style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: openFindingId === f.finding_id ? C.surfaceSoft : 'transparent' }}
              >
                <td style={{ padding: '8px 10px' }}>
                  <Pill color={M3_VERDICT_COLORS[f.verdict] || STATUS_COLORS[f.status]} title={M3_VERDICT_HELP[f.verdict]}>
                    {getM3FindingSemanticLabel(f)}
                  </Pill>
                </td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}>{f.rule_code}</td>
                <td style={{ padding: '8px 10px', minWidth: 180 }}>{f.title}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: C.textMuted }}>
                  {M3_CLASSIFICATION_LABELS[f.classification] || '—'}{f.approved_threshold === false ? ' · umbral no aprobado' : ''}
                </td>
                <td style={{ padding: '8px 10px' }}><Pill color={C.blue3}>{M3_GRANULARITY_LABELS[f.granularity] || f.granularity}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.branch_id != null ? `#${f.branch_id}` : '—'}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: STATUS_COLORS[f.status], fontWeight: 700 }}>{f.observed_value}</td>
                <td style={{ padding: '8px 10px' }}>{M3_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status}</td>
                <td style={{ padding: '8px 10px' }}>{f.responsible_area}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: C.textMuted }}>{fmtDateTime(f.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12, color: C.textMuted }}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={pagerBtn(page <= 1)}>← Anterior</button>
        <span>Página {page} de {table.pages} · {table.total} hallazgos</span>
        <button disabled={page >= table.pages} onClick={() => setPage(page + 1)} style={pagerBtn(page >= table.pages)}>Siguiente →</button>
      </div>

      {openFinding && <FindingDetail finding={openFinding} runsCount={runsCount} hasHistory={hasHistory} onClose={() => setOpenFindingId(null)} />}

      {/* Export */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>Evidencia y exportación (read-only)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <ExportBtn label="CSV de hallazgos" onClick={() => downloadTextFile(
          exportFilename('m3_findings', 'csv', { stale, demo: load.demo }),
          findingsToCsv(effectivePayload), 'text/csv')} />
        <ExportBtn label="JSON de evidencia" onClick={() => downloadTextFile(
          exportFilename('m3_evidencia', 'json', { stale, demo: load.demo }),
          evidenceJson(effectivePayload, load.demo ? { fixture_provenance: M3_API_FIXTURE_PROVENANCE } : {}), 'application/json')} />
        <ExportBtn label="Resumen ejecutivo (imprimible)" onClick={() => downloadTextFile(
          exportFilename('m3_resumen_ejecutivo', 'txt', { stale, demo: load.demo }),
          executiveSummaryText(effectivePayload, { demo: load.demo }))} />
        <ExportBtn label="Comparación plan vs real" onClick={() => downloadTextFile(
          exportFilename('m3_plan_vs_real', 'txt', { stale, demo: load.demo }),
          planVsRealText(effectivePayload, { demo: load.demo }))} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Trazabilidad: run {shortHash(run.run_id)} · manifest {shortHash(run.manifest_sha256)} · evidencia {shortHash(run.evidence_sha256)} · auditor {lineage.auditor} · contrato {lineage.contract}
        {stale ? ' · exports marcados STALE' : ''}
      </div>
    </div>
  )
}

function ExportBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: C.surface, border: `1px solid ${C.borderBlue}`, color: C.blue3,
      borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}>
      ⬇ {label}
    </button>
  )
}

function Header({ demo, technical, payload }) {
  const run = payload?.run
  const summary = payload?.summary
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>Ejecución de rutas</h1>
        <Pill color={C.blue3} title="Superficie de solo lectura: cero escrituras">READ-ONLY</Pill>
        {technical && (
          <Pill color={TECH_COLORS[technical] || TECH_COLORS.UNAVAILABLE} title="Estado técnico del auditor (no de los datos)">
            AUDITOR: {technical}
          </Pill>
        )}
        {summary && (
          <Pill color={STATUS_COLORS[summary.overall_status]} title="Estado operativo de la ejecución en campo">
            DATOS: {summary.overall_status}
          </Pill>
        )}
        {demo && <Pill color="#fbbf24">DEMO</Pill>}
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, lineHeight: 1.6 }}>
        KOLD OS · M3 (Ejecución operativa en campo) · observatorio de ejecución —{' '}
        {run ? (
          <>
            corte {fmtDateTime(run.finished_at)} · ventana {run.scope?.window_days} días · compañías{' '}
            {(run.scope?.company_ids || []).join(', ')} · {(run.executed_queries || []).length} consultas ·{' '}
            fuente: API autenticada gf_kold_os_m3
          </>
        ) : 'sin fuente disponible'}
      </div>
    </div>
  )
}

function FindingDetail({ finding, runsCount, hasHistory, onClose }) {
  const copyRef = () => {
    try { navigator.clipboard?.writeText(finding.finding_id) } catch { /* clipboard opcional */ }
  }
  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.6 }}>
      <span style={{ color: C.textMuted, minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.textSoft, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
  const isBranch = finding.granularity === 'branch'
  return (
    <div style={{
      marginTop: 12, padding: '14px 16px', borderRadius: TOKENS.radius.lg,
      background: C.surface, border: `1px solid ${STATUS_COLORS[finding.status]}45`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {finding.rule_code} · {finding.title}{' '}
          <Pill color={M3_VERDICT_COLORS[finding.verdict] || STATUS_COLORS[finding.status]} title={M3_VERDICT_HELP[finding.verdict]}>
            {getM3FindingSemanticLabel(finding)}
          </Pill>{' '}
          <Pill color={C.blue3}>{M3_GRANULARITY_LABELS[finding.granularity] || finding.granularity}</Pill>
        </div>
        <button onClick={onClose} aria-label="Cerrar detalle" style={{ ...pagerBtn(false) }}>✕</button>
      </div>
      <p style={{ fontSize: 12.5, color: C.textSoft, lineHeight: 1.6, marginTop: 8 }}>{finding.description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {row('Veredicto', `${M3_VERDICT_LABELS[finding.verdict] || '—'} — ${M3_VERDICT_HELP[finding.verdict] || ''}`)}
        {row('Clasificación', `${M3_CLASSIFICATION_LABELS[finding.classification] || '—'} · confianza ${finding.confidence || '—'}`)}
        {row('Universo medido', finding.universe || '—')}
        {row('Supuesto de negocio', finding.business_assumption || '—')}
        {row('Limitaciones de evidencia', finding.evidence_limitations || '—')}
        {row('Umbral', finding.approved_threshold ? `APROBADO — ${finding.threshold_source || ''}` : `NO APROBADO — ${finding.threshold_source || 'sin fuente'}`)}
        {row('Valor observado', finding.observed_value)}
        {row('Regla esperada', finding.expected_rule)}
        {row('Severidad', M3_SEVERITY_LABELS[finding.severity] || finding.severity)}
        {row('Incidencias', finding.incidences != null ? `${finding.incidences} (afectaciones de esta regla; no entidades únicas)` : '—')}
        {row('Entidad', `${finding.entity_type} · ${finding.entity_reference}`)}
        {row('Sucursal / ruta', isBranch
          ? `Sucursal branch_config #${finding.branch_id} (dimensión REAL del contrato)`
          : 'Agregado del scope completo — dimensión ruta/parada llega con el contrato v1.1')}
        {row('Ciclo de vida', hasHistory
          ? `${M3_LIFECYCLE_LABELS[finding.lifecycle_status] || finding.lifecycle_status} · visto en ${finding.occurrence_count} de ${runsCount} corridas`
          : 'Nuevo (primera corrida en el historial; persistencia/reincidencia se calculan con la segunda)')}
        {row('Primera detección', fmtDateTime(finding.first_seen_at))}
        {row('Última detección', fmtDateTime(finding.last_seen_at))}
        {row('Área responsable', `${finding.responsible_area} · dueño: ${finding.owner_status === 'unassigned' ? 'no identificado (sin fuente autoritativa)' : finding.owner_status}`)}
        {row('Acción operativa sugerida', finding.recommended_action)}
        {row('Fuente', `${finding.source_model} · query ${finding.evidence_reference?.query_id || '—'} · corte ${fmtDateTime(finding.source_timestamp)}`)}
        {row('Evidencia', `sha256 ${shortHash(finding.evidence_reference?.evidence_sha256)} · manifest ${shortHash(finding.evidence_reference?.manifest_sha256)} · campos: ${(finding.evidence_reference?.evidence_fields || []).join(', ') || '—'}`)}
        {row('Detalle por registro', finding.entity_id != null
          ? `entity_id ${finding.entity_id}`
          : 'No disponible en el contrato v1 (extensión v1.1 propuesta)')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={copyRef} style={{ ...pagerBtn(false) }}>Copiar referencia</button>
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Este panel es evidencia de observación. M3 no ofrece acciones de corrección: auto_fix = false por contrato.
      </div>
    </div>
  )
}
