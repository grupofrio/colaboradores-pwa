// ─── AppNav — navegación global única, basada en roles ───────────────────────
// Deriva 100% de src/lib/navModel.js (que usa el registry canónico). NO hay
// arrays de navegación hardcodeados aquí. Móvil = barra inferior (Inicio +
// prioritarios + "Más" + Yo). Desktop/tablet = rail lateral persistente:
// COMPACTO (solo iconos, 76px) en 1024–1439 para no comprimir shells con
// sidebar interno (Admin 220px + feed 320px — hallazgo Codex), COMPLETO
// (232px) desde 1440.
// Fail-closed: sin sesión VÁLIDA (isValidAuthenticatedSession) no se
// renderiza nada — jamás hay flash de navegación con sesión nula/corrupta.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../App'
import { TOKENS } from '../tokens'
import {
  buildMobileNav, buildDesktopNav, navLabel,
  DESKTOP_MIN, RAIL_FULL_MIN, DESKTOP_RAIL_WIDTH, DESKTOP_RAIL_WIDTH_COMPACT,
} from '../lib/navModel'
import { isValidAuthenticatedSession } from '../lib/session'

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
        minHeight: 48,
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

/* ── Sheet "Más" (dialog accesible) ───────────────────────────────────────────
   a11y completa (Codex PR #66):
   - role=dialog + aria-modal + aria-labelledby (título real)
   - foco inicial en el primer elemento interactivo (botón cerrar)
   - focus trap con Tab/Shift+Tab ciclando dentro del sheet
   - Escape, click en backdrop y botón visible de cerrar
   - bloqueo del scroll del body mientras está abierto (restaura al cerrar)
   - Back del navegador (popstate) cierra el sheet en vez de dejarlo colgado
   - al cerrar, el foco REGRESA al botón "Más" (lo restaura AppNav)            */
function MoreSheet({ items, activeId, onPick, onClose }) {
  const sheetRef = useRef(null)
  const closeBtnRef = useRef(null)

  // Bloqueo de scroll del body mientras el sheet está abierto.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  // Teclado: Escape cierra; Tab/Shift+Tab quedan atrapados dentro del dialog.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const root = sheetRef.current
      if (!root) return
      const focusables = Array.from(root.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.disabled && el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Back del navegador: cerrar el sheet (no navegar con el dialog abierto).
  useEffect(() => {
    function onPop() { onClose() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  // Foco inicial predecible: el botón de cerrar.
  useEffect(() => { closeBtnRef.current?.focus() }, [])

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
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gf-more-sheet-title"
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
        <div style={{ width: 40, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.18)', margin: '4px auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 6px 10px' }}>
          <p id="gf-more-sheet-title" style={{ fontSize: 11, letterSpacing: '0.14em', color: TOKENS.colors.textLow, margin: 0 }}>
            MÁS MÓDULOS
          </p>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de módulos"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${TOKENS.colors.border}`,
              color: TOKENS.colors.textSoft,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
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
                  padding: '14px 6px', borderRadius: 14, cursor: 'pointer', minHeight: 48,
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

/* ── Rail lateral desktop/tablet ──────────────────────────────────────────────
   compact=true (1024–1439px): solo iconos con title/aria-label — evita el
   triple panel comprimido en Admin/Gerente (rail 232 + sidebar 220 + feed 320
   dejaban ~252px de contenido a 1024px; compacto deja ≥408px).               */
function DesktopRail({ nav, compact, onGo }) {
  const items = [nav.home, ...nav.modules, nav.profile]
  const width = compact ? DESKTOP_RAIL_WIDTH_COMPACT : DESKTOP_RAIL_WIDTH
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width,
        background: 'rgba(3,8,17,0.96)', borderRight: `1px solid ${TOKENS.colors.border}`,
        backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column',
        padding: compact ? '18px 10px' : '18px 12px', gap: 4, zIndex: 100, overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'flex-start', gap: 8, padding: compact ? '0 0 14px' : '0 8px 14px' }}>
        <img src="/icons/icon-grupo-frio.svg" alt="Grupo Frío" style={{ width: 28, height: 28, borderRadius: 7 }} />
        {!compact && (
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: TOKENS.colors.textLow }}>COLABORADORES</span>
        )}
      </div>
      {items.map((item) => {
        const active = item.id === nav.activeId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onGo(item.route)}
            aria-current={active ? 'page' : undefined}
            aria-label={navLabel(item)}
            title={compact ? navLabel(item) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              justifyContent: compact ? 'center' : 'flex-start',
              padding: compact ? '12px 0' : '11px 12px', borderRadius: 12, cursor: 'pointer',
              textAlign: 'left', minHeight: 44,
              background: active ? 'rgba(43,143,224,0.14)' : 'transparent',
              border: `1px solid ${active ? 'rgba(43,143,224,0.35)' : 'transparent'}`,
              color: active ? TOKENS.colors.blue2 : TOKENS.colors.textSoft,
            }}
          >
            <NavIcon name={iconFor(item)} />
            {!compact && <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{navLabel(item)}</span>}
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
  const moreBtnRef = useRef(null)

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cerrar el sheet en cualquier navegación (evita estados colgados).
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  // FAIL-CLOSED (BLOCKER 1): sin sesión VÁLIDA no hay navegación de ningún
  // tipo. null / {} / token vacío / expirada / corrupta => null (sin flash:
  // la sesión se hidrata de forma síncrona desde localStorage en App.jsx).
  if (!isValidAuthenticatedSession(session)) return null

  const go = (route) => { setMoreOpen(false); navigate(route) }
  const closeMore = () => {
    setMoreOpen(false)
    // Restaurar el foco al botón "Más" al cerrar (a11y).
    requestAnimationFrame(() => moreBtnRef.current?.focus())
  }

  if (w >= DESKTOP_MIN) {
    const nav = buildDesktopNav(session, location.pathname)
    if (nav.hidden) return null
    return <DesktopRail nav={nav} compact={w < RAIL_FULL_MIN} onGo={go} />
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
            ref={moreBtnRef}
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Más módulos"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            // aria-current SOLO con el sheet cerrado (el activo vive en overflow):
            // abierto, el único aria-current="page" del DOM es el item del dialog.
            aria-current={nav.moreActive && !moreOpen ? 'page' : undefined}
            style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3, padding: '9px 2px',
              minHeight: 48,
              color: (moreOpen || nav.moreActive) ? TOKENS.colors.blue2 : TOKENS.colors.textLow,
              cursor: 'pointer', background: 'none', border: 'none',
            }}
          >
            <NavIcon name="more" />
            <span style={{ fontSize: 10, fontWeight: nav.moreActive ? 700 : 500, letterSpacing: '0.02em' }}>Más</span>
          </button>
        )}
        <TabButton item={nav.profile} short active={nav.profile.id === nav.activeId} onClick={() => go(nav.profile.route)} />
      </nav>
      {moreOpen && (
        <MoreSheet items={nav.overflow} activeId={nav.activeId} onPick={(item) => go(item.route)} onClose={closeMore} />
      )}
    </>
  )
}
