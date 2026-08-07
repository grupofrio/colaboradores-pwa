import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CASH_SHIFT_DENOMINATIONS,
  nextTransitionLabel,
  normalizeCashShift,
  normalizePendingCashShiftPreview,
} from '../cashShiftModel.js'
import {
  buildCashShiftCloseOperation,
  calculateCloseFeedback,
  cashShiftCloseBinding,
  hasCashDifference,
} from '../cashShiftCloseModel.js'
import CashShiftAdjustments from './CashShiftAdjustments.jsx'
import CashShiftDenominations from './CashShiftDenominations.jsx'

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

function PendingCountPreview({ cashShift }) {
  const boundary = cashShift.boundary
  return (
    <div className="cash-shift-audit-sections">
      <section>
        <h3>Totales autoritativos del periodo</h3>
        <dl className="cash-shift-preview-totals">
          <div><dt>Ventas en efectivo</dt><dd>{money(cashShift.totals.salesCash)}</dd></div>
          <div><dt>Ventas con terminal</dt><dd>{money(cashShift.totals.salesCard)}</dd></div>
          <div><dt>Gastos</dt><dd>{money(cashShift.totals.expenses)}</dd></div>
          <div><dt>Efectivo esperado</dt><dd>{money(cashShift.totals.expectedCash)}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Frontera operativa</h3>
        <dl className="cash-shift-preview-totals">
          <div><dt>Programada</dt><dd>{boundary.scheduledBoundaryAt}</dd></div>
          <div><dt>Ejecutada</dt><dd>{boundary.executedAt}</dd></div>
          <div><dt>Fin del periodo</dt><dd>{boundary.operationalClosedAt}</dd></div>
          <div><dt>Turno sucesor</dt><dd>{boundary.nextShiftId ? `#${boundary.nextShiftId}` : 'Por confirmar'}</dd></div>
        </dl>
        {boundary.lateExecution ? <p className="cash-shift-warning">La frontera se ejecutó tarde; la nota del arqueo es obligatoria.</p> : null}
      </section>
    </div>
  )
}

function normalizeClosePreview(raw, purpose) {
  const data = unwrap(raw)
  return purpose === 'settle'
    ? normalizePendingCashShiftPreview(data)
    : normalizeCashShift(data)
}

