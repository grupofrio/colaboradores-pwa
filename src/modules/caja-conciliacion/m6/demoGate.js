// ─── KOLD OS · M6 — Gate del modo demo (JAMÁS en producción) ─────────────────
// El demo (?demo=1 con el fixture emitido por el core real del backend M6 local)
// SOLO existe cuando:
//   · build de desarrollo (import.meta.env.DEV === true), o
//   · Preview explícitamente autorizado vía VITE_ENABLE_M6_DEMO === 'true'
//     (variable de Vercel SOLO en Preview; producción no la define).
// En producción el parámetro ?demo=1 se IGNORA por completo: el gate corta el
// código (no es un enlace oculto) y hay test de que niega en build productivo.
//
// Esto importa MÁS en M6 que en cualquier otro módulo: el backend NO existe
// desplegado todavía, así que la única fuente de datos hoy es el fixture. Si el
// gate fallara, producción mostraría cifras de un demo como si fueran su estado
// financiero. Producción sin backend debe decir `unavailable`, nunca demo.

export function isM6DemoAllowed(env) {
  if (!env || typeof env !== 'object') return false
  if (env.DEV === true) return true
  return env.VITE_ENABLE_M6_DEMO === 'true'
}
