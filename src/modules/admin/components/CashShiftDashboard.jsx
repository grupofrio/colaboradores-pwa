import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getActiveCashShift,
  getCashShiftDetail,
  previewCashShift,
} from '../api.js'
import { normalizeCashShift } from '../cashShiftModel.js'
import { mutateShiftWithRecovery } from '../cashShiftService.js'
import CashShiftActivePanel from './CashShiftActivePanel.jsx'
import CashShiftFirstOpenForm from './CashShiftFirstOpenForm.jsx'

const defaultOpenInitial = (input) => mutateShiftWithRecovery('open', input)
const defaultAuthorizePending = (input) => mutateShiftWithRecovery('authorize', input)

function unwrap(raw) {
  const envelope = raw?.result ?? raw
  if (envelope?.ok === false) throw new Error('cash_shift_request_rejected')
  return envelope?.data ?? envelope
}

function positiveId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function normalizePendingDetail(raw) {
  const data = unwrap(raw)
  if (
    !data || data.detail_kind !== 'pending_authorization'
    || positiveId(data.shift_id) === null
    || positiveId(data.version_id) === null
    || !Number.isSafeInteger(data.version) || data.version < 1
    || data.state !== 'pending_auth'
    || typeof data.difference !== 'number' || !Number.isFinite(data.difference)
    || typeof data.needs_manager_auth !== 'boolean'
    || typeof data.needs_director_auth !== 'boolean'
    || typeof data.evidence_present !== 'boolean'
    || !Array.isArray(data.authorizations)
    || !data.scope || typeof data.scope !== 'object'
  ) throw new TypeError('El detalle pendiente no es válido.')
  return {
    shiftId: data.shift_id,
    versionId: data.version_id,
    version: data.version,
    scope: {
      company: String(data.scope.company || ''),
      warehouse: String(data.scope.warehouse || ''),
      analytic: String(data.scope.analytic || ''),
    },
    difference: data.difference,
    needsManagerAuth: data.needs_manager_auth,
    needsDirectorAuth: data.needs_director_auth,
    note: String(data.note || ''),
    evidencePresent: data.evidence_present,
    authorizations: data.authorizations.length,
  }
}

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(value)
}

function CashShiftState({ title, children, action = null }) {
  return (
    <section className="cash-shift-card cash-shift-state" role="status">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  )
}

function PendingLookup({ value, onChange, onSubmit, error }) {
  return (
    <section className="cash-shift-card" aria-labelledby="pending-lookup-title">
      <p className="cash-shift-eyebrow">AUTORIZACIÓN</p>
      <h2 id="pending-lookup-title">Consultar corte pendiente</h2>
      <p className="cash-shift-muted">Ingresa el ID del turno pendiente que recibiste. No se consultan listas ni historial.</p>
      <label className="cash-shift-single-field">ID del turno pendiente
        <input name="pendingShiftId" inputMode="numeric" value={value} onChange={onChange} />
      </label>
      <button className="cash-shift-primary" type="button" onClick={onSubmit}>Consultar corte pendiente</button>
      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
    </section>
  )
}

function PendingAuthorization({ detail, busy, error, pendingRequest, onAuthorize }) {
  return (
    <section className="cash-shift-card" aria-labelledby="pending-authorization-title">
      <p className="cash-shift-eyebrow">DETALLE MÍNIMO</p>
      <h2 id="pending-authorization-title">Autorización pendiente</h2>
      <dl className="cash-shift-period-grid">
        <div><dt>Turno</dt><dd>#{detail.shiftId}</dd></div>
        <div><dt>Versión</dt><dd>{detail.version}</dd></div>
        <div><dt>Compañía</dt><dd>{detail.scope.company}</dd></div>
        <div><dt>Almacén</dt><dd>{detail.scope.warehouse}</dd></div>
        <div><dt>Diferencia</dt><dd>{money(detail.difference)}</dd></div>
        <div><dt>Evidencia</dt><dd>{detail.evidencePresent ? 'Adjunta' : 'Sin evidencia'}</dd></div>
      </dl>
      {detail.note ? <p className="cash-shift-info">Nota: {detail.note}</p> : null}
      <div className="cash-shift-actions">
        {pendingRequest ? (
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={() => onAuthorize(pendingRequest.level)}>Reintentar misma autorización</button>
        ) : detail.needsManagerAuth ? (
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={() => onAuthorize('manager')}>Autorizar gerencia</button>
        ) : null}
        {!pendingRequest && detail.needsDirectorAuth ? (
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={() => onAuthorize('director')}>Autorizar dirección</button>
        ) : null}
      </div>
      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
    </section>
  )
}

