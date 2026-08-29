export const PWA_CACHE_PREFIX = 'gf-colaboradores-pwa'
export const PWA_CACHE_VERSION = 'v3'
export const PWA_CACHE_ID = `${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`
export const STALE_CHUNK_RELOAD_KEY = 'gf_pwa_stale_chunk_reload'

export function isCurrentPwaCacheName(name, cacheId = PWA_CACHE_ID) {
  const value = String(name || '')
  return value === cacheId || value.startsWith(`${cacheId}-`)
}

export function obsoleteCacheNames(names = [], cacheId = PWA_CACHE_ID) {
  return (Array.isArray(names) ? names : []).filter((name) => {
    const value = String(name || '')
    if (!value) return false
    if (isCurrentPwaCacheName(value, cacheId)) return false
    return (
      value.startsWith('workbox-')
      || value.startsWith(PWA_CACHE_PREFIX)
      || value.startsWith('vite-')
      || value.includes('precache')
      || value.includes('runtime')
    )
  })
}

export async function activatePwaCaches(runtime = globalThis, { cacheId = PWA_CACHE_ID } = {}) {
  const keys = await runtime?.caches?.keys?.().catch(() => []) || []
  const obsolete = obsoleteCacheNames(keys, cacheId)
  await Promise.allSettled(obsolete.map((name) => runtime.caches.delete(name)))
  if (typeof runtime?.clients?.claim === 'function') {
    await runtime.clients.claim()
  }
  return { deleted: obsolete }
}

export async function takeControlOfServiceWorkers(runtime = globalThis) {
  const registrations = await runtime?.navigator?.serviceWorker?.getRegistrations?.().catch(() => []) || []
  await Promise.allSettled(registrations.map(async (registration) => {
    try {
      await registration?.update?.()
    } catch {
      // ignore update failures; activate/claim still proceeds
    }
    const waiting = registration?.waiting
    if (waiting && typeof waiting.postMessage === 'function') {
      waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }))
  return registrations.length
}

export function isStaleChunkError(error) {
  const msg = String(error?.message || error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)
}

export function reloadOnceForStaleChunk(runtime = globalThis, error) {
  if (!isStaleChunkError(error)) return false
  const session = runtime?.sessionStorage
  if (session?.getItem?.(STALE_CHUNK_RELOAD_KEY) === '1') return false
  try {
    session?.setItem?.(STALE_CHUNK_RELOAD_KEY, '1')
  } catch {
    return false
  }
  if (typeof runtime?.location?.reload === 'function') {
    runtime.location.reload()
    return true
  }
  return false
}
