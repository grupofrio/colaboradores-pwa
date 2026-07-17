// ─── ScreenM1Backlog — KOLD Tower M1 · Backlog de rutas / cash pendiente ─────
// Primera superficie funcional de Tower M1 (plan kold-os b6e9a69 + 57175d4).
// READ-ONLY: consume GET /pwa-tower/m1-backlog vía api()/directTower (#62);
// cero writes, cero acciones de cierre, sin menú general (ruta directa
// /torre/backlog detrás de TowerRoute). El backend es autoritativo: rol y
// scope se revalidan server-side con X-GF-Employee-Token; la UI solo presenta
// (jamás re-clasifica buckets ni recalcula KPIs).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { TOWER_M1_BACKLOG_PATH } from '../../../lib/towerM1Route'
import { readAuthoritativeTowerStatus } from '../e1/loadTowerStatus'
import { TOKENS } from '../../../tokens'
import {
  AGE_BUCKETS, DEFAULT_FILTERS, RISK_LABELS, SORTS, STATE_BUCKETS, STATE_LABELS,
  applyFilterChange, buildBacklogQuery, classifyError, clearFilters, fmtInt,
  fmtKpiValue, fmtMoney, normalizePayload, pagination, showBranchSelector,
  toQueryString, visibleBranchOptions, withTimeout,
} from './m1BacklogModel'

const C = TOKENS.colors
const MOBILE_BREAK = 760

const fmtDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  } catch { return d }
}

const fmtDateTime = (d) => {
  if (!d) return '—'
  try {
    return new Date(d.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

// ── UI atoms ──────────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: `${color}18`, border: `1px solid ${color}35`, color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function RiskPill({ level }) {
  const r = RISK_LABELS[level] || RISK_LABELS.low
  return <Badge color={r.color}>{r.icon} {r.label}</Badge>
}

function KpiCard({ card }) {
  return (
    <div
      role="group"
      aria-label={`${card.label}: ${fmtKpiValue(card)}`}
      style={{
        flex: '1 1 150px', minWidth: 140, padding: '10px 14px',
        background: TOKENS.glass.panelSoft, border: `1px solid ${C.border}`,
        borderRadius: TOKENS.radius.sm,
      }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted }}>
        {card.label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: C.textSoft }}>
        {fmtKpiValue(card)}
      </p>
    </div>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '7px 10px', color: C.textSoft, fontSize: 12,
  minHeight: 36, fontFamily: 'inherit',
}

function Field({ id, label, children }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted }}>
      {label}
      {children}
    </label>
  )
}

// Estado terminal / informativo a pantalla (sin datos)
function StatusPanel({ icon, title, children, onRetry, retryLabel = 'Reintentar' }) {
  return (
    <div role="status" style={{ textAlign: 'center', padding: '56px 20px', color: C.textMuted, maxWidth: 480, margin: '0 auto' }}>
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.textSoft }}>{title}</p>
      <div style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>{children}</div>
      {onRetry && (
        <button onClick={onRetry} style={{
          marginTop: 16, background: 'rgba(43,143,224,0.15)', border: '1px solid rgba(43,143,224,0.3)',
          borderRadius: 8, padding: '8px 18px', cursor: 'pointer', color: C.blue2,
          fontSize: 13, fontWeight: 600, minHeight: 40,
        }}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

// ── Fila / tarjeta ────────────────────────────────────────────────────────────
function cashOf(row, stateBucket) {
  return stateBucket === 'closed_cash_pending' ? row.cash_closed_pending_amount : row.cash_pending_amount
}

function RowCard({ row, stateBucket }) {
  const cash = cashOf(row, stateBucket)
  return (
    <article aria-label={`Ruta ${row.route_name}`} style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
      borderRadius: TOKENS.radius.sm, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{row.route_name || '—'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textMuted }}>{row.branch_name || '—'} · {fmtDate(row.scheduled_date)}</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: row.age_days > 7 ? '#f59e0b' : C.textMuted, whiteSpace: 'nowrap' }}>
          {row.age_days} día{row.age_days === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge color={C.blue2}>{STATE_LABELS[row.state] || row.state || '—'}</Badge>
        {row.close_candidate_flag && <Badge color="#22c55e">Candidata a cierre</Badge>}
        <RiskPill level={row.risk_level} />
        <span style={{ fontSize: 11, color: C.textMuted }}>
          Avance {row.stops_done}/{row.stops_total}{row.all_stops_done ? ' ✓' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: C.textMuted }}>{row.recommended_action || ''}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.textSoft, whiteSpace: 'nowrap' }}>
          {cash > 0 ? fmtMoney(cash) : '—'}
        </span>
      </div>
    </article>
  )
}

