// ─── Gerente V2 · pestaña Más ────────────────────────────────────────────────
// Accesos de respaldo del rol: Copiloto Gerencial (MGR-GAP-006), brief de
// gerencia, alertas (token-only V2), asistencias y superficies universales.
// Unlock de forecast queda fuera del shell read-only (piloto); deep-link en App.
import { useNavigate } from 'react-router-dom'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors

const GROUPS = [
  {
    title: 'DE TU SUCURSAL',
    items: [
      { key: 'copiloto', label: 'Copiloto Gerencial', route: '/gerente/copiloto', glyph: '◈' },
      { key: 'brief', label: 'Brief de gerencia', route: '/brief-gerencia', glyph: '▦' },
      { key: 'alertas', label: 'Alertas completas', route: '/gerente/alertas', glyph: '⚠' },
      { key: 'asistencias', label: 'Asistencias', route: '/asistencias', glyph: '✓' },
    ],
  },
  {
    title: 'MI CUENTA',
    items: [
      { key: 'encuestas', label: 'Encuestas', route: '/surveys', glyph: '☑' },
      { key: 'premios', label: 'Premios', route: '/badges', glyph: '★' },
      { key: 'perfil', label: 'Mi perfil', route: '/profile', glyph: '☺' },
    ],
  },
]

export default function MasGerenteTab() {
  const navigate = useNavigate()
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · MÁS
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>Más accesos</h1>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: '0 0 8px' }}>{g.title}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.items.map((it) => (
              <button
                key={it.key}
                onClick={() => navigate(it.route)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md, padding: '12px 14px',
                }}
              >
                <span aria-hidden style={{ fontSize: 16, color: C.blue3, width: 22, textAlign: 'center' }}>{it.glyph}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
