// ─── Orden de la portada del supervisor de ventas ────────────────────────────
// La portada salía en el orden de DECLARACIÓN del registry, que agrupa primero
// los módulos de rol `*` (KPIs, Encuestas, Premios) y deja al final los del
// puesto. Resultado: lo secundario arriba y el trabajo diario abajo.
//
// POR QUÉ UN ORDEN EXPLÍCITO Y NO ORDENAR EL HOME POR `navPriority`:
// lo medí. Ordenar el home global por navPriority cambia el orden a CUATRO
// roles, entre ellos `direccion_general`, que pasaría de 10 tarjetas en un
// orden a otro completamente distinto. Nadie pidió eso y nadie lo iba a
// revisar. Este orden vive aquí, aplica solo a esta portada, y se lee de un
// vistazo.
//
// Tampoco se toca `navPriority` en el registry: ese campo ordena la navegación
// de TODOS los roles que ven el módulo (el brief lo ven supervisión y
// dirección), así que moverlo para acomodar una portada arrastra la barra de
// otra gente.
export const SUPERVISOR_HOME_ORDER = Object.freeze([
  'supervisor_ventas',  // Equipo — su gente y sus rutas
  'brief_dia',          // Mi Brief del día — con qué arranca la mañana
  'torre_operativa',    // Torre — envejecimiento y caja atada
  'kpis',
  'encuestas',
  'logros',             // Premios
])

/**
 * Ordena los módulos de la portada. Lo que no esté en la lista NO se pierde:
 * se va al final conservando su orden relativo, para que un módulo nuevo
 * aparezca aunque nadie se acuerde de agregarlo aquí.
 */
export function orderSupervisorHomeModules(modules) {
  const list = Array.isArray(modules) ? modules : []
  const rank = new Map(SUPERVISOR_HOME_ORDER.map((id, i) => [id, i]))
  const fallback = SUPERVISOR_HOME_ORDER.length
  return list
    .map((module, i) => ({ module, i, rank: rank.has(module?.id) ? rank.get(module.id) : fallback }))
    .sort((a, b) => (a.rank - b.rank) || (a.i - b.i))
    .map((x) => x.module)
}
