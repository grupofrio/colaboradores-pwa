// ─── ScreenCajaConciliacionM6 — KOLD OS · M6 "Caja y conciliación" ───────────
// Observatorio READ-ONLY del estado financiero/administrativo de caja.
//
// QUÉ RESPONDE Y QUÉ NO: la pregunta "¿dónde está el dinero y qué falta para
// cerrar?" NO se responde con una conclusión global. La pantalla presenta TRES
// NIVELES: (1) estado financiero REPORTADO por las fuentes observadas, (2)
// cobertura de la instrumentación, (3) capacidades NO disponibles. Prohibido
// decir "todo cuadra", "no cuadra", "faltante", "pérdida", "fraude" o "dinero
// desaparecido" — ninguna regla v1 tiene umbral aprobado que lo soporte.
//
// ⚠️ EL BACKEND M6 NO ESTÁ DESPLEGADO. Existe un PR temporal pre-migración
// (GrupoVeniu/GrupoFrio#210, DRAFT) abierto SÓLO para la auditoría estática
// conjunta de Codex: no se mergea y será reemplazado por un PR en grupofrio/gf.
// PR existe ≠ backend desplegado ≠ API real probada ≠ runtime validado: las
// cuatro cosas son distintas y sólo la primera es cierta hoy. En producción esta
// pantalla resuelve `unavailable`; el demo (fixture del core real) SOLO vive en
// DEV o Preview con VITE_ENABLE_M6_DEMO.
//
// Las cifras las MIDE el auditor y viajan en `run.metrics` (filas crudas del
// manifiesto cerrado): cada tile declara su query y su campo de origen. La UI no
// deriva ni inventa cifras. OJO — el backend v1 NO emite un objeto `kpis` (a
// diferencia de M5); leer `payload.kpis` habría renderizado nada en silencio
// (bug 8: campo fantasma). Ver docs/m6/M6_KNOWN_LIMITATIONS.md.
//
// Las capabilities gobiernan qué existe: capability=false ⇒ "—" + razón, JAMÁS 0.
// Cero writes, cero botones de acción.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { fetchM6Latest, fetchM6Findings } from './m6/m6Api'
import { isM6DemoAllowed } from './m6/demoGate'
import {
  M6_DEFAULT_FILTERS, M6_PAGE_SIZE, M6_FILTER_AXES, M6_HIDDEN_FILTERS,
  buildFindingsParams, activeFilterCount, isFilterAvailable,
} from './m6/filters'
import {
  findingsToCsv, evidenceJson, executiveSummaryText, agingText, paymentsText,
  closuresText, capabilitiesText, downloadTextFile, exportFilename,
} from './m6/exporters'
import {
  M6_VERDICT_ORDER, M6_VERDICT_LABELS, M6_VERDICT_COLORS, M6_VERDICT_HELP,
  M6_CLASSIFICATION_LABELS, M6_SEVERITY_LABELS, M6_LIFECYCLE_LABELS,
  M6_CATEGORY_ORDER, M6_EVIDENCE_SOURCE_LABELS, M6_SHELL_BLOCKER_LABELS,
  M6_LIFECYCLE_UNAVAILABLE,
  categoryLabel,
} from './m6/m6Meta'
import { resolveM6Metric } from './m6/contract'
import { M6_API_FIXTURE_PROVENANCE, M6_API_LATEST_FIXTURE } from './m6/fixtures/apiLatestFixture'

const C = TOKENS.colors
const STATUS_COLORS = {
  GREEN: C.success, AMBER: '#f59e0b', RED: '#ef4444',
  NOT_EVALUABLE: 'rgba(255,255,255,0.45)',
}

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
    }}>{children}</span>
  )
}

