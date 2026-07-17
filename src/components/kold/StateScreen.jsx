// ─── StateScreen — estado controlado de pantalla (Etapa 0A) ──────────────────
// Reemplaza errores crudos por un estado humano: título + detalle + salida. JAMÁS
// muestra stack traces, HTML ni "Unexpected token". El detalle técnico va a
// logging/evidencia, no a la cara del usuario.
import { TOKENS } from '../../tokens'

const C = TOKENS.colors

export default function StateScreen({
  title, detail, tone = 'neutral', actionLabel, onAction, testid = 'kold-state-screen',
}) {
  const toneColor = tone === 'error' ? C.error : tone === 'warning' ? C.warning : C.textMuted
  return (
    <div data-testid={testid} role="status" aria-live="polite" style={{
      maxWidth: 560, margin: '48px auto', padding: '28px 24px', textAlign: 'center',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: toneColor }}>{title}</div>
      {detail && (
        <p style={{ fontSize: 13, color: C.textLow, marginTop: 8, lineHeight: 1.55 }}>{detail}</p>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction} style={{
          marginTop: 16, fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer',
          borderRadius: TOKENS.radius.pill, background: 'transparent', color: C.blue3,
          border: `1px solid ${C.borderBlue}`,
        }}>{actionLabel}</button>
      )}
    </div>
  )
}
