// ─── ScreenPlaneacionM2 — KOLD OS · M2 "Planeación y readiness" ──────────────
// Observatorio READ-ONLY de incumplimientos de planeación. Consume EXCLUSIVA-
// MENTE la API autenticada de gf_kold_os_m2 (GET /pwa-kold-os/m2/latest y
// /findings) vía el mecanismo canónico api() — cero archivos públicos, cero
// writes, cero botones de acción (auto_fix=false por contrato).
//
// Estados honestos:
//   · técnico (auditor):   PASS / FAIL / STALE / UNAVAILABLE (+disabled/etc.)
//   · operativo (datos):   GREEN / AMBER / RED / NOT_EVALUABLE
// Un tablero rojo = "M2 funciona y detectó incumplimientos", nunca error.
// STALE se muestra prominente (edad) y marca los exports; se puede leer pero
// jamás se presenta como vigente.
//
// El KPI dice "Incidencias detectadas": NO son entidades únicas (una misma
// entidad puede violar varias reglas); "registros únicos" exigirá IDs reales
// deduplicables (contrato v1.1). El detalle declara su granularidad real
// (AGREGADO / SUCURSAL / REGISTRO) — hoy todo es AGREGADO.
//
// Demo (?demo=1): SOLO con isM2DemoAllowed (DEV o VITE_ENABLE_M2_DEMO en
// Preview autorizado). En producción el parámetro se IGNORA.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { fetchM2Latest, fetchM2Findings } from './m2/m2Api'
import { isM2DemoAllowed } from './m2/demoGate'
import { applyFindingFilters, paginate, M2_DEFAULT_FILTERS, M2_PAGE_SIZE } from './m2/filters'
import { findingsToCsv, evidenceJson, executiveSummaryText, downloadTextFile, exportFilename } from './m2/exporters'
import {
  M2_CATEGORY_ORDER, M2_STATUS_LABELS, M2_LIFECYCLE_LABELS, M2_SEVERITY_LABELS,
  M2_GRANULARITY_LABELS, categoryLabel,
} from './m2/m2Meta'
import { M2_API_FIXTURE_PROVENANCE, M2_API_LATEST_FIXTURE } from './m2/fixtures/apiLatestFixture'

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
      padding: '10px 12px', minWidth: 108, flex: '1 1 108px',
    }} title={note || undefined}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
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

