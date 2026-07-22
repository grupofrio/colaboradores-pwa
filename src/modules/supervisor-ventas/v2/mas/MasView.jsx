// ─── Supervisor V2 · Más (vista PURA — accesos secundarios agrupados) ─────────
// Rejilla de accesos que NO son pestañas primarias del shell (Hoy / Radar /
// Rutas / Clientes / Pendientes). Se agrupan por intención: Planeación,
// Desempeño, Coaching, Clientes, Administración. Cada tile enlaza a su ruta
// legacy vía onNavigate(route). Vista PURA: sin window/fetch/hooks ⇒ SSR-testeable.
//
// Regla anti-placeholder: un tile sin `route` (sin fuente real) NO se renderiza;
// por eso el render filtra por `route`. Hoy TODAS las rutas existen (legacy).
//
// EXCLUSIONES de Supervisor V2, NO enlazadas aquí:
//  · Tareas / Notas / Nota rápida (Codex §2/§3): endpoints legacy api_key+sudo
//    sin rol/scope; pantallas no migradas.
//  · Bajas (§3): backend no localizado/auditado en estos repos.
//  · Planeación — Pronóstico y Agregar cliente (Codex §1/§3/§4, esta ronda):
//    sus PANTALLAS legacy están PARCIALMENTE migradas — "Pronóstico" mezcla
//    forecast/upsert|confirm (legacy, guard _guard_and_cfg NO token-only) con
//    forecast/update_lines (seguro); "Agregar cliente" usa route_plan/ensure y
//    customers/search legacy (scope company). El backend endureció
//    route_plan/active y route_plan/add_customer (token-only + canonical
//    effective_branch_config_id), pero como las pantallas dependen de más
//    endpoints legacy no migrados, se aplica "capacidad menor pero segura":
//    NO se enlazan desde V2. Quedan accesibles solo con la experiencia legacy
//    (flag V2 OFF); con V2 ON, un deep link cae en V2ExcludedRoute.
// Todas estas rutas están protegidas por V2ExcludedRoute en App.jsx (deep-link
// seguro: V2 ON ⇒ "no disponible" sin fetch; V2 OFF ⇒ pantalla legacy).
import { TOKENS } from '../../../../tokens'

const C = TOKENS.colors

// Accesos SECUNDARIOS agrupados por intención. `route` es obligatorio (fuente
// real); sin él, el tile se considera placeholder y se omite en el render.
const GROUPS = [
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
