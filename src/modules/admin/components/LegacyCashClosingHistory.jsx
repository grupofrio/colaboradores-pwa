import { useCallback, useEffect, useRef, useState } from 'react'
import { mexicoBusinessDate, validateOperationalHistoryDate } from '../cashShiftHistoryModel.js'

const PAGE_SIZE = 25
const CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
})

async function defaultLoadHistory(input) {
  const { getCashClosingHistory } = await import('../api.js')
  return getCashClosingHistory(input)
}

async function defaultLoadDetail(id) {
  const { getCashClosingDetail } = await import('../api.js')
  return getCashClosingDetail(id)
}

function unwrap(raw) {
  const envelope = raw?.result ?? raw
  if (envelope?.ok === false) throw new Error('legacy_cash_history_rejected')
  return envelope?.data ?? envelope
}

function positiveId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function finite(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function validLegacyRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = positiveId(raw.closing_id)
  if (id === null || typeof raw.date !== 'string' || typeof raw.state !== 'string') return null
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : `Cierre #${id}`,
    date: raw.date,
    state: raw.state,
    difference: finite(raw.difference),
  }
}

function normalizeLegacyHistory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.closings)) {
    throw new TypeError('El historial diario anterior no es válido.')
  }
  const ids = new Set()
  const rows = raw.closings.map(validLegacyRow)
  if (rows.some((row) => !row) || rows.some((row) => ids.has(row.id) || !ids.add(row.id))) {
    throw new TypeError('El historial diario anterior no es válido.')
  }
  const total = positiveId(raw.total_count) ?? (raw.total_count === 0 ? 0 : null)
  if (total === null || total < rows.length) throw new TypeError('El historial diario anterior no es válido.')
  return { total, rows }
}

function previousDate(value, days) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day - days))
  return date.toISOString().slice(0, 10)
}

