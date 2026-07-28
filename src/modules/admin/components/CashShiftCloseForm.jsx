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
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024
const defaultNow = () => Date.now()

function ownDataValue(record, key) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('El comprobante de evidencia no es válido.')
  }
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw new TypeError('El comprobante de evidencia no es válido.')
  }
  return descriptor.value
}

function odooUtcTimestamp(value) {
  if (typeof value !== 'string') throw new TypeError('La vigencia de evidencia no es válida.')
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new TypeError('La vigencia de evidencia no es válida.')
  const parts = match.slice(1).map(Number)
  const timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== parts[0]
    || date.getUTCMonth() !== parts[1] - 1
    || date.getUTCDate() !== parts[2]
    || date.getUTCHours() !== parts[3]
    || date.getUTCMinutes() !== parts[4]
    || date.getUTCSeconds() !== parts[5]
  ) throw new TypeError('La vigencia de evidencia no es válida.')
  return timestamp
}

function validateEvidenceReceipt(data, { binding, file, nowMs }) {
  const token = ownDataValue(data, 'evidence_token')
  const shiftId = ownDataValue(data, 'shift_id')
  const expectedVersion = ownDataValue(data, 'expected_version')
  const purpose = ownDataValue(data, 'purpose')
  const mimetype = ownDataValue(data, 'mimetype')
  const fileSize = ownDataValue(data, 'file_size')
  const expiresAtMs = odooUtcTimestamp(ownDataValue(data, 'expires_at'))
  if (
    typeof token !== 'string' || !token.trim()
    || shiftId !== binding.shiftId
    || expectedVersion !== binding.expectedVersion
    || purpose !== binding.purpose
    || mimetype !== file.type
    || fileSize !== file.size
    || !Number.isFinite(nowMs)
    || expiresAtMs <= nowMs
  ) throw new TypeError('El comprobante de evidencia no corresponde al corte actual.')
  return { token: token.trim(), expiresAtMs }
}

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
  sessionIdentity = 'cash-shift-session',
  onPreview,
  onClose,
  onEvidence,
  onCompleted = async () => {},
  onStale = async () => {},
  readEvidence = readEvidenceFile,
  now = defaultNow,
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
  const [staleStatus, setStaleStatus] = useState(null)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const previewGeneration = useRef(0)
  const uploadGeneration = useRef(0)
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
    uploadGeneration.current += 1
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
      uploadGeneration.current += 1
      staleReloadGeneration.current += 1
      mutationInFlight.current = null
      staleReloadInFlight.current = null
      formLockedRef.current = true
    }
  }, [])

  useEffect(() => {
    previewGeneration.current += 1
    uploadGeneration.current += 1
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
    setEvidence(null)
    setUploadBusy(false)
    setMutationBusy(false)
    setPendingRequest(null)
    setCompleted(null)
    setStaleStatus(null)
    setError('')
  }, [sessionIdentity])

  const refreshPreview = useCallback(async ({ preserveError = false } = {}) => {
    const generation = ++previewGeneration.current
    const workflow = captureWorkflow()
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
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) {
        previewBindingRef.current = binding.key
        setPreview(normalized)
      }
    } catch (previewError) {
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) {
        if (previewError?.code === 'stale_preview') {
          uploadGeneration.current += 1
          setEvidence(null)
          setError('El turno cambió de modo o versión. Conservamos el arqueo; vuelve a subir la fotografía después de actualizar el turno.')
        } else {
          setError('No se pudo actualizar la vista previa autoritativa. Reintenta antes de cortar.')
        }
      }
    } finally {
      if (workflowIsCurrent(workflow) && generation === previewGeneration.current) setPreviewBusy(false)
    }
  }, [binding.key, binding.shiftId, onPreview])

  useEffect(() => {
    let bindingChanged = false
    const authoritativeReload = staleRecoveryRef.current
    if (bindingRef.current !== binding.key) {
      bindingChanged = true
      bindingRef.current = binding.key
      uploadGeneration.current += 1
      setEvidence(null)
      setPendingRequest(null)
      setCompleted(null)
      if (!authoritativeReload) {
        setStaleStatus(null)
        formLockedRef.current = false
        setError('La versión o el modo cambió. Vuelve a subir la fotografía para continuar.')
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
    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      setError('La fotografía está vacía y no puede usarse como evidencia.')
      return
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      setError('La fotografía no puede exceder 5 MB.')
      return
    }
    const generation = uploadGeneration.current
    const workflow = captureWorkflow()
    const expectedBinding = binding.key
    setUploadBusy(true)
    try {
      const fileBase64 = await readEvidence(file)
      if (!workflowIsCurrent(workflow) || generation !== uploadGeneration.current || expectedBinding !== bindingRef.current) return
      const response = await onEvidence({
        shiftId: binding.shiftId,
        expectedVersion: binding.expectedVersion,
        purpose: binding.purpose,
        filename: file.name,
        fileBase64,
        mimeType: file.type,
      })
      const data = unwrap(response)
      const receipt = validateEvidenceReceipt(data, {
        binding,
        file,
        nowMs: now(),
      })
      if (workflowIsCurrent(workflow) && generation === uploadGeneration.current && expectedBinding === bindingRef.current) {
        setEvidence({
          token: receipt.token,
          filename: file.name,
          bindingKey: expectedBinding,
          expiresAtMs: receipt.expiresAtMs,
        })
      }
    } catch {
      if (workflowIsCurrent(workflow) && generation === uploadGeneration.current) {
        setError('No se pudo subir la fotografía. Selecciónala de nuevo para reintentar.')
      }
    } finally {
      if (workflowIsCurrent(workflow) && generation === uploadGeneration.current) setUploadBusy(false)
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
  const staleLocked = ['reloading', 'stale_requires_reload'].includes(staleStatus)
  const locked = mutationBusy || Boolean(pendingRequest) || Boolean(completed) || staleLocked

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
        const normalized = normalizeCashShift(unwrap(await onStale({
          shiftId: binding.shiftId,
          mode: binding.purpose,
          expectedVersion: binding.expectedVersion,
        })))
        if (!workflowIsCurrent(workflow) || generation !== staleReloadGeneration.current) return null
        const refreshedBinding = cashShiftEvidenceBinding(normalized)
        if (
          (binding.purpose === 'reclose' && (normalized.shift.state !== 'reopened' || normalized.shift.id !== binding.shiftId))
          || (binding.purpose === 'close' && !['open', 'reopened'].includes(normalized.shift.state))
        ) throw new TypeError('La recarga no corresponde al corte vigente.')
        bindingRef.current = refreshedBinding.key
        previewBindingRef.current = refreshedBinding.key
        setPreview(normalized)
        setPendingRequest(null)
        setCompleted(null)
        setEvidence(null)
        setStaleStatus('review_required')
        setError('Los totales actualizados cambiaron respecto al borrador. Revisa el arqueo conservado y vuelve a subir la fotografía antes de cerrar.')
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
    if (!pendingRequest && evidence && evidence.expiresAtMs <= now()) {
      uploadGeneration.current += 1
      setEvidence(null)
      formLockedRef.current = false
      setError('La evidencia expiró. Sube una fotografía nueva antes de cerrar.')
      return
    }
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
      if (mutationError?.code === 'stale_version') {
        staleRecoveryRef.current = true
        uploadGeneration.current += 1
        setEvidence(null)
        setPendingRequest(null)
        setCompleted(null)
        setPreview(null)
        keepLocked = true
        await reloadAuthoritativeShift()
      } else if (pendingRequest) {
        uploadGeneration.current += 1
        setEvidence(null)
        setPendingRequest(null)
        setCompleted(null)
        keepLocked = false
        setError('El intento pendiente fue rechazado. Conservamos el arqueo; sube una fotografía nueva antes de crear otra operación.')
      } else {
        setError('No se pudo guardar el corte. Conservamos el arqueo y la evidencia para reintentar.')
      }
    } finally {
      if (mutationInFlight.current === marker) mutationInFlight.current = null
      if (!keepLocked) formLockedRef.current = false
      if (workflowIsCurrent(workflow)) setMutationBusy(false)
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
      {!previewBusy && !preview && !staleStatus ? <button className="cash-shift-primary" type="button" onClick={refreshPreview}>Reintentar vista previa</button> : null}
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
        {staleStatus === 'review_required' ? (
          <p className="cash-shift-warning" role="status">Los totales actualizados ya son autoritativos. Revisa el borrador y sube una fotografía nueva; la evidencia anterior quedó invalidada.</p>
        ) : null}
        <div className="cash-shift-actions">
          {['reloading', 'stale_requires_reload'].includes(staleStatus) ? (
            <button className="cash-shift-primary" type="button" disabled={staleStatus === 'reloading'} onClick={reloadAuthoritativeShift}>Recargar corte</button>
          ) : pendingRequest ? (
            <button className="cash-shift-primary" type="button" disabled={mutationBusy} onClick={submit}>Reintentar mismo corte</button>
          ) : !completed ? (
            <button className="cash-shift-primary" type="button" disabled={previewBusy || uploadBusy || mutationBusy || !draftState.operation} onClick={submit}>{fallbackLabel}</button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
