import { useCallback, useEffect, useRef, useState } from 'react'
import { getCashShiftDetail, getCashShiftHistory } from '../api.js'
import { normalizeCashShift } from '../cashShiftModel.js'
import {
  mexicoBusinessDate,
  normalizeCashShiftHistory,
  operationalHistorySections,
  validateOperationalHistoryDate,
} from '../cashShiftHistoryModel.js'
import CashShiftPrintView from './CashShiftPrintView.jsx'

const CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
})

function money(value) {
  return CURRENCY.format(value)
}

function unwrap(raw) {
  const envelope = raw?.result ?? raw
  if (envelope?.ok === false) throw new Error('cash_shift_history_rejected')
  return envelope?.data ?? envelope
}

function HistoryState({ title, children, onRetry = null }) {
  return (
    <section className="cash-shift-card" role={onRetry ? 'alert' : 'status'}>
      <h2>{title}</h2>
      <p>{children}</p>
      {onRetry ? <button className="cash-shift-primary" type="button" onClick={onRetry}>Reintentar</button> : null}
    </section>
  )
}

function ShiftHistoryCard({ section, selected, onSelect }) {
  const cashShift = section.cashShift
  return (
    <article className="cash-shift-card cash-shift-history-card">
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">FOTOGRAFÍA VERSIONADA</p>
          <h2>{section.label}</h2>
        </div>
        <span className={`cash-shift-status ${cashShift.shift.type}`}>{cashShift.folio}</span>
      </div>
      <dl className="cash-shift-period-grid">
        <div><dt>Versión</dt><dd>{cashShift.versionNumber || 'Sin cierre'}</dd></div>
        <div><dt>Estado</dt><dd>{cashShift.shift.state}</dd></div>
        <div><dt>Ventas</dt><dd>{money(cashShift.totals.salesTotal)}</dd></div>
        <div><dt>Diferencia</dt><dd>{money(cashShift.difference)}</dd></div>
      </dl>
      {cashShift.versionId ? (
        <button
          className="cash-shift-secondary cash-shift-print-hide"
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(cashShift)}
        >
          {selected ? 'Detalle seleccionado' : `Ver detalle ${section.label}`}
        </button>
      ) : <p className="cash-shift-muted">Este turno aún no tiene una versión cerrada imprimible.</p>}
    </article>
  )
}

