// ─── Supervisor V2 · Más (vista PURA — accesos secundarios agrupados) ─────────
// Rejilla de accesos que NO son pestañas primarias del shell (Hoy / Radar /
// Rutas / Clientes / Pendientes). Se agrupan por intención: Planeación,
// Desempeño, Coaching, Clientes, Administración. Cada tile enlaza a su ruta
// legacy vía onNavigate(route). Vista PURA: sin window/fetch/hooks ⇒ SSR-testeable.
//
// Regla anti-placeholder: un tile sin `route` (sin fuente real) NO se renderiza;
// por eso el render filtra por `route`. Hoy TODAS las rutas existen (legacy).
//
// EXCLUSIONES de Supervisor V2 (Codex §2/§3), NO enlazadas aquí:
//  · Tareas / Notas / Nota rápida: sus endpoints legacy (/pwa-supv/tasks|notes)
//    son api_key+sudo SIN rol/scope. Existen endpoints V2 protegidos, pero las
//    PANTALLAS legacy aún no están migradas ⇒ no se enlazan desde V2 (quedan
//    accesibles solo con la experiencia legacy, flag V2 OFF). Con V2 ON, un deep
//    link a esas rutas cae en V2ExcludedRoute (pantalla "no disponible", sin
//    fetch legacy).
//  · Bajas: su backend NO está localizado/auditado en estos repos ⇒ no se enlaza
//    ni se monta desde V2 (misma protección de deep link).
// Follow-up (fuera de alcance): fusión Notas+Nota rápida y desglose de Pronóstico.
import { TOKENS } from '../../../../tokens'

const C = TOKENS.colors

// Accesos SECUNDARIOS agrupados por intención. `route` es obligatorio (fuente
// real); sin él, el tile se considera placeholder y se omite en el render.
const GROUPS = [
  {
    title: 'Planeación',
    tiles: [
      { label: 'Pronóstico', desc: 'Proyección de venta del equipo', route: '/equipo/pronostico' },
      { label: 'Agregar cliente', desc: 'Alta de cliente en el plan', route: '/equipo/planes/clientes' },
    ],
  },
  {
    title: 'Desempeño',
    tiles: [
      { label: 'Metas', desc: 'Metas de venta y cobranza del mes', route: '/equipo/metas' },
      { label: 'Score', desc: 'Cumplimiento semanal por vendedor', route: '/equipo/score-semanal' },
      { label: 'Dashboard', desc: 'Indicadores del equipo', route: '/equipo/dashboard' },
    ],
  },
  {
    title: 'Clientes',
    tiles: [
      { label: 'Recuperación', desc: 'Clientes por recuperar', route: '/equipo/recuperacion' },
    ],
  },
]

function Tile({ tile, onNavigate }) {
  return (
    <button
      type="button"
      data-testid="supervisor-v2-mas-tile"
      data-route={tile.route}
      onClick={() => { if (onNavigate) onNavigate(tile.route) }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
        padding: '13px 14px', width: '100%', cursor: 'pointer',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.md,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tile.label}</span>
      <span style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.35 }}>{tile.desc}</span>
    </button>
  )
}

export default function MasView({ onNavigate, testid = 'supervisor-v2-mas' }) {
  return (
    <div data-testid={testid}>
      <header style={{ marginBottom: 13 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Más</h1>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 5 }}>
          Accesos del equipo agrupados por tarea.
        </div>
      </header>

      {GROUPS.map((group) => {
        // Regla estructural: descarta tiles sin fuente (route) ⇒ sin placeholders.
        const tiles = group.tiles.filter((t) => t.route)
        if (tiles.length === 0) return null
        return (
          <section key={group.title} data-testid="supervisor-v2-mas-group" style={{ marginBottom: 18 }}>
            <h2 style={{
              fontSize: 12, fontWeight: 800, color: C.textSoft, margin: 0, marginBottom: 9,
              letterSpacing: '0.04em',
            }}>
              {group.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {tiles.map((tile) => (
                <Tile key={tile.route} tile={tile} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
