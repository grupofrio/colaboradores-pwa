import { useSyncExternalStore } from 'react'

const listeners = new Set()
let revision = 0
let snapshot = { revision }

function emit() {
  revision += 1
  snapshot = { revision }
  listeners.forEach((listener) => {
    try { listener() } catch { /* noop */ }
  })
}

export function notifyBackendCapabilitiesChanged() {
  emit()
}

export function getBackendCapabilitiesSnapshot() {
  return snapshot
}

export function subscribeBackendCapabilities(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useBackendCapabilitiesSnapshot() {
  return useSyncExternalStore(
    subscribeBackendCapabilities,
    getBackendCapabilitiesSnapshot,
    getBackendCapabilitiesSnapshot,
  )
}
