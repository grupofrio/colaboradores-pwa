// ─── Supervisor V2 · lectura del flag (compartida, sin JSX) ──────────────────
// isV2Active(): fuente única para decidir si la experiencia V2 está activa
// (fail-closed). En .js (no .jsx) para que los componentes que la importan solo
// exporten componentes (regla react-refresh).
import { getSession } from '../../../lib/api.js'
import { readSupervisorV2FlagRuntime } from './flag.js'

export function isV2Active() {
  let session = {}
  try { session = getSession() || {} } catch { session = {} }
  const capabilities = session.capabilities || {}
  return readSupervisorV2FlagRuntime(session, capabilities).enabled
}
