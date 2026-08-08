// ─── useM1BacklogQuery — carga PARAMETRIZADA del backlog M1 ──────────────────
// NO reconstruye el fetch: usa las mismas piezas que ya existen para Tower M1
// (`api` + `TOWER_M1_BACKLOG_PATH` + `buildBacklogQuery` + `normalizePayload` +
// `classifyError` + `withTimeout`). Lo único que agrega es poder cambiar
// filtros/offset, que es lo que `useM1Backlog` (el de Pendientes) no hace
// porque allá las dos consultas son fijas.
//
// POR QUE UN HOOK APARTE Y NO REFACTORIZAR LA PANTALLA CRUDA: la cruda es la de
// dirección y el encargo pide dejarla intacta. Consolidar su cargador con este
// hook es una limpieza posterior, no algo que valga la pena arriesgar en el
// mismo PR que estrena la vista del supervisor.
//
// SOLO LECTURA. `supervisor_writes_enabled` está en false: cualquier escritura
// devolvería 403 y aquí no hay ninguna.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { TOWER_M1_BACKLOG_PATH } from '../../../lib/towerM1Route'
import {
  buildBacklogQuery, classifyError, isM1BacklogPayload, normalizePayload,
  toQueryString, withTimeout,
} from './m1BacklogModel'

/**
 * @returns {{phase, data, error, filters, offset, setFilter, goOffset, reload}}
 *   phase: 'loading' | 'success' | 'empty' | 'feature_disabled' |
 *          'no_branch_scope' | 'forbidden' | 'session_expired' | 'error'
 */
export function useM1BacklogQuery(role, initialFilters) {
  const [filters, setFilters] = useState(() => ({ ...initialFilters }))
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // "Última petición gana": cambiar un filtro rápido no puede dejar pintada la
  // respuesta de un filtro anterior.
  const seq = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const load = useCallback(async (nextFilters, nextOffset) => {
    const id = ++seq.current
    setPhase('loading')
    setError(null)
    try {
      const query = buildBacklogQuery(nextFilters, nextOffset, role)
      const payload = await withTimeout(
        api('GET', `${TOWER_M1_BACKLOG_PATH}${toQueryString(query)}`),
      )
      if (id !== seq.current || !alive.current) return
      if (!isM1BacklogPayload(payload)) {
        setError({ state: 'error', retryable: true, code: 'malformed' })
        setPhase('error')
        return
      }
      const normalized = normalizePayload(payload, role)
      setData(normalized)
      setPhase(normalized.status)   // success | empty
    } catch (err) {
      if (id !== seq.current || !alive.current) return
      const info = classifyError(err)
      setError(info)
      setPhase(info.state)
    }
  }, [role])

  useEffect(() => { load({ ...initialFilters }, 0) }, [load])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiar cualquier filtro reinicia el offset: es la regla del contrato de UI
  // y evita quedarse en la página 3 de un resultado que ahora tiene una.
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      setOffset(0)
      load(next, 0)
      return next
    })
  }, [load])

  // Fija VARIOS filtros con una sola carga. Existe porque hay ejes que se
  // contradicen y hay que moverlos juntos: p.ej. el rango de semana y la
  // antigüedad (>7 días) no pueden convivir, así que elegir uno debe limpiar el
  // otro EN LA MISMA petición — con setFilter en cadena se dispararían dos cargas
  // y la primera dejaría un estado incoherente pintado un instante.
  const patchFilters = useCallback((delta) => {
    setFilters((prev) => {
      const next = { ...prev, ...(delta || {}) }
      setOffset(0)
      load(next, 0)
      return next
    })
  }, [load])

  const goOffset = useCallback((next) => {
    setOffset(next)
    load(filters, next)
  }, [filters, load])

  const reload = useCallback(() => load(filters, offset), [filters, offset, load])

  return { phase, data, error, filters, offset, setFilter, goOffset, reload }
}
