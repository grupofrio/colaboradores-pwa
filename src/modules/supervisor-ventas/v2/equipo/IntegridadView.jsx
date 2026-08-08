// ─── Supervisor V2 · Integridad de ejecución (vista PURA) ────────────────────
// Sin hooks, sin fetch, sin window ⇒ SSR-renderizable y testeable de verdad
// (mismo patrón que MasView). El contenedor `IntegridadEjecucion` le pasa el
// payload ya desenvuelto.
//
// REGLA que esta vista existe para sostener: los dos porcentajes se pintan
// SIEMPRE juntos, y `sin_evidencia` no es verde. Un 100% sobre 3 de 40 visitas
// no dice que la ruta esté bien, dice que no sabemos — y eso se escribe.
import { BRAND_TOKENS as T } from '../../../../theme/brandTokens'
import {
  integrityRows, pctLabel, toneKey, toneWord, evidenceCaption, blindWarning,
  blindReasons, thresholdsCaption, periodCaption,
} from './integridadModel'

const C = T.colors
const R = T.radius

// `blind` NO es verde ni rojo: es un aviso de ceguera, un estado propio.
const TONE_COLOR = { ok: C.success, watch: C.warning, bad: C.error, blind: C.blue3, none: C.textMuted }

function Metric({ label, value, hint, color }) {
  return (
    <div style={{ display: 'grid', gap: 1, minWidth: 96 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: '0.03em' }}>{label}</span>
      <span data-testid="ie-metric" data-metric={label} style={{
        fontSize: 19, fontWeight: 800, color: color || C.text, fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
      {hint ? <span style={{ fontSize: 10, color: C.textMuted }}>{hint}</span> : null}
    </div>
  )
}

/** Los dos porcentajes viven en el MISMO componente a propósito: así no existe
 *  forma de pintar uno sin el otro. */
function IntegrityPair({ summary, color }) {
  const s = summary || {}
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <Metric label="VERIFICADAS" value={pctLabel(s.pct_verificadas)} color={color}
        hint={`${s.verificadas || 0} de ${s.evaluables || 0} evaluables`} />
      <Metric label="CON EVIDENCIA" value={pctLabel(s.pct_con_evidencia)}
        hint={`${s.evaluables || 0} de ${s.visitas || 0} visitas`} />
      <Metric label="A REVISAR" value={String(s.a_revisar || 0)} />
      <Metric label="NO VERIFICABLES" value={String(s.no_verificables || 0)} />
    </div>
  )
}

export function SellerCard({ row }) {
  const key = toneKey(row)
  const color = TONE_COLOR[key] || C.textMuted
  const warning = blindWarning(row)
  const reasons = blindReasons(row)
  return (
    <article data-testid="ie-seller" data-tone={key} style={{
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`,
      borderRadius: R.lg, background: C.surface, padding: '12px 13px', display: 'grid', gap: 9,
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>
          {row.seller_name || 'Sin vendedor asignado'}
        </h3>
        {/* palabra + color: el color solo no basta (AA + daltonismo) */}
        <span data-testid="ie-tone-word" style={{
          fontSize: 10.5, fontWeight: 800, color, border: `1px solid ${color}`,
          borderRadius: R.pill, padding: '2px 8px', whiteSpace: 'nowrap',
        }}>{toneWord(row)}</span>
      </header>

      <IntegrityPair summary={row} color={color} />

      <p style={{ fontSize: 11.5, color: C.textSoft, margin: 0, lineHeight: 1.4 }}>{evidenceCaption(row)}</p>

      {warning ? (
        <p data-testid="ie-blind-warning" style={{
          fontSize: 11.5, fontWeight: 700, color: C.blue3, margin: 0,
          background: 'rgba(15,42,61,0.04)', borderRadius: R.md, padding: '7px 9px', lineHeight: 1.4,
        }}>{warning}</p>
      ) : null}

      {reasons.length > 0 ? (
        <div data-testid="ie-reasons" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {reasons.map((r) => (
            <span key={r.key} data-testid="ie-reason" data-reason={r.key} style={{
              fontSize: 10.5, color: C.textSoft, border: `1px solid ${C.border}`,
              borderRadius: R.pill, padding: '2px 8px', whiteSpace: 'nowrap',
            }}>{r.count} {r.label}</span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export default function IntegridadView({ payload, testid = 'integridad-view' }) {
  const rows = integrityRows(payload)
  const total = (payload && payload.total) || {}
  const thresholds = thresholdsCaption(payload)
  const periodo = periodCaption(payload)

  return (
    <div data-testid={testid} style={{ display: 'grid', gap: 12 }}>
      <section data-testid="ie-total" style={{
        border: `1px solid ${C.border}`, borderRadius: R.lg, background: C.surface,
        padding: '12px 13px', display: 'grid', gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: '0.04em' }}>
          TODA LA SUCURSAL{periodo ? ` · ${periodo}` : ''}
        </span>
        <IntegrityPair summary={total} />
        {thresholds ? (
          <p data-testid="ie-thresholds" style={{ fontSize: 11, color: C.textMuted, margin: 0, lineHeight: 1.4 }}>{thresholds}</p>
        ) : null}
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((row) => <SellerCard key={String(row.seller_id)} row={row} />)}
      </div>

      <p style={{ fontSize: 11, color: C.textMuted, margin: 0, lineHeight: 1.45 }}>
        Una visita sin cliente, sin check-in o sin duración medida no se acusa: se cuenta como
        no verificable, que es distinto de mal hecha.
      </p>
    </div>
  )
}
