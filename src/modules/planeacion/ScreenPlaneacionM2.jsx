// ─── ScreenPlaneacionM2 — KOLD OS · M2 "Planeación y readiness" ──────────────
// Observatorio READ-ONLY de incumplimientos de planeación. Evidencia qué no se
// está haciendo, cuántos registros afecta, desde cuándo y quién debe atenderlo.
// NO corrige, NO escribe, NO ejecuta el solver, NO asigna nada: cero botones
// de acción operativa. Fuente: run del auditor gf_route_compliance (13 queries
// read-only con guardas de transacción). Estados honestos:
//   · técnico  (auditor):  PASS / FAIL / STALE / UNAVAILABLE
//   · operativo (datos):   GREEN / AMBER / RED / NOT_EVALUABLE
// Un tablero en rojo = "M2 funciona y detectó incumplimientos", nunca error.
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { technicalStateFor } from './m2/contract'
import { deriveM2 } from './m2/deriveFindings'
import { applyLifecycle } from './m2/lifecycle'
import { applyFindingFilters, paginate, M2_DEFAULT_FILTERS, M2_PAGE_SIZE } from './m2/filters'
import { findingsToCsv, evidenceJson, executiveSummaryText, downloadTextFile } from './m2/exporters'
import { fetchM2Run } from './m2/loadM2Run'
import { M2_CATEGORIES } from './m2/ruleCatalog'
import { M2_FIXTURE_RUN, M2_FIXTURE_PROVENANCE } from './m2/fixtures/realRun20260714'

const C = TOKENS.colors

const STATUS_COLORS = {
  GREEN: C.success, AMBER: '#f59e0b', RED: '#ef4444', NOT_EVALUABLE: 'rgba(255,255,255,0.45)',
}
const STATUS_LABELS = {
  GREEN: 'Cumple', AMBER: 'Riesgo', RED: 'Incumplimiento', NOT_EVALUABLE: 'No evaluable',
}
const TECH_COLORS = { PASS: C.success, FAIL: '#ef4444', STALE: '#f59e0b', UNAVAILABLE: 'rgba(255,255,255,0.45)' }
const LIFECYCLE_LABELS = { new: 'Nuevo', persistent: 'Persistente', corrected: 'Corregido', recurrent: 'Reincidente' }
const SEVERITY_LABELS = { high: 'Alta', medium: 'Media' }

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

