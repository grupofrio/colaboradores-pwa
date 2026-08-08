// ─── Torre de control del supervisor de ventas (tema claro) ──────────────────
// VIVE EN `modules/supervisor-ventas/` a proposito, aunque la ruta sea /torre:
// adopta el tema claro sin condicion, y la regla del repo es que solo pueden
// hacerlo los archivos de esta superficie. El guard de `brandTokensScope` lo
// marco cuando estaba bajo `torre/m1/` — tenia razon: la carpeta decia "torre"
// (compartido) y el archivo es del puesto.
// Vista CURADA para el puesto de Aida. La pantalla cruda (`ScreenM1Backlog`)
// sigue existiendo y es la de dirección: aquí no se toca.
//
// REPARTO CON "PENDIENTES", para no decir dos veces lo mismo:
//   · Pendientes = lo accionable de HOY (candidatas a cerrar, gestión por
//     acción, riesgo, rezago). Ya existe y no se duplica aquí.
//   · Torre      = ENVEJECIMIENTO y CAJA ATADA. Dónde se está pudriendo el
//     backlog y dónde está el dinero viejo.
// Por eso el número protagonista es "abiertas con más de 7 días" y por eso los
// dos buckets huérfanos (draft, cerradas con caja) tienen drill y no solo un
// contador.
//
// SOLO LECTURA: `supervisor_writes_enabled` está en false. Ningún control
// ejecuta cierres ni acciones — daría 403. Los CTA solo NAVEGAN al detalle.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import StateScreen from '../../../components/kold/StateScreen'
import { Loader } from '../../../components/Loader'
import { BRAND_LIGHT as C, BRAND_HEADER_GRADIENT } from '../../../theme/brandLight'
import { BRAND_TOKENS } from '../../../theme/brandTokens'
import { STATE_LABELS, fmtMoney, pagination } from '../../torre/m1/m1BacklogModel'
import { useM1BacklogQuery } from '../../torre/m1/useM1BacklogQuery'
import { zonedTodayStr } from '../v2/civilWeek'
import {
  AGING_FILTERS, TORRE_BUCKETS, TORRE_PERIODS, TORRE_SORTS, applyAging, applyPeriod,
  cashForBucket, coverage, fmtActivity, headerKpis, initialTorreFilters, periodOf,
  progressOf, riskTone, routeDetailPath,
} from './torreSupervisorModel'

const ROLE = 'supervisor_ventas'
// Zona horaria operativa de la sucursal (piloto Iguala / centro de México). El
// IDEAL es que el backend entregue la fecha operativa por sucursal (deuda
// declarada); mientras, se usa la tz de la plaza en vez de UTC para no abrir la
// semana siguiente un domingo por la tarde (Codex).
const BRANCH_TIME_ZONE = 'America/Mexico_City'

const STATE_COPY = {
  feature_disabled: {
    title: 'La torre está apagada ahora mismo',
    detail: 'La función no está habilitada. No es algo que puedas activar desde aquí; repórtalo si te hace falta.',
    tone: 'warning',
  },
  no_branch_scope: {
    title: 'Tu usuario no tiene sucursal asignada',
    detail: 'Sin sucursal no hay rutas que mostrar. Pide que te asignen la tuya y vuelve a entrar.',
    tone: 'warning',
  },
  forbidden: {
    title: 'No tienes acceso a esta torre',
    detail: 'Tu sesión es válida, pero esta vista está reservada a otros puestos.',
    tone: 'warning',
  },
  session_expired: {
    title: 'Tu sesión venció',
    detail: 'Por seguridad las sesiones caducan. Vuelve a entrar con tu PIN y tu código.',
    tone: 'warning',
  },
  error: {
    title: 'No pudimos cargar la torre',
    detail: 'Puede ser la conexión o que el servicio esté momentáneamente fuera.',
    tone: 'error',
  },
  empty: {
    title: 'Nada en este corte',
    detail: 'Con los filtros que elegiste no hay rutas. Prueba con otra antigüedad o quita el filtro de candidatas.',
    tone: 'neutral',
  },
}

function KpiHeadline({ kpi, protagonista }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'rgba(255,255,255,0.86)', fontWeight: 700,
      }}>
        {kpi.label}
      </div>
      <div style={{
        fontSize: protagonista ? 38 : 22, fontWeight: 800, lineHeight: 1.1,
        marginTop: 4, color: C.onPrimary,
      }}>
        {kpi.text}
      </div>
    </div>
  )
}

function Chip({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '9px 14px',
        borderRadius: 999, minHeight: 40, whiteSpace: 'nowrap',
        background: active ? C.primary : C.surface,
        color: active ? C.onPrimary : C.text,
        border: `1px solid ${active ? C.primary : C.border}`,
      }}
    >
      {children}
    </button>
  )
}

