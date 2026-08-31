/**
 * Limpia Service Workers y Cache Storage legado.
 *
 * Contexto (piloto Gerente V2, 2026-08-19):
 * VitePWA corre con `selfDestroying: true`, pero un SW *viejo* que aún controla
 * la página puede seguir sirviendo HTML/JS cacheado. El bootstrap nuevo (con
 * este reset) solo corre si el navegador ya cargó el entrypoint fresco — hay
 * un chicken-and-egg. Por eso:
 *  1) update + SKIP_WAITING + unregister + delete caches al boot;
 *  2) si el buildId cambió vs localStorage, un reload one-shot tras limpiar
 *     (sessionStorage evita loops);
 *  3) headers no-store en index.html/sw.js (vercel.json) reducen HTML stale.
 *
 * Cambios de schema de sesión (p.ej. nuevas keys gerenteV2) siguen requiriendo
 * un login natural: no reescribimos gf_session aquí.
 */
export async function resetLegacyPwaState(runtime = globalThis, { buildId } = {}) {
  const registrations = await runtime?.navigator?.serviceWorker?.getRegistrations?.().catch(() => []) || []
  await Promise.allSettled(registrations.map(async (registration) => {
    try {
      await registration?.update?.()
    } catch {
      // A controlling SW from an older bundle may reject update(); still unregister.
    }
    const waiting = registration?.waiting
    if (waiting && typeof waiting.postMessage === 'function') {
      waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    return registration?.unregister?.()
  }))

  const cacheKeys = await runtime?.caches?.keys?.().catch(() => []) || []
  await Promise.allSettled(cacheKeys.map((key) => runtime.caches.delete(key)))

  const id = typeof buildId === 'string' ? buildId.trim() : ''
  if (!id) return { reloaded: false }

  const storage = runtime?.localStorage
  const session = runtime?.sessionStorage
  if (!storage?.getItem || !storage?.setItem) return { reloaded: false }

  const stampKey = 'gf_pwa_build_id'
  const reloadKey = 'gf_pwa_build_reload'
  const previous = String(storage.getItem(stampKey) || '')
  if (previous === id) return { reloaded: false }

  storage.setItem(stampKey, id)
  // One-shot reload after a build change so the next navigation fetches fresh
  // index.html (must-revalidate / no-store) instead of a controlling SW shell.
  if (session?.getItem?.(reloadKey) === id) return { reloaded: false }
  try {
    session?.setItem?.(reloadKey, id)
  } catch {
    // sessionStorage may be unavailable (privacy mode); skip reload rather than throw.
    return { reloaded: false }
  }
  if (typeof runtime?.location?.reload === 'function') {
    runtime.location.reload()
    return { reloaded: true }
  }
  return { reloaded: false }
}