function KpiTile({ label, value, tone }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: '10px 12px', minWidth: 108, flex: '1 1 108px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

const selectStyle = {
  background: C.bg1, border: `1px solid ${C.border}`, color: C.textSoft,
  borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 180,
}

export default function ScreenPlaneacionM2({ session }) {
  const location = useLocation()
  const demo = useMemo(() => new URLSearchParams(location.search).get('demo') === '1', [location.search])
  const [load, setLoad] = useState({ phase: 'loading' })
  const [filters, setFilters] = useState(M2_DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [openFindingId, setOpenFindingId] = useState(null)

  useEffect(() => {
    let alive = true
    if (demo) {
      setLoad({ phase: 'ready', report: M2_FIXTURE_RUN, demo: true })
      return () => { alive = false }
    }
    setLoad({ phase: 'loading' })
    fetchM2Run().then((result) => {
      if (!alive) return
      if (result.state === 'ok') setLoad({ phase: 'ready', report: result.report, demo: false })
      else setLoad({ phase: result.state, errors: result.errors || [] })
    })
    return () => { alive = false }
  }, [demo])

  const report = load.phase === 'ready' ? load.report : null
  const technical = useMemo(
    () => (load.phase === 'loading' ? null : technicalStateFor(report, new Date().toISOString())),
    [load.phase, report],
  )
  const derived = useMemo(() => (report ? deriveM2(report) : null), [report])
  // Historial v1: una sola corrida disponible ⇒ lifecycle desde esa historia.
  const lifecycle = useMemo(
    () => (report && derived ? applyLifecycle([{ report, findings: derived.findings }]) : null),
    [report, derived],
  )
  const filtered = useMemo(
    () => applyFindingFilters(lifecycle?.findings || [], filters),
    [lifecycle, filters],
  )
  const paged = useMemo(() => paginate(filtered, page, M2_PAGE_SIZE), [filtered, page])
  const openFinding = useMemo(
    () => (lifecycle?.findings || []).find((f) => f.finding_id === openFindingId) || null,
    [lifecycle, openFindingId],
  )

  const setFilter = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setPage(1) }

  const areas = useMemo(
    () => [...new Set((lifecycle?.findings || []).map((f) => f.responsible_area))],
    [lifecycle],
  )
  const entityTypes = useMemo(
    () => [...new Set((lifecycle?.findings || []).map((f) => f.entity_type))],
    [lifecycle],
  )

  const wrap = { maxWidth: 1200, margin: '0 auto', padding: '18px 16px 90px', color: C.text }
  const typo = getTypo ? getTypo() : {}

  if (load.phase === 'loading') {
    return <div style={wrap}><p style={{ color: C.textMuted, fontSize: 13 }}>Cargando auditoría de planeación…</p></div>
  }

  // Estado técnico UNAVAILABLE / FAIL — honesto, sin inventar datos.
  if (!report || technical === 'UNAVAILABLE' || technical === 'FAIL') {
    const failed = technical === 'FAIL'
    return (
      <div style={wrap}>
        <Header demo={false} technical={failed ? 'FAIL' : 'UNAVAILABLE'} report={failed ? report : null} summary={null} />
        <div style={{
          marginTop: 18, padding: '18px 16px', borderRadius: TOKENS.radius.lg,
          background: C.surface, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {failed ? 'La corrida del auditor NO superó sus guardas técnicas' : 'Sin corrida del auditor publicada para esta superficie'}
          </div>
          <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, marginTop: 8 }}>
            {failed
              ? 'El run existe pero declara FAIL en sus verificaciones read-only (transacción/write-probe/rollback). No se muestran datos derivados de una corrida inválida.'
              : 'M2 consume la evidencia del auditor read-only de planeación (gf_route_compliance). Aún no hay un run publicado en la fuente gateada de esta superficie; la publicación es parte del runbook v1.1 y requiere su propia autorización.'}
          </p>
          <p style={{ fontSize: 12, color: C.textLow, marginTop: 6 }}>
            Ver <code>docs/m2/M2_RUNBOOK.md</code>. Modo demostración disponible con <code>?demo=1</code> (reconstrucción sanitizada del run 2026-07-14).
          </p>
        </div>
      </div>
    )
  }

  const summary = derived.summary

  return (
    <div style={wrap}>
      <Header demo={load.demo} technical={technical} report={report} summary={summary} />

      {load.demo && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10, fontSize: 11.5,
          background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24',
        }}>
          MODO DEMO — reconstrucción sanitizada del run real 2026-07-14 ({M2_FIXTURE_PROVENANCE.kind}); los agregados
          reproducen las cifras reportadas, los desgloses internos son reconstruidos. No es evidencia en vivo.
        </div>
      )}

      {/* Mensaje honesto: rojo = M2 funcionando */}
      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12,
        background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.textSoft, lineHeight: 1.5,
      }}>
        <b>M2 está funcionando y detectó incumplimientos.</b> El semáforo describe el estado de los DATOS de planeación,
        no del sistema: un bloque en rojo es un resultado válido del observatorio. M2 observa, no corrige.
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <KpiTile label="Planes evaluados (ventana)" value={fmtPlanes(report)} />
        <KpiTile label="Reglas evaluadas" value={summary.total_rules - summary.rules_not_evaluable} />
        <KpiTile label="Incumplimientos (rojo)" value={summary.rules_fail} tone={STATUS_COLORS.RED} />
        <KpiTile label="Riesgos (ámbar)" value={summary.rules_warning} tone={STATUS_COLORS.AMBER} />
        <KpiTile label="Registros afectados" value={summary.total_affected_records.toLocaleString('es-MX')} tone={STATUS_COLORS.RED} />
        <KpiTile label="Compañías en scope" value={summary.companies_in_scope} />
        <KpiTile label="Persistentes" value={(lifecycle.findings || []).filter((f) => f.lifecycle_status === 'persistent').length} />
        <KpiTile label="Corregidos" value={(lifecycle.corrected || []).length} tone={STATUS_COLORS.GREEN} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 6 }}>
        Historial disponible: {lifecycle.run_count} corrida{lifecycle.run_count === 1 ? ' (tendencia y comparación aparecen a partir de la segunda)' : 's'}.
        Atribución por sucursal: pendiente de la extensión v1.1 del contrato del auditor (hoy el scope es agregado).
      </div>

      {/* Bloques por categoría */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 22 }}>Bloques de planeación</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, marginTop: 10 }}>
        {derived.blocks.map((block) => (
          <div key={block.category} style={{
            background: C.surface, border: `1px solid ${STATUS_COLORS[block.status]}35`,
            borderRadius: TOKENS.radius.lg, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{block.order}. {block.label}</div>
              <Pill color={STATUS_COLORS[block.status]}>{STATUS_LABELS[block.status]}</Pill>
            </div>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
              {block.affected_records.toLocaleString('es-MX')} registros señalados · {block.rules_red} rojo ·{' '}
              {block.rules_amber} ámbar · {block.rules_green} verde · {block.rules_not_evaluable} no evaluable
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
              Tendencia vs corrida anterior: {lifecycle.run_count > 1 ? 'ver detalle' : '— (primera corrida)'} · Sucursales: agregado global (v1)
            </div>
            <button
              onClick={() => { setFilter('category', block.category); document.getElementById('m2-drilldown')?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{
                marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.blue3, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              Ver hallazgos de este bloque →
            </button>
          </div>
        ))}
      </div>

      {/* Drill-down */}
      <h2 id="m2-drilldown" style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>
        Hallazgos ({filtered.length})
      </h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select aria-label="Categoría" style={selectStyle} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="all">Todas las categorías</option>
          {M2_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select aria-label="Severidad" style={selectStyle} value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)}>
          <option value="all">Toda severidad</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
        </select>
        <select aria-label="Estado" style={selectStyle} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="all">Todo estado</option>
          <option value="RED">Incumplimiento</option>
          <option value="AMBER">Riesgo</option>
        </select>
        <select aria-label="Ciclo de vida" style={selectStyle} value={filters.lifecycle} onChange={(e) => setFilter('lifecycle', e.target.value)}>
          <option value="all">Todo ciclo de vida</option>
          <option value="new">Nuevo</option>
          <option value="persistent">Persistente</option>
          <option value="recurrent">Reincidente</option>
        </select>
        <select aria-label="Entidad" style={selectStyle} value={filters.entity_type} onChange={(e) => setFilter('entity_type', e.target.value)}>
          <option value="all">Toda entidad</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Área responsable" style={selectStyle} value={filters.responsible_area} onChange={(e) => setFilter('responsible_area', e.target.value)}>
          <option value="all">Toda área</option>
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
              {['Estado', 'Regla', 'Hallazgo', 'Entidad', 'Observado', 'Ciclo', 'Área responsable', 'Última detección'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.items.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 14, color: C.textMuted }}>Sin hallazgos con estos filtros.</td></tr>
            )}
            {paged.items.map((f) => (
              <tr
                key={f.finding_id}
                onClick={() => setOpenFindingId(openFindingId === f.finding_id ? null : f.finding_id)}
                style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: openFindingId === f.finding_id ? C.surfaceSoft : 'transparent' }}
              >
                <td style={{ padding: '8px 10px' }}><Pill color={STATUS_COLORS[f.status]}>{STATUS_LABELS[f.status]}</Pill></td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}>{f.rule_code}</td>
                <td style={{ padding: '8px 10px', minWidth: 180 }}>{f.title}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{f.entity_type}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: STATUS_COLORS[f.status], fontWeight: 700 }}>{f.observed_value}</td>
                <td style={{ padding: '8px 10px' }}>{LIFECYCLE_LABELS[f.lifecycle_status] || f.lifecycle_status}</td>
                <td style={{ padding: '8px 10px' }}>{f.responsible_area}</td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: C.textMuted }}>{fmtDateTime(f.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12, color: C.textMuted }}>
        <button disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)} style={pagerBtn(paged.page <= 1)}>← Anterior</button>
        <span>Página {paged.page} de {paged.pages} · {paged.total} hallazgos</span>
        <button disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)} style={pagerBtn(paged.page >= paged.pages)}>Siguiente →</button>
      </div>

      {openFinding && <FindingDetail finding={openFinding} runCount={lifecycle.run_count} onClose={() => setOpenFindingId(null)} />}

      {/* Export */}
      <h2 style={{ ...typo.h3, fontSize: 15, marginTop: 24 }}>Evidencia y exportación (read-only)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <ExportBtn label="CSV de hallazgos" onClick={() => downloadTextFile('m2_findings.csv', findingsToCsv(lifecycle.findings), 'text/csv')} />
        <ExportBtn label="JSON de evidencia" onClick={() => downloadTextFile('m2_evidencia.json', evidenceJson(report, { summary, findings: lifecycle.findings }, load.demo ? { fixture_provenance: M2_FIXTURE_PROVENANCE } : {}), 'application/json')} />
        <ExportBtn label="Resumen ejecutivo (imprimible)" onClick={() => downloadTextFile('m2_resumen_ejecutivo.txt', executiveSummaryText(report, { summary, findings: lifecycle.findings }))} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, marginTop: 8 }}>
        Trazabilidad: run {shortHash(report.run_id_sha256)} · manifest {shortHash(report.manifest_sha256)} · evidencia {shortHash(report.evidence_sha256)} · auditor {shortHash(report.build_sha)}
      </div>
    </div>
  )
}

