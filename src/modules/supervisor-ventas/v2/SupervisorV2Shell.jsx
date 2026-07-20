// ─── Supervisor V2 · Shell de navegación (móvil primero) ─────────────────────
// Barra inferior en móvil + rail/tabs en desktop, para las 6 superficies. La nav
// global de la app sigue existiendo (no se duplica): este shell es la nav LOCAL
// del rol dentro de /equipo. Marca la pestaña activa por prop. Accesible:
// role="tablist", aria-current, foco por teclado, forma+texto (no solo color).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOKENS, getTypo } from '../../../tokens'

const C = TOKENS.colors

export const V2_TABS = Object.freeze([
  { key: 'hoy', label: 'Hoy', route: '/equipo', glyph: '◉' },
  { key: 'radar', label: 'Radar', route: '/equipo/radar', glyph: '◎' },
  { key: 'rutas', label: 'Rutas', route: '/equipo/rutas', glyph: '⋔' },
  { key: 'clientes', label: 'Clientes', route: '/equipo/clientes', glyph: '⚇' },
  { key: 'pendientes', label: 'Pendientes', route: '/equipo/pendientes', glyph: '⚑' },
  { key: 'mas', label: 'Más', route: '/equipo/mas', glyph: '⋯' },
])

function TabButton({ tab, active, onClick, vertical }) {
  const on = active === tab.key
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      aria-current={on ? 'page' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: vertical ? 'row' : 'column', alignItems: 'center',
        justifyContent: vertical ? 'flex-start' : 'center', gap: vertical ? 10 : 3,
        flex: vertical ? '0 0 auto' : 1, padding: vertical ? '10px 14px' : '6px 4px',
        background: on ? (vertical ? C.surfaceStrong : 'transparent') : 'transparent',
        borderRadius: vertical ? TOKENS.radius.md : 0,
        borderTop: vertical ? 'none' : `2px solid ${on ? C.blue3 : 'transparent'}`,
        color: on ? C.text : C.textMuted, cursor: 'pointer', width: vertical ? '100%' : 'auto',
        fontWeight: on ? 700 : 500,
      }}
    >
      <span aria-hidden style={{ fontSize: vertical ? 16 : 17, color: on ? C.blue3 : C.textMuted }}>{tab.glyph}</span>
      <span style={{ fontSize: vertical ? 14 : 10.5 }}>{tab.label}</span>
    </button>
  )
}

export default function SupervisorV2Shell({ active = 'hoy', children }) {
  const navigate = useNavigate()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const typo = useMemo(() => getTypo(sw), [sw])
  const isDesktop = sw >= 900

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const go = (tab) => { if (tab.key !== active) navigate(tab.route) }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${C.bg0} 0%, ${C.bg1} 50%, ${C.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <style>{`* { box-sizing: border-box; } button { border: none; background: none; }`}</style>

      {isDesktop ? (
        // Desktop: rail superior de tabs.
        <nav role="tablist" aria-label="Supervisor" style={{
          display: 'flex', gap: 6, maxWidth: 980, margin: '0 auto', padding: '14px 20px 0',
        }}>
          {V2_TABS.map((t) => <TabButton key={t.key} tab={t} active={active} onClick={() => go(t)} vertical />)}
        </nav>
      ) : null}

      <main style={{ maxWidth: 980, margin: '0 auto', padding: isDesktop ? '10px 20px 24px' : '14px 14px 84px', ...typo?.wrap }}>
        {children}
      </main>

      {!isDesktop && (
        // Móvil: barra inferior fija.
        <nav role="tablist" aria-label="Supervisor" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, height: 64,
          display: 'flex', alignItems: 'stretch',
          background: 'rgba(3,8,17,0.92)', borderTop: `1px solid ${C.border}`,
          paddingBottom: 'env(safe-area-inset-bottom)', backdropFilter: 'blur(8px)', zIndex: 40,
        }}>
          {V2_TABS.map((t) => <TabButton key={t.key} tab={t} active={active} onClick={() => go(t)} />)}
        </nav>
      )}
    </div>
  )
}
