import { useEffect, useRef, useState } from 'react'
import { normalizeCashShift } from '../cashShiftModel.js'

function positiveId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function unwrap(raw) {
  const envelope = raw?.result ?? raw
  if (envelope?.ok === false) throw new Error('cash_shift_request_rejected')
  return envelope?.data ?? envelope
}

export default function CashShiftReopenForm({ loadDetail, reopenShift, onReopened, onCancel }) {
  const [shiftId, setShiftId] = useState('')
  const [detail, setDetail] = useState(null)
  const [reason, setReason] = useState('')
  const [pendingRequest, setPendingRequest] = useState(null)
  const [completedShiftId, setCompletedShiftId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const lookupGeneration = useRef(0)
  const lookupInFlight = useRef(false)
  const mutationInFlight = useRef(false)
  const formLocked = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      lookupGeneration.current += 1
      lookupInFlight.current = false
      mutationInFlight.current = false
      formLocked.current = true
    }
  }, [])

  async function lookup() {
    if (lookupInFlight.current || formLocked.current) return
    const id = positiveId(shiftId)
    if (id === null) {
      setError('Captura un ID de corte válido.')
      return
    }
    const generation = ++lookupGeneration.current
    lookupInFlight.current = true
    setBusy(true)
    setError('')
    try {
      const normalized = normalizeCashShift(unwrap(await loadDetail({ shiftId: id })))
      if (normalized.shift.state !== 'closed') {
        throw new TypeError(
          normalized.shift.state === 'pending_auth'
            ? 'El corte debe terminar sus autorizaciones antes de reabrirse.'
            : 'Solo un corte cerrado puede reabrirse.',
        )
      }
      if (mounted.current && generation === lookupGeneration.current) {
        setDetail(normalized)
        setReason('')
        setPendingRequest(null)
        setCompletedShiftId(null)
        formLocked.current = false
      }
    } catch (lookupError) {
      if (mounted.current && generation === lookupGeneration.current) {
        setDetail(null)
        setError(lookupError instanceof TypeError
          ? lookupError.message
          : 'No se pudo consultar el corte dentro de tu alcance.')
      }
    } finally {
      lookupInFlight.current = false
      if (mounted.current && generation === lookupGeneration.current) setBusy(false)
    }
  }

  async function submit() {
    if (mutationInFlight.current || !detail) return
    const trimmedReason = reason.trim()
    if (!pendingRequest && !trimmedReason) {
      setError('La razón de reapertura es obligatoria.')
      return
    }
    const request = pendingRequest || {
      shiftId: detail.shift.id,
      expectedVersion: detail.shift.version,
      reason: trimmedReason,
    }
    mutationInFlight.current = true
    formLocked.current = true
    setBusy(true)
    setError('')
    let keepLocked = Boolean(pendingRequest || completedShiftId !== null)
    try {
      const result = await reopenShift(request)
      if (!mounted.current) return
      if (result?.status === 'pending') {
        keepLocked = true
        setPendingRequest(result.request || request)
        setError('La respuesta quedó pendiente. Reintenta la misma reapertura y clave.')
        return
      }
      setPendingRequest(null)
      setCompletedShiftId(detail.shift.id)
      keepLocked = true
      try {
        await onReopened(detail.shift.id)
      } catch {
        if (mounted.current) {
          setError('La reapertura quedó confirmada, pero no se pudo cargar el recierre. Reintenta solo la carga; no se enviará otra reapertura.')
        }
      }
    } catch (mutationError) {
      if (mounted.current) {
        setError(mutationError?.code === 'stale_version'
          ? 'El corte cambió en otra sesión. Consulta de nuevo; conservamos la razón capturada.'
          : 'No se pudo reabrir el corte. Conservamos la razón para reintentar.')
      }
    } finally {
      mutationInFlight.current = false
      if (!keepLocked) formLocked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function loadCompletedReopen() {
    if (mutationInFlight.current || completedShiftId === null) return
    mutationInFlight.current = true
    setBusy(true)
    setError('')
    try {
      await onReopened(completedShiftId)
    } catch {
      if (mounted.current) {
        setError('La reapertura sigue confirmada, pero no se pudo cargar el recierre. Inténtalo de nuevo.')
      }
    } finally {
      mutationInFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="cash-shift-card" aria-labelledby="cash-shift-reopen-title">
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">CORRECCIÓN AUDITABLE</p>
          <h2 id="cash-shift-reopen-title">Reabrir un corte cerrado</h2>
        </div>
        <button className="cash-shift-secondary" type="button" disabled={busy || Boolean(pendingRequest)} onClick={onCancel}>Volver</button>
      </div>
      <p className="cash-shift-muted">Consulta el folio técnico del corte. No se carga historial ni se cambia el turno sucesor activo.</p>
      <div className="cash-shift-form">
        <label>ID del corte
          <input name="reopenShiftId" inputMode="numeric" disabled={busy || Boolean(pendingRequest) || completedShiftId !== null} value={shiftId} onChange={(event) => {
            if (formLocked.current) return
            setShiftId(event.target.value); setDetail(null); setError('')
          }} />
        </label>
        <button className="cash-shift-primary" type="button" disabled={busy || Boolean(pendingRequest) || completedShiftId !== null} onClick={lookup}>Consultar corte</button>
      </div>
      {detail ? (
        <div className="cash-shift-preview">
          <p><strong>{detail.folio}</strong> · versión {detail.shift.version} · {detail.shift.type === 'night' ? 'Noche' : 'Día'} {Number(detail.shift.businessDate.slice(-2))}</p>
          <label className="cash-shift-single-field">Razón obligatoria de reapertura
            <textarea name="reopenReason" disabled={busy || Boolean(pendingRequest) || completedShiftId !== null} value={reason} onChange={(event) => {
              if (formLocked.current) return
              setReason(event.target.value); setError('')
            }} />
          </label>
          <div className="cash-shift-actions">
            {completedShiftId !== null ? (
              <button className="cash-shift-primary" type="button" disabled={busy} onClick={loadCompletedReopen}>Cargar recierre reabierto</button>
            ) : pendingRequest ? (
              <button className="cash-shift-primary" type="button" disabled={busy} onClick={submit}>Reintentar misma reapertura</button>
            ) : (
              <button className="cash-shift-primary" type="button" disabled={busy} onClick={submit}>Reabrir corte</button>
            )}
          </div>
        </div>
      ) : null}
      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
    </section>
  )
}
