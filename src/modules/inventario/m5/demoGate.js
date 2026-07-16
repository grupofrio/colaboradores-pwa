// ─── KOLD OS · M5 — Gate del modo demo (JAMÁS en producción) ─────────────────
// El demo (?demo=1 con fixture emitido por el core real del backend del
// PR #205) SOLO existe cuando:
//   · build de desarrollo (import.meta.env.DEV === true), o
//   · Preview explícitamente autorizado vía VITE_ENABLE_M5_DEMO === 'true'
//     (variable de Vercel SOLO en Preview; producción no la define).
// En producción el parámetro ?demo=1 se IGNORA por completo (gate de código,
// no un enlace oculto; hay test de que el gate niega en build productivo).

export function isM5DemoAllowed(env) {
  if (!env || typeof env !== 'object') return false
  if (env.DEV === true) return true
  return env.VITE_ENABLE_M5_DEMO === 'true'
}
