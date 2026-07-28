import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CASH_SHIFT_DENOMINATIONS,
  nextTransitionLabel,
  normalizeCashShift,
} from '../cashShiftModel.js'
import {
  buildCashShiftCloseOperation,
  calculateCloseFeedback,
  cashShiftEvidenceBinding,
  hasCashDifference,
  readEvidenceFile,
} from '../cashShiftCloseModel.js'
import CashShiftAdjustments from './CashShiftAdjustments.jsx'
import CashShiftDenominations from './CashShiftDenominations.jsx'

const EVIDENCE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function rawAdjustments(rows) {
  return rows.map((row) => ({
    type: row.type,
    concept: row.concept,
    amount: Number(row.amount),
  }))
}

function unwrap(raw) {
  const envelope = raw?.result ?? raw
  if (envelope?.ok === false) throw new Error('cash_shift_request_rejected')
  return envelope?.data ?? envelope
}

function initialCounts() {
  return Object.fromEntries(CASH_SHIFT_DENOMINATIONS.map((denomination) => [denomination, '0']))
}

function denominationLines(counts) {
  return CASH_SHIFT_DENOMINATIONS.map((denomination) => ({
    denomination,
    count: /^\d+$/.test(String(counts[denomination] ?? ''))
      ? Number(counts[denomination])
      : Number.NaN,
  }))
}

function AuditList({ rows, empty, renderRow }) {
  if (!rows.length) return <p className="cash-shift-muted">{empty}</p>
  return (
    <ul className="cash-shift-audit-list">
      {rows.map((row, index) => <li key={row.id || row.order_id || row.expense_id || index}>{renderRow(row)}</li>)}
    </ul>
  )
}

function AuditPreview({ cashShift }) {
  const otherPayments = cashShift.payments.rows.reduce((total, row) => (
    ['cash', 'card'].includes(row.method) ? total : total + row.amount
  ), 0)
  return (
    <div className="cash-shift-audit-sections">
      <section><h3>Tickets y ventas</h3><AuditList rows={cashShift.sales} empty="Sin ventas en este turno." renderRow={(row) => <><span>{row.name}</span><strong>{money(row.amount_total)}</strong></>} /></section>
      <section>
        <h3>Pagos</h3>
        <dl className="cash-shift-preview-totals">
          <div><dt>Efectivo</dt><dd>{money(cashShift.payments.cash)}</dd></div>
          <div><dt>Terminal</dt><dd>{money(cashShift.payments.card)}</dd></div>
          <div><dt>Otros</dt><dd>{money(otherPayments)}</dd></div>
          <div><dt>Total</dt><dd>{money(cashShift.payments.total)}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Productos</h3>
        <AuditList rows={cashShift.products} empty="Sin productos realizados." renderRow={(row) => <><span>{row.product_name} · {row.quantity} u.</span><strong>{money(row.amount_total)}</strong>{row.weight_unknown ? <small>Peso faltante</small> : null}</>} />
        <p className="cash-shift-muted">{cashShift.productTotals.quantity} unidades · {money(cashShift.productTotals.amount_total)} · {cashShift.productTotals.weight_total_kg} kg conocidos · {cashShift.productTotals.products_without_weight} sin peso</p>
      </section>
      <section><h3>Cancelaciones</h3><AuditList rows={cashShift.cancellations} empty="Sin cancelaciones." renderRow={(row) => <><span>{row.name} · {row.reason_text || 'Sin motivo histórico'}</span><strong>{money(row.amount_total)}</strong></>} /></section>
      <section><h3>Gastos</h3><AuditList rows={cashShift.expenses} empty="Sin gastos." renderRow={(row) => <><span>{row.concept || row.name}</span><strong>{money(row.amount)}</strong></>} /></section>
      <section>
        <h3>Base de efectivo</h3>
        <dl className="cash-shift-preview-totals">
          <div><dt>Fondo inicial</dt><dd>{money(cashShift.openingFund)}</dd></div>
          <div><dt>Efectivo esperado</dt><dd>{money(cashShift.totals.expectedCash)}</dd></div>
        </dl>
      </section>
    </div>
  )
}

