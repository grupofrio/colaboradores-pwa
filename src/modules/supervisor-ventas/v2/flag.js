// ─── Supervisor V2 · feature flag (fail-closed, global + sucursal) ────────────
// La experiencia V2 (shell de 6 superficies) SOLO se habilita si AMBOS flags
// están activos: global (config de plataforma) Y sucursal (branch config). Si
// falta cualquiera, o el estado es desconocido, se cae a la experiencia legacy
// (fail-closed). Núcleo PURO + lector runtime (con override explícito solo en
// dev para poder construir/QA sin backend desplegado).

/**
 * Núcleo PURO — decide V2 vs legacy. Fail-closed: ambos deben ser === true.
 * @param {{globalEnabled?:*, branchEnabled?:*, devOverride?:boolean, isDev?:boolean}} p
 * @returns {{enabled:boolean, source:'both'|'dev-override'|'global-off'|'branch-off'|'unknown'}}
 */
export function computeSupervisorV2Flag({ globalEnabled, branchEnabled, devOverride = false, isDev = false } = {}) {
  if (isDev && devOverride === true) return { enabled: true, source: 'dev-override' }
  if (globalEnabled !== true && branchEnabled !== true) return { enabled: false, source: 'unknown' }
  if (globalEnabled !== true) return { enabled: false, source: 'global-off' }
  if (branchEnabled !== true) return { enabled: false, source: 'branch-off' }
  return { enabled: true, source: 'both' }
}

/**
 * Lee los flags desde una sesión/capabilities ya cargadas (sin efectos).
 * global: `capabilities.supervisorV2` (config de plataforma).
 * branch: `session.branch.supervisor_v2_enabled` (branch config server-side).
 */
export function readSupervisorV2FlagFrom(session = {}, capabilities = {}, { devOverride = false, isDev = false } = {}) {
  return computeSupervisorV2Flag({
    globalEnabled: capabilities?.supervisorV2 === true,
    branchEnabled: session?.branch?.supervisor_v2_enabled === true,
    devOverride,
    isDev,
  })
}

// Lector runtime: en dev permite override por localStorage (`supervisor_v2=1`)
// para construir/QA sin backend. En prod SOLO manda el server (fail-closed).
export function readSupervisorV2FlagRuntime(session = {}, capabilities = {}) {
  let isDev = false
  let devOverride = false
  try {
    isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true
    if (isDev && typeof localStorage !== 'undefined') {
      devOverride = localStorage.getItem('supervisor_v2') === '1'
    }
  } catch {
    isDev = false
  }
  return readSupervisorV2FlagFrom(session, capabilities, { devOverride, isDev })
}
