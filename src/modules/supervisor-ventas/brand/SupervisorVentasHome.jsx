// ─── Portada "claro Grupo Frío" para supervisor_ventas ───────────────────────
// Réplica de la identidad de la PWA de clientes (clientes-tradicional-kolders)
// adaptada al grid de módulos de la PWA de colaboradores: header con gradiente
// institucional + logo oficial, fondo #F0F9FF y tarjetas claras con borde
// #DBEFF9.
//
// Es una PANTALLA APARTE, no un `if` regado por ScreenHome: así el resto de los
// roles no pasa por ninguna rama nueva y su portada oscura queda intacta byte a
// byte. ScreenHome hace early-return a este componente y le inyecta la lista de
// módulos y el manejador de entrada YA resueltos (misma autoridad de siempre:
// getHomeModulesForSession + getModuleEntryDecisionForSession).
import {
  BRAND_LIGHT as C,
  BRAND_HEADER_GRADIENT,
  BRAND_LOGO,
  BRAND_LOGO_MARK,
} from '../../../theme/brandLight'

const ICON = {
  kpis: '📈', encuestas: '📝', logros: '🏅', equipo: '👥',
  ruta: '🚚', torres: '🗼', admin: '🧾', supervision: '🔎',
  produccion: '🏭', almacen: '📦', entregas: '🛻',
}

function ModuleCard({ module, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`brand-card-${module.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '16px 16px', textAlign: 'left', cursor: 'pointer',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        boxShadow: '0 1px 2px rgba(15,42,61,0.05)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#E8F6FD', fontSize: 19,
        }}
      >
        {ICON[module.icon] || '•'}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.text }}>
          {module.label}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          {module.route}
        </span>
      </span>
    </button>
  )
}

export default function SupervisorVentasHome({
  session, modules = [], onModule, onLogout,
}) {
  const firstName = String(session?.name || '').split(' ')[0] || 'Colaborador'

  return (
    <div
      data-testid="brand-light-home"
      data-theme="brand-light"
      style={{
        minHeight: '100dvh',
        background: C.bg,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)',
        overflowX: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        [data-theme="brand-light"] * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        [data-theme="brand-light"] button { border: none; background: none; }
      `}</style>

      {/* Header institucional: gradiente #005A8D → #00B8D4 + esquinas redondeadas
          abajo, igual que la portada de clientes. */}
      <header
        style={{
          background: BRAND_HEADER_GRADIENT,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px',
          color: C.onPrimary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span
            style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img src={BRAND_LOGO_MARK} alt="" aria-hidden="true" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          </span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              data-testid="brand-logout"
              style={{
                cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 14px',
                borderRadius: 999, color: C.onPrimary,
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.32)',
              }}
            >
              Salir
            </button>
          )}
        </div>

        <img
          src={BRAND_LOGO}
          alt="Grupo Frío"
          style={{ display: 'block', height: 44, width: 'auto', marginTop: 18 }}
        />

        <p style={{ margin: '14px 0 0', fontSize: 13, opacity: 0.9 }}>
          Hola, <strong style={{ fontWeight: 700 }}>{firstName}</strong>
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.78 }}>
          Supervisión de ventas
        </p>
      </header>

      <main style={{ padding: '20px 16px 8px', maxWidth: 720, margin: '0 auto' }}>
        <h2
          style={{
            margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.textMuted,
          }}
        >
          Mis módulos
        </h2>

        <div style={{ display: 'grid', gap: 10 }}>
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} onClick={() => onModule?.(module)} />
          ))}
        </div>

        {modules.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Todavía no tienes módulos asignados.
          </p>
        )}
      </main>
    </div>
  )
}
