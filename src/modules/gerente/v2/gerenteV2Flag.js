// ─── Gerente V2 · feature flag (fail-closed, global + sucursal) ──────────────
// La experiencia "Mi Sucursal" (shell de 6 pestañas) SOLO se habilita si AMBOS
// flags están activos: global (config de plataforma) Y sucursal (branch config).
// Si falta cualquiera, o el estado es desconocido, se cae al hub legacy de 5
// botones (fail-closed). Mismo patrón que el flag del supervisor.
//
// POR QUÉ DETRÁS DE FLAG: la tarea pide reemplazar el hub, pero en modo nocturno
// nada se enciende. Con el flag apagado (default), `/gerente` sigue mostrando el
// hub actual byte a byte; mergear no cambia producción. Encender la experiencia
// V2 es una decisión de dirección en la mañana.

/**
 * Núcleo PURO — decide V2 vs hub legacy. Fail-closed: ambos deben ser === true.
 * @returns {{enabled:boolean, source:'both'|'dev-override'|'global-off'|'branch-off'|'unknown'}}
 */
export function computeGerenteV2Flag({ globalEnabled, branchEnabled, devOverride = false, isDev = false } = {}) {
  if (isDev && devOverride === true) return { enabled: true, source: 'dev-override' }
  if (globalEnabled !== true && branchEnabled !== true) return { enabled: false, source: 'unknown' }
  if (globalEnabled !== true) return { enabled: false, source: 'global-off' }
  if (branchEnabled !== true) return { enabled: false, source: 'branch-off' }
  return { enabled: true, source: 'both' }
}

/**
 * Lee los flags desde una sesión/capabilities ya cargadas (sin efectos).
 * global: `capabilities.gerenteV2` (config de plataforma).
 * branch: `session.branch.gerente_v2_enabled` (branch config server-side, el
 *         MISMO campo que gatea los endpoints del gerente en Odoo).
 */
export function readGerenteV2FlagFrom(session = {}, capabilities = {}, { devOverride = false, isDev = false } = {}) {
  return computeGerenteV2Flag({
    globalEnabled: capabilities?.gerenteV2 === true,
    branchEnabled: session?.branch?.gerente_v2_enabled === true,
    devOverride,
    isDev,
  })
}

// Lector runtime: en dev permite override por localStorage (`gerente_v2=1`) para
// construir/QA sin backend. En prod SOLO manda el server (fail-closed).
export function readGerenteV2FlagRuntime(session = {}, capabilities = {}) {
  let isDev = false
  let devOverride = false
  try {
    isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true
    if (isDev && typeof localStorage !== 'undefined') {
      devOverride = localStorage.getItem('gerente_v2') === '1'
    }
  } catch {
    isDev = false
  }
  return readGerenteV2FlagFrom(session, capabilities, { devOverride, isDev })
}

/** Fuente única para decidir si "Mi Sucursal" está activa (fail-closed). */
export function isGerenteV2Active(session = {}) {
  const capabilities = session?.capabilities || {}
  return readGerenteV2FlagRuntime(session, capabilities).enabled
}
