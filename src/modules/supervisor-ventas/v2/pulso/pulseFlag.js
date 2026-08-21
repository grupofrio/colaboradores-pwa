/**
 * Dark-launch gate for Supervisor Pulso Comercial.
 *
 * The values passed here are the server-authenticated sign-in projection. There
 * is deliberately no runtime or persistent client override.
 */
export function computePulseFlag({ globalEnabled, branchEnabled } = {}) {
  if (globalEnabled !== true && branchEnabled !== true) {
    return { enabled: false, source: 'unknown' }
  }
  if (globalEnabled !== true) return { enabled: false, source: 'global-off' }
  if (branchEnabled !== true) return { enabled: false, source: 'branch-off' }
  return { enabled: true, source: 'both' }
}

export function readPulseFlagFrom(session = {}, capabilities = {}) {
  return computePulseFlag({
    globalEnabled: capabilities?.supervisorPulse === true,
    branchEnabled: session?.branch?.supervisor_pulse_enabled === true,
  })
}
