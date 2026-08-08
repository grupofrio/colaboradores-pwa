// ─── Dashboard del Gerente — retirado hasta tener tablero con alcance ───────
// Esta pantalla montaba un <iframe src={VITE_METABASE_URL}> SIN token firmado y
// SIN filtro de sucursal: el MISMO tablero global para todos los gerentes, con
// los números de todas las sucursales. Un gerente de Iguala veía Cuernavaca.
//
// No se "arregla" con un filtro en el cliente — un filtro que el cliente pone
// el cliente lo quita. El camino correcto es el flujo firmado
// (`/pwa-metabase-token`) con el filtro de sucursal embebido en el JWT del
// embed, o directamente los KPIs nativos de la Fase 2.
//
// Mientras tanto se retira el acceso y se dice por qué. Mostrar un tablero
// global a todos los gerentes es peor que no mostrar ninguno.
import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'

export default function ScreenDashboardGerente() {
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])

  useEffect(() => {
    const h = () => setSw(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button onClick={() => navigate('/gerente')} style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>Dashboard Gerente</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div style={{
          padding: 24, borderRadius: TOKENS.radius.xl,
          background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
          textAlign: 'center', maxWidth: 340,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p style={{ ...typo.title, color: TOKENS.colors.text, margin: 0 }}>Dashboard en preparación</p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, marginTop: 8 }}>
            El tablero anterior mostraba los números de todas las sucursales al mismo
            tiempo. Se retiró hasta tener uno filtrado por tu sucursal.
          </p>
          <p style={{ ...typo.caption, color: TOKENS.colors.textLow, marginTop: 10 }}>
            Mientras tanto, el resumen de tu sucursal está en la pantalla principal.
          </p>
        </div>
      </div>
    </div>
  )
}
