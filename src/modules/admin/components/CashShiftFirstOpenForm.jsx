import { useEffect, useRef, useState } from 'react'

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

const MEXICO_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function mexicoWallTimeToUtc(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new TypeError('La hora inicial no es válida.')
  const desired = match.slice(1).map(Number)
  const target = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4], 0)
  const semantic = new Date(target)
  if (
    semantic.getUTCFullYear() !== desired[0]
    || semantic.getUTCMonth() !== desired[1] - 1
    || semantic.getUTCDate() !== desired[2]
    || desired[3] > 23 || desired[4] > 59
  ) throw new TypeError('La hora inicial no es válida.')

  let instant = target
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      MEXICO_CLOCK.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    )
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    )
    const correction = target - represented
    instant += correction
    if (correction === 0) break
  }
  return new Date(instant).toISOString().replace('T', ' ').slice(0, 19)
}

export default function CashShiftFirstOpenForm({ onPreview, onOpen }) {
  const [draft, setDraft] = useState(initialDraft)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingRequest, setPendingRequest] = useState(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setPreview(null)
    setError('')
  }

  function validatedDraft() {
    const openingFund = Number(draft.openingFund)
    if (
      !['night', 'day'].includes(draft.shiftType)
      || !/^\d{4}-\d{2}-\d{2}$/.test(draft.businessDate)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.startAt)
      || draft.openingFund === ''
      || !Number.isFinite(openingFund)
      || openingFund < 0
    ) {
      throw new TypeError('Completa tipo, fecha operativa, hora inicial y fondo inicial.')
    }
    return {
      shiftType: draft.shiftType,
      businessDate: draft.businessDate,
      startAt: mexicoWallTimeToUtc(draft.startAt),
      openingFund,
    }
  }

  async function review(event) {
    event?.preventDefault?.()
    setError('')
    let request
    try {
      request = validatedDraft()
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    setBusy(true)
    try {
      const response = await onPreview({
        mode: 'initial',
        shiftType: request.shiftType,
        businessDate: request.businessDate,
        startAt: request.startAt,
      })
      if (mounted.current) setPreview(normalizePreview(response))
    } catch {
      if (mounted.current) setError('No se pudo obtener la vista previa del servidor. Inténtalo de nuevo.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function confirm() {
    setError('')
    let request
    try {
      request = pendingRequest || validatedDraft()
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    setBusy(true)
    try {
      const result = await onOpen(request)
      if (!mounted.current) return
      if (result?.status === 'pending') {
        setPendingRequest(result.request || request)
        setError('La respuesta quedó pendiente. Reintenta exactamente la misma apertura.')
        return
      }
      setPendingRequest(null)
    } catch {
      if (mounted.current) setError('No se pudo abrir el primer turno. Conservamos los datos para reintentar.')
    } finally {
      if (mounted.current) setBusy(false)
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
          <select name="shiftType" value={draft.shiftType} onChange={(event) => update('shiftType', event.target.value)}>
            <option value="">Selecciona</option>
            <option value="night">Noche</option>
            <option value="day">Día</option>
          </select>
        </label>
        <label>Fecha operativa
          <input name="businessDate" type="date" value={draft.businessDate} onChange={(event) => update('businessDate', event.target.value)} />
        </label>
        <label>Hora inicial
          <input name="startAt" type="datetime-local" value={draft.startAt} onChange={(event) => update('startAt', event.target.value)} />
        </label>
        <label>Fondo inicial
          <input name="openingFund" type="number" min="0" step="0.01" inputMode="decimal" value={draft.openingFund} onChange={(event) => update('openingFund', event.target.value)} />
        </label>
        <button className="cash-shift-primary" type="button" onClick={(event) => { void review(event) }} disabled={busy || Boolean(pendingRequest)}>
          {busy ? 'Consultando…' : 'Revisar movimientos elegibles'}
        </button>
      </form>

      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}

      {preview ? (
        <div className="cash-shift-preview" aria-live="polite">
          <h3>Vista previa del servidor</h3>
          <p>Generada en: <strong>{preview.serverPreviewAt}</strong></p>
          <p>
            Intervalo: <strong>{preview.interval[0]}</strong> → <strong>{preview.interval[1]}</strong>.
            Incluye el inicio y excluye la hora final.
          </p>
          <div className="cash-shift-preview-counts">
            <span>{preview.salesCount} {preview.salesCount === 1 ? 'venta elegible' : 'ventas elegibles'}</span>
            <span>{preview.expensesCount} {preview.expensesCount === 1 ? 'gasto elegible' : 'gastos elegibles'}</span>
          </div>
          <div className="cash-shift-eligible-grid">
            <section aria-labelledby="cash-shift-eligible-sales-title">
              <h4 id="cash-shift-eligible-sales-title">Ventas elegibles</h4>
              <ul className="cash-shift-eligible-list">
                {preview.sales.map((sale) => (
                  <li key={sale.key}><span>{sale.name}</span><strong>{money(sale.total)}</strong></li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="cash-shift-eligible-expenses-title">
              <h4 id="cash-shift-eligible-expenses-title">Gastos elegibles</h4>
              <ul className="cash-shift-eligible-list">
                {preview.expenses.map((expense) => (
                  <li key={expense.key}><span>{expense.name}</span><strong>{money(expense.total)}</strong></li>
                ))}
              </ul>
            </section>
          </div>
          <dl className="cash-shift-preview-totals">
            <div><dt>Ventas en efectivo</dt><dd>{money(preview.totals.cash)}</dd></div>
            <div><dt>Ventas con terminal</dt><dd>{money(preview.totals.card)}</dd></div>
            <div><dt>Ventas totales</dt><dd>{money(preview.totals.sales)}</dd></div>
            <div><dt>Gastos</dt><dd>{money(preview.totals.expenses)}</dd></div>
          </dl>
          <p className="cash-shift-info">
            Al confirmar, el servidor vuelve a evaluar bajo bloqueo los movimientos. Una venta recién creada quedará completa en el turno correcto.
          </p>
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={confirm}>Confirmar apertura</button>
        </div>
      ) : null}
      {pendingRequest ? (
        <button className="cash-shift-primary" type="button" disabled={busy} onClick={confirm}>Reintentar misma apertura</button>
      ) : null}
    </section>
  )
}
