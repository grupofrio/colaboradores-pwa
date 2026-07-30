import { useEffect, useMemo, useRef, useState } from 'react'
import TicketDocument from './TicketDocument'
import {
  getIgualaSalesHistory,
  getIgualaSalesTickets,
  MAX_SELECTED_TICKETS,
  PAGE_SIZE,
} from './salesHistoryApi.js'
import {
  isSelectionAtLimit,
  selectedAmount,
  toggleOrderSelection,
  togglePageSelection,
} from './salesHistoryState.js'
import { logScreenError } from '../shared/logScreenError.js'

const CDMX_TIME_ZONE = 'America/Mexico_City'

function cdmxDateKey(date = new Date()) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: CDMX_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type) => values.find((value) => value.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function money(amount, currency = 'MXN') {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: currency || 'MXN', minimumFractionDigits: 2,
  }).format(value)
}

function dateTime(orderedAt) {
  const date = orderedAt ? new Date(orderedAt) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: CDMX_TIME_ZONE,
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function paymentText(order) {
  const payment = order?.payment || {}
  const parts = Array.isArray(payment.breakdown) ? payment.breakdown : []
  if (parts.length > 0) return parts.map((part) => part.label || part.method).filter(Boolean).join(' · ')
  return payment.label || payment.method || '—'
}

function OrderLines({ order }) {
  const lines = Array.isArray(order?.lines) ? order.lines : []
  if (!lines.length) return <span>Sin líneas disponibles</span>
  return (
    <details className="vi-order-lines">
      <summary>{lines.length} {lines.length === 1 ? 'línea' : 'líneas'}</summary>
      <ul>{lines.map((line, index) => <li key={`${line.product_id || line.product_name || 'line'}-${index}`}>
        <span><strong>Producto:</strong> {line.product_name || 'Producto'}</span>
        <span><strong>Cantidad:</strong> {line.quantity}</span>
        <span><strong>Precio unitario:</strong> {money(line.unit_price, order.currency)}</span>
        <span><strong>Total:</strong> {money(line.line_total, order.currency)}</span>
      </li>)}</ul>
    </details>
  )
}

function errorMessage(error, fallback) {
  return typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : fallback
}

function getErrorState(error, fallback) {
  const code = String(error?.code || '').trim().toLowerCase()
  const status = Number(error?.status ?? error?.response?.status)
  if (status === 401 || status === 403 || ['access_denied', 'forbidden', 'not_authorized', 'unauthorized'].includes(code)) {
    return { title: 'Acceso denegado', message: 'No tienes permiso para consultar las ventas de Iguala.', retryable: false }
  }
  if (code === 'invalid_batch_ticket_contract') {
    return { title: 'Datos no válidos', message: 'Los datos de los tickets no cumplen el contrato de impresión.', retryable: false }
  }
  return { title: 'No pudimos completar la operación', message: errorMessage(error, fallback), retryable: true }
}

export default function ScreenVentasIguala() {
  const today = useMemo(() => cdmxDateKey(), [])
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [printableTickets, setPrintableTickets] = useState([])
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState(null)
  const requestSeq = useRef(0)
  const appliedSearchRef = useRef('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim()
      if (appliedSearchRef.current !== nextSearch) {
        appliedSearchRef.current = nextSearch
        setSelectedOrders([])
        setSearch(nextSearch)
        setPage(1)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const currentRequest = ++requestSeq.current
    let active = true

    async function loadHistory() {
      setLoading(true)
      setErrorState(null)
      try {
        const nextHistory = await getIgualaSalesHistory({ dateFrom, dateTo, search, page })
        if (!active || currentRequest !== requestSeq.current) return
        setHistory(nextHistory)
      } catch (loadError) {
        if (!active || currentRequest !== requestSeq.current) return
        logScreenError('ScreenVentasIguala', 'loadHistory', loadError)
        setHistory(null)
        setErrorState(getErrorState(loadError, 'No pudimos cargar las ventas de Iguala.'))
      } finally {
        if (active && currentRequest === requestSeq.current) setLoading(false)
      }
    }

    loadHistory()
    return () => { active = false }
  }, [dateFrom, dateTo, page, retryKey, search])

  const orders = history?.orders || []
  const pagination = history?.pagination || { page: 1, page_size: PAGE_SIZE, total: 0 }
  const currentPage = Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : page
  const total = typeof pagination.total === 'number' && pagination.total >= 0 ? pagination.total : 0
  const totalPages = Math.max(1, Math.ceil(total / (pagination.page_size || PAGE_SIZE)))
  const selectedIds = useMemo(() => new Set(selectedOrders.map(({ id }) => id)), [selectedOrders])
  const pageFullySelected = orders.length > 0 && orders.every((order) => selectedIds.has(order.id))
  const filtersUpdating = loading || searchInput.trim() !== search
  const selectedTotal = selectedAmount(selectedOrders)
  const selectionAtLimit = isSelectionAtLimit(selectedOrders)
  const canPrint = selectedOrders.length > 0 && !printing && !filtersUpdating

  function changeDate(setter, nextValue, currentValue) {
    if (nextValue === currentValue) return
    setSelectedOrders([])
    setter(nextValue)
    setPage(1)
  }

  function toggleOrder(order) {
    setSelectedOrders((previous) => toggleOrderSelection(previous, order))
  }

  function toggleCurrentPage(checked) {
    setSelectedOrders((previous) => togglePageSelection(previous, orders, checked))
  }

  async function handlePrint() {
    if (!canPrint) return
    setPrinting(true)
    setPrintError(null)
    try {
      const tickets = await getIgualaSalesTickets(selectedOrders.map(({ id }) => id))
      setPrintableTickets(tickets)
      window.requestAnimationFrame(() => window.print())
    } catch (nextPrintError) {
      logScreenError('ScreenVentasIguala', 'prepareTickets', nextPrintError)
      setPrintError(getErrorState(nextPrintError, 'No pudimos preparar los tickets seleccionados.'))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <section className="ventas-iguala-screen" aria-labelledby="ventas-iguala-title">
        <style>{`
          .ventas-iguala-screen { max-width: 1320px; margin: 0 auto; padding: 24px 16px 110px; color: #172033; }
          .vi-header, .vi-toolbar, .vi-selection, .vi-page { display: flex; gap: 12px; align-items: center; }
          .vi-header { justify-content: space-between; flex-wrap: wrap; margin-bottom: 20px; }
          .vi-header h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.1rem); }
          .vi-label { border-radius: 999px; padding: 6px 10px; background: #eaf4ff; color: #075ea9; font-weight: 700; font-size: .86rem; }
          .vi-toolbar { align-items: end; flex-wrap: wrap; padding: 16px; border: 1px solid #dce3ec; border-radius: 16px; background: #fff; }
          .vi-field { display: grid; gap: 5px; font-size: .86rem; font-weight: 600; color: #46546a; }
          .vi-field input { min-height: 40px; border: 1px solid #bfcbd9; border-radius: 9px; padding: 0 10px; font: inherit; color: #172033; background: #fff; }
          .vi-search { min-width: min(100%, 280px); flex: 1; }
          .vi-selection { position: fixed; right: 0; bottom: 0; left: 0; z-index: 10; justify-content: space-between; flex-wrap: wrap; margin: 0; padding: 12px max(16px, calc((100vw - 1288px) / 2)); background: #172f50; color: #fff; box-shadow: 0 -3px 16px rgba(23, 47, 80, .22); }
          .vi-selection p { margin: 0; }
          .vi-total { font-weight: 800; }
          .vi-button { min-height: 40px; border: 0; border-radius: 9px; padding: 0 14px; background: #0877c9; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
          .vi-button:disabled { cursor: not-allowed; opacity: .55; }
          .vi-button-secondary { background: #e8eef4; color: #172033; }
          .vi-table-wrap { overflow-x: auto; border: 1px solid #dce3ec; border-radius: 14px; background: #fff; }
          .vi-table { width: 100%; border-collapse: collapse; min-width: 960px; }
          .vi-table th, .vi-table td { padding: 12px; border-bottom: 1px solid #edf0f4; vertical-align: top; text-align: left; font-size: .9rem; }
          .vi-table th { background: #f7f9fb; color: #4b5a70; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
          .vi-table tr:last-child td { border-bottom: 0; }
          .vi-lines { max-width: 280px; color: #4b5a70; font-size: .8rem; }
          .vi-order-lines summary { cursor: pointer; color: #075ea9; }
          .vi-order-lines ul { display: grid; gap: 5px; margin: 8px 0 0; padding: 0; list-style: none; }
          .vi-order-lines li { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; }
          .vi-cards { display: none; gap: 10px; }
          .vi-card { padding: 14px; border: 1px solid #dce3ec; border-radius: 12px; background: #fff; }
          .vi-card-head, .vi-card-row { display: flex; justify-content: space-between; gap: 12px; }
          .vi-card-row { margin-top: 8px; color: #4b5a70; font-size: .86rem; }
          .vi-card-row strong { color: #172033; text-align: right; }
          .vi-state { padding: 32px 16px; text-align: center; border: 1px dashed #bfcbd9; border-radius: 14px; background: #fff; color: #4b5a70; }
          .vi-error { margin-top: 14px; color: #a31919; }
          .vi-page { justify-content: flex-end; margin-top: 16px; }
          @media (max-width: 720px) { .vi-table-wrap { display: none; } .vi-cards { display: grid; } .vi-toolbar { align-items: stretch; } .vi-field, .vi-search { width: 100%; } .vi-page { justify-content: space-between; } }
        `}</style>

        <header className="vi-header">
          <div>
            <h1 id="ventas-iguala-title">Historial de ventas</h1>
            <p>Consulta e impresión de tickets de ventas de la sucursal.</p>
          </div>
          <span className="vi-label">Sucursal fija: Iguala · {CDMX_TIME_ZONE}</span>
        </header>

        <div className="vi-toolbar" aria-label="Filtros de historial">
          <label className="vi-field">Desde
            <input aria-label="Fecha inicial" type="date" value={dateFrom} onChange={(event) => changeDate(setDateFrom, event.target.value, dateFrom)} />
          </label>
          <label className="vi-field">Hasta
            <input aria-label="Fecha final" type="date" value={dateTo} onChange={(event) => changeDate(setDateTo, event.target.value, dateTo)} />
          </label>
          <label className="vi-field vi-search">Cliente o folio
            <input aria-label="Buscar cliente o folio" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nombre del cliente o folio" />
          </label>
        </div>

        <div className="vi-selection" aria-live="polite">
          <p><strong>{selectedOrders.length}</strong> de {MAX_SELECTED_TICKETS} tickets seleccionados</p>
          <p className="vi-total">Total exacto: {money(selectedTotal)}</p>
          <button className="vi-button" type="button" disabled={!canPrint || filtersUpdating} onClick={handlePrint}>
            {printing ? 'Preparando tickets…' : 'Imprimir tickets'}
          </button>
        </div>
        {filtersUpdating && !loading && <p aria-live="polite">Actualizando filtros…</p>}
        {printError && <p className="vi-error" role="alert"><strong>{printError.title}.</strong> {printError.message}</p>}

        {loading && <div className="vi-state" aria-live="polite">Cargando ventas de Iguala…</div>}
        {!loading && errorState && (
          <div className="vi-state" role="alert">
            <h2>{errorState.title}</h2>
            <p>{errorState.message}</p>
            {errorState.retryable && <button className="vi-button" type="button" onClick={() => setRetryKey((key) => key + 1)}>Reintentar</button>}
          </div>
        )}
        {!loading && !errorState && orders.length === 0 && <div className="vi-state">No se encontraron ventas para los filtros aplicados.</div>}
        {!loading && !errorState && orders.length > 0 && (
          <>
            <div className="vi-table-wrap">
              <table className="vi-table">
                <thead><tr>
                  <th scope="col"><input aria-label="Seleccionar página" type="checkbox" checked={pageFullySelected} onChange={(event) => toggleCurrentPage(event.target.checked)} /></th>
                  <th scope="col">Folio y fecha</th><th scope="col">Cliente</th><th scope="col">Responsable</th><th scope="col">Líneas</th><th scope="col">Pago</th><th scope="col">Total</th>
                </tr></thead>
                <tbody>{orders.map((order) => {
                  const checked = selectedIds.has(order.id)
                  return <tr key={order.id}>
                    <td><input aria-label={`Seleccionar ${order.folio || order.id}`} type="checkbox" checked={checked} disabled={selectionAtLimit && !checked} onChange={() => toggleOrder(order)} /></td>
                    <td><strong>{order.folio || `#${order.id}`}</strong><br /><small>{dateTime(order.ordered_at)}</small></td>
                    <td>{order.customer?.name || 'Público general'}</td>
                    <td>{order.responsible_employee?.name || '—'}</td>
                    <td className="vi-lines"><OrderLines order={order} /></td>
                    <td>{paymentText(order)}</td>
                    <td><strong>{money(order.amount_total, order.currency)}</strong></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
            <div className="vi-cards">{orders.map((order) => {
              const checked = selectedIds.has(order.id)
              return <article className="vi-card" key={order.id}>
                <div className="vi-card-head"><label><input aria-label={`Seleccionar ${order.folio || order.id}`} type="checkbox" checked={checked} disabled={selectionAtLimit && !checked} onChange={() => toggleOrder(order)} /> {order.folio || `#${order.id}`}</label><strong>{money(order.amount_total, order.currency)}</strong></div>
                <div className="vi-card-row"><span>Cliente</span><strong>{order.customer?.name || 'Público general'}</strong></div>
                <div className="vi-card-row"><span>Fecha (CDMX)</span><strong>{dateTime(order.ordered_at)}</strong></div>
                <div className="vi-card-row"><span>Responsable</span><strong>{order.responsible_employee?.name || '—'}</strong></div>
                <div className="vi-card-row"><span>Pago</span><strong>{paymentText(order)}</strong></div>
                <div className="vi-card-row"><span>Líneas</span><OrderLines order={order} /></div>
              </article>
            })}</div>
            <nav className="vi-page" aria-label="Paginación">
              <button className="vi-button vi-button-secondary" type="button" disabled={currentPage <= 1 || filtersUpdating} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
              <span>Página {currentPage} de {totalPages} · {total} ventas</span>
              <button className="vi-button vi-button-secondary" type="button" disabled={currentPage >= totalPages || filtersUpdating} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
            </nav>
          </>
        )}
      </section>

      <div className="gf-batch-ticket-print" aria-hidden="true">
        {printableTickets.map((ticket) => <TicketDocument key={ticket.order_id} ticket={ticket} printId={`iguala-ticket-${ticket.order_id}`} />)}
      </div>
    </>
  )
}
