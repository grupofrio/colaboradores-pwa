import { TOKENS as DARK_TOKENS } from '../../../tokens'

/* ============================================================================
   StatusBadge — Reusable status chip for steps, tickets, pallets, etc.
============================================================================ */

const statusMap = (TOKENS) => ({
  pending:     { color: TOKENS.colors.warning,  bg: TOKENS.colors.warningSoft, label: 'Pendiente' },
  draft:       { color: TOKENS.colors.warning,  bg: TOKENS.colors.warningSoft, label: 'Borrador' },
  completed:   { color: TOKENS.colors.success,  bg: TOKENS.colors.successSoft, label: 'Completado' },
  done:        { color: TOKENS.colors.success,  bg: TOKENS.colors.successSoft, label: 'Hecho' },
  received:    { color: TOKENS.colors.success,  bg: TOKENS.colors.successSoft, label: 'Recibido' },
  dispatched:  { color: TOKENS.colors.success,  bg: TOKENS.colors.successSoft, label: 'Despachado' },
  in_progress: { color: TOKENS.colors.chipInfoFg, bg: TOKENS.colors.chipInfoBg, label: 'En progreso' },
  published:   { color: TOKENS.colors.chipInfoFg, bg: TOKENS.colors.chipInfoBg, label: 'Publicado' },
  sale:        { color: TOKENS.colors.chipInfoFg, bg: TOKENS.colors.chipInfoBg, label: 'Venta' },
  alert:       { color: TOKENS.colors.error,    bg: TOKENS.colors.errorSoft,   label: 'Alerta' },
  error:       { color: TOKENS.colors.error,    bg: TOKENS.colors.errorSoft,   label: 'Error' },
  rejected:    { color: TOKENS.colors.error,    bg: TOKENS.colors.errorSoft,   label: 'Rechazado' },
  locked:      { color: TOKENS.colors.textMuted, bg: TOKENS.colors.chipNeutralBg, label: 'Bloqueado' },
  hold:        { color: TOKENS.colors.textMuted, bg: TOKENS.colors.chipNeutralBg, label: 'En espera' },
})

const fallback = (TOKENS) => ({ color: TOKENS.colors.textMuted, bg: TOKENS.colors.chipNeutralBg, label: '—' })

// `tokens` OPCIONAL con default OSCURO: quien no lo pasa (Entregas, M2-M7,
// torres, admin…) se ve exactamente igual que antes. Solo la superficie de
// supervisión de ventas inyecta BRAND_TOKENS (rebranding tanda 3).
export default function StatusBadge({ status, label, tokens = DARK_TOKENS }) {
  const TOKENS = tokens
  const cfg = statusMap(TOKENS)[status] || fallback(TOKENS)
  const displayLabel = label || cfg.label

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: TOKENS.radius.pill,
        background: cfg.bg,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {displayLabel}
    </span>
  )
}