export default function CashShiftCloseForm({
  cashShift,
  sessionIdentity = 'cash-shift-session',
  onPreview,
  onClose,
  onCompleted = async () => {},
  onStale = async () => {},
  onPendingCountRequired = async () => {},
  onCancel = null,
}) {
  const binding = cashShiftCloseBinding(cashShift)
  const [preview, setPreview] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(true)
  const [counts, setCounts] = useState(initialCounts)
  const [adjustments, setAdjustments] = useState([])
  const [notes, setNotes] = useState('')
  const [nextOpeningFund, setNextOpeningFund] = useState('')
  const [separationConfirmed, setSeparationConfirmed] = useState(null)
  const [separationExceptionNote, setSeparationExceptionNote] = useState('')
  const [mutationBusy, setMutationBusy] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [completed, setCompleted] = useState(null)
  const [staleStatus, setStaleStatus] = useState(null)
  const [pendingCountRedirect, setPendingCountRedirect] = useState(null)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const previewGeneration = useRef(0)
  const staleReloadGeneration = useRef(0)
  const mutationInFlight = useRef(null)
  const staleReloadInFlight = useRef(null)
  const staleRecoveryRef = useRef(false)
  const formLockedRef = useRef(false)
  const adjustmentSequence = useRef(0)
  const bindingRef = useRef(binding.key)
  const previewBindingRef = useRef('')
  const workflowRef = useRef({ identity: sessionIdentity, generation: 0 })
  if (workflowRef.current.identity !== sessionIdentity) {
    workflowRef.current = {
      identity: sessionIdentity,
      generation: workflowRef.current.generation + 1,
    }
    previewGeneration.current += 1
    staleReloadGeneration.current += 1
    mutationInFlight.current = null
    staleReloadInFlight.current = null
    staleRecoveryRef.current = false
  }

  function captureWorkflow() {
    return { ...workflowRef.current }
  }

  function workflowIsCurrent(workflow) {
    return Boolean(
      mounted.current
      && workflow.identity === workflowRef.current.identity
      && workflow.generation === workflowRef.current.generation,
    )
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      previewGeneration.current += 1
      staleReloadGeneration.current += 1
      mutationInFlight.current = null
      staleReloadInFlight.current = null
      formLockedRef.current = true
    }
  }, [])

  useEffect(() => {
    previewGeneration.current += 1
    staleReloadGeneration.current += 1
    mutationInFlight.current = null
    staleReloadInFlight.current = null
    previewBindingRef.current = ''
    formLockedRef.current = false
    setPreview(null)
    setCounts(initialCounts())
    setAdjustments([])
    setNotes('')
    setNextOpeningFund('')
    setSeparationConfirmed(null)
    setSeparationExceptionNote('')
    setMutationBusy(false)
    setPendingRequest(null)
    setCompleted(null)
    setStaleStatus(null)
    setPendingCountRedirect(null)
    setError('')
  }, [sessionIdentity])

  const refreshPreview = useCallback(async ({ preserveError = false } = {}) => {
    const generation = ++previewGeneration.current
    const workflow = captureWorkflow()
    setPreviewBusy(true)
    if (!preserveError) setError('')
    try {
      const response = await onPreview({
        mode: binding.purpose === 'settle' ? 'pending' : 'active',
        shiftId: binding.shiftId,
      })
      const normalized = normalizeClosePreview(response, binding.purpose)
      if (cashShiftCloseBinding(normalized).key !== binding.key) {
        throw Object.assign(new TypeError('La vista previa corresponde a otra versión.'), {
          code: 'stale_preview',
        })
      }
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) {
        previewBindingRef.current = binding.key
        setPreview(normalized)
      }
    } catch (previewError) {
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) {
        if (previewError?.code === 'stale_preview') {
          setError('El turno cambió de modo o versión. Conservamos el arqueo para revisarlo después de actualizar el turno.')
        } else {
          setError('No se pudo actualizar la vista previa autoritativa. Reintenta antes de cortar.')
        }
      }
    } finally {
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) setPreviewBusy(false)
    }
  }, [binding.key, binding.purpose, binding.shiftId, onPreview])

  useEffect(() => {
    let bindingChanged = false
    const authoritativeReload = staleRecoveryRef.current
    if (bindingRef.current !== binding.key) {
      bindingChanged = true
      bindingRef.current = binding.key
      setPendingRequest(null)
      setCompleted(null)
      if (!authoritativeReload) {
        setStaleStatus(null)
        formLockedRef.current = false
        setError('La versión o el modo cambió. Revisa el arqueo antes de continuar.')
      }
      if (authoritativeReload) staleRecoveryRef.current = false
    }
    if (!authoritativeReload && previewBindingRef.current !== binding.key) {
      void refreshPreview({ preserveError: bindingChanged })
    }
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

  const draftState = useMemo(() => {
    if (!preview) return { operation: null, error: null }
    try {
      return {
        operation: buildCashShiftCloseOperation({
          cashShift: preview,
          denominations: denominationLines(counts),
          adjustments: rawAdjustments(adjustments),
          notes,
          nextOpeningFund,
          separationConfirmed,
          separationExceptionNote,
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
  }, [adjustments, counts, nextOpeningFund, notes, preview, separationConfirmed, separationExceptionNote])
  const feedback = draftState.operation?.feedback || draftState.feedback
  const staleLocked = ['reloading', 'stale_requires_reload'].includes(staleStatus)
  const locked = mutationBusy || Boolean(pendingRequest) || Boolean(completed) || staleLocked || Boolean(pendingCountRedirect)

  async function redirectToPendingCount(shiftId) {
    if (!Number.isSafeInteger(shiftId) || shiftId < 1) {
      throw new TypeError('El turno pendiente no es válido.')
    }
    await onPendingCountRequired({ shiftId })
  }

  async function reloadAuthoritativeShift() {
    if (staleReloadInFlight.current) return staleReloadInFlight.current.promise
    const workflow = captureWorkflow()
    const generation = ++staleReloadGeneration.current
    const marker = { workflow, generation, promise: null }
    staleReloadInFlight.current = marker
    formLockedRef.current = true
    setStaleStatus('reloading')
    setPreviewBusy(true)
    setError('El turno cambió y el arqueo conservado todavía no es autoritativo. Recargando los totales actuales…')
    marker.promise = (async () => {
      try {
        const normalized = normalizeClosePreview(
          await onStale({
            shiftId: binding.shiftId,
            mode: binding.purpose,
            expectedVersion: binding.expectedVersion,
          }),
          binding.purpose,
        )
        if (!workflowIsCurrent(workflow) || generation !== staleReloadGeneration.current) return null
        const refreshedBinding = cashShiftCloseBinding(normalized)
        if (
          (binding.purpose === 'reclose' && (normalized.shift.state !== 'reopened' || normalized.shift.id !== binding.shiftId))
          || (binding.purpose === 'close' && !['open', 'reopened'].includes(normalized.shift.state))
          || (binding.purpose === 'settle' && normalized.shift.state !== 'pending_count')
        ) throw new TypeError('La recarga no corresponde al corte vigente.')
        bindingRef.current = refreshedBinding.key
        previewBindingRef.current = refreshedBinding.key
        setPreview(normalized)
        setPendingRequest(null)
        setCompleted(null)
        setStaleStatus('review_required')
        setError('Los totales actualizados cambiaron respecto al borrador. Revisa el arqueo conservado antes de cerrar.')
        formLockedRef.current = false
        return normalized
      } catch (reloadError) {
        if (!workflowIsCurrent(workflow) || generation !== staleReloadGeneration.current) return null
        setPreview(null)
        setStaleStatus('stale_requires_reload')
        setError('El turno cambió y los totales del borrador no son autoritativos. Recarga el corte antes de continuar.')
        formLockedRef.current = true
        return null
      } finally {
        if (staleReloadInFlight.current === marker) staleReloadInFlight.current = null
        if (workflowIsCurrent(workflow) && generation === staleReloadGeneration.current) setPreviewBusy(false)
      }
    })()
    return marker.promise
  }

  async function submit() {
    if (mutationInFlight.current || completed || staleLocked) return
    setError('')
    staleRecoveryRef.current = false
    const operation = pendingRequest
      ? { operation: binding.purpose, request: pendingRequest }
      : draftState.operation
    if (!operation) {
      setError(draftState.error || 'Completa el arqueo antes de continuar.')
      return
    }
    const workflow = captureWorkflow()
    const marker = { workflow }
    mutationInFlight.current = marker
    formLockedRef.current = true
    setMutationBusy(true)
    let keepLocked = Boolean(pendingRequest || completed)
    try {
      const result = await onClose(operation.operation, operation.request)
      if (!workflowIsCurrent(workflow) || mutationInFlight.current !== marker) return
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
      if (!workflowIsCurrent(workflow) || mutationInFlight.current !== marker) return
      if (mutationError?.code === 'pending_count_required') {
        const shiftId = Number(mutationError?.details?.shift_id)
        if (!Number.isSafeInteger(shiftId) || shiftId < 1) {
          setError('El servidor indicó un arqueo pendiente sin un turno válido. Actualiza la página antes de continuar.')
          keepLocked = false
        } else {
          setPendingCountRedirect({ shiftId })
          keepLocked = true
          try {
            await redirectToPendingCount(shiftId)
          } catch {
            if (workflowIsCurrent(workflow) && mutationInFlight.current === marker) {
              setError('El turno se separó automáticamente. Abre el arqueo pendiente para continuar; no reintentes el cierre normal.')
            }
          }
        }
      } else if (mutationError?.code === 'stale_version') {
        staleRecoveryRef.current = true
        setPendingRequest(null)
        setCompleted(null)
        setPreview(null)
        keepLocked = true
        await reloadAuthoritativeShift()
      } else if (pendingRequest) {
        setPendingRequest(null)
        setCompleted(null)
        keepLocked = false
        setError('El intento pendiente fue rechazado. Conservamos el arqueo para crear una operación nueva.')
      } else {
        setError('No se pudo guardar el corte. Conservamos el arqueo para reintentar.')
      }
    } finally {
      if (mutationInFlight.current === marker) mutationInFlight.current = null
      if (!keepLocked) formLockedRef.current = false
      if (workflowIsCurrent(workflow)) setMutationBusy(false)
    }
  }

  const fallbackLabel = binding.purpose === 'settle'
    ? `Guardar arqueo pendiente ${cashShift.shift.type === 'night' ? 'Noche' : 'Día'} ${Number(cashShift.shift.businessDate.slice(-2))}`
    : binding.purpose === 'reclose'
      ? `Volver a cerrar ${cashShift.shift.type === 'night' ? 'Noche' : 'Día'} ${Number(cashShift.shift.businessDate.slice(-2))}`
      : nextTransitionLabel(cashShift.shift)

  return (
    <section className="cash-shift-card cash-shift-close" aria-labelledby="cash-shift-close-title">
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">{binding.purpose === 'settle' ? 'ARQUEO DIFERIDO' : binding.purpose === 'reclose' ? 'RECIERRE' : 'HACER CORTE'}</p>
          <h2 id="cash-shift-close-title">{fallbackLabel}</h2>
        </div>
        {onCancel ? <button className="cash-shift-secondary" type="button" disabled={locked} onClick={onCancel}>Volver</button> : null}
      </div>
      {binding.purpose === 'settle' ? (
        <p className="cash-shift-automatic-label" role="status">
          Arqueo posterior a cierre automático. El turno sucesor continúa operando con fondo $0.00; este formulario no crea ni modifica otro turno.
        </p>
      ) : (
        <p className="cash-shift-info" role="status">
          Se actualiza la vista del servidor antes de cerrar. Sus totales y la respuesta final son autoritativos.
        </p>
      )}
      {previewBusy ? <p role="status">Actualizando vista previa…</p> : null}
      {!previewBusy && !preview && !staleStatus ? <button className="cash-shift-primary" type="button" onClick={refreshPreview}>Reintentar vista previa</button> : null}
      {preview ? (binding.purpose === 'settle' ? <PendingCountPreview cashShift={preview} /> : <AuditPreview cashShift={preview} />) : null}

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
            Toda diferencia, sin importar el umbral de autorización, requiere nota. El servidor decidirá si corresponde gerencia o dirección.
          </p>
        ) : null}
        <div className="cash-shift-form cash-shift-close-fields">
          <label>Nota de diferencia
            <textarea name="differenceNote" disabled={locked} value={notes} onChange={(event) => {
              if (!formLockedRef.current) setNotes(event.target.value)
            }} />
          </label>
          {binding.purpose === 'close' ? (
            <label>Fondo inicial del siguiente turno
              <input name="nextOpeningFund" type="number" inputMode="decimal" min="0" step="0.01" disabled={locked} value={nextOpeningFund} onChange={(event) => {
                if (!formLockedRef.current) setNextOpeningFund(event.target.value)
              }} />
            </label>
          ) : null}
        </div>
        {binding.purpose === 'settle' ? (
          <section className="cash-shift-separation-confirmation" aria-labelledby="cash-separation-title">
            <h3 id="cash-separation-title">Separación física del efectivo</h3>
            <p className="cash-shift-muted">Confirma la condición real del efectivo del turno terminado. No registramos una separación que no ocurrió.</p>
            <div className="cash-shift-choice-list">
              <label>
                <input
                  type="radio"
                  name="cashSeparationConfirmed"
                  checked={separationConfirmed === true}
                  disabled={locked}
                  onChange={() => setSeparationConfirmed(true)}
                />
                Confirmo que el efectivo fue separado y etiquetado.
              </label>
              <label>
                <input
                  type="radio"
                  name="cashSeparationConfirmed"
                  checked={separationConfirmed === false}
                  disabled={locked}
                  onChange={() => setSeparationConfirmed(false)}
                />
                El efectivo no se separó a tiempo.
              </label>
            </div>
            {separationConfirmed === false ? (
              <label className="cash-shift-single-field">Explica la excepción de separación
                <textarea
                  name="separationExceptionNote"
                  disabled={locked}
                  value={separationExceptionNote}
                  onChange={(event) => setSeparationExceptionNote(event.target.value)}
                />
              </label>
            ) : null}
          </section>
        ) : null}
        {draftState.error && !error ? <p className="cash-shift-muted">{draftState.error}</p> : null}
        {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
        {completed ? (
          <p className="cash-shift-info" role="status">
            {completed.state === 'pending_auth'
              ? `Corte guardado en autorización pendiente · versión ${completed.version}.`
              : `Corte guardado · versión ${completed.version}.`}
          </p>
        ) : null}
        {staleStatus === 'review_required' ? (
          <p className="cash-shift-warning" role="status">Los totales actualizados ya son autoritativos. Revisa el arqueo conservado antes de cerrar.</p>
        ) : null}
        <div className="cash-shift-actions">
          {pendingCountRedirect ? (
            <button
              className="cash-shift-primary"
              type="button"
              disabled={mutationBusy}
              onClick={() => {
                void redirectToPendingCount(pendingCountRedirect.shiftId).catch(() => {
                  setError('El turno se separó automáticamente. Abre el arqueo pendiente para continuar; no reintentes el cierre normal.')
                })
              }}
            >
              Abrir arqueo pendiente
            </button>
          ) : ['reloading', 'stale_requires_reload'].includes(staleStatus) ? (
            <button className="cash-shift-primary" type="button" disabled={staleStatus === 'reloading'} onClick={reloadAuthoritativeShift}>Recargar corte</button>
          ) : pendingRequest ? (
            <button className="cash-shift-primary" type="button" disabled={mutationBusy} onClick={submit}>Reintentar mismo corte</button>
          ) : !completed ? (
            <button className="cash-shift-primary" type="button" disabled={previewBusy || mutationBusy || !draftState.operation} onClick={submit}>{fallbackLabel}</button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
