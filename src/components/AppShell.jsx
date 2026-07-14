// ─── AppShell — layout global que monta la navegación en TODAS las pantallas ─
// Envuelve las rutas autenticadas (via <Outlet/>) y renderiza <AppNav/>.
// Reserva el espacio del nav con padding en el propio wrapper: como el nav/rail
// son opacos y fixed sobre exactamente esa zona, no queda hueco ni se solapa el
// contenido de ninguna pantalla (universal o shell de módulo).

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../App'
import AppNav, { DESKTOP_RAIL_WIDTH, MOBILE_NAV_HEIGHT } from './AppNav'
import { isNavHiddenForPath } from '../lib/navModel'

const DESKTOP_MIN = 1024

export default function AppShell() {
  const { session } = useSession()
  const location = useLocation()
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const showNav = !!session && !isNavHiddenForPath(location.pathname)
  const isDesktop = w >= DESKTOP_MIN

  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingLeft: showNav && isDesktop ? DESKTOP_RAIL_WIDTH : 0,
        paddingBottom: showNav && !isDesktop ? `calc(env(safe-area-inset-bottom) + ${MOBILE_NAV_HEIGHT}px)` : 0,
        transition: 'padding 120ms ease',
      }}
    >
      <Outlet />
      <AppNav />
    </div>
  )
}
