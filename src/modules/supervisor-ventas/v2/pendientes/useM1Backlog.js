// ─── useM1Backlog — carga del backlog M1 para la superficie "Pendientes" ─────
// REUTILIZA el cliente y la normalización que ya existen para Tower M1
// (`lib/towerM1Route` + `torre/m1/m1BacklogModel`): aquí NO se reconstruye el
// fetch, ni se re-clasifican buckets, ni se reinventan los estados de error.
//
// DOS consultas, read-only, ambas por el mismo cliente:
//   A. state_bucket=open, sort=age_days, limit=200 → KPIs autoritativos + filas.
//   B. close_candidate=1 → las candidatas EXACTAS.
// La B existe porque el endpoint topa en 200 filas (MAX_LIMIT) y hoy hay 214
// abiertas: filtrar las candidatas desde la página A podría perder alguna. Los
// conteos de arriba salen de los KPIs (search_count sobre todo el scope), nunca
// de contar filas paginadas.
//
// SOLO LECTURA: ni esta capa ni la vista ejecutan acciones. `supervisor_writes_
// enabled` está en false y cualquier intento devolvería 403.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../../lib/api'
import { TOWER_M1_BACKLOG_PATH } from '../../../../lib/towerM1Route'
import {
  classifyError, normalizePayload, toQueryString, withTimeout,
} from '../../../torre/m1/m1BacklogModel'
import { buildM1Accommodation } from './m1Accommodation.js'

// Tope del contrato (MAX_LIMIT del servicio). Pedir más no trae más.
const PAGE_LIMIT = 200
const ROLE = 'supervisor_ventas'

function query(extra) {
  return toQueryString({
    state_bucket: 'open',
    sort: 'age_days',
    limit: PAGE_LIMIT,
    offset: 0,
    ...extra,
  })
}

/**
 * @returns {{status, accommodation, error, reload}}
 *   status: 'loading' | 'ok' | 'empty' | 'feature_disabled' | 'no_branch_scope'
 *         | 'forbidden' | 'session_expired' | 'error'
 */
export function useM1Backlog({ enabled = true } = {}) {
  const [state, setState] = useState({ status: 'loading', accommodation: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'disabled', accommodation: null, error: null })
      return undefined
    }
    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading' }))

    Promise.all([
      withTimeout(api('GET', `${TOWER_M1_BACKLOG_PATH}${query()}`)),
      withTimeout(api('GET', `${TOWER_M1_BACKLOG_PATH}${query({ close_candidate: '1', limit: 50 })}`)),
    ])
      .then(([mainRaw, candRaw]) => {
        if (cancelled || !alive.current) return
        const main = normalizePayload(mainRaw, ROLE)
        const cand = normalizePayload(candRaw, ROLE)
        // Forma inesperada ⇒ se NOMBRA como fallo; jamás se pinta en ceros.
        if (!Array.isArray(main.rows) || !main.kpis?.length) {
          setState({ status: 'error', accommodation: null, error: { code: 'malformed' } })
          return
        }
        const accommodation = buildM1Accommodation(main, cand.rows)
        setState({
          status: main.rows.length === 0 ? 'empty' : 'ok',
          accommodation,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled || !alive.current) return
        const classified = classifyError(err)
        setState({ status: classified.state, accommodation: null, error: classified })
      })

    return () => { cancelled = true }
  }, [enabled, reloadKey])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])
  return { ...state, reload }
}
