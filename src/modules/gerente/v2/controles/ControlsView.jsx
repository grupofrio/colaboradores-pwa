// ─── Gerente V2 · Controles (vista PURA del panel) ───────────────────────────
// Tarjetas por regla agrupadas por categoría. Cada tarjeta: conteo + monto +
// semáforo POR PALABRA (no solo color). Estados honestos:
//   · available:false            → gris, «esta regla aún no tiene fuente»
//   · available:true, count 0    → verde, «sin hallazgos ✅» (cero REAL)
//   · available:true, count > 0  → color de severidad, con conteo y monto
// `null ≠ 0`: un total nulo se pinta «—», nunca $0.00.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import {
  CONTROL_CATEGORIES,
  CONTROL_PERIODS,
  CONTROL_RULES,
  controlReasonText,
  formatTotal,
  ruleMeta,
} from './controlsCatalog.js'

const C = TOKENS.colors

// Semáforo por palabra + color, según estado real de la regla.
function statusOf(rule) {
  if (!rule || rule.available === false) return { word: 'SIN FUENTE', color: C.textMuted, bg: C.surface }
  const count = Number(rule.count || 0)
  if (count === 0) return { word: 'SIN HALLAZGOS', color: C.success, bg: C.successSoft }
  const meta = ruleMeta(rule.key)
  const color = meta?.severity === 'error' ? C.error : C.warning
  const bg = meta?.severity === 'error' ? 'rgba(185,28,28,0.08)' : 'rgba(180,83,9,0.08)'
  return { word: 'REVISAR', color, bg }
}

function RuleCard({ rule, onOpen }) {
  const meta = ruleMeta(rule.key)
  const st = statusOf(rule)
  const count = Number(rule.count || 0)
  const clickable = rule.available !== false && count > 0
  return (
    <button
      type="button"
      onClick={clickable ? () => onOpen(rule.key) : undefined}
      aria-disabled={!clickable}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: clickable ? 'pointer' : 'default',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
        padding: 14, position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: st.color }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{meta?.label || rule.key}</span>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: st.color,
          background: st.bg, borderRadius: TOKENS.radius.pill, padding: '2px 8px', whiteSpace: 'nowrap',
        }}>{st.word}</span>
      </div>
      <p style={{ fontSize: 11, color: C.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>{meta?.desc}</p>

      {rule.available === false ? (
        <p style={{ fontSize: 11, color: C.textLow, margin: '10px 0 0' }}>
          {rule.reason ? controlReasonText(rule.reason) : 'Sin fuente de datos cableada.'}
        </p>
      ) : count === 0 ? (
        <p style={{ fontSize: 12, color: C.success, margin: '10px 0 0', fontWeight: 600 }}>Sin hallazgos ✅</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{count.toLocaleString('es-MX')}</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {count === 1 ? 'caso' : 'casos'} · {formatTotal(meta, rule.total_amount)}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.blue3, fontWeight: 700 }}>Ver ›</span>
        </div>
      )}
    </button>
  )
}

export default function ControlsView({ rules, period, onChangePeriod, onOpenRule, onRefresh, scope }) {
  const byKey = new Map((rules || []).map((r) => [r.key, r]))
  // Se recorre el CATÁLOGO (orden estable), tomando el dato del backend por
  // clave. Una regla que el backend no devolvió se pinta como «sin fuente».
  const ordered = CONTROL_RULES.map((meta) => byKey.get(meta.key) || { key: meta.key, available: false, reason: 'source_unavailable' })

  const totalHallazgos = ordered.reduce((n, r) => n + (r.available !== false ? Number(r.count || 0) : 0), 0)
  const cats = Object.entries(CONTROL_CATEGORIES)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
            MI SUCURSAL · CONTROLES
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>
            {scope?.branch_name || 'Mi sucursal'}
            {totalHallazgos > 0 && (
              <span style={{
                marginLeft: 10, fontSize: 12, fontWeight: 800, color: C.error,
                background: 'rgba(185,28,28,0.10)', borderRadius: TOKENS.radius.pill, padding: '2px 10px',
              }}>{totalHallazgos} por revisar</span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {CONTROL_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => onChangePeriod(p.key)}
              aria-pressed={period === p.key}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: TOKENS.radius.pill, cursor: 'pointer',
                background: period === p.key ? C.surfaceStrong : 'transparent',
                color: period === p.key ? C.blue3 : C.textMuted,
                border: `1px solid ${period === p.key ? C.blue3 : C.border}`,
              }}
            >{p.label}</button>
          ))}
          {onRefresh && (
            <button onClick={onRefresh} style={{ fontSize: 12, color: C.blue3, textDecoration: 'underline', cursor: 'pointer', marginLeft: 4 }}>
              Actualizar
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: C.textLow, margin: '0 0 14px' }}>
        Detección read-only: esto muestra qué revisar, no bloquea ni corrige.
      </p>

      {cats.map(([catKey, catLabel]) => {
        const inCat = ordered.filter((r) => (ruleMeta(r.key)?.category) === catKey)
        if (!inCat.length) return null
        return (
          <section key={catKey} style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: '0 0 8px' }}>
              {catLabel.toUpperCase()}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {inCat.map((r) => <RuleCard key={r.key} rule={r} onOpen={onOpenRule} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