function RiskTag({ level }) {
  const tone = riskTone(level)
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: tone.bg, color: tone.fg, whiteSpace: 'nowrap',
    }}>
      {tone.label}
    </span>
  )
}

function Progress({ row }) {
  const p = progressOf(row)
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
        {p.label}
        {p.finished && <span style={{ color: '#166534' }}> ✓</span>}
      </div>
      {p.note && (
        <div style={{ fontSize: 10.5, color: '#166534', fontWeight: 600 }}>{p.note}</div>
      )}
      {p.pct !== null && (
        <div aria-hidden="true" style={{
          marginTop: 4, height: 4, borderRadius: 3, background: '#E8F0F6', overflow: 'hidden',
        }}>
          <div style={{ width: `${p.pct}%`, height: '100%', background: p.finished ? '#166534' : C.ice }} />
        </div>
      )}
    </div>
  )
}

function RouteRow({ row, stateBucket, onOpen }) {
  const cash = cashForBucket(row, stateBucket)
  return (
    <article
      data-testid="torre-row"
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '13px 14px', display: 'grid', gap: 10,
        gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>
            {row.route_name || '—'}
          </span>
          <span style={{ fontSize: 11.5, color: C.textMuted }}>
            {STATE_LABELS[row.state] || row.state || '—'}
          </span>
          <RiskTag level={row.risk_level} />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-start' }}>
          <Progress row={row} />
          <div>
            <div style={{ fontSize: 10.5, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Última actividad
            </div>
            <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>
              {fmtActivity(row.last_activity_at)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Edad
            </div>
            <div style={{
              fontSize: 12.5, fontWeight: 700,
              color: row.age_days > 7 ? '#b45309' : C.text,
            }}>
              {row.age_days} día{row.age_days === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {row.recommended_action && (
          <p style={{ margin: '9px 0 0', fontSize: 12, color: C.textMuted }}>
            {row.recommended_action}
          </p>
        )}
      </div>

      <div style={{ textAlign: 'right', display: 'grid', gap: 8, justifyItems: 'end' }}>
        <div>
          <div style={{ fontSize: 10.5, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Caja pendiente
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>
            {cash > 0 ? fmtMoney(cash) : '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpen(row)}
          data-testid="torre-open-route"
          style={{
            cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '8px 14px',
            borderRadius: 999, minHeight: 40, whiteSpace: 'nowrap',
            background: 'transparent', color: C.primary, border: `1px solid ${C.border}`,
          }}
        >
          Ver ruta
        </button>
      </div>
    </article>
  )
}

export default function ScreenTorreSupervisor() {
  const navigate = useNavigate()
  // La fecha de referencia se calcula en la tz de la SUCURSAL, no en UTC: así la
  // semana en curso no salta al lunes siguiente un domingo por la tarde de México.
  const today = useMemo(() => zonedTodayStr(BRANCH_TIME_ZONE), [])
  const {
    phase, data, filters, offset, setFilter, patchFilters, goOffset, reload,
  } = useM1BacklogQuery(ROLE, initialTorreFilters(today))

  const period = periodOf(filters)
  const kpis = useMemo(() => headerKpis(data?.kpis), [data])
  const cov = useMemo(() => coverage(data?.rows?.length, data?.total), [data])
  const pag = data ? pagination(data.offset, data.rows.length, data.total, data.limit) : null
  const copy = STATE_COPY[phase]

  return (
    <div
      data-testid="torre-supervisor"
      data-theme="brand-light"
      style={{ minHeight: '100dvh', background: C.bg, paddingBottom: 88 }}
    >
      <style>{`
        [data-theme="brand-light"] * { box-sizing: border-box; }
      `}</style>

      {/* Encabezado: el envejecimiento primero. "Abiertas" a secas no dice nada
          cuando casi todas lo están; lo que duele es cuántas llevan semanas. */}
      <header style={{
        background: BRAND_HEADER_GRADIENT, color: C.onPrimary,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        padding: 'calc(env(safe-area-inset-top) + 18px) 20px 22px',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
          Torre de control
        </div>
        <div style={{
          display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12,
        }}>
          {kpis.map((kpi, i) => (
            <KpiHeadline key={kpi.key} kpi={kpi} protagonista={i === 0} />
          ))}
        </div>
        {data?.dataAsOf && (
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.82 }}>
            Datos al {fmtActivity(data.dataAsOf)}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 14px 8px' }}>
        {/* Período: la Torre abre en la SEMANA EN CURSO (operación viva). El
            histórico (+7 días) es una vista aparte, explícita, a un clic. */}
        <div role="group" aria-label="Período" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {TORRE_PERIODS.map((p) => (
            <Chip
              key={p.value}
              active={period === p.value}
              onClick={() => patchFilters(applyPeriod(p.value, today))}
            >
              {p.label}
            </Chip>
          ))}
        </div>

        {/* Buckets: los dos huérfanos dejan de ser un número y se pueden abrir. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {TORRE_BUCKETS.map((b) => (
            <Chip
              key={b.value}
              active={filters.state_bucket === b.value}
              onClick={() => setFilter('state_bucket', b.value)}
              title={b.hint}
            >
              {b.label}
            </Chip>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {AGING_FILTERS.map((a) => (
            <Chip
              key={a.value || 'all'}
              active={(filters.bucket || '') === a.value}
              // La antigüedad y el rango de semana se excluyen: elegir una limpia
              // la otra en la MISMA carga (si no, "esta semana" + ">7 días" = vacío).
              onClick={() => patchFilters(applyAging(a.value, today))}
            >
              {a.label}
            </Chip>
          ))}
          <Chip
            active={filters.close_candidate === true}
            onClick={() => setFilter('close_candidate', !filters.close_candidate)}
          >
            Solo candidatas a cierre
          </Chip>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            Orden
            <select
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              data-testid="torre-sort"
              style={{
                fontSize: 12.5, padding: '9px 10px', borderRadius: 10, minHeight: 40,
                background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              }}
            >
              {TORRE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            Desde
            <input
              type="date" value={filters.date_from} data-testid="torre-date-from"
              onChange={(e) => setFilter('date_from', e.target.value)}
              style={{
                fontSize: 12.5, padding: '9px 10px', borderRadius: 10, minHeight: 40,
                background: C.surface, color: C.text, border: `1px solid ${C.border}`, colorScheme: 'light',
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            Hasta
            <input
              type="date" value={filters.date_to} data-testid="torre-date-to"
              onChange={(e) => setFilter('date_to', e.target.value)}
              style={{
                fontSize: 12.5, padding: '9px 10px', borderRadius: 10, minHeight: 40,
                background: C.surface, color: C.text, border: `1px solid ${C.border}`, colorScheme: 'light',
              }}
            />
          </label>
          <button
            type="button" onClick={reload} data-testid="torre-reload"
            style={{
              cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '9px 16px',
              borderRadius: 999, minHeight: 40, background: 'transparent',
              color: C.primary, border: `1px solid ${C.border}`,
            }}
          >
            Actualizar
          </button>
        </div>

        {phase === 'loading' && <Loader label="Cargando la torre…" tokens={BRAND_TOKENS} />}

        {phase === 'success' && (
          <>
            {/* Sobre cuántas filas habla lo que se ve. El endpoint topa, y una
                página no es el universo. */}
            <p data-testid="torre-coverage" style={{ margin: '0 0 10px', fontSize: 12, color: C.textMuted }}>
              {cov.text}
              {cov.partial && ' · los totales de arriba son de toda tu sucursal, no de esta página'}
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {data.rows.map((row) => (
                <RouteRow
                  key={row.plan_id}
                  row={row}
                  stateBucket={filters.state_bucket}
                  onOpen={(r) => navigate(routeDetailPath(r))}
                />
              ))}
            </div>

            {pag && (pag.canPrev || pag.canNext) && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                <button
                  type="button" disabled={!pag.canPrev} onClick={() => goOffset(pag.prevOffset)}
                  style={{
                    cursor: pag.canPrev ? 'pointer' : 'default', minHeight: 40, padding: '9px 16px',
                    borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                    background: C.surface, color: pag.canPrev ? C.primary : C.textMuted,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  Anteriores
                </button>
                <span style={{ fontSize: 12, color: C.textMuted, alignSelf: 'center' }}>
                  {pag.from}–{pag.to} de {pag.total}
                </span>
                <button
                  type="button" disabled={!pag.canNext} onClick={() => goOffset(pag.nextOffset)}
                  style={{
                    cursor: pag.canNext ? 'pointer' : 'default', minHeight: 40, padding: '9px 16px',
                    borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                    background: C.surface, color: pag.canNext ? C.primary : C.textMuted,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  Siguientes
                </button>
              </div>
            )}

            <p style={{ margin: '14px 0 0', fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
              <b>Caja pendiente</b> es el monto que la ruta trae sin conciliar en el sistema; no
              afirma si está por recibir o por validar. <b>Última actividad</b> es cuándo quedó
              registrado el último movimiento en el servidor, no necesariamente cuándo ocurrió en
              campo. Esta vista es de consulta: los cierres se hacen donde siempre.
            </p>
          </>
        )}

        {phase !== 'loading' && phase !== 'success' && copy && (
          <StateScreen
            testid="torre-state"
            title={copy.title}
            detail={copy.detail}
            tone={copy.tone}
            tokens={BRAND_TOKENS}
            actionLabel={phase === 'error' || phase === 'feature_disabled' ? 'Reintentar' : null}
            onAction={phase === 'error' || phase === 'feature_disabled' ? reload : null}
          />
        )}
      </main>
    </div>
  )
}