const th = {
  textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted,
  borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'rgba(3,8,17,0.97)', zIndex: 1,
}
const td = { padding: '9px 10px', fontSize: 12, color: C.textSoft, borderBottom: `1px solid rgba(255,255,255,0.05)`, verticalAlign: 'top' }

function RowsTable({ rows, stateBucket }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.sm }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Backlog de rutas M1
        </caption>
        <thead>
          <tr>
            <th scope="col" style={th}>Ruta / Sucursal</th>
            <th scope="col" style={th}>Edad</th>
            <th scope="col" style={th}>Venta cash pend.</th>
            <th scope="col" style={th}>Avance</th>
            <th scope="col" style={th}>Estado</th>
            <th scope="col" style={th}>Riesgo</th>
            <th scope="col" style={th}>Acción sugerida</th>
            <th scope="col" style={th}>Últ. actividad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cash = cashOf(row, stateBucket)
            return (
              <tr key={row.plan_id ?? `${row.route_name}-${row.scheduled_date}`}>
                <td style={td}>
                  <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{row.route_name || '—'}</span>
                  <br />
                  <span style={{ fontSize: 11, color: C.textMuted }}>{row.branch_name || '—'} · {fmtDate(row.scheduled_date)}</span>
                </td>
                <td style={{ ...td, fontWeight: 700, color: row.age_days > 7 ? '#f59e0b' : C.textSoft, whiteSpace: 'nowrap' }}>
                  {row.age_days} d
                </td>
                <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{cash > 0 ? fmtMoney(cash) : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{row.stops_done}/{row.stops_total}{row.all_stops_done ? ' ✓' : ''}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Badge color={C.blue2}>{STATE_LABELS[row.state] || row.state || '—'}</Badge>
                    {row.close_candidate_flag && <Badge color="#22c55e">Candidata</Badge>}
                  </div>
                </td>
                <td style={td}><RiskPill level={row.risk_level} /></td>
                <td style={{ ...td, fontSize: 11, maxWidth: 220 }}>{row.recommended_action || '—'}</td>
                <td style={{ ...td, fontSize: 11, whiteSpace: 'nowrap', color: C.textMuted }}>{fmtDateTime(row.last_activity_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function ScreenM1Backlog({ session }) {
  const navigate = useNavigate()
  const role = readAuthoritativeTowerStatus(session)

  const [sw, setSw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024))
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('initial') // initial|loading|success|empty|feature_disabled|no_branch_scope|forbidden|session_expired|error
  const [data, setData] = useState(null)
  const [branches, setBranches] = useState([])
  const [errorInfo, setErrorInfo] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Flag de montaje: al desmontar, ninguna respuesta en vuelo debe hacer setState.
  // (Separado de requestSeq para no invalidar la carga inicial bajo StrictMode.)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const load = useCallback(async (nextFilters, nextOffset) => {
    const requestId = ++requestSeq.current
    setPhase('loading')
    setErrorInfo(null)
    try {
      const query = buildBacklogQuery(nextFilters, nextOffset, role)
      const payload = await withTimeout(
        api('GET', `${TOWER_M1_BACKLOG_PATH}${toQueryString(query)}`),
      )
      // respuesta vieja o componente desmontado: se ignora (última petición gana)
      if (requestId !== requestSeq.current || !alive.current) return
      const normalized = normalizePayload(payload, role)
      setData(normalized)
      setBranches(visibleBranchOptions(role, payload))
      setFetchedAt(new Date())
      setPhase(normalized.status) // success | empty
    } catch (err) {
      if (requestId !== requestSeq.current || !alive.current) return
      const info = classifyError(err)
      setErrorInfo(info)
      setPhase(info.state)
    }
  }, [role])

  // Carga inicial con los defaults. StrictMode-safe: si el efecto se re-ejecuta,
  // "última petición gana" descarta la respuesta previa y la última carga rinde.
  // Solo referencia `load` (estable) y constantes → sin warning de deps.
  useEffect(() => { load({ ...DEFAULT_FILTERS }, 0) }, [load])

  const changeFilter = (key, value) => {
    const next = applyFilterChange(filters, key, value)
    setFilters(next.filters)
    setOffset(next.offset)
    load(next.filters, next.offset)
  }

  const onClear = () => {
    const next = clearFilters()
    setFilters(next.filters)
    setOffset(next.offset)
    load(next.filters, next.offset)
  }

  const goOffset = (nextOffset) => {
    setOffset(nextOffset)
    load(filters, nextOffset)
  }

  const refresh = () => load(filters, offset)

  const isMobile = sw < MOBILE_BREAK
  const loading = phase === 'loading' || phase === 'initial'
  const pag = data ? pagination(data.offset, data.rows.length, data.total, data.limit) : null
  const activeFilters = useMemo(() => {
    const d = DEFAULT_FILTERS
    return Object.keys(d).filter((k) => String(filters[k]) !== String(d[k])).length
  }, [filters])

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg0,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px', borderBottom: `1px solid rgba(255,255,255,0.07)`,
        background: 'rgba(3,8,17,0.95)', position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate('/torre')}
          aria-label="Volver a la Torre"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.6)', fontSize: 20, display: 'flex', alignItems: 'center', minHeight: 44, minWidth: 32 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
            Backlog M1 · Rutas y cash pendiente
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>
            {data?.dataAsOf ? `Datos al ${fmtDateTime(data.dataAsOf.replace('T', ' ').replace('Z', ''))}` : 'KOLD Tower · read-only'}
            {fetchedAt ? ` · consultado ${fetchedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          aria-label="Actualizar backlog"
          style={{
            background: 'rgba(43,143,224,0.15)', border: '1px solid rgba(43,143,224,0.3)',
            borderRadius: 8, padding: '8px 14px', cursor: loading ? 'not-allowed' : 'pointer',
            color: C.blue2, fontSize: 12, fontWeight: 600, minHeight: 40,
          }}
        >
          {loading ? '…' : 'Actualizar'}
        </button>
      </div>

      <div style={{ flex: 1, padding: '14px 16px 40px', maxWidth: 1180, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Región viva para lectores de pantalla: anuncia carga/errores */}
        <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {phase === 'loading' ? 'Cargando backlog' : phase === 'error' ? 'Error al cargar el backlog' : ''}
        </p>

        {/* KPIs (globales del backend; jamás recalculados) */}
        {data && (phase === 'success' || phase === 'empty' || phase === 'loading') && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: activeFilters > 0 ? 6 : 12 }}>
            {data.kpis.map((card) => <KpiCard key={card.key} card={card} />)}
          </div>
        )}

        {/* Leyenda de alcance de los KPIs: son TOTALES GLOBALES; los filtros afectan
            SÓLO la tabla de abajo (evita leer un total como si estuviera filtrado). */}
        {data && (phase === 'success' || phase === 'empty') && activeFilters > 0 && (
          <div data-testid="m1-filter-legend" style={{
            fontSize: 11, color: C.textLow, marginBottom: 12, lineHeight: 1.5,
          }}>
            Los indicadores de arriba son <strong>totales globales</strong>; la tabla de abajo
            está filtrada ({activeFilters} {activeFilters === 1 ? 'filtro' : 'filtros'}).
          </div>
        )}

        {/* Filtros (server-side, contrato) */}
        {phase !== 'feature_disabled' && phase !== 'no_branch_scope' && phase !== 'forbidden' && phase !== 'session_expired' && (
          <div role="group" aria-label="Filtros del backlog" style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
            padding: '10px 12px', marginBottom: 14,
            background: TOKENS.glass.panelSoft, border: `1px solid ${C.border}`,
            borderRadius: TOKENS.radius.sm,
          }}>
            <Field id="m1-sb" label="Bucket">
              <select id="m1-sb" style={inputStyle} value={filters.state_bucket}
                onChange={(e) => changeFilter('state_bucket', e.target.value)}>
                {STATE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </Field>
            <Field id="m1-age" label="Antigüedad">
              <select id="m1-age" style={inputStyle} value={filters.bucket}
                onChange={(e) => changeFilter('bucket', e.target.value)}>
                {AGE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </Field>
            <Field id="m1-from" label="Desde">
              <input id="m1-from" type="date" style={inputStyle} value={filters.date_from}
                onChange={(e) => changeFilter('date_from', e.target.value)} />
            </Field>
            <Field id="m1-to" label="Hasta">
              <input id="m1-to" type="date" style={inputStyle} value={filters.date_to}
                onChange={(e) => changeFilter('date_to', e.target.value)} />
            </Field>
            <Field id="m1-sort" label="Orden">
              <select id="m1-sort" style={inputStyle} value={filters.sort}
                onChange={(e) => changeFilter('sort', e.target.value)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            {showBranchSelector(role) && (
              <Field id="m1-branch" label="Sucursal">
                <select id="m1-branch" style={inputStyle} value={filters.branch_id}
                  disabled={branches.length === 0}
                  onChange={(e) => changeFilter('branch_id', e.target.value)}>
                  <option value="">{branches.length === 0 ? 'Sin catálogo' : 'Todas'}</option>
                  {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.display_name}</option>)}
                </select>
              </Field>
            )}
            <button
              onClick={() => changeFilter('close_candidate', !filters.close_candidate)}
              aria-pressed={filters.close_candidate}
              style={{
                ...inputStyle, cursor: 'pointer', fontWeight: 700,
                color: filters.close_candidate ? '#22c55e' : C.textMuted,
                border: `1px solid ${filters.close_candidate ? 'rgba(34,197,94,0.4)' : C.border}`,
                background: filters.close_candidate ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              }}
            >
              {filters.close_candidate ? '✓ ' : ''}Solo candidatas a cierre
            </button>
            {activeFilters > 0 && (
              <button onClick={onClear} style={{ ...inputStyle, cursor: 'pointer', color: C.textMuted }}>
                Limpiar filtros ({activeFilters})
              </button>
            )}
          </div>
        )}

        {/* Estados */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: isMobile ? 96 : 44, borderRadius: TOKENS.radius.sm, background: 'rgba(255,255,255,0.04)', animation: 'm1pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {phase === 'feature_disabled' && (
          <StatusPanel icon="⏸" title="Tower M1 aún no está habilitado" onRetry={refresh}>
            El módulo está desplegado pero apagado. No es un error de tu cuenta.
          </StatusPanel>
        )}

        {phase === 'no_branch_scope' && (
          <StatusPanel icon="🔒" title="No tienes sucursal asignada">
            {errorInfo?.reason === 'multiple_branch_configs'
              ? 'Tu usuario está en más de una sucursal; por seguridad el acceso se bloquea hasta que el administrador de KOLD Tower corrija la asignación (proceso D4).'
              : 'Tu usuario tiene rol de supervisor pero ninguna sucursal activa te incluye. Solicita la asignación al administrador de KOLD Tower (canal operativo D4).'}
          </StatusPanel>
        )}

        {phase === 'forbidden' && (
          <StatusPanel icon="⛔" title="Tu rol no tiene acceso a Tower M1">
            Si crees que es un error, contacta al administrador de KOLD Tower.
          </StatusPanel>
        )}

        {phase === 'session_expired' && (
          <StatusPanel icon="🔑" title="Tu sesión expiró">
            Vuelve a iniciar sesión para continuar.
          </StatusPanel>
        )}

        {phase === 'error' && (
          <StatusPanel icon="⚠️" title="No pudimos consultar el backlog" onRetry={errorInfo?.retryable ? refresh : undefined}>
            Reintenta; si persiste, repórtalo al administrador de KOLD Tower (canal operativo D4).
            {errorInfo?.code ? <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: C.textLow }}>Código: {errorInfo.code}</span> : null}
          </StatusPanel>
        )}

        {phase === 'empty' && (
          <StatusPanel icon="✅" title="Sin rutas con este filtro">
            {activeFilters > 0 ? 'Prueba quitando filtros para ampliar la búsqueda.' : 'No hay rutas en este bucket ahora mismo.'}
          </StatusPanel>
        )}

        {phase === 'success' && data && (
          <>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.rows.map((row) => (
                  <RowCard key={row.plan_id ?? `${row.route_name}-${row.scheduled_date}`} row={row} stateBucket={filters.state_bucket} />
                ))}
              </div>
            ) : (
              <RowsTable rows={data.rows} stateBucket={filters.state_bucket} />
            )}

            {/* Paginación (meta.total filtrado del server) */}
            {pag && (
              <nav aria-label="Paginación del backlog" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => goOffset(pag.prevOffset)}
                  disabled={!pag.canPrev || loading}
                  style={{ ...inputStyle, cursor: pag.canPrev ? 'pointer' : 'not-allowed', opacity: pag.canPrev ? 1 : 0.45 }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  Mostrando {pag.from}–{pag.to} de {pag.total}
                </span>
                <button
                  onClick={() => goOffset(pag.nextOffset)}
                  disabled={!pag.canNext || loading}
                  style={{ ...inputStyle, cursor: pag.canNext ? 'pointer' : 'not-allowed', opacity: pag.canNext ? 1 : 0.45 }}
                >
                  Siguiente →
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes m1pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          [style*="m1pulse"] { animation: none !important; }
        }
        select:focus-visible, input:focus-visible, button:focus-visible {
          outline: 2px solid ${C.blue3}; outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
