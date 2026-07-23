// ─── Supervisor V2 · Pendientes (vista PURA — superficie ÚNICA de excepciones) ─
// UNA sola superficie de excepciones con AUTORIDAD ÚNICA por tipo: cada item
// declara su `source` y NO se duplica un problema que otra señal ya cubre. La
// consolidación la hace derivePendientes (priorities[] + cierres no cubiertos);
// aquí SOLO se presenta lo ya consolidado. Sin window/fetch/hooks ⇒ SSR-testeable.
// Reglas duras heredadas: null≠0; sin marca de tiempo ≠ "hace 0"; enum/tipo raro ⇒
// neutral, nunca crash.
import { TOKENS } from '../../../../tokens'
import { PENDIENTE_TYPE_LABELS } from '../presentation.js'

const C = TOKENS.colors
const S = TOKENS.state

// Severidad: orden (critical → warning → info), rango y tono/palabra por nivel.
const SEV_RANK = { critical: 0, warning: 1, info: 2 }
const SEV_META = {
  critical: { tone: S.incumplimiento, word: 'Incumplimiento' },
  warning: { tone: S.risk, word: 'Riesgo' },
  info: { tone: S.info, word: 'Información' },
}
const sevRank = (s) => (SEV_RANK[s] ?? 3)
const sevMeta = (s) => SEV_META[s] || { tone: S.no_evaluable, word: 'No evaluable' }
const typeLabel = (t) => PENDIENTE_TYPE_LABELS[t] || 'Pendiente'

