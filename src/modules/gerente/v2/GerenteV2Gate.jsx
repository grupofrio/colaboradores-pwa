// ─── Gerente V2 · gate del feature flag (fail-closed) ────────────────────────
// Decide, por ruta, si se monta la EXPERIENCIA V2 ("Mi Sucursal", shell de 6
// pestañas) o la LEGACY (el hub de 5 botones). Fail-closed: sin flag global +
// sucursal (o desconocido) ⇒ hub legacy. El rol ya lo impuso ModuleRoleRoute.
//
// Igual que el gate del supervisor, esto NO es autorización: el rol lo impone la
// ruta y la autoridad de seguridad sigue siendo el guard + rol + flags del
// backend. Aquí solo se decide QUÉ experiencia se pinta, nunca ambas.
//
// Las pestañas que no existen en el hub legacy (Equipo/Producción/Inventario/Más)
// no pasan `legacy` ⇒ con el flag OFF hacen redirect seguro a /gerente, que sí
// tiene su fallback (el hub de 5 botones).
import { Navigate } from 'react-router-dom'
import { useSession } from '../../../App'
import { isGerenteV2Active } from './gerenteV2Flag.js'
import GerenteV2Shell from './GerenteV2Shell.jsx'

export default function GerenteV2Gate({ active, children, legacy = null }) {
  const { session } = useSession()
  if (!isGerenteV2Active(session)) {
    if (legacy) return legacy
    return <Navigate to="/gerente" replace />
  }
  return <GerenteV2Shell active={active}>{children}</GerenteV2Shell>
}
