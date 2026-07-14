// ─── AppNav — navegación global única, basada en roles ───────────────────────
// Deriva 100% de src/lib/navModel.js (que usa el registry canónico). NO hay
// arrays de navegación hardcodeados aquí. Móvil = barra inferior (Inicio +
// prioritarios + "Más" + Yo). Desktop/tablet = rail lateral persistente.
// Fail-closed: sin sesión no se renderiza nada.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../App'
import { TOKENS } from '../tokens'
import { buildMobileNav, buildDesktopNav, navLabel } from '../lib/navModel'

const DESKTOP_MIN = 1024
export const DESKTOP_RAIL_WIDTH = 232
export const MOBILE_NAV_HEIGHT = 64

function NavIcon({ name, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'home': return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'user': return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    case 'more': return <svg {...p}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
    case 'kpis': return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    case 'encuestas': return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
    case 'logros': return <svg {...p}><circle cx="12" cy="8" r="6" /><polyline points="8.5 13 7 22 12 19 17 22 15.5 13" /></svg>
    case 'equipo': return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
    case 'admin': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
    case 'ruta': return <svg {...p}><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
    case 'produccion': return <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
    case 'entregas': return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" /></svg>
    case 'supervision': return <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
    case 'almacen': return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'torres': return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

const iconFor = (item) => item?.navIcon || item?.icon || 'more'

/* ── Botón de la barra inferior móvil ─────────────────────────────────────── */
function TabButton({ item, active, short, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={navLabel(item)}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3, padding: '9px 2px',
        color: active ? TOKENS.colors.blue2 : TOKENS.colors.textLow,
        cursor: 'pointer', background: 'none', border: 'none',
        transition: `color ${TOKENS.motion.fast}`,
      }}
    >
      <NavIcon name={iconFor(item)} />
      <span style={{
        fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.02em',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {navLabel(item, { short })}
      </span>
    </button>
  )
}

/* ── Sheet "Más" ──────────────────────────────────────────────────────────── */
function MoreSheet({ items, activeId, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(2,6,14,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Más módulos"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '70vh', overflowY: 'auto',
          background: 'rgba(6,12,22,0.98)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: `1px solid ${TOKENS.colors.border}`,
          padding: '10px 12px calc(env(safe-area-inset-bottom) + 16px)',
          outline: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.18)', margin: '4px auto 12px' }} />
        <p style={{ fontSize: 11, letterSpacing: '0.14em', color: TOKENS.colors.textLow, margin: '0 6px 10px' }}>MÁS MÓDULOS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                aria-label={navLabel(item)}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 6px', borderRadius: 14, cursor: 'pointer',
                  background: active ? 'rgba(43,143,224,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                  color: active ? TOKENS.colors.blue2 : TOKENS.colors.textSoft,
                }}
              >
                <NavIcon name={iconFor(item)} size={22} />
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{navLabel(item)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Rail lateral desktop/tablet ──────────────────────────────────────────── */
function DesktopRail({ nav, onGo }) {
  const items = [nav.home, ...nav.modules, nav.profile]
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: DESKTOP_RAIL_WIDTH,
        background: 'rgba(3,8,17,0.96)', borderRight: `1px solid ${TOKENS.colors.border}`,
        backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column',
        padding: '18px 12px', gap: 4, zIndex: 100, overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 14px' }}>
        <img src="/icons/icon-grupo-frio.svg" alt="Grupo Frío" style={{ width: 28, height: 28, borderRadius: 7 }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: TOKENS.colors.textLow }}>COLABORADORES</span>
      </div>
      {items.map((item) => {
        const active = item.id === nav.activeId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onGo(item.route)}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              background: active ? 'rgba(43,143,224,0.14)' : 'transparent',
              border: `1px solid ${active ? 'rgba(43,143,224,0.35)' : 'transparent'}`,
              color: active ? TOKENS.colors.blue2 : TOKENS.colors.textSoft,
            }}
          >
            <NavIcon name={iconFor(item)} />
            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{navLabel(item)}</span>
          </button>
        )
      })}
    </nav>
  )
}

/* ── AppNav ───────────────────────────────────────────────────────────────── */
export default function AppNav() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // fail-closed: sin sesión no hay navegación
  if (!session) return null

  const go = (route) => { setMoreOpen(false); navigate(route) }

  if (w >= DESKTOP_MIN) {
    const nav = buildDesktopNav(session, location.pathname)
    if (nav.hidden) return null
    return <DesktopRail nav={nav} onGo={go} />
  }

  const nav = buildMobileNav(session, location.pathname)
  if (nav.hidden) return null
  const tabs = [nav.home, ...nav.primary]

  return (
    <>
      <nav
        aria-label="Navegación principal"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(3,8,17,0.94)', borderTop: `1px solid ${TOKENS.colors.border}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 100,
        }}
      >
        {tabs.map((item) => (
          <TabButton key={item.id} item={item} short active={item.id === nav.activeId} onClick={() => go(item.route)} />
        ))}
        {nav.hasMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Más módulos"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3, padding: '9px 2px',
              color: moreOpen ? TOKENS.colors.blue2 : TOKENS.colors.textLow,
              cursor: 'pointer', background: 'none', border: 'none',
            }}
          >
            <NavIcon name="more" />
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.02em' }}>Más</span>
          </button>
        )}
        <TabButton item={nav.profile} short active={nav.profile.id === nav.activeId} onClick={() => go(nav.profile.route)} />
      </nav>
      {moreOpen && (
        <MoreSheet items={nav.overflow} activeId={nav.activeId} onPick={(item) => go(item.route)} onClose={() => setMoreOpen(false)} />
      )}
    </>
  )
}
