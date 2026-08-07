// ─── KOLD OS · M2 — Gate del modo demo (B2: JAMÁS en producción) ─────────────
// El demo (?demo=1 con fixture generado por código real) SOLO existe cuando:
//   · build de desarrollo (import.meta.env.DEV === true), o
//   · Preview explícitamente autorizado vía VITE_ENABLE_M2_DEMO === 'true'
//     (variable de entorno de Vercel SOLO en Preview; producción no la define).
// En producción el parámetro ?demo=1 se IGNORA por completo (no es un enlace
// oculto: el gate corta el código, y hay test de que el gate niega en prod).

export function isM2DemoAllowed(env) {
  if (!env || typeof env !== 'object') return false
  if (env.DEV === true) return true
  return env.VITE_ENABLE_M2_DEMO === 'true'
}
