// ─── AppShell — layout global que monta la navegación en TODAS las pantallas ─
// Envuelve las rutas autenticadas (via <Outlet/>) y renderiza <AppNav/>.
// Reserva el espacio del nav con padding en el propio wrapper: como el nav/rail
// son opacos y fixed sobre exactamente esa zona, no queda hueco ni se solapa el
// contenido de ninguna pantalla (universal o shell de módulo).
//
// FAIL-CLOSED (Codex PR #66 BLOCKER 1): el nav solo existe con sesión VÁLIDA
// (isValidAuthenticatedSession) y fuera de rutas ocultas. La sesión se hidrata
// de forma SÍNCRONA en App.jsx (useState(getStoredSession)): o hay sesión
// válida en el primer render o no la hay => sin estado "cargando" ni flash.
//
// Espaciado del nav (Codex PR #66 "doble bottom padding"):
//   DESKTOP → paddingLeft = ancho del rail (compacto/completo). Reservado aquí
//     una sola vez para TODAS las pantallas (rail fijo opaco sobre esa franja).
//   MÓVIL   → NO se agrega paddingBottom en el wrapper. El nav inferior es un
//     overlay fijo de 64px con la MISMA huella que la vieja barra por pantalla,
//     así las 5 universales (que ya reservaban su propio espacio) no quedan con
//     doble padding. Los shells de módulo que antes NO tenían barra reciben su
//     holgura con <ModuleMobileSpacer/> (misma altura canónica).

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../App'
import AppNav from './AppNav'
import { isNavHiddenForPath, railWidthFor, DESKTOP_MIN } from '../lib/navModel'
import { isValidAuthenticatedSession } from '../lib/session'

export default function AppShell() {
  const { session } = useSession()
  const location = useLocation()
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const showNav = isValidAuthenticatedSession(session) && !isNavHiddenForPath(location.pathname)
  const isDesktop = w >= DESKTOP_MIN

  return (
    <div
      style={{
        minHeight: '100dvh',
        // Solo el rail desktop reserva espacio en el wrapper (una vez, para
        // todas las pantallas). El nav móvil es overlay => cero doble padding.
        paddingLeft: showNav && isDesktop ? railWidthFor(w) : 0,
        transition: 'padding 120ms ease',
      }}
    >
      <Outlet />
      <AppNav />
    </div>
  )
}