export default function CashShiftCloseForm({
  cashShift,
  onPreview,
  onClose,
  onEvidence,
  onCompleted = async () => {},
  onStale = async () => {},
  readEvidence = readEvidenceFile,
  onCancel = null,
}) {
  const binding = cashShiftEvidenceBinding(cashShift)
  const [preview, setPreview] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(true)
  const [counts, setCounts] = useState(initialCounts)
  const [adjustments, setAdjustments] = useState([])
  const [notes, setNotes] = useState('')
  const [nextOpeningFund, setNextOpeningFund] = useState('')
  const [evidence, setEvidence] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [completed, setCompleted] = useState(null)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const previewGeneration = useRef(0)
  const uploadGeneration = useRef(0)
  const mutationInFlight = useRef(false)
  const formLockedRef = useRef(false)
  const adjustmentSequence = useRef(0)
  const bindingRef = useRef(binding.key)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      previewGeneration.current += 1
      uploadGeneration.current += 1
      mutationInFlight.current = false
      formLockedRef.current = true
    }
  }, [])

  const refreshPreview = useCallback(async ({ preserveError = false } = {}) => {
    const generation = ++previewGeneration.current
    setPreviewBusy(true)
    if (!preserveError) setError('')
    try {
      const response = await onPreview({ mode: 'active', shiftId: binding.shiftId })
      const normalized = normalizeCashShift(unwrap(response))
      if (cashShiftEvidenceBinding(normalized).key !== binding.key) {
        throw Object.assign(new TypeError('La vista previa corresponde a otra versión.'), {
          code: 'stale_preview',
        })
      }
      if (mounted.current && generation === previewGeneration.current) setPreview(normalized)
    } catch (previewError) {
      if (mounted.current && generation === previewGeneration.current) {
        if (previewError?.code === 'stale_preview') {
          uploadGeneration.current += 1
          setEvidence(null)
          setError('El turno cambió de modo o versión. Conservamos el arqueo; vuelve a subir la fotografía después de actualizar el turno.')
        } else {
          setError('No se pudo actualizar la vista previa autoritativa. Reintenta antes de cortar.')
        }
      }
    } finally {
      if (mounted.current && generation === previewGeneration.current) setPreviewBusy(false)
    }
  }, [binding.key, binding.shiftId, onPreview])

  useEffect(() => {
    let bindingChanged = false
    if (bindingRef.current !== binding.key) {
      bindingChanged = true
      bindingRef.current = binding.key
      uploadGeneration.current += 1
      setEvidence(null)
      setPendingRequest(null)
      setCompleted(null)
      formLockedRef.current = false
      setError('La versión o el modo cambió. Vuelve a subir la fotografía para continuar.')
    }
    void refreshPreview({ preserveError: bindingChanged })
    return () => { previewGeneration.current += 1 }
  }, [binding.key, refreshPreview])

  function updateCount(denomination, value) {
    if (formLockedRef.current) return
    if (value !== '' && !/^\d+$/.test(value)) return
    setCounts((current) => ({ ...current, [denomination]: value }))
    setError('')
  }

  function addAdjustment() {
    if (formLockedRef.current) return
    const id = ++adjustmentSequence.current
    setAdjustments((current) => [...current, { id, type: 'income', concept: '', amount: '' }])
  }

  function updateAdjustment(id, field, value) {
    if (formLockedRef.current) return
    setAdjustments((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )))
    setError('')
  }

  function removeAdjustment(id) {
    if (formLockedRef.current) return
    setAdjustments((current) => current.filter((row) => row.id !== id))
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    uploadGeneration.current += 1
    setEvidence(null)
    setError('')
    if (!file) return
    if (!EVIDENCE_MIMES.has(file.type)) {
      setError('La fotografía debe ser JPEG, PNG o WebP.')
      return
    }
    const generation = uploadGeneration.current
    const expectedBinding = binding.key
    setUploadBusy(true)
    try {
      const fileBase64 = await readEvidence(file)
      if (!mounted.current || generation !== uploadGeneration.current || expectedBinding !== bindingRef.current) return
      const response = await onEvidence({
        shiftId: binding.shiftId,
        expectedVersion: binding.expectedVersion,
        purpose: binding.purpose,
        filename: file.name,
        fileBase64,
        mimeType: file.type,
      })
      const data = unwrap(response)
      const token = String(data?.evidence_token || '').trim()
      if (!token) throw new TypeError('El servidor no confirmó la evidencia.')
      if (mounted.current && generation === uploadGeneration.current && expectedBinding === bindingRef.current) {
        setEvidence({ token, filename: file.name, bindingKey: expectedBinding })
      }
    } catch {
      if (mounted.current && generation === uploadGeneration.current) {
        setError('No se pudo subir la fotografía. Selecciónala de nuevo para reintentar.')
      }
    } finally {
      if (mounted.current && generation === uploadGeneration.current) setUploadBusy(false)
    }
  }

  const draftState = useMemo(() => {
    if (!preview) return { operation: null, error: null }
    try {
      return {
        operation: buildCashShiftCloseOperation({
          cashShift: preview,
          denominations: denominationLines(counts),
          adjustments: rawAdjustments(adjustments),
          notes,
          evidenceToken: evidence?.bindingKey === binding.key ? evidence.token : '',
          nextOpeningFund,
        }),
        error: null,
      }
    } catch (draftError) {
      let feedback = null
      try {
        feedback = calculateCloseFeedback({
          serverExpectedCash: preview.totals.expectedCash,
          denominations: denominationLines(counts),
          adjustments: rawAdjustments(adjustments),
        })
      } catch {
        // El mensaje de validación principal se muestra junto al formulario.
      }
      return { operation: null, feedback, error: draftError.message }
    }
  }, [adjustments, binding.key, counts, evidence, nextOpeningFund, notes, preview])
  const feedback = draftState.operation?.feedback || draftState.feedback
  const locked = mutationBusy || Boolean(pendingRequest) || Boolean(completed)

  async function submit() {
    if (mutationInFlight.current || completed) return
    setError('')
    const operation = pendingRequest
      ? { operation: binding.purpose, request: pendingRequest }
      : draftState.operation
    if (!operation) {
      setError(draftState.error || 'Completa el arqueo antes de continuar.')
      return
    }
    mutationInFlight.current = true
    formLockedRef.current = true
    setMutationBusy(true)
    let keepLocked = Boolean(pendingRequest || completed)
    try {
      const result = await onClose(operation.operation, operation.request)
      if (!mounted.current) return
      if (result?.status === 'pending') {
        keepLocked = true
        setPendingRequest(result.request || operation.request)
        setError('La respuesta quedó pendiente. Reintenta exactamente la misma operación y clave.')
        return
      }
      setPendingRequest(null)
      keepLocked = true
      const response = unwrap(result?.data)
      setCompleted(response)
      await onCompleted({ mode: operation.operation, result: response, request: operation.request })
    } catch (mutationError) {
      if (!mounted.current) return
      if (mutationError?.code === 'stale_version') {
        uploadGeneration.current += 1
        setEvidence(null)
        const staleMessage = 'El turno cambió en otra sesión. Conservamos el arqueo; revisa la vista actualizada y vuelve a subir la fotografía.'
        setError(staleMessage)
        await Promise.allSettled([refreshPreview(), onStale({ shiftId: binding.shiftId })])
        if (mounted.current) setError(staleMessage)
      } else {
        setError('No se pudo guardar el corte. Conservamos el arqueo y la evidencia para reintentar.')
      }
    } finally {
      mutationInFlight.current = false
      if (!keepLocked) formLockedRef.current = false
      if (mounted.current) setMutationBusy(false)
    }
  }

  const fallbackLabel = binding.purpose === 'reclose'
    ? `Volver a cerrar ${cashShift.shift.type === 'night' ? 'Noche' : 'Día'} ${Number(cashShift.shift.businessDate.slice(-2))}`
    : nextTransitionLabel(cashShift.shift)

  return (
    <section className="cash-shift-card cash-shift-close" aria-labelledby="cash-shift-close-title">
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">{binding.purpose === 'reclose' ? 'RECIERRE' : 'HACER CORTE'}</p>
          <h2 id="cash-shift-close-title">{fallbackLabel}</h2>
        </div>
        {onCancel ? <button className="cash-shift-secondary" type="button" disabled={locked} onClick={onCancel}>Volver</button> : null}
      </div>
      <p className="cash-shift-info" role="status">
        Se actualiza la vista del servidor antes de cerrar. Sus totales y la respuesta final son autoritativos.
      </p>
      {previewBusy ? <p role="status">Actualizando vista previa…</p> : null}
      {!previewBusy && !preview ? <button className="cash-shift-primary" type="button" onClick={refreshPreview}>Reintentar vista previa</button> : null}
      {preview ? <AuditPreview cashShift={preview} /> : null}

      <div className="cash-shift-reconciliation">
        <CashShiftDenominations counts={counts} disabled={locked} onChange={updateCount} />
        <CashShiftAdjustments rows={adjustments} disabled={locked} onAdd={addAdjustment} onChange={updateAdjustment} onRemove={removeAdjustment} />
        {feedback ? (
          <dl className="cash-shift-totals-grid cash-shift-reconcile-totals">
            <div><dt>Esperado del servidor</dt><dd>{money(feedback.serverExpectedCash)}</dd></div>
            <div><dt>Esperado con ajustes</dt><dd>{money(feedback.adjustedExpectedCash)}</dd></div>
            <div><dt>Efectivo físico</dt><dd>{money(feedback.physicalCash)}</dd></div>
            <div className="cash-shift-total-emphasis"><dt>Diferencia</dt><dd>{money(feedback.difference)}</dd></div>
          </dl>
        ) : null}
        {feedback && hasCashDifference(feedback.difference) ? (
          <p className="cash-shift-warning" role="status">
            Toda diferencia, sin importar el umbral de autorización, requiere nota y fotografía. El servidor decidirá si corresponde gerencia o dirección.
          </p>
        ) : null}
        <div className="cash-shift-form cash-shift-close-fields">
          <label>Nota de diferencia
            <textarea name="differenceNote" disabled={locked} value={notes} onChange={(event) => {
              if (!formLockedRef.current) setNotes(event.target.value)
            }} />
          </label>
          <label>Fotografía del arqueo
            <input name="evidencePhoto" type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || uploadBusy} onChange={uploadPhoto} />
          </label>
          {binding.purpose === 'close' ? (
            <label>Fondo inicial del siguiente turno
              <input name="nextOpeningFund" type="number" inputMode="decimal" min="0" step="0.01" disabled={locked} value={nextOpeningFund} onChange={(event) => {
                if (!formLockedRef.current) setNextOpeningFund(event.target.value)
              }} />
            </label>
          ) : null}
        </div>
        {uploadBusy ? <p role="status">Subiendo fotografía…</p> : null}
        {evidence ? <p className="cash-shift-info" role="status">Fotografía lista: {evidence.filename}</p> : null}
        {draftState.error && !error ? <p className="cash-shift-muted">{draftState.error}</p> : null}
        {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
        {completed ? (
          <p className="cash-shift-info" role="status">
            {completed.state === 'pending_auth'
              ? `Corte guardado en autorización pendiente · versión ${completed.version}.`
              : `Corte guardado · versión ${completed.version}.`}
          </p>
        ) : null}
        <div className="cash-shift-actions">
          {pendingRequest ? (
            <button className="cash-shift-primary" type="button" disabled={mutationBusy} onClick={submit}>Reintentar mismo corte</button>
          ) : !completed ? (
            <button className="cash-shift-primary" type="button" disabled={previewBusy || uploadBusy || mutationBusy || !draftState.operation} onClick={submit}>{fallbackLabel}</button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
