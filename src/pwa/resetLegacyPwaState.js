export async function resetLegacyPwaState(runtime = globalThis) {
  const registrations = await runtime?.navigator?.serviceWorker?.getRegistrations?.().catch(() => []) || []
  await Promise.allSettled(registrations.map((registration) => registration?.unregister?.()))

  const cacheKeys = await runtime?.caches?.keys?.().catch(() => []) || []
  await Promise.allSettled(cacheKeys.map((key) => runtime.caches.delete(key)))
}
