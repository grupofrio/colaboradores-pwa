import { useEffect, useRef, useState } from 'react'
import { zonedWallTimeToUtcMs } from '../cashShiftTime.js'

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function normalizeEligibleRows(rows, kind) {
  return rows.map((row, index) => {
    if (
      !row || typeof row !== 'object'
      || typeof row.display_name !== 'string' || !row.display_name.trim()
      || typeof row.total !== 'number' || !Number.isFinite(row.total)
    ) throw new TypeError(`Los movimientos elegibles de ${kind} no son válidos.`)

    return {
      key: `${kind}-${index}`,
      name: row.display_name.trim(),
      total: row.total,
    }
  })
}

function normalizePreview(raw) {
  const value = raw?.result ?? raw
  const data = value?.data ?? value
  if (value?.ok === false || data?.mode !== 'initial' || data?.config_state !== 'inactive') {
    throw new TypeError('La vista previa inicial no es válida.')
  }
  if (!Array.isArray(data.interval) || data.interval.length !== 2) {
    throw new TypeError('El intervalo inicial no es válido.')
  }
  if (!Array.isArray(data.eligible_sales) || !Array.isArray(data.eligible_expenses)) {
    throw new TypeError('Los movimientos elegibles no son válidos.')
  }
  const totals = data.displayed_totals
  if (!totals || ['sales_cash', 'sales_card', 'sales_total', 'expenses_total'].some(
    (key) => typeof totals[key] !== 'number' || !Number.isFinite(totals[key]),
  )) throw new TypeError('Los totales elegibles no son válidos.')
  return {
    serverPreviewAt: String(data.server_preview_at || ''),
    interval: data.interval.map(String),
    salesCount: data.eligible_sales.length,
    expensesCount: data.eligible_expenses.length,
    sales: normalizeEligibleRows(data.eligible_sales, 'venta'),
    expenses: normalizeEligibleRows(data.eligible_expenses, 'gasto'),
    totals: {
      cash: totals.sales_cash,
      card: totals.sales_card,
      sales: totals.sales_total,
      expenses: totals.expenses_total,
    },
  }
}

function initialDraft() {
  return { shiftType: '', businessDate: '', startAt: '', openingFund: '' }
}

function mexicoWallTimeToUtc(value) {
  const instant = zonedWallTimeToUtcMs(value, 'America/Mexico_City')
  if (!Number.isFinite(instant)) throw new TypeError('La hora inicial no es válida.')
  return new Date(instant).toISOString().replace('T', ' ').slice(0, 19)
}

function canonicalDraft(source) {
  const openingFund = Number(source.openingFund)
  if (
    !['night', 'day'].includes(source.shiftType)
    || !/^\d{4}-\d{2}-\d{2}$/.test(source.businessDate)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(source.startAt)
    || source.openingFund === ''
    || !Number.isFinite(openingFund)
    || openingFund < 0
  ) {
    throw new TypeError('Completa tipo, fecha operativa, hora inicial y fondo inicial.')
  }
  return {
    shiftType: source.shiftType,
    businessDate: source.businessDate,
    startAt: mexicoWallTimeToUtc(source.startAt),
    openingFund,
  }
}

function draftFingerprint(request) {
  return JSON.stringify([
    request.shiftType,
    request.businessDate,
    request.startAt,
    request.openingFund,
  ])
}