function VerdictTile({ verdict, rules, incidences }) {
  const color = M6_VERDICT_COLORS[verdict]
  return (
    <div title={M6_VERDICT_HELP[verdict]} style={{
      background: C.surface, border: `1px solid ${color}45`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 128, flex: '1 1 128px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.4 }}>{M6_VERDICT_LABELS[verdict]}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{rules} reglas</div>
      <div style={{ fontSize: 10.5, color: C.textMuted }}>{incidences != null ? `${fmtInt(incidences)} incidencias` : ' '}</div>
    </div>
  )
}

// MetricTile: presenta una cifra MEDIDA POR EL AUDITOR, leída de `run.metrics`
// (las filas crudas del manifiesto cerrado). Cada tile declara su query y su
// campo de origen: el frontend NO deriva ni inventa cifras.
//
// ⚠️ POR QUÉ metrics Y NO kpis: el backend M6 v1 **no emite un objeto `kpis`**
// (a diferencia de M5, que tiene product_flow_kpis con contrato por KPI).
// Leer `payload.kpis` aquí habría renderizado NADA en silencio — exactamente el
// bug 8 de M4/M5 (campo fantasma). Se lee lo que el backend SÍ emite y se
// declara. Cerrar esa brecha (un `kpis` con contrato completo) es trabajo del
// backend v1.1; ver docs/m6/M6_KNOWN_LIMITATIONS.md.
//
// Ausencia ≠ cero — y las ausencias NO son todas iguales.
//
// Antes este tile hacía `if (!row || row[field] == null) return null`, y TRES
// fallas distintas se desvanecían en el mismo silencio: la query no vino, el
// campo no existe (contrato roto) y el campo vino null. Un tile que desaparece
// se lee como "aquí no había nada que ver", que es justo lo que un contrato roto
// necesita para pasar inadvertido. Codex lo marcó como riesgo y tenía razón.
//
// Seis estados, ninguno silencioso:
//   ok                  → hay valor. 0 incluido: 0 es un dato, no un vacío.
//   capability_disabled → el backend declara que no puede: "—" + razón.
//   metric_unavailable  → la query no vino: cobertura parcial declarada.
//   not_evaluable       → campo null DECLARADO nullable: "—" + razón.
//   contract_error      → campo requerido ausente: ERROR VISIBLE, en rojo.
//   malformed_metric    → el tipo no es el declarado: ERROR VISIBLE.
//
// Ahora la decisión NO vive aquí: `resolveM6Metric` (contract.js) es la única
// autoridad — el mismo módulo que valida el envelope, no un segundo validador
// paralelo que pueda derivar. El tile sólo elige cómo pintar cada estado.
const METRIC_STATE_UI = {
  capability_disabled: { glyph: '—', color: C.textLow, badge: 'no disponible', border: 'dashed' },
  metric_unavailable: { glyph: '—', color: C.textLow, badge: 'cobertura parcial', border: 'dashed' },
  not_evaluable: { glyph: '—', color: C.textLow, badge: 'no evaluable', border: 'dashed' },
  contract_error: { glyph: '!', color: STATUS_COLORS.RED, badge: 'ERROR DE CONTRATO', border: 'solid' },
  malformed_metric: { glyph: '!', color: STATUS_COLORS.RED, badge: 'MÉTRICA MALFORMADA', border: 'solid' },
  backend_unavailable: { glyph: '—', color: C.textLow, badge: 'sin backend', border: 'dashed' },
}

function MetricTile({ label, payload, query, field, universe, unit, tone, coverage,
                     caveat, capability, nullable }) {
  const res = resolveM6Metric(payload, { query, field, capability, nullable })
  const base = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
    padding: '10px 12px', minWidth: 138, flex: '1 1 138px',
  }

  if (res.state !== 'ok') {
    const ui = METRIC_STATE_UI[res.state]
    const roto = res.state === 'contract_error' || res.state === 'malformed_metric'
    return (
      <div title={`${res.reason}\nUniverso: ${universe}\nFuente: query \`${query}\` → campo \`${field}\``}
        data-testid="metric-tile" data-state={res.state} data-query={query} data-field={field}
        style={{
          ...base,
          background: roto ? 'rgba(239,68,68,0.08)' : C.surfaceSoft,
          border: `1px ${ui.border} ${roto ? STATUS_COLORS.RED : C.border}`,
        }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: ui.color }}>{ui.glyph}</div>
        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.3, marginTop: 3,
          color: roto ? STATUS_COLORS.RED : C.textLow,
        }}>{ui.badge}</div>
        <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>
          {res.reason}
        </div>
      </div>
    )
  }

  // 0 es un VALOR medido, no un vacío: se pinta como cualquier otra cifra.
  const row = payload.metrics[query][0]
  const cov = typeof coverage === 'function' ? coverage(row) : coverage
  const note = [
    `Universo: ${universe}`,
    `Fuente: auditor → query \`${query}\` → campo \`${field}\``,
    unit ? `Unidad: ${unit}` : '',
    cov != null ? `Cobertura: ${cov}%` : '',
    caveat ? `⚠ ${caveat}` : '',
  ].filter(Boolean).join('\n')
  return (
    <div title={note} data-testid="metric-tile" data-state="ok"
      data-query={query} data-field={field} style={base}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>{fmtInt(res.value)}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
        {label}{unit ? <span style={{ color: C.textLow }}> · {unit}</span> : null}
      </div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>
        {String(universe || '').slice(0, 62)}{String(universe || '').length > 62 ? '…' : ''}
      </div>
      {cov != null && <div style={{ fontSize: 9.5, color: C.textLow }}>cobertura {cov}%</div>}
      {caveat && <div style={{ fontSize: 9.5, color: '#fbbf24', marginTop: 2 }}>⚠ con salvedad</div>}
    </div>
  )
}

const pct = (num, den) => (den ? Math.round((num / den) * 10000) / 100 : null)