function fmtPlanes(report) {
  const rows = report?.metrics?.capacity_metrics
  const n = Array.isArray(rows) && rows[0] ? rows[0].plan_count : null
  return Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-MX') : '—'
}

const pagerBtn = (disabled) => ({
  background: C.surface, border: `1px solid ${C.border}`, color: disabled ? C.textLow : C.textSoft,
  borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
})

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

function Header({ demo, technical, report, summary }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>Planeación y readiness</h1>
        <Pill color={C.blue3} title="Superficie de solo lectura: cero escrituras">READ-ONLY</Pill>
        {technical && (
          <Pill color={TECH_COLORS[technical]} title="Estado técnico del auditor (no de los datos)">
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
        {report ? (
          <>
            corte {fmtDateTime(report.finished_at)} · ventana {report.scope?.window_days} días · compañías{' '}
            {(report.scope?.company_ids || []).join(', ')} · {report.duration_ms} ms ·{' '}
            {(report.executed_queries || []).length}/13 consultas · contrato producción{' '}
            {report.production_contract ? '3/3' : '—'}
          </>
        ) : 'sin corrida publicada'}
      </div>
    </div>
  )
}

function FindingDetail({ finding, runCount, onClose }) {
  const copyRef = () => {
    try { navigator.clipboard?.writeText(finding.finding_id) } catch { /* clipboard opcional */ }
  }
  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.6 }}>
      <span style={{ color: C.textMuted, minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.textSoft, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
  return (
    <div style={{
      marginTop: 12, padding: '14px 16px', borderRadius: TOKENS.radius.lg,
      background: C.surface, border: `1px solid ${STATUS_COLORS[finding.status]}45`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {finding.rule_code} · {finding.title}{' '}
          <Pill color={STATUS_COLORS[finding.status]}>{STATUS_LABELS[finding.status]}</Pill>
        </div>
        <button onClick={onClose} aria-label="Cerrar detalle" style={{ ...pagerBtn(false) }}>✕</button>
      </div>
      <p style={{ fontSize: 12.5, color: C.textSoft, lineHeight: 1.6, marginTop: 8 }}>{finding.description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {row('Valor observado', finding.observed_value)}
        {row('Regla esperada', finding.expected_rule)}
        {row('Severidad', SEVERITY_LABELS[finding.severity] || finding.severity)}
        {row('Entidad', `${finding.entity_type} · ${finding.entity_reference}`)}
        {row('Compañías (scope)', (finding.company_scope || []).join(', ') || '—')}
        {row('Sucursal', 'Agregado global — atribución por sucursal llega con el contrato v1.1')}
        {row('Ciclo de vida', `${LIFECYCLE_LABELS[finding.lifecycle_status] || finding.lifecycle_status} · visto en ${finding.occurrence_count} de ${runCount} corrida(s)`)}
        {row('Primera detección', fmtDateTime(finding.first_seen_at))}
        {row('Última detección', fmtDateTime(finding.last_seen_at))}
        {row('Área responsable', `${finding.responsible_area} · dueño: ${finding.owner_status === 'unassigned' ? 'no identificado (sin fuente autoritativa)' : finding.owner_status}`)}
        {row('Acción operativa sugerida', finding.recommended_action)}
        {row('Fuente', `${finding.source_model} · query ${finding.evidence_reference?.query_id || '—'} · corte ${fmtDateTime(finding.source_timestamp)}`)}
        {row('Evidencia', `sha256 ${shortHash(finding.evidence_reference?.evidence_sha256)} · manifest ${shortHash(finding.evidence_reference?.manifest_sha256)} · campos: ${(finding.evidence_reference?.evidence_fields || []).join(', ') || '—'}`)}
        {row('Detalle por registro', finding.drilldown_route ? finding.drilldown_route : 'No disponible en el contrato v1 (extensión v1.1 propuesta)')}
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
