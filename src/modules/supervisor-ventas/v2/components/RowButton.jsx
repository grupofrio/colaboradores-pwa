// ─── Supervisor V2 · RowButton (accesibilidad de filas clicables) ─────────────
// Un <button> REAL (no un div con role="button"): teclado Enter/Space nativo,
// foco nativo, semántica correcta. Reset de estilos + foco visible. Se usa para
// toda fila/tarjeta accionable de las superficies (Codex P12). Si no hay onClick,
// degrada a un <div> no interactivo (no anuncia un botón inerte).
import { TOKENS } from '../../../../tokens'

const C = TOKENS.colors

export default function RowButton({ onClick, children, testid, ariaLabel, style }) {
  const base = {
    display: 'block', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
    background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: onClick ? 'pointer' : 'default',
    borderRadius: TOKENS.radius.lg, ...style,
  }
  if (!onClick) {
    return <div data-testid={testid} style={base}>{children}</div>
  }
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={ariaLabel}
      onClick={onClick}
      style={base}
      onFocus={(e) => { e.currentTarget.style.outline = `2px solid ${C.blue3}`; e.currentTarget.style.outlineOffset = '2px' }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
    >
      {children}
    </button>
  )
}
