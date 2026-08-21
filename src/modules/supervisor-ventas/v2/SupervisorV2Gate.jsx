// ─── Supervisor V2 · gate del feature flag (fail-closed) ─────────────────────
// Decide, por ruta, si se monta la EXPERIENCIA V2 (shell) o la LEGACY. Fail-closed:
// sin flag global+sucursal (o desconocido) ⇒ legacy. `v2Only` = ruta que no existe
// en legacy ⇒ redirect seguro a /equipo. El rol ya lo impuso ModuleRoleRoute.
//
// ALCANCE DEL FLAG (decisión contractual). El flag gobierna la EXPERIENCIA, no el
// namespace técnico del endpoint. `/v2/` en una URL es la versión del CONTRATO de
// API, no una marca de "superficie V2".
//
//   `supervisorExperienceV2Enabled` = true  ⇒ monta SupervisorV2Shell; habilita
//     las rutas V2 según rol/flags.
//   `supervisorExperienceV2Enabled` = false ⇒ monta ÚNICAMENTE la experiencia
//     legacy (ScreenSupervisorOperationsEntry) y, dentro de ella:
//       · NO se monta ningún componente de la rama V2 (`v2OnlySurface`);
//       · NO se ejecutan efectos ni writes exclusivos de V2;
//       · NO se habilitan rutas V2-only (redirect a /equipo);
//       · SÍ puede consumir lecturas COMPARTIDAS y seguras — hoy
//         `sharedDayControlRead` (day-control read-only, guardado y scoped por el
//         backend, sujeto a sus propios flags de lectura). Esa es la MISMA fuente
//         de verdad que usa V2: no se duplica el datasource ni las reglas.
//   Flag ausente / parcial (global ON + sucursal OFF) / sesión inválida ⇒ mismos
//   límites que OFF (fail-closed).
//
// Invariante verificable: "cero montaje de rama V2 · cero efectos V2-only · cero
// writes V2 · cero navegación a rutas V2-only" — NO "cero fetch a URLs /v2/*".
import { Navigate } from 'react-router-dom'
import { isV2Active } from './gateAccess.js'
import SupervisorV2Shell from './SupervisorV2Shell.jsx'

/**
 * Decide UNA sola experiencia; NUNCA monta ambas (los `return` son excluyentes).
 * No es una capa de autorización: el rol lo impone ModuleRoleRoute y la autoridad
 * de seguridad sigue siendo el guard + rol + flags del backend.
 * @param {{active:'pulso'|'hoy'|'radar'|'rutas'|'clientes'|'prospectos'|'pendientes'|'copiloto'|'mas',
 *          children:React.ReactNode, legacy?:React.ReactNode,
 *          v2Only?:boolean, shell?:boolean, pulseEnabled?:boolean}} p
 * legacy: elemento a renderizar si el flag está OFF (p.ej. el entry legacy).
 * v2Only: la ruta no existe en legacy ⇒ redirect seguro a /equipo cuando está OFF.
 * shell:  false ⇒ con V2 ON entrega los children SIN envolver en SupervisorV2Shell
 *         (para pantallas que ya traen su propio shell; evita doble navegación).
 */
export default function SupervisorV2Gate({
  active,
  children,
  legacy = null,
  v2Only = false,
  shell = true,
  pulseEnabled,
}) {
  if (!isV2Active()) {
    if (legacy) return legacy
    if (v2Only) return <Navigate to="/equipo" replace />
    return <Navigate to="/equipo" replace />
  }
  if (!shell) return children
  return <SupervisorV2Shell active={active} pulseEnabled={pulseEnabled}>{children}</SupervisorV2Shell>
}