function ConsolidatedHistoryCard({ section }) {
  const report = section.consolidated
  return (
    <article className="cash-shift-card cash-shift-consolidated" aria-labelledby="cash-shift-consolidated-title">
      <p className="cash-shift-eyebrow">REPORTE DEL BACKEND</p>
      <h2 id="cash-shift-consolidated-title">{section.label}</h2>
      <p className="cash-shift-muted">Los importes se muestran tal como fueron consolidados por el servidor.</p>
      <dl className="cash-shift-totals-grid">
        <div><dt>Ventas</dt><dd>{money(report.salesTotal)} · {report.realizedOrderIds.length} tickets</dd></div>
        <div><dt>Pagos</dt><dd>{money(report.payments.total)}</dd></div>
        <div><dt>Gastos</dt><dd>{money(report.expensesTotal)} · {report.expenseIds.length} movimientos</dd></div>
        <div><dt>Ajustes</dt><dd>+{money(report.adjustmentIncomeTotal)} / −{money(report.adjustmentExpenseTotal)}</dd></div>
        <div className="cash-shift-total-emphasis"><dt>Diferencia neta de ambos turnos</dt><dd>{money(report.netDifference)}</dd></div>
      </dl>
      <div className="cash-shift-report-grid">
        <section>
          <h3>Productos</h3>
          <div className="cash-shift-table-wrap">
            <table className="cash-shift-report-table">
              <thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Peso</th><th scope="col">Importe</th></tr></thead>
              <tbody>
                {report.products.length ? report.products.map((row) => (
                  <tr key={row.productId}>
                    <td>{row.sku ? `${row.sku} · ` : ''}{row.productName}</td>
                    <td>{row.quantity}</td>
                    <td>{row.weightUnknown ? 'No disponible' : `${row.weightTotalKg} kg`}</td>
                    <td>{money(row.amountTotal)}</td>
                  </tr>
                )) : <tr><td colSpan={4}>Sin productos</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h3>Movimientos incluidos</h3>
          <ul className="cash-shift-history-counts">
            <li>Ventas: <strong>{report.realizedOrderIds.length}</strong></li>
            <li>Pagos: <strong>{report.paymentOrderIds.length}</strong></li>
            <li>Cancelados: <strong>{report.cancelledOrderIds.length}</strong></li>
            <li>Gastos: <strong>{report.expenseIds.length}</strong></li>
            <li>Ajustes: <strong>{report.adjustmentIds.length}</strong></li>
          </ul>
        </section>
      </div>
      {report.shiftArqueos.length ? (
        <section className="cash-shift-separate-arqueos">
          <h3>Arqueos separados por turno</h3>
          <p className="cash-shift-muted">Estos valores pertenecen a cada turno; no son un arqueo consolidado.</p>
          <div className="cash-shift-history-arqueos">
            {report.shiftArqueos.map((row) => (
              <article key={row.shift.id}>
                <strong>{row.shift.type === 'night' ? 'Noche' : 'Día'} · versión #{row.versionId}</strong>
                <span>Fondo {money(row.openingFund)}</span>
                <span>Esperado {money(row.expectedCash)}</span>
                <span>Físico {money(row.physicalCash)}</span>
                <span>Diferencia {money(row.difference)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}

export default function CashShiftHistory({
  accessMode,
  sessionIdentity,
  loadHistory = getCashShiftHistory,
  loadDetail = getCashShiftDetail,
  printWindow,
  now = Date.now,
}) {
  const today = mexicoBusinessDate(now())
  const [businessDate, setBusinessDate] = useState(() => today)
  const [requestNonce, setRequestNonce] = useState(0)
  const [view, setView] = useState({ status: 'idle', data: null, error: '' })
  const [detailView, setDetailView] = useState({ status: 'idle', data: null, error: '' })
  const mounted = useRef(false)
  const workflowRef = useRef({ identity: `${sessionIdentity}|${accessMode}`, generation: 0 })
  const historyInFlight = useRef(null)
  const detailInFlight = useRef(null)
  const historyGeneration = useRef(0)
  const detailGeneration = useRef(0)
  const workflowIdentity = `${sessionIdentity}|${accessMode}`
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
      workflowRef.current = {
        identity: workflowRef.current.identity,
        generation: workflowRef.current.generation + 1,
      }
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
    setBusinessDate(today)
    setView({ status: 'idle', data: null, error: '' })
    setDetailView({ status: 'idle', data: null, error: '' })
  }, [accessMode, today, workflowIdentity])

  const load = useCallback(async () => {
    if (accessMode !== 'manage') return null
    let validatedDate
    try {
      validatedDate = validateOperationalHistoryDate(businessDate, now())
    } catch (error) {
      setView({ status: 'validation', data: null, error: error.message })
      return null
    }
    const workflow = captureWorkflow()
    const generation = historyGeneration.current
    const fingerprint = `${validatedDate}|${workflow.identity}|${workflow.generation}|${generation}`
    const currentMarker = historyInFlight.current
    if (currentMarker?.fingerprint === fingerprint) {
      return currentMarker.promise
    }
    const marker = { fingerprint, generation, workflow, promise: null }
    historyInFlight.current = marker
    setView({ status: 'loading', data: null, error: '' })
    setDetailView({ status: 'idle', data: null, error: '' })
    marker.promise = (async () => {
      try {
        const history = normalizeCashShiftHistory(unwrap(await loadHistory({
          businessDate: validatedDate,
        })), validatedDate)
        if (
          historyInFlight.current === marker
          && generation === historyGeneration.current
          && isCurrent(workflow)
        ) {
          setView({ status: 'ready', data: history, error: '' })
        }
        return history
      } catch {
        if (
          historyInFlight.current === marker
          && generation === historyGeneration.current
          && isCurrent(workflow)
        ) {
          setView({ status: 'error', data: null, error: 'No se pudo cargar un historial operativo válido.' })
        }
        return null
      } finally {
        if (historyInFlight.current === marker) historyInFlight.current = null
      }
    })()
    return marker.promise
  }, [accessMode, businessDate, captureWorkflow, isCurrent, loadHistory, now])

  useEffect(() => {
    void load()
  }, [load, requestNonce])

  const selectVersion = useCallback(async (cashShift, versionId = cashShift.versionId) => {
    if (accessMode !== 'manage' || !cashShift?.shift?.id || !versionId) return null
    const workflow = captureWorkflow()
    const key = `${cashShift.shift.id}|${versionId}|${workflow.identity}|${workflow.generation}`
    if (detailInFlight.current?.key === key) return detailInFlight.current.promise
    const generation = ++detailGeneration.current
    detailInFlight.current = null
    const marker = { key, generation, workflow, promise: null }
    detailInFlight.current = marker
    setDetailView({ status: 'loading', data: null, error: '' })
    marker.promise = (async () => {
      try {
        const detail = normalizeCashShift(unwrap(await loadDetail({ shiftId: cashShift.shift.id, versionId })))
        if (
          detail.shift.id !== cashShift.shift.id
          || detail.versionId !== versionId
          || detail.shift.businessDate !== businessDate
          || !detail.printable
        ) throw new TypeError('La fotografía solicitada no coincide.')
        if (
          detailInFlight.current === marker
          && generation === detailGeneration.current
          && isCurrent(workflow)
        ) {
          setDetailView({ status: 'ready', data: detail, error: '' })
        }
        return detail
      } catch {
        if (
          detailInFlight.current === marker
          && generation === detailGeneration.current
          && isCurrent(workflow)
        ) {
          setDetailView({ status: 'error', data: null, error: 'No se pudo cargar la versión exacta del corte.' })
        }
        return null
      } finally {
        if (detailInFlight.current === marker) detailInFlight.current = null
      }
    })()
    return marker.promise
  }, [accessMode, businessDate, captureWorkflow, isCurrent, loadDetail])

  function handleDateChange(event) {
    const value = event.target.value
    historyGeneration.current += 1
    detailGeneration.current += 1
    historyInFlight.current = null
    detailInFlight.current = null
    setBusinessDate(value)
    setDetailView({ status: 'idle', data: null, error: '' })
    try {
      validateOperationalHistoryDate(value, now())
      setView({ status: 'idle', data: null, error: '' })
    } catch (error) {
      setView({ status: 'validation', data: null, error: error.message })
    }
  }

  function handleRetry() {
    historyGeneration.current += 1
    detailGeneration.current += 1
    historyInFlight.current = null
    detailInFlight.current = null
    setDetailView({ status: 'idle', data: null, error: '' })
    setRequestNonce((value) => value + 1)
  }

  if (accessMode !== 'manage') {
    return <HistoryState title="Historial no disponible">Solo la persona administradora de cortes puede consultar o imprimir el historial.</HistoryState>
  }

  const sections = view.data ? operationalHistorySections(view.data) : []
  const selectedVersionId = detailView.data?.versionId ?? null
  return (
    <div className="cash-shift-stack">
      <section className="cash-shift-card cash-shift-history-filter cash-shift-print-hide">
        <div>
          <p className="cash-shift-eyebrow">FECHA OPERATIVA MÉXICO</p>
          <h2>Historial operativo</h2>
        </div>
        <label>Fecha
          <input
            type="date"
            name="cashShiftBusinessDate"
            max={today}
            value={businessDate}
            onChange={handleDateChange}
          />
        </label>
      </section>

      {view.status === 'loading' || view.status === 'idle' ? (
        <HistoryState title="Cargando historial">Consultando la fecha operativa seleccionada…</HistoryState>
      ) : null}
      {view.status === 'validation' ? <p className="cash-shift-error" role="alert">{view.error}</p> : null}
      {view.status === 'error' ? (
        <HistoryState title="No se pudo cargar el historial" onRetry={handleRetry}>{view.error}</HistoryState>
      ) : null}
      {view.status === 'ready' && view.data.shifts.length === 0 ? (
        <HistoryState title="Sin cortes operativos">No hay fotografías de turno para esta fecha. El consolidado del servidor se conserva en cero.</HistoryState>
      ) : null}
      {view.status === 'ready' ? sections.map((section) => (
        section.kind === 'shift'
          ? <ShiftHistoryCard key={section.key} section={section} selected={selectedVersionId === section.cashShift.versionId} onSelect={selectVersion} />
          : <ConsolidatedHistoryCard key={section.key} section={section} />
      )) : null}

      {detailView.status === 'loading' ? <HistoryState title="Cargando versión">Consultando la fotografía histórica exacta…</HistoryState> : null}
      {detailView.status === 'error' ? <p className="cash-shift-error" role="alert">{detailView.error}</p> : null}
      {detailView.status === 'ready' ? (
        <div className="cash-shift-stack">
          {detailView.data.previousVersionId ? (
            <button
              className="cash-shift-secondary cash-shift-print-hide"
              type="button"
              onClick={() => selectVersion(detailView.data, detailView.data.previousVersionId)}
            >Ver e imprimir versión anterior #{detailView.data.previousVersionId}</button>
          ) : null}
          <CashShiftPrintView cashShift={detailView.data} onPrint={printWindow} />
        </div>
      ) : null}
    </div>
  )
}
