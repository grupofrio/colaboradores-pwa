// ─── Supervisor V2 · hook de día operativo (fuente ÚNICA compartida) ──────────
// Carga day-control + radar UNA vez y las comparte entre las 6 superficies vía
// una caché en memoria de corta vida (evita refetch al cambiar de pestaña).
// Refresh manual invalida la caché. Demo (fixtures sintéticos) gated a dev.
// El hook es SOLO runtime; las vistas puras se testean con props directas.
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOperationalDay, usable } from './dataSources'

const CACHE_TTL_MS = 45000
let _cache = null // { key, at, promise }

function cacheKey(date) {
  return `day:${date || 'today'}`
}

async function demoLoad() {
  try {
    const mod = await import('virtual:supervisor-v2-demo')
    if (mod?.demoAvailable && typeof mod.loadSupervisorV2Demo === 'function') {
      const demo = await mod.loadSupervisorV2Demo()
      if (demo && usable(demo.dayControl)) {
        return { ok: true, dayControl: demo.dayControl, radar: usable(demo.radar) ? demo.radar : null, radarError: null, error: null, source: 'demo', provenance: demo.provenance || null }
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
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const nowRef = useRef(Date.now())

  const run = useCallback(async (force) => {
    const key = cacheKey(date)
    nowRef.current = Date.now()
    if (!force && _cache && _cache.key === key && (nowRef.current - _cache.at) < CACHE_TTL_MS) {
      return _cache.promise
    }
    const promise = (async () => {
      const live = await loadOperationalDay({ date })
      if (live.ok) return { ...live, status: 'live', source: 'live', provenance: null }
      if (demoEnabled) {
        const demo = await demoLoad()
        if (demo) return { ...demo, status: 'demo' }
      }
      return { ...live, status: 'error', source: null, provenance: null }
    })()
    _cache = { key, at: nowRef.current, promise }
    return promise
  }, [date, demoEnabled])

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    run(attempt > 0).then((res) => { if (!cancelled) setState(res) })
      .catch((e) => { if (!cancelled) setState({ status: 'error', error: e?.message || 'Error inesperado.' }) })
    return () => { cancelled = true }
  }, [run, attempt])

  const reload = useCallback(() => { _cache = null; setAttempt((n) => n + 1) }, [])
  return { ...state, reload, nowMs: nowRef.current }
}
