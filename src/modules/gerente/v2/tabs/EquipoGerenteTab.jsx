// ─── Gerente V2 · pestaña Equipo (el módulo del supervisor, completo) ────────
// Decisión de dirección: el gerente ve Equipo COMPLETO (el mismo del supervisor,
// con scope de su sucursal), no un resumen. NO se duplica código: esta pestaña
// es un directorio que lleva a las MISMAS rutas /equipo/* del supervisor, que ya
// renderizan las superficies V2. El backend ya acepta gerente_sucursal en el
// guard (SUPERVISOR_V2_ROLES) con el scope de su sucursal.
//
// POR QUÉ UN DIRECTORIO Y NO MONTAR EL SHELL DEL SUPERVISOR AQUÍ: montar
// SupervisorV2Shell dentro de GerenteV2Shell anidaría dos raíles de pestañas. El
// gerente entra a las superficies del supervisor por su ruta propia; el rail del
// supervisor lo lleva de vuelta. Cero duplicación de pantallas.
import { useNavigate } from 'react-router-dom'
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors

const SURFACES = [
  { key: 'hoy', label: 'Hoy del equipo', desc: 'Rutas, radar y clientes por visitar', route: '/equipo', glyph: '◉' },
  { key: 'radar', label: 'Radar', desc: 'Posición de las rutas en vivo', route: '/equipo/radar', glyph: '◎' },
  { key: 'rutas', label: 'Rutas', desc: 'Rutas del día y planeación', route: '/equipo/rutas', glyph: '⋔' },
  { key: 'planear', label: 'Planear mañana', desc: 'Recursos y asignación del día siguiente', route: '/equipo/rutas/planear', glyph: '⊹' },
  { key: 'clientes', label: 'Clientes', desc: 'Cartera y segmentos de la sucursal', route: '/equipo/clientes', glyph: '⚇' },
  // Pendientes va a la superficie READ-ONLY del gerente (/gerente/pendientes):
  // los endpoints de escritura del supervisor lo excluyen a propósito, así que
  // aquí ve tareas y notas en solo lectura, no la pantalla de escritura.
  { key: 'pendientes', label: 'Pendientes', desc: 'Tareas y notas del equipo (lectura)', route: '/gerente/pendientes', glyph: '⚑' },
]

export default function EquipoGerenteTab() {
  const navigate = useNavigate()
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
          MI SUCURSAL · EQUIPO DE VENTAS
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '2px 0 0' }}>El equipo de tu sucursal</h1>
        <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>
          Ves el módulo completo del supervisor, con el alcance de tu sucursal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {SURFACES.map((s) => (
          <button
            key={s.key}
            onClick={() => navigate(s.route)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg, padding: '14px 16px',
            }}
          >
            <span aria-hidden style={{
              width: 40, height: 40, borderRadius: TOKENS.radius.md, flexShrink: 0,
              background: C.surfaceStrong, color: C.blue3, fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{s.glyph}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.text }}>{s.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.textMuted }}>{s.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