export default function ScreenPlaneacionM2({ session }) {
  const location = useLocation()
  const demoAllowed = isM2DemoAllowed(import.meta.env)
  const demo = useMemo(
    () => demoAllowed && new URLSearchParams(location.search).get('demo') === '1',
    [demoAllowed, location.search],
  )
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M2_DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [table, setTable] = useState({ phase: 'idle', items: [], total: 0, pages: 1 })
  const [openFindingId, setOpenFindingId] = useState(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false } // descarta resultados tardíos (B1)
  }, [])

  // ── /latest ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (demo) {
      setLoad({ phase: 'ok', payload: M2_API_LATEST_FIXTURE, demo: true })
      return
    }
    setLoad({ phase: 'loading' })
    fetchM2Latest().then((result) => {
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
      const local = paginate(filtered, page, M2_PAGE_SIZE)
      setTable({ phase: 'ok', items: local.items, total: local.total, pages: local.pages })
      return
    }
    setTable((prev) => ({ ...prev, phase: 'loading' }))
    const params = { page, page_size: M2_PAGE_SIZE }
    for (const [key, value] of Object.entries(filters)) if (value) params[key] = value
    const result = await fetchM2Findings(params)
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
    return M2_CATEGORY_ORDER.map((key, index) => {
      const rules = payload.rule_results.filter((r) => r.category === key)
      const red = rules.filter((r) => r.status === 'RED').length
      const amber = rules.filter((r) => r.status === 'AMBER').length
      const notEvaluable = rules.filter((r) => r.status === 'NOT_EVALUABLE').length
      const incidences = rules.reduce((acc, r) => acc + (Number.isInteger(r.incidences) ? r.incidences : 0), 0)
      let status = 'GREEN'
      if (red) status = 'RED'
      else if (amber) status = 'AMBER'
      else if (notEvaluable === rules.length) status = 'NOT_EVALUABLE'
      return { key, order: index + 1, label: categoryLabel(key), rules, red, amber, notEvaluable, incidences, status,
        green: rules.filter((r) => r.status === 'GREEN').length }
    })
  }, [payload])

  const areas = useMemo(() => [...new Set((payload?.findings || []).map((f) => f.responsible_area))], [payload])
  const entityTypes = useMemo(() => [...new Set((payload?.findings || []).map((f) => f.entity_type))], [payload])
  const openFinding = useMemo(
    () => table.items.find((f) => f.finding_id === openFindingId) || null,
    [table.items, openFindingId],
  )

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '18px 16px 90px', color: C.text }
  const typo = getTypo ? getTypo() : {}

  if (load.phase === 'loading') {
    return <div style={wrap}><p style={{ color: C.textMuted, fontSize: 13 }}>Cargando auditoría de planeación…</p></div>
  }

  // ── estados no-ok, honestos y accionables ─────────────────────────────────
  if (!payload) {
    const copy = {
      disabled: ['La API de M2 está apagada (flag)', 'El backend gf_kold_os_m2 responde feature_disabled: el flag gf_kold_os.m2.enabled sigue en "0". Encenderlo requiere S/N.'],
      unavailable: ['Sin fuente de datos disponible', 'La API autenticada de M2 (gf_kold_os_m2) aún no está desplegada o no tiene corridas ingeridas. El despliegue del backend y la ingesta del run son gates de Sebastián (ver docs/m2/M2_RUNBOOK.md).'],
      session_expired: ['Sesión expirada', 'Vuelve a iniciar sesión para consultar M2.'],
      forbidden: ['Sin permiso M2', 'Tu sesión no tiene acceso M2 (direccion_general / admin_plataforma). El acceso es fail-closed.'],
      schema_mismatch: ['Versión de contrato no soportada', 'El backend publica una versión de kold.os.m2.api que esta UI no soporta. Actualiza la PWA (no se intenta adivinar la estructura).'],
      invalid: ['Respuesta inválida del backend', 'El envelope no validó el contrato kold.os.m2.api/1; no se muestra nada derivado de datos corruptos.'],
      error: ['Error de red o servidor', 'No fue posible consultar la API de M2. Reintenta más tarde.'],
    }[load.phase] || ['Estado desconocido', 'No fue posible determinar el estado de la fuente M2.']
    return (
      <div style={wrap}>
        <Header demo={false} technical="UNAVAILABLE" payload={null} />
        <div style={{ marginTop: 18, padding: '18px 16px', borderRadius: TOKENS.radius.lg, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{copy[0]}</div>
          <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, marginTop: 8 }}>{copy[1]}</p>
          {demoAllowed && (
            <p style={{ fontSize: 12, color: C.textLow, marginTop: 6 }}>
              Modo demostración (solo este entorno): <code>?demo=1</code> — fixture generado por código real, no evidencia en vivo.
            </p>
          )}
        </div>
      </div>
    )
  }

  const summary = payload.summary
  const run = payload.run

  return (
    <div style={wrap}>
      <Header demo={load.demo} technical={run.technical_state} payload={payload} />

      {load.demo && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24',
        }}>
          MODO DEMO ({M2_API_FIXTURE_PROVENANCE.kind}) — envelope generado por el core real del auditor (@fb03840) y el core
          real del backend (PR GrupoVeniu/GrupoFrio#201) con los agregados reportados del run 2026-07-14. NO es evidencia en
          vivo y NO existe en producción.
        </div>
      )}

      {stale && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
          background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24',
        }}>
          ⚠ CORRIDA STALE — la auditoría tiene {payload.age_days ?? '?'} días (umbral: {payload.capabilities?.stale_days ?? 7}).
          Se puede leer, pero NO representa el estado vigente; los exports quedan marcados STALE. Ejecutar una corrida nueva
          (runbook §1) es responsabilidad del operador.
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12,
        background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.textSoft, lineHeight: 1.5,
      }}>
        <b>M2 está funcionando y detectó incumplimientos.</b> El semáforo describe el estado de los DATOS de planeación,
        no del sistema: un bloque en rojo es un resultado válido del observatorio. M2 observa, no corrige.
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <KpiTile label="Reglas evaluadas" value={summary.total_rules - summary.rules_not_evaluable} />
        <KpiTile label="Incumplimientos (rojo)" value={summary.rules_fail} tone={STATUS_COLORS.RED} />
        <KpiTile label="Riesgos (ámbar)" value={summary.rules_warning} tone={STATUS_COLORS.AMBER} />
        <KpiTile
          label="Incidencias detectadas"
          value={summary.total_incidences.toLocaleString('es-MX')}
          tone={STATUS_COLORS.RED}
          note="NO son entidades únicas: una misma entidad puede participar en varias reglas. Registros únicos = contrato v1.1 (IDs deduplicables)."
        />
        <KpiTile label="Compañías en scope" value={(run.scope?.company_ids || []).length} />
        <KpiTile label="Corridas en historial" value={runsCount} />
        <KpiTile
          label="Persistentes"
          value={hasHistory ? (payload.findings || []).filter((f) => f.lifecycle_status === 'persistent').length : '—'}
          note={hasHistory ? undefined : 'Sin historial: se calcula a partir de la 2ª corrida real'}
        />
        <KpiTile
          label="Corregidos"
          value={hasHistory ? (payload.corrected || []).length : '—'}
          tone={hasHistory ? STATUS_COLORS.GREEN : undefined}
          note={hasHistory ? 'vs corrida anterior' : 'Sin historial: se calcula a partir de la 2ª corrida real'}
        />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        “Incidencias detectadas” cuenta afectaciones acumuladas por regla, no entidades únicas.
        {hasHistory ? '' : ' Historial: 1 corrida — tendencias, persistencia y corregidos aparecen con la segunda corrida real.'}
        {' '}Atribución por sucursal: {payload.capabilities?.features?.branch_dimension ? 'disponible' : 'pendiente de la extensión v1.1 del contrato del auditor (scope agregado)'}.
      </div>

      {/* Bloques */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Bloques de planeación</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, marginTop: 10 }}>
        {blocks.map((block) => (
          <div key={block.key} style={{
            background: C.surface, border: `1px solid ${STATUS_COLORS[block.status]}35`,
            borderRadius: TOKENS.radius.lg, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{block.order}. {block.label}</div>
              <Pill color={STATUS_COLORS[block.status]}>{M2_STATUS_LABELS[block.status]}</Pill>
            </div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
              {block.incidences.toLocaleString('es-MX')} incidencias · {block.red} rojo · {block.amber} ámbar ·{' '}
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
              Tendencia: {hasHistory ? 'vs corrida anterior en el detalle' : 'sin historial (primera corrida)'} · Granularidad: AGREGADO (v1)
            </div>
            <button
              onClick={() => { setFilter('category', block.key); document.getElementById('m2-detalle')?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.blue3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver hallazgos de este bloque →
            </button>
          </div>
        ))}
      </div>

      {/* Detalle de regla (agregado v1) */}
      <h2 id="m2-detalle" style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>
        Detalle de regla ({table.total}) <Pill color={C.blue3}>{M2_GRANULARITY_LABELS.aggregate}</Pill>
      </h2>
      <div style={{ fontSize: 11, color: C.textLow, marginTop: 4 }}>
        El contrato v1 es agregado: aquí se detalla la REGLA incumplida, no registros individuales.
        El detalle por registro (y la apertura directa del registro en Odoo) se habilita cuando el contrato v1.1 entregue IDs reales.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select aria-label="Categoría" style={selectStyle} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">Todas las categorías</option>
          {M2_CATEGORY_ORDER.map((key) => <option key={key} value={key}>{categoryLabel(key)}</option>)}
        </select>
        <select aria-label="Severidad" style={selectStyle} value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)}>
          <option value="">Toda severidad</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
        </select>
        <select aria-label="Estado" style={selectStyle} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Todo estado</option>
          <option value="RED">Incumplimiento</option>
          <option value="AMBER">Riesgo</option>
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
              {['Estado', 'Regla', 'Hallazgo', 'Granularidad', 'Entidad', 'Observado', 'Ciclo', 'Área responsable', 'Última detección'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.phase === 'loading' && (
              <tr><td colSpan={9} style={{ padding: 14, color: C.textMuted }}>Cargando hallazgos…</td></tr>
            )}
            {table.phase === 'error' && (
              <tr><td colSpan={9} style={{ padding: 14, color: STATUS_COLORS.AMBER }}>No fue posible consultar /findings ({table.state}). Reintenta.</td></tr>
            )}
            {table.phase === 'ok' && table.items.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 14, color: C.textMuted }}>Sin hallazgos con estos filtros.</td></tr>
            )}
            {table.phase === 'ok' && table.items.map((f) => (
              <tr
                key={f.finding_id}
                onClick={() => setOpenFindingId(openFindingId === f.finding_id ? null : f.finding_id)}
                style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: openFindingId === f.finding_id ? C.surfaceSoft : 'transparent' }}
              >
                <td style={{ padding: '8px 10px' }}><Pill color={STATUS_COLORS[f.status]}>{M2_STATUS_LABELS[f.status]}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}>{f.rule_code}</td>
                <td style={{ padding: '8px 10px', minWidth: 180 }}>{f.title}</td>
                <td style={{ padding: '8px 10px' }}><Pill color={C.blue3}>{M2_GRANULARITY_LABELS[f.granularity] || f.granularity}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.entity_type}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: STATUS_COLORS[f.status], fontWeight: 700 }}>{f.observed_value}</td>
                <td style={{ padding: '8px 10px' }}>{M2_LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status}</td>
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
          exportFilename('m2_findings', 'csv', { stale, demo: load.demo }),
          findingsToCsv(payload.findings), 'text/csv')} />
        <ExportBtn label="JSON de evidencia" onClick={() => downloadTextFile(
          exportFilename('m2_evidencia', 'json', { stale, demo: load.demo }),
          evidenceJson(payload, load.demo ? { fixture_provenance: M2_API_FIXTURE_PROVENANCE } : {}), 'application/json')} />
        <ExportBtn label="Resumen ejecutivo (imprimible)" onClick={() => downloadTextFile(
          exportFilename('m2_resumen_ejecutivo', 'txt', { stale, demo: load.demo }),
          executiveSummaryText(payload, { demo: load.demo }))} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Trazabilidad: run {shortHash(run.run_id)} · manifest {shortHash(run.manifest_sha256)} · evidencia {shortHash(run.evidence_sha256)} · auditor {shortHash(run.build_sha)}
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
        <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>Planeación y readiness</h1>
        <Pill color={C.blue3} title="Superficie de solo lectura: cero escrituras">READ-ONLY</Pill>
        {technical && (
          <Pill color={TECH_COLORS[technical] || TECH_COLORS.UNAVAILABLE} title="Estado técnico del auditor (no de los datos)">
            AUDITOR: {technical}
          </Pill>
        )}
        {summary && (
          <Pill color={STATUS_COLORS[summary.overall_status]} title="Estado operativo de los datos de planeación">
            DATOS: {summary.overall_status}
          </Pill>
        )}
        {demo && <Pill color="#fbbf24">DEMO</Pill>}
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, lineHeight: 1.6 }}>
        KOLD OS · M2 (Demanda / planeación / optimización) · observatorio de incumplimientos —{' '}
        {run ? (
          <>
            corte {fmtDateTime(run.finished_at)} · ventana {run.scope?.window_days} días · compañías{' '}
            {(run.scope?.company_ids || []).join(', ')} · {run.duration_ms} ms ·{' '}
            {(run.executed_queries || []).length} consultas · fuente: API autenticada gf_kold_os_m2
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
  const isAggregate = finding.granularity === 'aggregate'
  return (
    <div style={{
      marginTop: 12, padding: '14px 16px', borderRadius: TOKENS.radius.lg,
      background: C.surface, border: `1px solid ${STATUS_COLORS[finding.status]}45`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {finding.rule_code} · {finding.title}{' '}
          <Pill color={STATUS_COLORS[finding.status]}>{M2_STATUS_LABELS[finding.status]}</Pill>{' '}
          <Pill color={C.blue3}>{M2_GRANULARITY_LABELS[finding.granularity] || finding.granularity}</Pill>
        </div>
        <button onClick={onClose} aria-label="Cerrar detalle" style={{ ...pagerBtn(false) }}>✕</button>
      </div>
      <p style={{ fontSize: 12.5, color: C.textSoft, lineHeight: 1.6, marginTop: 8 }}>{finding.description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {row('Valor observado', finding.observed_value)}
        {row('Regla esperada', finding.expected_rule)}
        {row('Severidad', M2_SEVERITY_LABELS[finding.severity] || finding.severity)}
        {row('Incidencias', finding.incidences != null ? `${finding.incidences} (afectaciones de esta regla; no entidades únicas)` : '—')}
        {row('Entidad', `${finding.entity_type} · ${finding.entity_reference}`)}
        {row('Compañía / sucursal', isAggregate
          ? 'Agregado del scope completo — la dimensión por sucursal llega con el contrato v1.1'
          : `${finding.company_name || finding.company_id || '—'} / ${finding.branch_name || finding.branch_id || '—'}`)}
        {row('Ciclo de vida', hasHistory
          ? `${M2_LIFECYCLE_LABELS[finding.lifecycle_status] || finding.lifecycle_status} · visto en ${finding.occurrence_count} de ${runsCount} corridas`
          : 'Nuevo (primera corrida en el historial; persistencia/reincidencia se calculan con la segunda)')}
        {row('Primera detección', fmtDateTime(finding.first_seen_at))}
        {row('Última detección', fmtDateTime(finding.last_seen_at))}
        {row('Área responsable', `${finding.responsible_area} · dueño: ${finding.owner_status === 'unassigned' ? 'no identificado (sin fuente autoritativa)' : finding.owner_status}`)}
        {row('Acción operativa sugerida', finding.recommended_action)}
        {row('Fuente', `${finding.source_model} · query ${finding.evidence_reference?.query_id || '—'} · corte ${fmtDateTime(finding.source_timestamp)}`)}
        {row('Evidencia', `sha256 ${shortHash(finding.evidence_reference?.evidence_sha256)} · manifest ${shortHash(finding.evidence_reference?.manifest_sha256)} · campos: ${(finding.evidence_reference?.evidence_fields || []).join(', ') || '—'}`)}
        {row('Detalle por registro', finding.entity_id != null
          ? `entity_id ${finding.entity_id}`
          : 'No disponible en el contrato agregado v1 (extensión v1.1 propuesta)')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={copyRef} style={{ ...pagerBtn(false) }}>Copiar referencia</button>
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Este panel es evidencia de observación. M2 no ofrece acciones de corrección: auto_fix = false por contrato.
      </div>
    </div>
  )
}
