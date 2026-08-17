// ─── Gerente V2 · Shell "Mi Sucursal" (rail superior siempre) ────────────────
// Calca el patrón de SupervisorV2Shell: nav LOCAL del rol con rail superior
// SIEMPRE visible en desktop, sin barra inferior propia. La nav GLOBAL de la app
// (AppNav) sigue aparte; este shell NO la duplica.
//
// LECCIÓN DEL FIX #147 (misma que el shell de supervisor): NO se pinta una barra
// inferior fija por breakpoint. Antes eso se encimaba con la barra inferior de
// AppNav (ambas position:fixed; bottom:0) y a zoom normal de escritorio con ancho
// <900 las pestañas del rol quedaban tapadas. El rail superior se ve a cualquier
// ancho, con scroll horizontal cuando no caben las 6 pestañas.
//
// Accesible: role="tablist", aria-selected/current, foco por teclado, forma +
// texto (no solo color). Touch targets ≥44px. Tema CLARO BRAND_TOKENS, igual que
// supervisor; el invariante de tema lo verifica el test de scope de tokens.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTypo } from '../../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { GERENTE_V2_TABS } from './gerenteV2Tabs.js'

const C = TOKENS.colors

export { GERENTE_V2_TABS }

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

export default function GerenteV2Shell({ active = 'hoy', children }) {
  const navigate = useNavigate()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const typo = useMemo(() => getTypo(sw), [sw])
  // `wide` NO decide si se ven las pestañas (siempre se ven): solo ensancha el
  // tablero de "Hoy" en pantallas amplias.
  const wide = sw >= 900

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

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
        .gz-rail { scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .gz-rail::-webkit-scrollbar { height: 6px; }
      `}</style>

      {/* Rail superior: SIEMPRE visible a cualquier ancho, scroll horizontal
          cuando no caben las 6. Sin barra inferior propia (fix #147). */}
      <nav role="tablist" aria-label="Mi Sucursal" className="gz-rail" style={{
        display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto',
        maxWidth: shellMax, margin: '0 auto', padding: '12px 14px 4px',
      }}>
        {GERENTE_V2_TABS.map((t) => <TabButton key={t.key} tab={t} active={active} onClick={() => go(t)} />)}
      </nav>

      <main style={{
        maxWidth: shellMax, margin: '0 auto',
        padding: wide ? '10px 20px 24px' : '12px 14px 88px', ...typo?.wrap,
      }}>
        {children}
      </main>
    </div>
  )
}
