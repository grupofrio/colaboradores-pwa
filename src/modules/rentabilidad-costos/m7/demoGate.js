// ─── KOLD OS · M7 — Gate del modo demo (JAMÁS en producción real) ────────────
//
// Codex (auditoría final) clasificó como MAJOR que el fixture financiero agregado
// pudiera viajar en el bundle productivo y que `VITE_ENABLE_M7_DEMO='true'`
// bastara por sí solo aunque el entorno fuera producción. Dos defensas:
//   1) BUNDLING — el fixture se carga por `virtual:m7-demo-fixture`, que en build
//      de producción resuelve a un stub SIN el fixture (ver demoFixtureLoader.*),
//      igual que M4. `scripts/check_m7_demo_bundle.mjs` lo verifica sobre dist/.
//   2) GATE — `canLoadM7DemoFixture` es fail-closed: producción real NUNCA, aunque
//      el flag esté encendido; sólo DEV local o Preview EXPLÍCITO de Vercel.
//
// El backend M7 NO está desplegado (PR #211 temporal pre-migración). Sin este gate
// producción mostraría cifras de un demo como su estado económico. Producción sin
// backend debe decir `unavailable`, nunca demo.

function isObj(v) { return v && typeof v === 'object' }

/**
 * ¿Se permite el modo demo (y por tanto cargar el fixture) en ESTE entorno?
 * @param {object} env  import.meta.env (DEV/PROD/VITE_ENABLE_M7_DEMO/VITE_VERCEL_ENV)
 * @param {object} ctx  { authorized?: bool, vercelEnv?: string } — overridable en tests
 * Reglas (fail-closed):
 *   · usuario NO autorizado                     ⇒ jamás.
 *   · VERCEL_ENV === 'production' (prod real)   ⇒ jamás, aunque el flag esté ON.
 *   · DEV local (import.meta.env.DEV)            ⇒ permitido.
 *   · build PROD:  sólo si VERCEL_ENV==='preview' Y el flag está ON.
 *   · cualquier otro caso                        ⇒ negado.
 */
export function canLoadM7DemoFixture(env, ctx = {}) {
  if (!isObj(env)) return false
  if (ctx.authorized === false) return false
  const vercelEnv = String(ctx.vercelEnv ?? env.VITE_VERCEL_ENV ?? '')
  const flag = env.VITE_ENABLE_M7_DEMO === 'true'
  if (vercelEnv === 'production') return false          // producción real: NUNCA
  if (env.DEV === true) return true                      // desarrollo local
  if (env.PROD === true) return vercelEnv === 'preview' && flag  // sólo Preview + flag
  return false                                           // fail-closed
}

/**
 * Compat: la pantalla llamaba isM7DemoAllowed(env). Se mantiene como envoltura
 * fina de canLoadM7DemoFixture (sin contexto de acceso: la pantalla ya vive tras
 * el route guard direccion_general). Producción real sigue negada.
 */
export function isM7DemoAllowed(env, ctx = {}) {
  return canLoadM7DemoFixture(env, ctx)
}