function LegacyDetail({ detail }) {
  const denominations = Array.isArray(detail.denominations) ? detail.denominations : []
  return (
    <section className="cash-shift-card cash-shift-legacy-detail">
      <p className="cash-shift-eyebrow">CIERRE DIARIO ANTERIOR · SOLO LECTURA</p>
      <h2>{typeof detail.name === 'string' ? detail.name : `Cierre #${detail.closing_id}`}</h2>
      <dl className="cash-shift-period-grid">
        <div><dt>Fecha calendario</dt><dd>{detail.date || '—'}</dd></div>
        <div><dt>Estado histórico</dt><dd>{detail.state || '—'}</dd></div>
        <div><dt>Fondo</dt><dd>{CURRENCY.format(finite(detail.opening_fund))}</dd></div>
        <div><dt>Ventas</dt><dd>{CURRENCY.format(finite(detail.sales_total))}</dd></div>
        <div><dt>Gastos</dt><dd>{CURRENCY.format(finite(detail.expenses_total))}</dd></div>
        <div><dt>Esperado</dt><dd>{CURRENCY.format(finite(detail.expected_total))}</dd></div>
        <div><dt>Físico</dt><dd>{CURRENCY.format(finite(detail.physical_total))}</dd></div>
        <div><dt>Diferencia</dt><dd>{CURRENCY.format(finite(detail.difference))}</dd></div>
      </dl>
      {denominations.length ? (
        <div className="cash-shift-table-wrap">
          <table className="cash-shift-report-table">
            <thead><tr><th scope="col">Denominación</th><th scope="col">Conteo</th><th scope="col">Subtotal</th></tr></thead>
            <tbody>{denominations.map((row, index) => (
              <tr key={`${row.denomination || 'legacy'}-${index}`}><td>{row.denomination || '—'}</td><td>{Number.isSafeInteger(row.count) ? row.count : '—'}</td><td>{CURRENCY.format(finite(row.subtotal))}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {detail.notes ? <p>Notas: {String(detail.notes)}</p> : null}
    </section>
  )
}

export default function LegacyCashClosingHistory({
  accessMode,
  sessionIdentity,
  loadHistory = defaultLoadHistory,
  loadDetail = defaultLoadDetail,
  now = Date.now,
}) {
  const today = mexicoBusinessDate(now())
  const [dateFrom, setDateFrom] = useState(() => previousDate(today, 30))
  const [dateTo, setDateTo] = useState(() => today)
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [view, setView] = useState({ status: 'idle', rows: [], total: 0, error: '' })
  const [detail, setDetail] = useState({ status: 'idle', data: null, error: '' })
  const mounted = useRef(false)
  const workflowIdentity = `${sessionIdentity}|${accessMode}`
  const workflowRef = useRef({ identity: workflowIdentity, generation: 0 })
  const historyInFlight = useRef(null)
  const detailInFlight = useRef(null)
  const historyGeneration = useRef(0)
  const detailGeneration = useRef(0)
  if (workflowRef.current.identity !== workflowIdentity) {
    workflowRef.current = { identity: workflowIdentity, generation: workflowRef.current.generation + 1 }
    historyGeneration.current += 1
    detailGeneration.current += 1
    historyInFlight.current = null
    detailInFlight.current = null
  }

  const captureWorkflow = useCallback(() => ({ ...workflowRef.current }), [])
  const isCurrent = useCallback((guard) => (
    mounted.current
    && accessMode === 'manage'
    && guard.identity === workflowRef.current.identity
    && guard.generation === workflowRef.current.generation
  ), [accessMode])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      workflowRef.current = { identity: workflowRef.current.identity, generation: workflowRef.current.generation + 1 }
      historyGeneration.current += 1
      detailGeneration.current += 1
      historyInFlight.current = null
      detailInFlight.current = null
    }
  }, [])

  useEffect(() => {
    if (accessMode !== 'manage') return
    historyGeneration.current += 1
    detailGeneration.current += 1
    historyInFlight.current = null
    detailInFlight.current = null
    setDateFrom(previousDate(today, 30))
    setDateTo(today)
    setOffset(0)
    setView({ status: 'idle', rows: [], total: 0, error: '' })
    setDetail({ status: 'idle', data: null, error: '' })
  }, [accessMode, today, workflowIdentity])

  const load = useCallback(async () => {
    if (accessMode !== 'manage') return null
    try {
      validateOperationalHistoryDate(dateFrom, now())
      validateOperationalHistoryDate(dateTo, now())
      if (dateFrom > dateTo) throw new TypeError('El rango de fechas no es válido.')
    } catch (error) {
      setView({ status: 'validation', rows: [], total: 0, error: error.message })
      return null
    }
    const workflow = captureWorkflow()
    const generation = historyGeneration.current
    const key = `${dateFrom}|${dateTo}|${offset}|${workflow.identity}|${workflow.generation}|${generation}`
    if (historyInFlight.current?.key === key) return historyInFlight.current.promise
    const marker = { key, workflow, promise: null }
    historyInFlight.current = marker
    setView((current) => ({ ...current, status: 'loading', error: '' }))
    setDetail({ status: 'idle', data: null, error: '' })
    marker.promise = (async () => {
      try {
        const history = normalizeLegacyHistory(unwrap(await loadHistory({
          dateFrom,
          dateTo,
          limit: PAGE_SIZE,
          offset,
        })))
        if (
          historyInFlight.current === marker
          && generation === historyGeneration.current
          && isCurrent(workflow)
        ) {
          setView({ status: 'ready', rows: history.rows, total: history.total, error: '' })
        }
        return history
      } catch {
        if (
          historyInFlight.current === marker
          && generation === historyGeneration.current
          && isCurrent(workflow)
        ) {
          setView({ status: 'error', rows: [], total: 0, error: 'No se pudieron cargar los cierres diarios anteriores.' })
        }
        return null
      } finally {
        if (historyInFlight.current === marker) historyInFlight.current = null
      }
    })()
    return marker.promise
  }, [accessMode, captureWorkflow, dateFrom, dateTo, isCurrent, loadHistory, now, offset])

  useEffect(() => {
    void load()
  }, [load, retry])

  const selectDetail = useCallback(async (id) => {
    if (accessMode !== 'manage' || positiveId(id) === null) return null
    const workflow = captureWorkflow()
    const key = `${dateFrom}|${dateTo}|${offset}|${id}|${workflow.identity}|${workflow.generation}`
    if (detailInFlight.current?.key === key) return detailInFlight.current.promise
    const generation = ++detailGeneration.current
    detailInFlight.current = null
    const marker = { key, generation, workflow, promise: null }
    detailInFlight.current = marker
    setDetail({ status: 'loading', data: null, error: '' })
    marker.promise = (async () => {
      try {
        const value = unwrap(await loadDetail(id))
        if (!value || typeof value !== 'object' || positiveId(value.closing_id) !== id) {
          throw new TypeError('El detalle diario anterior no es válido.')
        }
        if (
          detailInFlight.current === marker
          && generation === detailGeneration.current
          && isCurrent(workflow)
        ) {
          setDetail({ status: 'ready', data: value, error: '' })
        }
        return value
      } catch {
        if (
          detailInFlight.current === marker
          && generation === detailGeneration.current
          && isCurrent(workflow)
        ) {
          setDetail({ status: 'error', data: null, error: 'No se pudo cargar el cierre diario anterior.' })
        }
        return null
      } finally {
        if (detailInFlight.current === marker) detailInFlight.current = null
      }
    })()
    return marker.promise
  }, [accessMode, captureWorkflow, dateFrom, dateTo, isCurrent, loadDetail, offset])

  function invalidateForFilterChange() {
    historyGeneration.current += 1
    detailGeneration.current += 1
    historyInFlight.current = null
    detailInFlight.current = null
    setDetail({ status: 'idle', data: null, error: '' })
  }

  function setValidatedFilters(nextFrom, nextTo, nextOffset = 0) {
    invalidateForFilterChange()
    setDateFrom(nextFrom)
    setDateTo(nextTo)
    setOffset(nextOffset)
    try {
      validateOperationalHistoryDate(nextFrom, now())
      validateOperationalHistoryDate(nextTo, now())
      if (nextFrom > nextTo) throw new TypeError('El rango de fechas no es válido.')
      setView({ status: 'idle', rows: [], total: 0, error: '' })
    } catch (error) {
      setView({ status: 'validation', rows: [], total: 0, error: error.message })
    }
  }

  function changeOffset(nextOffset) {
    invalidateForFilterChange()
    setOffset(nextOffset)
    setView({ status: 'idle', rows: [], total: 0, error: '' })
  }

  function handleRetry() {
    invalidateForFilterChange()
    setRetry((value) => value + 1)
  }

  if (accessMode !== 'manage') {
    return <section className="cash-shift-card" role="status"><h2>Cierres diarios anteriores no disponibles</h2><p>Solo la persona administradora de cortes puede consultar estos registros.</p></section>
  }

  return (
    <div className="cash-shift-stack">
      <section className="cash-shift-card cash-shift-print-hide">
        <p className="cash-shift-eyebrow">HISTÓRICO LEGACY · SOLO LECTURA</p>
        <h2>Cierres diarios anteriores</h2>
        <p className="cash-shift-muted">Estos registros siguen usando fecha calendario y no se reinterpretan como turnos.</p>
        <div className="cash-shift-legacy-filters">
          <label>Desde<input type="date" name="legacyDateFrom" max={today} value={dateFrom} onChange={(event) => setValidatedFilters(event.target.value, dateTo)} /></label>
          <label>Hasta<input type="date" name="legacyDateTo" max={today} value={dateTo} onChange={(event) => setValidatedFilters(dateFrom, event.target.value)} /></label>
        </div>
      </section>

      {view.status === 'loading' || view.status === 'idle' ? <p className="cash-shift-info" role="status">Cargando cierres diarios anteriores…</p> : null}
      {view.status === 'validation' ? <p className="cash-shift-error" role="alert">{view.error}</p> : null}
      {view.status === 'error' ? (
        <p className="cash-shift-error" role="alert">{view.error} <button className="cash-shift-secondary" type="button" onClick={handleRetry}>Reintentar</button></p>
      ) : null}
      {view.status === 'ready' ? (
        <section className="cash-shift-card">
          <h3>Resultados ({view.total})</h3>
          {view.rows.length ? (
            <div className="cash-shift-legacy-list">
              {view.rows.map((row) => (
                <button className="cash-shift-secondary" type="button" key={row.id} onClick={() => selectDetail(row.id)}>
                  <span>{row.name} · {row.date}</span>
                  <span>{row.state} · diferencia {CURRENCY.format(row.difference)}</span>
                </button>
              ))}
            </div>
          ) : <p className="cash-shift-muted">Sin cierres diarios anteriores en este rango.</p>}
          <div className="cash-shift-actions cash-shift-print-hide">
            <button className="cash-shift-secondary" type="button" disabled={offset === 0} onClick={() => changeOffset(Math.max(0, offset - PAGE_SIZE))}>Anterior</button>
            <button className="cash-shift-secondary" type="button" disabled={offset + PAGE_SIZE >= view.total} onClick={() => changeOffset(offset + PAGE_SIZE)}>Siguiente</button>
          </div>
        </section>
      ) : null}
      {detail.status === 'loading' ? <p className="cash-shift-info" role="status">Cargando detalle diario anterior…</p> : null}
      {detail.status === 'error' ? <p className="cash-shift-error" role="alert">{detail.error}</p> : null}
      {detail.status === 'ready' ? <LegacyDetail detail={detail.data} /> : null}
    </div>
  )
}
