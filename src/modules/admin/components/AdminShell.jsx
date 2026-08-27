// ─── AdminShell — layout desktop-first del rol Auxiliar Administrativo ──────
// Estructura (≥1024px):
//   ┌──────────────────────────────────────────────────┐
//   │ Top bar: back | título | CompanySelector | user  │
//   ├──────────┬──────────────────────┬────────────────┤
//   │ Sidenav  │        Main          │  ActivityFeed  │
//   │ (módulos)│      (children)      │   (lateral)    │
//   └──────────┴──────────────────────┴────────────────┘
// En <1024px cae a columna única centrada (fallback mobile).
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTypo } from '../../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { useAdmin } from '../AdminContext'
import { useSession } from '../../../App'
import { getEffectiveJobKeys } from '../../../lib/roleContext'
import { publishedScope } from '../../../lib/capabilityContract.js'
import { BACKEND_CAPS } from '../adminService.js'
import {
  filterAdminNavForGerentePilot,
  resolveGerentePilotCapabilities,
} from '../gerentePilotCaps.js'
import { NAV_ITEMS } from '../adminNavItems.js'
import { navItemsForRoles } from '../adminRouteAccess.js'
import CompanySelector from './CompanySelector'
import ActivityFeed from './ActivityFeed'

// NAV_ITEMS vive en ../adminNavItems.js: lo comparten el menú y la
// autorización por subruta (adminRouteAccess.js). Se re-exporta por compatibilidad.
export { NAV_ITEMS }

export default function AdminShell({
  activeBlock = 'hub',
  title = 'Administración de sucursal',
  children,
  onBack,
  backButtonLabel,
  backButtonSize = 38,
  hideActivityFeed = false,
  hideNavigation = false,
}) {
  const navigate = useNavigate()
  const { employeeName, capsReady, capsRevision } = useAdmin()
  const { session } = useSession()
  const sucursal = publishedScope(BACKEND_CAPS)?.plaza_label || ''
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const typo = useMemo(() => getTypo(sw), [sw])
  const isDesktop = sw >= 1024
  const iconStroke = 'rgba(15,42,61,0.7)'
  // Feed de actividad (320px) solo con ancho holgado: bajo 1366px el rail
  // global compacto (76px) + sidebar interno (220px) + feed dejarían el
  // contenido comprimido (hallazgo Codex PR #66 — triple panel a 1024–1280).
  const showActivityFeed = !hideNavigation && !hideActivityFeed && sw >= 1366

  const effectiveCaps = useMemo(
    () => {
      void capsRevision
      return resolveGerentePilotCapabilities(session, BACKEND_CAPS, capsReady)
    },
    [capsReady, capsRevision, session],
  )

  // Filtrar módulos según rol del usuario + piloto Gerente read-only.
  const visibleNavItems = useMemo(
    () => filterAdminNavForGerentePilot(
      navItemsForRoles(
        getEffectiveJobKeys(session),
        effectiveCaps,
      ),
      session,
      effectiveCaps,
    ),
    [effectiveCaps, session],
  )

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  function handleBack() {
    if (onBack) { onBack(); return }
    navigate('/')
  }

  function handleNav(item) {
    if (!item.route) return
    if (item.status === 'pending_backend') return
    navigate(item.route, item.routeState ? { state: item.routeState } : undefined)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        input, textarea, select { font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: isDesktop ? '14px 24px' : '14px 16px',
        borderBottom: `1px solid ${TOKENS.colors.border}`,
        background: TOKENS.colors.surfaceSoft,
        position: 'sticky', top: 0, zIndex: 500,
        backdropFilter: 'blur(8px)',
      }}>
        <button
          type="button"
          {...(backButtonLabel ? { 'aria-label': backButtonLabel } : {})}
          onClick={handleBack}
          style={{
            width: backButtonSize, height: backButtonSize, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0, lineHeight: 1.2 }}>
            {title}
          </p>
          {sucursal && (
            <p style={{ fontSize: 11, color: TOKENS.colors.textLow, margin: 0, marginTop: 2 }}>
              {sucursal}
            </p>
          )}
        </div>

        <button
          onClick={() => window.location.reload()}
          title="Refrescar página"
          aria-label="Refrescar página"
          style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>

        <CompanySelector />

        {isDesktop && employeeName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white',
            }}>
              {employeeName.trim().slice(0, 1).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.colors.textSoft }}>
              {employeeName}
            </span>
          </div>
        )}
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isDesktop ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: hideNavigation
            ? 'minmax(0, 1fr)'
            : showActivityFeed
              ? '220px 1fr 320px'
              : '220px 1fr',
          minHeight: 'calc(100dvh - 68px)',
        }}>
          {/* Sidebar izquierda */}
          {!hideNavigation && (
            <nav style={{
            padding: '20px 12px', borderRight: `1px solid ${TOKENS.colors.border}`,
            background: TOKENS.colors.surfaceSoft,
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              color: TOKENS.colors.textLow, margin: '0 0 10px 10px',
            }}>
              MÓDULOS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visibleNavItems.map(item => {
                const active = item.id === activeBlock
                const pending = item.status === 'pending_backend'
                const readOnlyPilot = item.readOnlyPilot === true
                const showReadOnlyBadge = readOnlyPilot || (pending && item.lockedReason)
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item)}
                    disabled={pending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: TOKENS.radius.sm,
                      background: active ? `${TOKENS.colors.blue2}1f` : 'transparent',
                      border: `1px solid ${active ? TOKENS.colors.blue2 : 'transparent'}`,
                      cursor: pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.45 : (readOnlyPilot ? 0.92 : 1),
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: active ? TOKENS.colors.blue3 : (pending ? TOKENS.colors.textLow : TOKENS.colors.textMuted),
                      flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1, fontSize: 13, fontWeight: 600,
                      color: active ? TOKENS.colors.text : TOKENS.colors.textSoft,
                    }}>
                      {item.label}
                    </span>
                    {showReadOnlyBadge && (
                      <span
                        title={item.lockedReason || 'Disponible pronto'}
                        style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                        padding: '2px 6px', borderRadius: 4,
                        background: TOKENS.colors.warningSoft,
                        color: TOKENS.colors.warning,
                      }}>
                        {item.lockedReason ? 'SOLO LECTURA' : 'PRONTO'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            </nav>
          )}

          {/* Main */}
          <main style={{ padding: '24px 28px', overflowY: 'auto' }}>
            {children}
          </main>

          {/* Feed derecho — oculto en vistas que lo desactivan (ej: Requisiciones) */}
          {showActivityFeed && <ActivityFeed moduleId={activeBlock} />}
        </div>
      ) : (
        // Mobile fallback — columna simple. Holgura inferior para no quedar
        // tapado por la barra global (AppNav overlay 64px) — Codex PR #66.
        <main style={{ maxWidth: 520, margin: '0 auto', padding: '16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
          {children}
        </main>
      )}
    </div>
  )
}