// Antigüedad relativa simple desde occurredAt. El contrato entrega tiempos
// server-received (naive ⇒ UTC) o ISO con Z/offset; null ⇒ "sin marca de tiempo"
// (NO se inventa una edad). Futuro/ilegible se nombra, no se disfraza de reciente.
function parseMs(ts) {
  if (typeof ts !== 'string') return null
  const s = ts.trim()
  if (!s) return null
  const hasTz = /[zZ]|[+-]\d\d:?\d\d$/.test(s)
  const ms = Date.parse(s.replace(' ', 'T') + (hasTz ? '' : 'Z'))
  return Number.isFinite(ms) ? ms : null
}
function ageLabel(occurredAt, nowMs) {
  const ms = parseMs(occurredAt)
  if (ms === null) return 'sin marca de tiempo'
  const now = Number(nowMs)
  if (nowMs == null || !Number.isFinite(now)) return 'con marca de tiempo'
  const sec = Math.round((now - ms) / 1000)
  if (sec < 0) return 'marca de tiempo futura'
  if (sec < 60) return 'hace instantes'
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  const rem = min % 60
  if (h < 24) return rem ? `hace ${h} h ${rem} min` : `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function Chip({ text, tone }) {
  const t = tone || S.no_evaluable
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: TOKENS.radius.pill,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function FilterChip({ label, count, active, tone, onClick }) {
  const t = tone || S.no_evaluable
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{
      fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: TOKENS.radius.pill, cursor: 'pointer',
      color: active ? t.fg : C.textMuted,
      background: active ? t.bg : C.surfaceSoft,
      border: `1px solid ${active ? t.border : C.border}`,
    }}>{label}{typeof count === 'number' ? ` · ${count}` : ''}</button>
  )
}

const cardStyle = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
  padding: '13px 15px', marginBottom: 10,
}

export default function PendientesView({
  items = [], source = 'live', nowMs = null, onOpenRoute,
  filterType = null, onSelectFilter, testid = 'supervisor-v2-pendientes',
}) {
  const all = Array.isArray(items) ? items : []
  const isDemo = source === 'demo'
  const select = (t) => { if (onSelectFilter) onSelectFilter(t) }

  // Conteo por tipo sobre TODOS los items (los chips no dependen del filtro).
  const countsByType = new Map()
  const sevOfType = new Map()
  for (const it of all) {
    countsByType.set(it.type, (countsByType.get(it.type) || 0) + 1)
    if (!sevOfType.has(it.type)) sevOfType.set(it.type, it.severity)
  }
  const presentTypes = [...countsByType.keys()].sort((a, b) =>
    (sevRank(sevOfType.get(a)) - sevRank(sevOfType.get(b))) || typeLabel(a).localeCompare(typeLabel(b)))

  // Lista visible: filtrada por tipo y ordenada por severidad (estable dentro del
  // mismo nivel: se preserva el orden de entrada que ya trae la consolidación).
  const visible = all
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => filterType == null || it.type === filterType)
    .sort((a, b) => (sevRank(a.it.severity) - sevRank(b.it.severity)) || (a.i - b.i))
    .map(({ it }) => it)

  return (
    <div data-testid={testid} data-source={source}>
      {isDemo && (
        <div data-testid="v2-demo-banner" role="note" style={{
          fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.10)',
          border: '1px solid rgba(192,132,252,0.30)', borderRadius: TOKENS.radius.md, padding: '9px 12px', marginBottom: 13,
        }}>
          ◈ Datos de DEMOSTRACIÓN sintéticos — no reflejan operación real.
        </div>
      )}

      <header style={{ marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Pendientes</h1>
          <span data-testid="pendientes-total" style={{ fontSize: 12.5, color: C.textMuted }}>
            {all.length === 0 ? 'Sin pendientes' : `${all.length} ${all.length === 1 ? 'pendiente' : 'pendientes'}`}
          </span>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>
          Superficie única de excepciones. Cada pendiente declara su fuente (autoridad única);
          no se duplica un problema que otra señal ya cubre.
        </p>
      </header>

      {all.length === 0 ? (
        <div data-testid="pendientes-empty" role="status" style={{
          ...cardStyle, textAlign: 'center', padding: '28px 20px', color: C.textMuted, fontSize: 14, fontWeight: 700,
        }}>
          Sin pendientes en este momento.
          <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6, color: C.textLow }}>
            Ausencia de señal ≠ jornada perfecta: refleja solo lo que el contrato acredita hoy.
          </div>
        </div>
      ) : (
        <>
          <div data-testid="pendientes-filtros" role="group" aria-label="Filtrar por tipo"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 13 }}>
            <FilterChip label="Todos" count={all.length} active={filterType == null} tone={S.signal} onClick={() => select(null)} />
            {presentTypes.map((t) => (
              <FilterChip key={t} label={typeLabel(t)} count={countsByType.get(t)}
                active={filterType === t} tone={sevMeta(sevOfType.get(t)).tone} onClick={() => select(t)} />
            ))}
          </div>

          {visible.length === 0 ? (
            <div data-testid="pendientes-empty-filtro" role="status" style={{
              ...cardStyle, textAlign: 'center', padding: '22px 20px', color: C.textMuted, fontSize: 13,
            }}>
              Sin pendientes de este tipo.
            </div>
          ) : (
            <ul data-testid="pendientes-lista" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visible.map((it, idx) => {
                const meta = sevMeta(it.severity)
                const clickable = !!onOpenRoute && it.routeId != null
                const showCount = Number(it.count) > 1
                return (
                  <li key={idx} data-testid="pendiente-item" data-type={it.type} data-severity={it.severity}
                    role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onOpenRoute(it.routeId) : undefined}
                    style={{ ...cardStyle, cursor: clickable ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{typeLabel(it.type)}</span>
                        <Chip text={meta.word} tone={meta.tone} />
                        {showCount && <span data-testid="pendiente-count"><Chip text={`×${Number(it.count)}`} tone={meta.tone} /></span>}
                      </div>
                      {clickable && <span aria-hidden style={{ color: C.blue3, fontSize: 14 }}>›</span>}
                    </div>

                    <div style={{ fontSize: 13, color: C.textSoft, marginTop: 6, lineHeight: 1.5 }}>{it.reason || 'Pendiente'}</div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: C.textMuted }}>
                      <span data-testid="pendiente-ruta">{it.routeId != null ? `Ruta ${it.routeId}` : 'Sin ruta asociada'}</span>
                      <span data-testid="pendiente-edad">· {ageLabel(it.occurredAt, nowMs)}</span>
                      {it.dataAsOf && <span>· datos al {String(it.dataAsOf)}</span>}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 10.5, color: C.textLow }}>
                      fuente: <span data-testid="pendiente-source">{it.source || 'no declarada'}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
