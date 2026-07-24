// ─── KOLD OS · M4 — Gate del modo demo (JAMÁS en producción) ─────────────────
// El demo (?demo=1 con fixture emitido por el core real del backend del
// PR #205) SOLO existe en desarrollo (import.meta.env.DEV === true). Preview y
// producción resuelven un loader vacío en build-time, así que el fixture ni
// siquiera forma parte de sus assets públicos.

export function isM4DemoAllowed(env) {
  if (!env || typeof env !== 'object') return false
  return env.DEV === true
}