// Capability en false: "—" con su RAZÓN. Jamás un 0.
function UnavailableTile({ label, reason }) {
  return (
    <div title={reason} style={{
      background: C.surfaceSoft, border: `1px dashed ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 138, flex: '1 1 138px',
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

function Header({ demo, payload }) {
  const run = payload?.run
  const typo = getTypo ? getTypo() : {}
  const scope = run?.scope || {}
  const nonformal = run && run.is_production_shell_run !== true
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ ...typo.h2, fontSize: 19, margin: 0 }}>Caja y conciliación</h1>
        <Pill color={C.blue3}>READ-ONLY</Pill>
        {run?.technical_state && (
          <Pill color={run.technical_state === 'PASS' ? C.success : '#ef4444'}>
            AUDITOR: {run.technical_state}
          </Pill>
        )}
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
          KOLD OS · M6 (caja, cobranza, conciliación y liquidación) · observatorio de SEÑALES del estado
          financiero — corte {fmtDateTime(run.finished_at)} · ventana [{scope.window_start} → {scope.window_end_exclusive})
          · compañías {(scope.company_ids || []).join(', ') || '—'}
          · sucursales {(scope.branch_ids || []).length ? scope.branch_ids.join(', ') : 'todas (v1 agregado)'}
          · monedas {(scope.currency_ids || []).join(', ') || '—'}
          · {(run.executed_queries || []).length} consultas
          · midió: {shortHash(run.auditor_build_sha)} · empacó: {shortHash(run.contract_build_sha) || 'sin sellar'}
          · run {shortHash(run.run_id)} · scope {shortHash(run.scope_key)}
          · fuente: {M6_EVIDENCE_SOURCE_LABELS[run.measurement_method] || run.measurement_method || '—'}
        </p>
      )}
      {nonformal && (
        <div style={{
          background: '#7dd3fc14', border: '1px solid #7dd3fc40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.textSoft, lineHeight: 1.5,
        }}>
          <b>Evidencia no formal:</b> medición read-only fuera de odoo-shell productivo.
          Los números son reales; la corrida formal no existe.
          Bloqueada por: {(run.production_shell_run_blocked_by || [])
            .map((b) => M6_SHELL_BLOCKER_LABELS[b] || b).join(' · ') || '—'}.
        </div>
      )}
    </div>
  )
}

export default function ScreenCajaConciliacionM6({ session }) {
  const location = useLocation()
  const demoAllowed = isM6DemoAllowed(import.meta.env)
  const demo = useMemo(
    () => demoAllowed && new URLSearchParams(location.search).get('demo') === '1',
    [demoAllowed, location.search],
  )
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M6_DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [table, setTable] = useState({ phase: 'idle', items: [], total: 0, pages: 1, rejected: [] })
  const [openFindingId, setOpenFindingId] = useState(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false } // descarta resultados tardíos
  }, [])

  // ── /latest ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (demo) {
      setLoad({ phase: 'ok', payload: M6_API_LATEST_FIXTURE, demo: true })
      return
    }
    setLoad({ phase: 'loading' })
    fetchM6Latest().then((result) => {
      if (!aliveRef.current) return
      if (result.state === 'ok') setLoad({ phase: 'ok', payload: result.payload, demo: false })
      else setLoad({ phase: result.state, errors: result.errors || [] })
    })
  }, [demo])

  const payload = load.phase === 'ok' ? load.payload : null
  const capabilities = payload?.capabilities
  const features = capabilities?.features || {}
  const stale = payload?.stale === true

  // ── /findings — SERVER-SIDE. El frontend jamás filtra `items`. ─────────────
  const loadTable = useCallback(async () => {
    if (!payload) return
    if (demo) {
      // En demo no hay backend: se muestran los findings del fixture SIN filtrar
      // localmente. Filtrar aquí simularía un server-side que no existe y
      // escondería justo el bug que este módulo debe evitar.
      setTable({
        phase: 'ok', items: payload.findings || [], total: (payload.findings || []).length,
        pages: 1, rejected: [], demoUnfiltered: activeFilterCount(filters) > 0,
      })
      return
    }
    setTable((t) => ({ ...t, phase: 'loading' }))
    const params = buildFindingsParams(filters, { page, pageSize: M6_PAGE_SIZE })
    const result = await fetchM6Findings(params)
    if (!aliveRef.current) return
    if (result.state === 'ok') {
      setTable({
        phase: 'ok', items: result.payload.items || [], total: result.payload.total || 0,
        pages: result.payload.pages || 1, rejected: result.payload.rejected_params || [],
      })
    } else {
      setTable({ phase: result.state, items: [], total: 0, pages: 1, rejected: [] })
    }
  }, [payload, demo, filters, page])

  useEffect(() => { loadTable() }, [loadTable])

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1) }

  const exportMarks = {
    demo: !!load.demo,
    nonformal: payload?.run?.is_production_shell_run !== true,
    stale,
  }
  const doExport = (base, ext, text, mime = 'text/plain') =>
    downloadTextFile(exportFilename(base, ext, exportMarks), text, mime)

  const typo = getTypo ? getTypo() : {}

  // ── estados no-ok ──────────────────────────────────────────────────────────
  if (load.phase !== 'ok') {
    const messages = {
      loading: ['Cargando…', ''],
      unavailable: ['Sin fuente de datos disponible',
        'La API autenticada de M6 (gf_kold_os_m6) aún no está desplegada. El backend está construido en LOCAL y todavía NO se ha publicado: el repositorio Odoo está migrando a grupofrio/gf. El merge, el despliegue, el flag y la ingesta son gates posteriores, cada uno con su S/N.'],
      flag_off: ['Módulo deshabilitado', 'El flag gf_kold_os.m6.enabled está en 0. Habilitarlo es una decisión con S/N.'],
      unauthorized: ['Sesión no válida', 'Vuelve a iniciar sesión.'],
      forbidden: ['Sin acceso', 'Este observatorio está limitado a dirección general.'],
      schema_mismatch: ['Contrato desconocido', 'El backend respondió con un schema_version que este frontend no soporta. No se renderiza nada antes que mostrar cifras que no se pueden interpretar.'],
      malformed: ['Respuesta inválida', 'El payload no cumple el contrato kold.os.m6.api/1.'],
      error: ['No se pudo cargar', 'Error de red o del servidor.'],
    }
    const [title, body] = messages[load.phase] || messages.error
    return (
      <div style={{ padding: 16, maxWidth: 1180, margin: '0 auto' }}>
        <Header demo={false} payload={null} />
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
          padding: 16, marginTop: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          {body && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 1.6 }}>{body}</p>}
          {load.errors?.length > 0 && (
            <p style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
              Detalle técnico: {load.errors.slice(0, 3).join(' · ')}
            </p>
          )}
          {demoAllowed && load.phase === 'unavailable' && (
            <p style={{ fontSize: 11, color: C.textLow, marginTop: 8 }}>
              Modo demostración (solo este entorno): <code>?demo=1</code> — fixture generado
              por el core real del backend M6 local. No es evidencia en vivo.
            </p>
          )}
        </div>
      </div>
    )
  }

  const s = payload.summary || {}
  const rules = payload.rule_results || []

  // Etiquetas de universo DERIVADAS del propio payload: el frontend no las
  // inventa ni las escribe a mano; las lee de lo que el backend declaró en cada
  // rule_result. Si un universo no viene, el tile muestra su id (visible, no mudo).
  const U = new Proxy({}, {
    get: (_t, id) => rules.find((r) => r.universe_id === id)?.universe_label || String(id),
  })

  return (
    <div style={{ padding: 16, maxWidth: 1180, margin: '0 auto' }}>
      <Header demo={!!load.demo} payload={payload} />

      {load.demo && (
        <div style={{
          background: '#f59e0b14', border: '1px solid #f59e0b40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.textSoft, lineHeight: 1.5,
        }}>
          <b>Modo demostración</b> ({M6_API_FIXTURE_PROVENANCE.kind}) — envelope generado por el
          core real del backend M6 (<b>{M6_API_FIXTURE_PROVENANCE.backend_status}</b>, destino
          {' '}{M6_API_FIXTURE_PROVENANCE.backend_target_repo}) con los NÚMEROS REALES medidos en
          producción por XML-RPC read-only. La API real nunca ha sido probada: no existe endpoint
          desplegado. Este fixture NO existe en producción.
        </div>
      )}

      {stale && (
        <div style={{
          background: '#f59e0b14', border: '1px solid #f59e0b40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.textSoft,
        }}>
          <b>Corrida stale:</b> {payload?.age_days ?? '?'} días de antigüedad. No es el estado vigente.
        </div>
      )}

      {/* ── QUÉ RESPONDE Y QUÉ NO ─────────────────────────────────────────── */}
      <p style={{ fontSize: 11, color: C.textLow, marginTop: 10, lineHeight: 1.6 }}>
        Lee los veredictos, no solo los colores: solo los <b>INCUMPLIMIENTOS</b> tienen umbral aprobado
        y supuesto verificado. Las <b>ANOMALÍAS</b> son señales exploratorias (dicen dónde mirar, no
        prueban una conclusión financiera). Esta pantalla <b>no afirma que la caja cuadre ni que falte
        dinero</b>: muestra lo que las fuentes reportan, con qué cobertura se observó y qué no se puede
        concluir. M6 observa: no registra pagos, no valida cortes, no concilia, no liquida.
      </p>

      {/* ── NIVEL 1 · ESTADO FINANCIERO REPORTADO ─────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 18 }}>Nivel 1 · Estado financiero reportado</h2>
      <div style={{ fontSize: 10, color: C.textLow, marginTop: 2, marginBottom: 6 }}>
        Por <b>veredicto</b>: qué se concluye de cada regla.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <VerdictTile verdict="incumplimiento" rules={s.definitive_incident_rule_count ?? 0} incidences={s.definitive_incident_count} />
        <VerdictTile verdict="riesgo" rules={s.warning_rule_count ?? 0} incidences={s.warning_count} />
        <VerdictTile verdict="anomalia" rules={s.anomaly_rule_count ?? 0} incidences={s.anomaly_count} />
        <VerdictTile verdict="cumple" rules={s.compliant_rule_count ?? 0} incidences={null} />
        <VerdictTile verdict="no_evaluable" rules={s.not_evaluable_rule_count ?? 0} incidences={null} />
      </div>

      {/* Los OTROS DOS EJES: mismas reglas, otra lectura. No se derivan entre sí. */}
      {(s.classification_rule_counts || s.severity_rule_counts) && (
        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 10, lineHeight: 1.55 }}>
          <div>
            <b style={{ color: C.textSoft }}>Las mismas {s.total_rules ?? '—'} reglas por clasificación</b>
            {' '}(otro eje: qué tan sólida es la evidencia) —{' '}
            {Object.entries(s.classification_rule_counts || {}).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </div>
          <div style={{ marginTop: 2 }}>
            <b style={{ color: C.textSoft }}>…y por severidad</b>
            {' '}(otro eje: qué tan grave si es real) —{' '}
            {Object.entries(s.severity_rule_counts || {}).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </div>
          <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2 }}>
            “exploratory” es una clasificación, no un veredicto; “critical” es una severidad, no una
            conclusión. Los tres ejes leen las mismas reglas y no se derivan uno de otro.
          </div>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        Incidencias detectadas: {fmtInt(s.total_incidences)} = suma exacta de incumplimientos + riesgos + anomalías.
        Son afectaciones <b>por regla</b>, NO entidades únicas, NO clientes, NO importes: jamás se mezclan
        pagos, facturas, cierres y cajas en un total genérico. Historial: {payload?.history?.runs_count ?? 0} corrida(s).
      </div>

      {/* ── KPIs del backend ───────────────────────────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>
        Señales por bloque — corte {fmtDateTime(payload.run?.finished_at)}
      </h2>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 4, marginBottom: 8 }}>
        Cada indicador declara su universo, su fuente, su unidad y su salvedad (pasa el cursor por encima).
        Lo que el contrato v1 no puede evaluar se muestra como “—”, nunca como 0.
      </div>

      <Block title="1 · Facturación y cuentas por cobrar">
        <MetricTile label="Facturas publicadas" unit="documentos" payload={payload}
          query="invoice_metrics" field="invoice_count" universe={U.posted_customer_invoices_in_scope} />
        <MetricTile label="Abiertas (por cobrar)" unit="documentos" payload={payload} tone={STATUS_COLORS.AMBER}
          query="invoice_metrics" field="open_count" universe={U.open_receivables_in_scope}
          coverage={(r) => pct(r.open_count, r.invoice_count)} />
        <MetricTile label="Vencidas y abiertas" unit="documentos" payload={payload} tone={STATUS_COLORS.RED}
          query="invoice_metrics" field="overdue_count" universe={U.open_receivables_in_scope}
          coverage={(r) => pct(r.overdue_count, r.open_count)}
          caveat="Vencida = due date anterior al cierre de la ventana. La cartera canónica por cliente vive en el snapshot (bloque 7)." />
        <MetricTile label="Pagadas con residual" unit="documentos" payload={payload} tone={STATUS_COLORS.AMBER}
          query="invoice_metrics" field="paid_with_residual_count" universe={U.posted_customer_invoices_in_scope}
          caveat="Puede ser redondeo, multi-moneda o conciliación parcial. Señal, no faltante probado." />
        <MetricTile label="Sin fecha de vencimiento" unit="documentos" payload={payload}
          query="invoice_metrics" field="no_due_date_count" universe={U.posted_customer_invoices_in_scope}
          caveat="Sin due date esa factura NO entra al aging: hueco de cobertura." />
      </Block>

      <Block title="2 · Pagos"
        note="Un pago sin conciliación identificada NO es un faltante ni un pago perdido: puede ser anticipo, pago no aplicado, conciliación parcial, pago reversado, flujo contable alternativo o cobertura del propio modelo.">
        <MetricTile label="Pagos entrantes" unit="pagos" payload={payload}
          query="payment_metrics" field="payment_count" universe={U.posted_inbound_payments_in_window} />
        <MetricTile label="Sin conciliación identificada" unit="pagos" payload={payload} tone={STATUS_COLORS.AMBER}
          query="payment_metrics" field="unreconciled_count" universe={U.posted_inbound_payments_in_window}
          coverage={(r) => pct(r.unreconciled_count, r.payment_count)}
          caveat="Señal de COBERTURA de conciliación, no de dinero perdido. Sin SLA aprobado no es incumplimiento." />
        <MetricTile label="Sin journal" unit="pagos" payload={payload}
          query="payment_metrics" field="no_journal_count" universe={U.posted_inbound_payments_in_window} />
        <MetricTile label="Monto no positivo" unit="pagos" payload={payload}
          query="payment_metrics" field="non_positive_count" universe={U.posted_inbound_payments_in_window}
          caveat="Puede ser reverso o ajuste." />
      </Block>

      <Block title="3 · Caja de ruta"
        note="“Estado abierto” es lo que la fuente REPORTA. Puede representar una caja operativa permanente o una sesión sin cierre: requiere validación funcional. NO son cajas abandonadas ni un faltante: no existe política de cierre aprobada contra la cual medirlo.">
        <MetricTile label="Cajas de vendedor" unit="cajas" payload={payload}
          query="seller_cashbox_metrics" field="cashbox_count" universe={U.route_cash_boxes_in_window} />
        <MetricTile label="Con estado abierto" unit="cajas" payload={payload} tone={STATUS_COLORS.AMBER}
          query="seller_cashbox_metrics" field="still_open_count" universe={U.route_cash_boxes_in_window}
          coverage={(r) => pct(r.still_open_count, r.cashbox_count)}
          caveat="Estado abierto en la fuente observada; requiere validación funcional." />
        <MetricTile label="Con estado cerrado" unit="cajas" payload={payload}
          query="seller_cashbox_metrics" field="closed_count" universe={U.route_cash_boxes_in_window} />
        <MetricTile label="Sin ruta vinculada" unit="cajas" payload={payload}
          query="seller_cashbox_metrics" field="no_route_count" universe={U.route_cash_boxes_in_window}
          caveat="Sin route_plan no se puede atribuir el efectivo a una ruta." />
      </Block>

      <Block title="4 · Corte y liquidación">
        <MetricTile label="Cierres de caja" unit="cierres" payload={payload}
          query="cash_closing_metrics" field="closing_count" universe={U.cash_closings_in_window}
          caveat="Cobertura del modelo baja: pocos registros en la ventana." />
        <MetricTile label="Con diferencia reportada" unit="cierres" payload={payload} tone={STATUS_COLORS.RED}
          query="cash_closing_metrics" field="with_difference_count" universe={U.cash_closings_in_window}
          coverage={(r) => pct(r.with_difference_count, r.closing_count)}
          caveat="Diferencia FINANCIERA que el arqueo declara — distinta de la diferencia FÍSICA de M5. Sin umbral aprobado." />
        <MetricTile label="Cierres de sucursal" unit="cierres" payload={payload}
          query="branch_close_metrics" field="close_count" universe={U.branch_daily_closes_in_window} />
        <MetricTile label="Cerrados" unit="cierres" payload={payload}
          query="branch_close_metrics" field="closed_count" universe={U.branch_daily_closes_in_window}
          coverage={(r) => pct(r.closed_count, r.close_count)} />
        <MetricTile label="Sin arrancar" unit="cierres" payload={payload} tone={STATUS_COLORS.AMBER}
          query="branch_close_metrics" field="not_started_count" universe={U.branch_daily_closes_in_window} />
        <MetricTile label="Bajo revisión" unit="cierres" payload={payload}
          query="branch_close_metrics" field="under_review_count" universe={U.branch_daily_closes_in_window} />
      </Block>

      <Block title="5 · Depósitos"
        note="No existe una fuente canónica ratificada de “depósito”: account.bank.statement.line es un candidato, no autoridad.">
        <MetricTile label="Líneas bancarias" unit="líneas" payload={payload}
          query="bank_statement_metrics" field="statement_line_count" universe={U.bank_statement_lines_in_window} />
        {features.deposit_model === false && (
          <UnavailableTile label="Depósitos conciliados"
            reason="capability deposit_model=false — sin fuente canónica ratificada de “depósito”" />
        )}
      </Block>

      <Block title="6 · Conciliación">
        <MetricTile label="Apuntes de CxC" unit="apuntes" payload={payload}
          query="reconciliation_metrics" field="receivable_line_count" universe={U.open_receivable_move_lines_in_window} />
        <MetricTile label="Abiertos sin conciliar" unit="apuntes" payload={payload} tone={STATUS_COLORS.AMBER}
          query="reconciliation_metrics" field="unreconciled_open_count" universe={U.open_receivable_move_lines_in_window}
          coverage={(r) => pct(r.unreconciled_open_count, r.receivable_line_count)}
          caveat="El residual abierto es esperado hasta el cobro: es cobertura, no faltante." />
      </Block>

      <Block title="7 · Cartera y aging"
        note="Fuente canónica: gf.ar.customer.snapshot — el aging lo computa el snapshot. El frontend NO lo recalcula por fecha ni suma monedas. Son conteos de CLIENTES, no importes. Sin identidad del cliente (PII fuera del observatorio).">
        <MetricTile label="Clientes con snapshot" unit="clientes" payload={payload}
          query="ar_aging_metrics" field="snapshot_count" universe={U.ar_customer_snapshots_in_scope} />
        <MetricTile label="Con saldo vencido" unit="clientes" payload={payload} tone={STATUS_COLORS.AMBER}
          query="ar_aging_metrics" field="overdue_count" universe={U.ar_customer_snapshots_in_scope}
          coverage={(r) => pct(r.overdue_count, r.snapshot_count)} />
        <MetricTile label="Atraso > 30 días" unit="clientes" payload={payload}
          query="ar_aging_metrics" field="over_30_count" universe={U.ar_customer_snapshots_in_scope} />
        <MetricTile label="Atraso > 60 días" unit="clientes" payload={payload} tone={STATUS_COLORS.AMBER}
          query="ar_aging_metrics" field="over_60_count" universe={U.ar_customer_snapshots_in_scope} />
        <MetricTile label="Atraso > 90 días" unit="clientes" payload={payload} tone={STATUS_COLORS.RED}
          query="ar_aging_metrics" field="over_90_count" universe={U.ar_customer_snapshots_in_scope}
          caveat="Candidato a incobrable; el write-off no es evaluable sin política aprobada." />
        <MetricTile label="Saldo sin vencimiento" unit="clientes" payload={payload}
          query="ar_aging_metrics" field="pending_without_due_count" universe={U.ar_customer_snapshots_in_scope}
          caveat="Sin oldest_due_date el aging de ese cliente NO es evaluable por dato faltante." />
        <UnavailableTile label="Importe de cartera por bucket"
          reason="el backend v1 emite CONTEOS de clientes, no importes por bucket; consolidarlos exigiría normalizar monedas" />
      </Block>

      {/* ── NIVEL 2 · COBERTURA DE INSTRUMENTACIÓN ────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>Nivel 2 · Cobertura de la instrumentación</h2>
      <div style={{ fontSize: 10, color: C.textLow, marginTop: 2, marginBottom: 6, lineHeight: 1.45 }}>
        Cuánto de la realidad alcanzamos a observar. Una cobertura baja no es un incumplimiento:
        es el límite de lo que se puede afirmar.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <CoverageTile label="Monedas en el scope"
          value={(payload.run?.scope?.currency_ids || []).length}
          note="Los importes NO se consolidan entre monedas." />
        <CoverageTile label="Consultas ejecutadas"
          value={(payload.run?.executed_queries || []).length}
          note="Manifiesto cerrado del auditor." />
        <CoverageTile label="Reglas evaluadas"
          value={rules.filter((r) => r.verdict !== 'no_evaluable').length}
          note={`de ${rules.length} totales. El resto es NO evaluable por contrato.`} />
        <CoverageTile label="Corridas del scope"
          value={payload?.history?.runs_count ?? 0}
          note="El historial jamás mezcla scopes distintos." />
      </div>

      {/* ── NIVEL 3 · CAPACIDADES NO DISPONIBLES ──────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 20 }}>Nivel 3 · Capacidades no disponibles</h2>
      <div style={{ fontSize: 10, color: C.textLow, marginTop: 2, marginBottom: 6, lineHeight: 1.45 }}>
        Lo que esta corrida <b>NO</b> puede afirmar, y por qué. Una capability en false no es un cero.
      </div>
      {features.consolidated_global_total === false && (
        <div style={{
          background: '#a78bfa14', border: '1px solid #a78bfa40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginBottom: 8, fontSize: 11.5, color: C.textSoft, lineHeight: 1.5,
        }}>
          <b>Total consolidado no disponible:</b> existen varias monedas sin normalización autorizada.
          Los importes se muestran por moneda; convertirlos aquí con una tasa inventada produciría
          una cifra falsa.
        </div>
      )}
      {features.lifecycle_corrected_detection === false && (
        <div style={{
          background: '#a78bfa14', border: '1px solid #a78bfa40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginBottom: 8, fontSize: 11.5, color: C.textSoft, lineHeight: 1.5,
        }}>
          <b>“Corregido” no se mide:</b> el ciclo de vida distingue nuevo, persistente y
          reincidente, pero <b>no</b> puede afirmar que algo se corrigió. Que un hallazgo
          desaparezca no prueba una corrección — pudo cambiar el alcance, faltar la fuente o
          no haberse evaluado la regla. Por eso no aparece como filtro: daría cero siempre,
          y ese cero se leería como “no hubo correcciones”.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Se lee del contrato del backend (capabilities.lifecycle_states_unsupported),
            no de una lista escrita a mano que pueda envejecer sin avisar. */}
        {Object.entries(payload.capabilities?.lifecycle_states_unsupported || {}).map(
          ([estado, razon]) => (
            <UnavailableTile key={estado}
              label={`Ciclo de vida: ${M6_LIFECYCLE_UNAVAILABLE.find((x) => x.key === estado)?.label || estado}`}
              reason={razon} />
          ))}
        {features.consolidated_global_total === false && (
          <UnavailableTile label="Total consolidado global"
            reason="varias monedas sin normalización autorizada" />
        )}
        {features.currency_normalization_supported === false && (
          <UnavailableTile label="Normalización de moneda"
            reason="no se aplica tasa por fecha (res.currency.rate)" />
        )}
        {features.m1_cash_pending_reconciliation === false && (
          <UnavailableTile label="Cruce con cash pending de M1"
            reason="el cash pending de M1 es SEÑAL operativa, no un saldo de caja" />
        )}
        {features.m3_close_reconciliation === false && (
          <UnavailableTile label="Cruce con cierre de ruta (M3)"
            reason="el mapeo ruta→cierre administrativo no está ratificado" />
        )}
        {features.physical_to_financial_bridge === false && (
          <UnavailableTile label="Puente físico → financiero"
            reason="la diferencia FÍSICA de M5 no es una diferencia FINANCIERA" />
        )}
        {features.m7_financial_cost_available === false && (
          <UnavailableTile label="Costo financiero (M7)"
            reason="M7 no iniciado" />
        )}
      </div>

      {/* ── FILTROS (server-side) ──────────────────────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Hallazgos</h2>
      <div style={{ fontSize: 10, color: C.textLow, marginTop: 2, marginBottom: 8, lineHeight: 1.45 }}>
        Los filtros viajan al backend: él filtra, cuenta y pagina. El frontend solo representa.
        Los cuatro ejes se filtran por separado.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {M6_FILTER_AXES.map((axis) => (
          <select key={axis.key} title={axis.help} style={selectStyle}
            value={filters[axis.key]} onChange={(e) => setFilter(axis.key, e.target.value)}>
            <option value="">{axis.label}: todos</option>
            {axis.options.map((opt) => (
              <option key={opt} value={opt}>
                {axis.key === 'verdict' ? M6_VERDICT_LABELS[opt]
                  : axis.key === 'classification' ? M6_CLASSIFICATION_LABELS[opt]
                  : axis.key === 'severity' ? M6_SEVERITY_LABELS[opt]
                  : axis.key === 'lifecycle_status' ? M6_LIFECYCLE_LABELS[opt]
                  : categoryLabel(opt)}
              </option>
            ))}
          </select>
        ))}
        <input style={{ ...selectStyle, maxWidth: 220 }} placeholder="Buscar (regla, título, área)…"
          value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        {activeFilterCount(filters) > 0 && (
          <button style={pagerBtn(false)} onClick={() => { setFilters(M6_DEFAULT_FILTERS); setPage(1) }}>
            Limpiar ({activeFilterCount(filters)})
          </button>
        )}
      </div>

      {/* rejected_params: un filtro rechazado en silencio es una mentira. */}
      {table.rejected?.length > 0 && (
        <div style={{
          background: '#ef444414', border: '1px solid #ef444440', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.textSoft,
        }}>
          <b>Parámetros rechazados por el backend:</b> {table.rejected.join(', ')}.
          La lista que ves <b>NO</b> está filtrada por ellos.
        </div>
      )}
      {table.demoUnfiltered && (
        <div style={{
          background: '#f59e0b14', border: '1px solid #f59e0b40', borderRadius: TOKENS.radius.lg,
          padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.textSoft,
        }}>
          <b>Demo sin backend:</b> los filtros se aplican en el servidor, y en demo no hay servidor.
          La lista se muestra <b>sin filtrar</b> en vez de simular un filtrado que no ocurrió.
        </div>
      )}

      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Filtros no disponibles en v1: {M6_HIDDEN_FILTERS.map((f) => f.key).join(' · ')} —
        los hallazgos v1 son agregados y no portan esas dimensiones.
      </div>

      {/* ── TABLA DE FINDINGS ──────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '6px 8px' }}>Veredicto</th>
              <th style={{ padding: '6px 8px' }}>Clasificación</th>
              <th style={{ padding: '6px 8px' }}>Severidad</th>
              <th style={{ padding: '6px 8px' }}>Regla</th>
              <th style={{ padding: '6px 8px' }}>Título</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Observado</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Universo</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cobertura</th>
              <th style={{ padding: '6px 8px' }}>Ciclo</th>
              <th style={{ padding: '6px 8px' }}>Área</th>
            </tr>
          </thead>
          <tbody>
            {table.items.map((f) => (
              <tr key={f.finding_id || f.finding_key} style={{ borderBottom: `1px solid ${C.border}55`, cursor: 'pointer' }}
                onClick={() => setOpenFindingId(openFindingId === (f.finding_id || f.finding_key) ? null : (f.finding_id || f.finding_key))}>
                <td style={{ padding: '6px 8px' }}>
                  <Pill color={M6_VERDICT_COLORS[f.verdict] || C.textMuted} title={M6_VERDICT_HELP[f.verdict]}>
                    {M6_VERDICT_LABELS[f.verdict] || f.verdict}
                  </Pill>
                </td>
                <td style={{ padding: '6px 8px', color: C.textMuted }}>{M6_CLASSIFICATION_LABELS[f.classification] || f.classification}</td>
                <td style={{ padding: '6px 8px', color: C.textMuted }}>{M6_SEVERITY_LABELS[f.severity] || f.severity}</td>
                <td style={{ padding: '6px 8px', color: C.textSoft, fontFamily: 'monospace' }}>{f.rule_code}</td>
                <td style={{ padding: '6px 8px', color: C.text }}>{f.title}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: C.text }}>{fmtInt(f.observed_value ?? f.incidences)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: C.textMuted }}>{fmtInt(f.denominator)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: C.textMuted }}>{f.pct != null ? `${f.pct}%` : '—'}</td>
                <td style={{ padding: '6px 8px', color: C.textMuted }}>{M6_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status}</td>
                <td style={{ padding: '6px 8px', color: C.textMuted }}>{f.responsible_area}</td>
              </tr>
            ))}
            {table.items.length === 0 && table.phase === 'ok' && (
              <tr><td colSpan={10} style={{ padding: 14, color: C.textMuted, textAlign: 'center' }}>
                Sin hallazgos con estos filtros. (Vacío ≠ sin datos: la corrida existe.)
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Panel de detalle del hallazgo */}
      {openFindingId && (() => {
        const f = table.items.find((x) => (x.finding_id || x.finding_key) === openFindingId)
        if (!f) return null
        return (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
            padding: 12, marginTop: 10, fontSize: 11.5, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 800, color: C.text, marginBottom: 6 }}>{f.rule_code} · {f.title}</div>
            <Field label="Universo" value={f.universe_label} />
            <Field label="Fórmula / fuente" value={`${f.source_model} (${(f.source_fields || []).join(', ')})`} />
            <Field label="Supuesto de negocio" value={f.business_assumption} />
            <Field label="Limitaciones de la evidencia" value={f.evidence_limitations} />
            <Field label="Umbral aprobado" value={f.approved_threshold ? 'SÍ' : 'NO'} />
            <Field label="Origen del umbral" value={f.threshold_source} />
            <Field label="Moneda" value={f.currency_aware ? 'el universo puede mezclar monedas: los importes NO se consolidan' : 'n/a'} />
            <Field label="Linaje" value={`auditor ${shortHash(payload.run?.auditor_build_sha)} · contrato ${shortHash(payload.run?.contract_build_sha) || 'sin sellar'}`} />
            <Field label="scope_key" value={f.scope_key} />
            <Field label="Ciclo de vida" value={`${M6_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status} · primera ${fmtDateTime(f.first_seen_at)} · última ${fmtDateTime(f.last_seen_at)} · ${f.occurrence_count ?? 1} ocurrencia(s)`} />
            <Field label="Corte del dato" value={fmtDateTime(payload.run?.finished_at)} />
            <Field label="Acción recomendada" value={f.recommended_action} />
            <div style={{ fontSize: 10, color: C.textLow, marginTop: 6 }}>
              M6 observa, no corrige: este panel no tiene botones de acción.
            </div>
          </div>
        )
      })()}

      {/* Paginación (server-side) */}
      {!demo && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <button style={pagerBtn(page <= 1)} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
          <span style={{ fontSize: 11.5, color: C.textMuted }}>
            Página {page} de {table.pages} · {fmtInt(table.total)} hallazgos (total del conjunto filtrado)
          </span>
          <button style={pagerBtn(page >= table.pages)} disabled={page >= table.pages} onClick={() => setPage((p) => Math.min(table.pages, p + 1))}>Siguiente</button>
        </div>
      )}

      {/* ── EXPORTS ────────────────────────────────────────────────────────── */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Exportar evidencia</h2>
      <div style={{ fontSize: 10, color: C.textLow, marginTop: 2, marginBottom: 8 }}>
        Cada archivo declara su linaje y su estado de evidencia en el nombre y en el cuerpo. Sin PII.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_hallazgos', 'csv',
          findingsToCsv(table.items), 'text/csv')}>Hallazgos CSV</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_evidencia', 'json',
          evidenceJson(payload, { demo: !!load.demo }), 'application/json')}>Evidencia JSON</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_resumen', 'txt',
          executiveSummaryText(payload, { demo: !!load.demo }))}>Resumen ejecutivo</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_cartera_aging', 'txt',
          agingText(payload, { demo: !!load.demo }))}>Cartera y aging</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_pagos_conciliacion', 'txt',
          paymentsText(payload, { demo: !!load.demo }))}>Pagos y conciliación</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_cierres_liquidaciones', 'txt',
          closuresText(payload, { demo: !!load.demo }))}>Cierres y liquidaciones</button>
        <button style={exportBtn} onClick={() => doExport('kold_os_m6_capacidades', 'txt',
          capabilitiesText(payload, { demo: !!load.demo }))}>Capacidades y cobertura</button>
      </div>

      <p style={{ fontSize: 10, color: C.textLow, marginTop: 16, lineHeight: 1.5 }}>
        M6 observa, no corrige. No registra pagos, no valida cortes, no concilia, no liquida, no crea
        depósitos, no modifica facturas ni cartera. Cero writes.
      </p>
    </div>
  )
}

function Block({ title, note, children }) {
  const visible = Array.isArray(children) ? children.filter(Boolean) : children
  if (!visible || (Array.isArray(visible) && visible.length === 0)) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSoft }}>{title}</div>
      {note && <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.4 }}>{note}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{children}</div>
    </div>
  )
}

function CoverageTile({ label, value, note }) {
  return (
    <div title={note} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 138, flex: '1 1 138px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmtInt(value)}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 2, lineHeight: 1.3 }}>{note}</div>
    </div>
  )
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
      <div style={{ minWidth: 190, color: C.textMuted, fontSize: 10.5 }}>{label}</div>
      <div style={{ color: C.textSoft, fontSize: 10.5, wordBreak: 'break-word' }}>{String(value)}</div>
    </div>
  )
}
