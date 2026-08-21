// ─── Supervisor V2 · Shell de navegación (rail superior siempre) ─────────────
// Nav LOCAL del rol dentro de /equipo, para las 6 superficies. La nav GLOBAL de
// la app (AppNav) sigue existiendo aparte; este shell NO la duplica.
//
// POR QUÉ RAIL SUPERIOR SIEMPRE (no barra inferior por breakpoint): antes el
// shell pintaba una barra inferior fija cuando sw<900, que se ENCIMABA con la
// barra inferior de AppNav (ambas position:fixed; bottom:0) ⇒ a zoom normal de
// escritorio (ancho <900) las pestañas del rol quedaban tapadas y solo se veían
// haciendo zoom-out (~25%, que cruzaba los 900). Ahora el rail superior se ve a
// cualquier ancho, con scroll horizontal cuando no caben las 6; sin barra
// inferior propia, no hay colisión con AppNav.
// Accesible: role="tablist", aria-current, foco por teclado, forma+texto (no
// solo color). Touch targets ≥44px.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionContext } from '../../../lib/sessionContext.js'
import { getTypo } from '../../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { getSupervisorCopilotCapabilities } from './copilot/copilotSupervisorApi.js'
import { resolveSupervisorCopilotTabVisibleForSession } from './copilot/copilotSupervisorModel.js'

const C = TOKENS.colors

export const V2_TABS = Object.freeze([
  { key: 'hoy', label: 'Hoy', route: '/equipo', glyph: '◉' },
  { key: 'radar', label: 'Radar', route: '/equipo/radar', glyph: '◎' },
  { key: 'rutas', label: 'Rutas', route: '/equipo/rutas', glyph: '⋔' },
  { key: 'clientes', label: 'Clientes', route: '/equipo/clientes', glyph: '⚇' },
  { key: 'prospectos', label: 'Prospectos', route: '/equipo/prospectos', glyph: '+' },
  { key: 'pendientes', label: 'Pendientes', route: '/equipo/pendientes', glyph: '⚑' },
  { key: 'copiloto', label: 'Copiloto', route: '/equipo/copiloto', glyph: '✎' },
  { key: 'mas', label: 'Más', route: '/equipo/mas', glyph: '⋯' },
])

const PULSE_TAB = Object.freeze({ key: 'pulso', label: 'Pulso', route: '/equipo', glyph: '◈' })

function buildSupervisorV2Tabs(pulseEnabled = false) {
  return pulseEnabled === true ? [PULSE_TAB, ...V2_TABS.slice(1)] : [...V2_TABS]
}

// Pastilla horizontal (icono + texto). Una sola forma; el rail hace scroll si no
// caben. minHeight 44 para touch. Activa = fondo + texto fuerte + palabra, no
// solo color.
function TabButton({ tab, active, onClick }) {
  const on = active === tab.key
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      aria-current={on ? 'page' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, flex: '0 0 auto', minHeight: 44, padding: '9px 14px', whiteSpace: 'nowrap',
        background: on ? C.surfaceStrong : 'transparent', borderRadius: TOKENS.radius.md,
        color: on ? C.text : C.textMuted, cursor: 'pointer', fontWeight: on ? 700 : 500,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, color: on ? C.blue3 : C.textMuted }}>{tab.glyph}</span>
      <span style={{ fontSize: 14 }}>{tab.label}</span>
    </button>
  )
}

export default function SupervisorV2Shell({ active = 'hoy', children, pulseEnabled }) {
  const navigate = useNavigate()
  const session = useSessionContext()?.session
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const [copilotOk, setCopilotOk] = useState(false)
  const typo = useMemo(() => getTypo(sw), [sw])
  const wide = sw >= 900
  const pulseOn = pulseEnabled === true
  const tabs = useMemo(
    () => {
      const available = buildSupervisorV2Tabs(pulseOn)
      return copilotOk ? available : available.filter((t) => t.key !== 'copiloto')
    },
    [copilotOk, pulseOn],
  )

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    let cancelled = false
    setCopilotOk(false)
    resolveSupervisorCopilotTabVisibleForSession(session, getSupervisorCopilotCapabilities)
      .then((ok) => { if (!cancelled) setCopilotOk(ok === true) })
    return () => { cancelled = true }
  }, [session])

  const go = (tab) => { if (tab.key !== active) navigate(tab.route) }
  const shellMax = wide && active === 'hoy' ? 1680 : 980

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${C.bg0} 0%, ${C.bg1} 50%, ${C.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        button { border: none; background: none; }
        .supv-rail { scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .supv-rail::-webkit-scrollbar { height: 6px; }
      `}</style>

      {/* Rail superior de pestañas del rol: SIEMPRE visible a cualquier ancho,
          con scroll horizontal cuando no caben las 6. Sin barra inferior propia. */}
      <nav role="tablist" aria-label="Supervisor" className="supv-rail" style={{
        display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto',
        maxWidth: shellMax, margin: '0 auto', padding: '12px 14px 4px',
      }}>
        {tabs.map((t) => <TabButton key={t.key} tab={t} active={active} onClick={() => go(t)} />)}
      </nav>

      {/* 980px es el ancho de lectura de una columna; "Hoy" (tablero de 3
          columnas) se ensancha a 1680 en pantallas amplias. paddingBottom deja
          aire para la barra inferior GLOBAL de AppNav en móvil. */}
      <main style={{
        maxWidth: shellMax, margin: '0 auto',
        padding: wide ? '10px 20px 24px' : '12px 14px 88px', ...typo?.wrap,
      }}>
        {children}
      </main>
    </div>
  )
}
