// ─── Supervisor V2 · gate del feature flag (fail-closed) ─────────────────────
// Decide, por ruta, si se monta la experiencia V2 (shell) o la LEGACY. Fail-closed:
// sin flag global+sucursal (o desconocido) ⇒ legacy. `v2Only` = ruta que no existe
// en legacy ⇒ redirect seguro a /equipo. El rol ya lo impuso ModuleRoleRoute.
import { Navigate } from 'react-router-dom'
import { getSession } from '../../../lib/api.js'
import { readSupervisorV2FlagRuntime } from './flag.js'
import SupervisorV2Shell from './SupervisorV2Shell.jsx'

// Interno del gate (no se exporta ⇒ el .jsx solo expone el componente).
function isV2Active() {
  let session = {}
  try { session = getSession() || {} } catch { session = {} }
  const capabilities = session.capabilities || {}
  return readSupervisorV2FlagRuntime(session, capabilities).enabled
}

/**
 * Decide UNA sola experiencia; NUNCA monta ambas (los `return` son excluyentes).
 * No es una capa de autorización: el rol lo impone ModuleRoleRoute y la autoridad
 * de seguridad sigue siendo el guard + rol + flags del backend.
 * @param {{active:string, children:React.ReactNode, legacy?:React.ReactNode,
 *          v2Only?:boolean, shell?:boolean}} p
 * legacy: elemento a renderizar si el flag está OFF (p.ej. el entry legacy).
 * v2Only: la ruta no existe en legacy ⇒ redirect seguro a /equipo cuando está OFF.
 * shell:  false ⇒ con V2 ON entrega los children SIN envolver en SupervisorV2Shell
 *         (para pantallas que ya traen su propio shell; evita doble navegación).
 */
export default function SupervisorV2Gate({ active, children, legacy = null, v2Only = false, shell = true }) {
  if (!isV2Active()) {
    if (legacy) return legacy
    if (v2Only) return <Navigate to="/equipo" replace />
    return <Navigate to="/equipo" replace />
  }
  if (!shell) return children
  return <SupervisorV2Shell active={active}>{children}</SupervisorV2Shell>
}