export default function CashShiftDashboard({
  accessMode = 'denied',
  scopeReady = false,
  authorizerShiftId = null,
  layout = 'desktop',
  loadActive = getActiveCashShift,
  loadPendingDetail = getCashShiftDetail,
  previewInitial = previewCashShift,
  openInitial = defaultOpenInitial,
  authorizePending = defaultAuthorizePending,
}) {
  const [view, setView] = useState({ status: 'idle', kind: null, data: null })
  const [manualShiftId, setManualShiftId] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState(() => positiveId(authorizerShiftId))
  const [lookupError, setLookupError] = useState('')
  const [operationBusy, setOperationBusy] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [pendingAuthorization, setPendingAuthorization] = useState(null)
  const requestGeneration = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestGeneration.current += 1
    }
  }, [])

  useEffect(() => {
    setSelectedShiftId(positiveId(authorizerShiftId))
    setManualShiftId('')
    setLookupError('')
    setPendingAuthorization(null)
    setOperationError('')
  }, [authorizerShiftId])

  const load = useCallback(async () => {
    if (!scopeReady || !['manage', 'authorize'].includes(accessMode)) return
    if (accessMode === 'authorize' && selectedShiftId === null) return
    const generation = ++requestGeneration.current
    setView({ status: 'loading', kind: null, data: null })
    try {
      if (accessMode === 'authorize') {
        const detail = normalizePendingDetail(await loadPendingDetail({ shiftId: selectedShiftId }))
        if (mounted.current && generation === requestGeneration.current) {
          setView({ status: 'ready', kind: 'authorization', data: detail })
        }
        return
      }
      const data = unwrap(await loadActive())
      if (data?.active === false && data?.config_state === 'inactive') {
        if (mounted.current && generation === requestGeneration.current) {
          setView({ status: 'ready', kind: 'inactive', data: null })
        }
        return
      }
      const cashShift = normalizeCashShift(data)
      if (mounted.current && generation === requestGeneration.current) {
        setView({ status: 'ready', kind: 'active', data: cashShift })
      }
    } catch {
      if (mounted.current && generation === requestGeneration.current) {
        setView({ status: 'error', kind: null, data: null })
      }
    }
  }, [accessMode, loadActive, loadPendingDetail, scopeReady, selectedShiftId])

  useEffect(() => {
    void load()
    return () => { requestGeneration.current += 1 }
  }, [load])

  async function handleOpen(input) {
    const result = await openInitial(input)
    if (result?.status === 'completed') await load()
    return result
  }

  async function handleAuthorize(level) {
    if (view.kind !== 'authorization') return
    setOperationBusy(true)
    setOperationError('')
    try {
      const request = pendingAuthorization || {
        shiftId: view.data.shiftId,
        versionId: view.data.versionId,
        level,
      }
      const result = await authorizePending(request)
      if (result?.status === 'completed') {
        if (mounted.current) setPendingAuthorization(null)
        const completed = unwrap(result.data)
        if (completed?.state === 'closed') {
          if (mounted.current) {
            requestGeneration.current += 1
            setView({ status: 'ready', kind: 'authorization_complete', data: completed })
          }
        } else {
          await load()
        }
      } else if (mounted.current) {
        setPendingAuthorization(result?.request || request)
        setOperationError('La autorización quedó pendiente. Reintenta exactamente la misma operación.')
      }
    } catch {
      if (mounted.current) setOperationError('No se pudo autorizar el corte. Verifica tu nivel e inténtalo de nuevo.')
    } finally {
      if (mounted.current) setOperationBusy(false)
    }
  }

  function submitManualShift() {
    const id = positiveId(manualShiftId)
    if (id === null) {
      setLookupError('Captura un ID de turno válido.')
      return
    }
    setLookupError('')
    setPendingAuthorization(null)
    setOperationError('')
    setSelectedShiftId(id)
  }

  if (accessMode === 'loading') {
    return <CashShiftState title="Verificando acceso">Consultando capacidades autenticadas del servidor…</CashShiftState>
  }
  if (accessMode === 'denied') {
    return <CashShiftState title="Cortes de caja no disponibles">El backend no confirmó permiso para administrar ni autorizar cortes.</CashShiftState>
  }
  if (!scopeReady) {
    return <CashShiftState title="Falta alcance de sucursal">Tu sesión no tiene compañía o almacén confiables. Vuelve a iniciar sesión.</CashShiftState>
  }
  if (accessMode === 'authorize' && selectedShiftId === null) {
    return (
      <PendingLookup
        value={manualShiftId}
        onChange={(event) => { setManualShiftId(event.target.value); setLookupError('') }}
        onSubmit={submitManualShift}
        error={lookupError}
      />
    )
  }
  if (view.status === 'loading' || view.status === 'idle') {
    return <CashShiftState title="Cargando">Consultando el corte autorizado para tu alcance…</CashShiftState>
  }
  if (view.status === 'error') {
    return (
      <CashShiftState
        title="No se pudo consultar el turno activo"
        action={<button className="cash-shift-primary" type="button" onClick={load}>Reintentar</button>}
      >No mostramos detalles del error del servidor. Inténtalo de nuevo.</CashShiftState>
    )
  }
  if (view.kind === 'authorization') {
    return <PendingAuthorization detail={view.data} busy={operationBusy} error={operationError} pendingRequest={pendingAuthorization} onAuthorize={handleAuthorize} />
  }
  if (view.kind === 'authorization_complete') {
    return <CashShiftState title="Corte autorizado">La autorización se registró y el corte quedó cerrado.</CashShiftState>
  }
  if (view.kind === 'inactive') {
    return <CashShiftFirstOpenForm onPreview={previewInitial} onOpen={handleOpen} />
  }
  return <CashShiftActivePanel cashShift={view.data} layout={layout} />
}
