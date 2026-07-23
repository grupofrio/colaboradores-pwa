// ─── sessionStore — capa REACTIVA de scope de sesión (Codex §2/§3/§5) ─────────
// NO es un segundo store de sesión: la AUTORIDAD sigue siendo el estado `session`
// de App.jsx (persistido en localStorage `gf_session`). Este módulo expone un
// SNAPSHOT reactivo (useSyncExternalStore) derivado de esa autoridad + una versión
// monotónica `sessionVersion` que bumpea SOLO cuando cambia la identidad efectiva
// (login / logout / token-sesión / empleado / sucursal / company). Los hooks de
// datos dependen de este snapshot para: limpiar el estado visible de la identidad
// anterior, invalidar cachés dependientes, incrementar la generación de request y
// refetch — sin depender de una lectura imperativa aislada de sessionScopeKey().
import { useSyncExternalStore } from 'react'
import { sessionScopeKey, sessionScopeFields } from '../modules/supervisor-ventas/v2/sessionScope.js'

const listeners = new Set()
const scopedCaches = new Set()
let _version = 0

function build() {
  return { sessionVersion: _version, scopeKey: sessionScopeKey(), ...sessionScopeFields() }
}

let _snapshot = build()

// Recalcula el snapshot; si la identidad (scopeKey) cambió: bumpea la versión,
// invalida cachés dependientes y notifica a los suscriptores (re-render de hooks).
function recompute() {
  const nextKey = sessionScopeKey()
  if (nextKey !== _snapshot.scopeKey) {
    _version += 1
    _snapshot = build()
    invalidateSessionScopedCaches() // §5: al cambiar identidad, cachés por sesión fuera
    listeners.forEach((l) => { try { l() } catch { /* noop */ } })
  }
}

export function getSessionScopeSnapshot() {
  return _snapshot
}

function subscribe(cb) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Hook reactivo: devuelve el snapshot de scope (estable entre cambios). */
export function useSessionScope() {
  return useSyncExternalStore(subscribe, getSessionScopeSnapshot, getSessionScopeSnapshot)
}

/** La autoridad (App.jsx) llama a esto al cambiar la sesión en la MISMA pestaña
 *  (los localStorage writes de la misma pestaña no disparan `storage`). */
export function notifySessionChanged() {
  recompute()
}

// ── cachés dependientes de la sesión (§5) ────────────────────────────────────
/** Registra un invalidador (p.ej. limpiar day-control/route-stops). Devuelve el
 *  de-registro. Se ejecuta al cambiar identidad y en sesión expirada. */
export function registerSessionScopedCache(invalidateFn) {
  if (typeof invalidateFn === 'function') scopedCaches.add(invalidateFn)
  return () => { scopedCaches.delete(invalidateFn) }
}

export function invalidateSessionScopedCaches() {
  scopedCaches.forEach((fn) => { try { fn() } catch { /* noop */ } })
}

// Conexión al CICLO REAL de sesión de la app (login/logout/expiración/multi-tab).
if (typeof window !== 'undefined') {
  window.addEventListener('gf:session-changed', recompute)
  window.addEventListener('gf:session-expired', () => { invalidateSessionScopedCaches(); recompute() })
  window.addEventListener('storage', (e) => { if (e.key === 'gf_session') recompute() })
}
