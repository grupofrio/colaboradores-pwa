// ─── Supervisor V2 · hook de día operativo (fuente ÚNICA compartida) ──────────
// Carga day-control + radar UNA vez y las comparte entre las 6 superficies vía
// una caché en memoria de corta vida (evita refetch al cambiar de pestaña).
// Refresh manual invalida la caché. Demo (fixtures sintéticos) gated a dev.
// El hook es SOLO runtime; las vistas puras se testean con props directas.
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOperationalDay, PHASE } from './dataSources'
import { useSessionScope, registerSessionScopedCache } from '../../../lib/sessionStore.js'

const _usable = (p) => !!p && typeof p === 'object' && p.ok !== false

const CACHE_TTL_MS = 45000
let _cache = null // { key, at, promise }

// Clave de caché CANÓNICA (Codex §5/§6): identidad de sesión (snapshot reactivo) +
// fecha. Nunca solo `day:${date}` (dos supervisores/sucursales compartirían caché).
function cacheKey(scopeKey, date) {
  return `day:${scopeKey}:${date || 'today'}`
}

// Invalidación de la caché de day-control. Codex §5: se CONECTA al ciclo real de
// sesión vía sessionStore (abajo) ⇒ al cambiar identidad/logout/expiración se
// limpia automáticamente, no solo tras publish.
export function invalidateOperationalDayCacheForSessionChange() {
  _cache = null
}
registerSessionScopedCache(invalidateOperationalDayCacheForSessionChange)

async function demoLoad() {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    if (mod?.demoAvailable && typeof mod.loadSupervisorV2Demo === 'function') {
      const demo = await mod.loadSupervisorV2Demo()
      if (demo && _usable(demo.dayControl)) {
        return { ok: true, dayControl: demo.dayControl, radar: _usable(demo.radar) ? demo.radar : null, radarError: null, error: null, source: 'demo', provenance: demo.provenance || null }
      }
    }
  } catch { /* stub en prod ⇒ sin demo */ }
  return null
}

/**
 * @param {{date?:string, demoEnabled?:boolean, nowMs?:number}} opts
 * @returns {{status, dayControl, radar, radarError, error, source, provenance, reload, nowMs}}
 */
export function useOperationalDay({ date = null, demoEnabled = false } = {}) {
  // §2/§3: snapshot REACTIVO de scope. Al cambiar sesión/token/empleado/sucursal/
  // company, `scope.scopeKey` cambia ⇒ `run` es nuevo ⇒ el efecto re-corre:
  // limpia el estado visible anterior, la caché ya fue invalidada por el store, y
  // se hace refetch del nuevo scope (la respuesta anterior no escribe, ver reqSeq).
  const scope = useSessionScope()
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const nowRef = useRef(Date.now())
  const reqSeq = useRef(0) // request-id monotónico: solo el más reciente escribe

  const run = useCallback(async (force) => {
    const key = cacheKey(scope.scopeKey, date)
    nowRef.current = Date.now()
    if (!force && _cache && _cache.key === key && (nowRef.current - _cache.at) < CACHE_TTL_MS) {
      return _cache.promise
    }
    const promise = (async () => {
      const live = await loadOperationalDay({ date })
      if (live.ok) return { ...live, status: 'live', source: 'live', provenance: null }
      // DATE_NOT_ALLOWED es estado PROPIO: no cae a demo ni a fecha anterior.
      if (live.phase === PHASE.DATE_NOT_ALLOWED) {
        return { ...live, status: 'date_not_allowed', source: null, provenance: null }
      }
      if (demoEnabled) {
        const demo = await demoLoad()
        if (demo) return { ...demo, status: 'demo' }
      }
      return { ...live, status: 'error', source: null, provenance: null }
    })()
    _cache = { key, at: nowRef.current, promise }
    return promise
  }, [date, demoEnabled, scope.scopeKey])

  useEffect(() => {
    const myReq = (reqSeq.current += 1)
    setState({ status: 'loading' })
    // Solo la petición MÁS RECIENTE puede escribir el estado: una respuesta
    // anterior (de otra fecha/identidad, o de una recarga superada) jamás pinta
    // encima de datos más nuevos. Codex §5/§6.
    run(attempt > 0)
      .then((res) => { if (reqSeq.current === myReq) setState(res) })
      .catch((e) => { if (reqSeq.current === myReq) setState({ status: 'error', error: e?.message || 'Error inesperado.' }) })
  }, [run, attempt])

  const reload = useCallback(() => { _cache = null; setAttempt((n) => n + 1) }, [])
  return { ...state, reload, nowMs: nowRef.current, scopeKey: scope.scopeKey }
}
