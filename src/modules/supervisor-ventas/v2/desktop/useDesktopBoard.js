// ─── ¿Estamos en escritorio? ─────────────────────────────────────────────────
// Reutiliza DESKTOP_MIN de navModel para NO inventar un breakpoint propio: el
// tablero de 3 columnas aparece exactamente donde la app ya considera que hay
// espacio de escritorio (y donde la navegación pasa a rail lateral).
//
// Fail-closed hacia MÓVIL: sin `window` (SSR/tests) devuelve false, así la
// experiencia por defecto es la actual y el tablero nunca se cuela donde no cabe.
import { useEffect, useState } from 'react'
import { DESKTOP_MIN } from '../../../../lib/navModel.js'

export function isDesktopWidth(width) {
  return Number.isFinite(width) && width >= DESKTOP_MIN
}

export function useIsDesktop() {
  const read = () => (typeof window === 'undefined' ? false : isDesktopWidth(window.innerWidth))
  const [desktop, setDesktop] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setDesktop(isDesktopWidth(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return desktop
}
