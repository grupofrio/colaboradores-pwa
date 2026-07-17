// ─── KOLD OS · M7 — Gate del modo demo (JAMÁS en producción) ─────────────────
// El demo (?demo=1 con el fixture emitido por el core real del backend M7 #211)
// SÓLO existe cuando:
//   · build de desarrollo (import.meta.env.DEV === true), o
//   · Preview autorizado vía VITE_ENABLE_M7_DEMO === 'true'.
// En producción ?demo=1 se IGNORA por completo: el gate corta el código y hay
// test de que niega en build productivo.
//
// El backend M7 NO está desplegado (PR #211 temporal pre-migración). Si el gate
// fallara, producción mostraría cifras de un demo como su estado económico.
// Producción sin backend debe decir `unavailable`, nunca demo.

export function isM7DemoAllowed(env) {
  if (!env || typeof env !== 'object') return false
  if (env.DEV === true) return true
  return env.VITE_ENABLE_M7_DEMO === 'true'
}
