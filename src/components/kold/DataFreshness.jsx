// ─── DataFreshness — edad del dato (Etapa 0A: descriptiva y neutral) ─────────
// Canal visual PROPIO (reloj/neutro), nunca el rojo de riesgo de negocio. En 0A
// solo muestra edad ("Datos medidos hace N horas"); el estado evaluativo
// (vigente/atrasado) requiere una cadencia aprobada (staleAfterHours), inexistente
// en 0A. Lógica pura en src/lib/freshness.js (testeable sin render).
import { TOKENS } from '../../tokens'
import { freshnessView } from '../../lib/freshness'

export default function DataFreshness({
  dataAsOf, staleAfterHours = null, nowMs, source = null, testid = 'kold-freshness',
}) {
  const v = freshnessView({ dataAsOf, staleAfterHours, nowMs })
  const tone = v.level === 'stale' ? TOKENS.freshness.stale : TOKENS.freshness.neutral
  const label = v.level === 'unknown' ? 'Corte no informado' : v.label
  return (
    <span data-testid={testid} data-level={v.level} data-evaluative={String(v.evaluative)}
      title={source ? `Fuente: ${source}` : undefined} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
        padding: '3px 9px', borderRadius: TOKENS.radius.pill,
        color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`, whiteSpace: 'nowrap',
      }}>
      <span aria-hidden="true">{tone.glyph}</span>{label}
    </span>
  )
}