export default function CashShiftFirstOpenForm({ onPreview, onOpen }) {
  const [draft, setDraft] = useState(initialDraft)
  const [preview, setPreview] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingRequest, setPendingRequest] = useState(null)
  const mounted = useRef(false)
  const draftRef = useRef(draft)
  const generationRef = useRef(0)
  const mutationLockedRef = useRef(false)
  const mutationInFlightRef = useRef(false)
  const previewData = preview?.data
  const mutationLocked = mutationBusy || Boolean(pendingRequest)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generationRef.current += 1
    }
  }, [])

  function update(field, value) {
    if (mutationLockedRef.current) return
    const next = { ...draftRef.current, [field]: value }
    draftRef.current = next
    generationRef.current += 1
    setDraft(next)
    setPreview(null)
    setPreviewBusy(false)
    setError('')
  }

  function isCurrentPreviewRequest(generation, fingerprint) {
    if (!mounted.current || generationRef.current !== generation) return false
    try {
      return draftFingerprint(canonicalDraft(draftRef.current)) === fingerprint
    } catch {
      return false
    }
  }

  function previewMatchesCurrentDraft(candidate) {
    return Boolean(
      candidate
      && candidate.generation === generationRef.current
      && isCurrentPreviewRequest(candidate.generation, candidate.fingerprint),
    )
  }

  async function review(event) {
    event?.preventDefault?.()
    if (mutationLockedRef.current) return
    setError('')
    let request
    try {
      request = canonicalDraft(draftRef.current)
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    const fingerprint = draftFingerprint(request)
    const generation = generationRef.current + 1
    generationRef.current = generation
    setPreview(null)
    setPreviewBusy(true)
    try {
      const response = await onPreview({
        mode: 'initial',
        shiftType: request.shiftType,
        businessDate: request.businessDate,
        startAt: request.startAt,
      })
      if (isCurrentPreviewRequest(generation, fingerprint)) {
        setPreview({
          data: normalizePreview(response),
          draft: request,
          fingerprint,
          generation,
        })
      }
    } catch {
      if (isCurrentPreviewRequest(generation, fingerprint)) {
        setError('No se pudo obtener la vista previa del servidor. Inténtalo de nuevo.')
      }
    } finally {
      if (isCurrentPreviewRequest(generation, fingerprint)) setPreviewBusy(false)
    }
  }

  async function confirm() {
    if (mutationInFlightRef.current) return
    setError('')
    let request
    try {
      if (pendingRequest) {
        request = pendingRequest
      } else if (previewMatchesCurrentDraft(preview)) {
        request = preview.draft
      } else {
        throw new TypeError('El borrador cambió; vuelve a revisar los movimientos antes de abrir.')
      }
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    mutationLockedRef.current = true
    mutationInFlightRef.current = true
    setMutationBusy(true)
    let keepLocked = Boolean(pendingRequest)
    try {
      const result = await onOpen(request)
      if (!mounted.current) return
      if (result?.status === 'pending') {
        keepLocked = true
        setPendingRequest(result.request || request)
        setError('La respuesta quedó pendiente. Reintenta exactamente la misma apertura.')
        return
      }
      keepLocked = false
      setPendingRequest(null)
    } catch {
      if (mounted.current) setError('No se pudo abrir el primer turno. Conservamos los datos para reintentar.')
    } finally {
      mutationInFlightRef.current = false
      if (!keepLocked) mutationLockedRef.current = false
      if (mounted.current) setMutationBusy(false)
    }
  }

  return (
    <section className="cash-shift-card" aria-labelledby="cash-shift-first-open-title">
      <p className="cash-shift-eyebrow">ACTIVACIÓN INICIAL</p>
      <h2 id="cash-shift-first-open-title">Abrir primer turno</h2>
      <p className="cash-shift-muted">
        La compañía, el almacén y la cuenta analítica provienen de tu sesión autenticada.
      </p>

      <form className="cash-shift-form" onSubmit={review} noValidate>
        <label>Tipo de turno
          <select name="shiftType" disabled={mutationLocked} value={draft.shiftType} onChange={(event) => update('shiftType', event.target.value)}>
            <option value="">Selecciona</option>
            <option value="night">Noche</option>
            <option value="day">Día</option>
          </select>
        </label>
        <label>Fecha operativa
          <input name="businessDate" type="date" disabled={mutationLocked} value={draft.businessDate} onChange={(event) => update('businessDate', event.target.value)} />
        </label>
        <label>Hora inicial
          <input name="startAt" type="datetime-local" disabled={mutationLocked} value={draft.startAt} onChange={(event) => update('startAt', event.target.value)} />
        </label>
        <label>Fondo inicial
          <input name="openingFund" type="number" min="0" step="0.01" inputMode="decimal" disabled={mutationLocked} value={draft.openingFund} onChange={(event) => update('openingFund', event.target.value)} />
        </label>
        <button className="cash-shift-primary" type="button" onClick={(event) => { void review(event) }} disabled={previewBusy || mutationLocked}>
          {previewBusy ? 'Consultando…' : 'Revisar movimientos elegibles'}
        </button>
      </form>

      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}

      {previewData ? (
        <div className="cash-shift-preview" aria-live="polite">
          <h3>Vista previa del servidor</h3>
          <p>Generada en: <strong>{previewData.serverPreviewAt}</strong></p>
          <p>
            Intervalo: <strong>{previewData.interval[0]}</strong> → <strong>{previewData.interval[1]}</strong>.
            Incluye el inicio y excluye la hora final.
          </p>
          <div className="cash-shift-preview-counts">
            <span>{previewData.salesCount} {previewData.salesCount === 1 ? 'venta elegible' : 'ventas elegibles'}</span>
            <span>{previewData.expensesCount} {previewData.expensesCount === 1 ? 'gasto elegible' : 'gastos elegibles'}</span>
          </div>
          <div className="cash-shift-eligible-grid">
            <section aria-labelledby="cash-shift-eligible-sales-title">
              <h4 id="cash-shift-eligible-sales-title">Ventas elegibles</h4>
              <ul className="cash-shift-eligible-list">
                {previewData.sales.map((sale) => (
                  <li key={sale.key}><span>{sale.name}</span><strong>{money(sale.total)}</strong></li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="cash-shift-eligible-expenses-title">
              <h4 id="cash-shift-eligible-expenses-title">Gastos elegibles</h4>
              <ul className="cash-shift-eligible-list">
                {previewData.expenses.map((expense) => (
                  <li key={expense.key}><span>{expense.name}</span><strong>{money(expense.total)}</strong></li>
                ))}
              </ul>
            </section>
          </div>
          <dl className="cash-shift-preview-totals">
            <div><dt>Ventas en efectivo</dt><dd>{money(previewData.totals.cash)}</dd></div>
            <div><dt>Ventas con terminal</dt><dd>{money(previewData.totals.card)}</dd></div>
            <div><dt>Ventas totales</dt><dd>{money(previewData.totals.sales)}</dd></div>
            <div><dt>Gastos</dt><dd>{money(previewData.totals.expenses)}</dd></div>
          </dl>
          <p className="cash-shift-info">
            Al confirmar, el servidor vuelve a evaluar bajo bloqueo los movimientos. Una venta recién creada quedará completa en el turno correcto.
          </p>
          <button className="cash-shift-primary" type="button" disabled={mutationLocked} onClick={confirm}>Confirmar apertura</button>
        </div>
      ) : null}
      {pendingRequest ? (
        <div className="cash-shift-retry-block">
          <p className="cash-shift-info">Se reutilizarán exactamente la misma solicitud y clave congeladas.</p>
          <button className="cash-shift-primary" type="button" disabled={mutationBusy} onClick={confirm}>Reintentar misma apertura</button>
        </div>
      ) : null}
    </section>
  )
}
