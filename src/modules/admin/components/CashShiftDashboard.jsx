import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getActiveCashShift,
  getCashShiftDetail,
  getCashShiftHistory,
  previewCashShift,
} from '../api.js'
import { normalizeCashShift } from '../cashShiftModel.js'
import { mutateShiftWithRecovery } from '../cashShiftService.js'
import CashShiftActivePanel from './CashShiftActivePanel.jsx'
import CashShiftCloseForm from './CashShiftCloseForm.jsx'
import CashShiftFirstOpenForm from './CashShiftFirstOpenForm.jsx'
import CashShiftHistory from './CashShiftHistory.jsx'
import CashShiftReopenForm from './CashShiftReopenForm.jsx'
import LegacyCashClosingHistory from './LegacyCashClosingHistory.jsx'

const defaultOpenInitial = (input) => mutateShiftWithRecovery('open', input)
const defaultAuthorizePending = (input) => mutateShiftWithRecovery('authorize', input)
const defaultCloseShift = (operation, input) => mutateShiftWithRecovery(operation, input)
const defaultReopenShift = (input) => mutateShiftWithRecovery('reopen', input)
const defaultScheduleRefresh = (callback, delay) => globalThis.setInterval(callback, delay)
const defaultCancelRefresh = (intervalId) => globalThis.clearInterval(intervalId)
const AUTHORIZATION_LEVELS = ['manager', 'director']
const PENDING_DETAIL_FIELDS = [
  'detail_kind', 'shift_id', 'version_id', 'version', 'state', 'scope', 'difference',
  'needs_manager_auth', 'needs_director_auth', 'note', 'evidence_present',
  'allowed_levels', 'authorizations',
]
const PENDING_SCOPE_FIELDS = ['company', 'warehouse', 'analytic']
const AUTHORIZATION_FIELDS = ['level', 'actor_employee_id', 'actor_name', 'authorized_at']

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

function exactRecord(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} no es válido.`)
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Object.keys(descriptors).sort()
  if (
    keys.length !== fields.length
    || fields.some((field) => !Object.prototype.hasOwnProperty.call(descriptors, field))
    || fields.some((field) => !Object.prototype.hasOwnProperty.call(descriptors[field], 'value'))
  ) throw new TypeError(`${label} no es válido.`)
  return Object.fromEntries(fields.map((field) => [field, descriptors[field].value]))
}

function exactArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} no es válido.`)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const allowedKeys = new Set(['length', ...value.map((_, index) => String(index))])
  if (
    Object.keys(descriptors).some((key) => !allowedKeys.has(key))
    || value.some((_, index) => !Object.prototype.hasOwnProperty.call(descriptors[index], 'value'))
  ) throw new TypeError(`${label} no es válido.`)
  return value.map((_, index) => descriptors[index].value)
}

function exactLevels(value, label, { allowEmpty = false } = {}) {
  const levels = exactArray(value, label)
  const canonical = AUTHORIZATION_LEVELS.filter((level) => levels.includes(level))
  if (
    (!allowEmpty && levels.length === 0)
    || canonical.length !== levels.length
    || canonical.some((level, index) => level !== levels[index])
  ) throw new TypeError(`${label} no es válido.`)
  return levels
}

function normalizePendingDetail(raw) {
  const data = exactRecord(unwrap(raw), PENDING_DETAIL_FIELDS, 'El detalle pendiente')
  const scope = exactRecord(data.scope, PENDING_SCOPE_FIELDS, 'El alcance pendiente')
  const allowedLevels = exactLevels(data.allowed_levels, 'Los niveles permitidos')
  const authorizations = exactArray(data.authorizations, 'Las autorizaciones').map((rawRow) => {
    const row = exactRecord(rawRow, AUTHORIZATION_FIELDS, 'La autorización')
    if (
      !AUTHORIZATION_LEVELS.includes(row.level)
      || positiveId(row.actor_employee_id) === null
      || typeof row.actor_name !== 'string'
      || typeof row.authorized_at !== 'string' || !row.authorized_at
    ) throw new TypeError('La autorización no es válida.')
    return { level: row.level }
  })
  const authorizedLevels = exactLevels(
    authorizations.map((row) => row.level).sort(
      (left, right) => AUTHORIZATION_LEVELS.indexOf(left) - AUTHORIZATION_LEVELS.indexOf(right),
    ),
    'Los niveles autorizados',
    { allowEmpty: true },
  )
  if (
    data.detail_kind !== 'pending_authorization'
    || positiveId(data.shift_id) === null
    || positiveId(data.version_id) === null
    || !Number.isSafeInteger(data.version) || data.version < 1
    || data.state !== 'pending_auth'
    || typeof data.difference !== 'number' || !Number.isFinite(data.difference)
    || typeof data.needs_manager_auth !== 'boolean'
    || typeof data.needs_director_auth !== 'boolean'
    || typeof data.evidence_present !== 'boolean'
  ) throw new TypeError('El detalle pendiente no es válido.')
  return {
    shiftId: data.shift_id,
    versionId: data.version_id,
    version: data.version,
    scope: {
      company: String(scope.company || ''),
      warehouse: String(scope.warehouse || ''),
      analytic: String(scope.analytic || ''),
    },
    difference: data.difference,
    needsManagerAuth: data.needs_manager_auth,
    needsDirectorAuth: data.needs_director_auth,
    note: String(data.note || ''),
    evidencePresent: data.evidence_present,
    allowedLevels,
    authorizations,
    authorizedLevels,
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
  const availableLevels = AUTHORIZATION_LEVELS.filter((level) => (
    detail.allowedLevels.includes(level)
    && !detail.authorizedLevels.includes(level)
    && (level === 'manager' ? detail.needsManagerAuth : detail.needsDirectorAuth)
  ))
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
        ) : availableLevels.includes('manager') ? (
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={() => onAuthorize('manager')}>Autorizar gerencia</button>
        ) : null}
        {!pendingRequest && availableLevels.includes('director') ? (
          <button className="cash-shift-primary" type="button" disabled={busy} onClick={() => onAuthorize('director')}>Autorizar dirección</button>
        ) : null}
      </div>
      {!pendingRequest && availableLevels.length === 0 ? (
        <p className="cash-shift-info" role="status">
          Este corte espera autorización de otro nivel; no tienes una acción disponible.
        </p>
      ) : null}
      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
    </section>
  )
}

function ManageWorkspace({ activeArea, onAreaChange, children }) {
  const tabs = [
    ['active', 'Turno activo'],
    ['history', 'Historial operativo'],
    ['legacy', 'Cierres diarios anteriores'],
  ]
  return (
    <div className="cash-shift-stack">
      <nav className="cash-shift-tabs cash-shift-print-hide" role="tablist" aria-label="Áreas de cortes de caja">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            id={`cash-shift-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeArea === id}
            aria-controls={`cash-shift-panel-${id}`}
            onClick={() => onAreaChange(id)}
          >{label}</button>
        ))}
      </nav>
      <div
        id={`cash-shift-panel-${activeArea}`}
        role="tabpanel"
        aria-labelledby={`cash-shift-tab-${activeArea}`}
      >{children}</div>
    </div>
  )
}

export default function CashShiftDashboard({
  sessionIdentity = 'cash-shift-session',
  accessMode = 'denied',
  scopeReady = false,
  authorizerShiftId = null,
  layout = 'desktop',
  loadActive = getActiveCashShift,
  loadPendingDetail = getCashShiftDetail,
  previewInitial = previewCashShift,
  previewActive = previewCashShift,
  openInitial = defaultOpenInitial,
  authorizePending = defaultAuthorizePending,
  closeShift = defaultCloseShift,
  loadShiftDetail = getCashShiftDetail,
  loadHistory = getCashShiftHistory,
  loadHistoryDetail = getCashShiftDetail,
  loadLegacyHistory,
  loadLegacyDetail,
  printWindow,
  historyNow,
  legacyNow,
  reopenShift = defaultReopenShift,
  scheduleRefresh = defaultScheduleRefresh,
  cancelRefresh = defaultCancelRefresh,
}) {
  const [view, setView] = useState({ status: 'idle', kind: null, data: null })
  const [manualShiftId, setManualShiftId] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState(() => positiveId(authorizerShiftId))
  const [lookupError, setLookupError] = useState('')
  const [operationBusy, setOperationBusy] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [pendingAuthorization, setPendingAuthorization] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [showClose, setShowClose] = useState(false)
  const [showReopen, setShowReopen] = useState(false)
  const [recloseTarget, setRecloseTarget] = useState(null)
  const [lastOperation, setLastOperation] = useState(null)
  const [transitionNotice, setTransitionNotice] = useState('')
  const [recloseVerification, setRecloseVerification] = useState(null)
  const [activeArea, setActiveArea] = useState('active')
  const requestGeneration = useRef(0)
  const requestInFlight = useRef(null)
  const authorizationInFlight = useRef(null)
  const recloseVerificationInFlight = useRef(null)
  const recloseActiveShiftId = useRef(null)
  const mounted = useRef(false)
  const workflowIdentity = `${sessionIdentity}|${accessMode}|${scopeReady ? 'ready' : 'missing'}`
  const workflowRef = useRef({ identity: workflowIdentity, generation: 0 })
  if (workflowRef.current.identity !== workflowIdentity) {
    workflowRef.current = {
      identity: workflowIdentity,
      generation: workflowRef.current.generation + 1,
    }
    requestGeneration.current += 1
    requestInFlight.current = null
    authorizationInFlight.current = null
    recloseVerificationInFlight.current = null
    recloseActiveShiftId.current = null
  }

  const captureWorkflow = useCallback(() => {
    return { ...workflowRef.current }
  }, [])

  const workflowIsCurrent = useCallback((guard, { manage = false } = {}) => {
    return Boolean(
      mounted.current
      && guard.identity === workflowRef.current.identity
      && guard.generation === workflowRef.current.generation
      && scopeReady
      && (manage ? accessMode === 'manage' : ['manage', 'authorize'].includes(accessMode)),
    )
  }, [accessMode, scopeReady])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestGeneration.current += 1
      requestInFlight.current = null
      authorizationInFlight.current = null
      recloseVerificationInFlight.current = null
      recloseActiveShiftId.current = null
    }
  }, [])

  useEffect(() => {
    setSelectedShiftId(positiveId(authorizerShiftId))
    setManualShiftId('')
    setLookupError('')
    setPendingAuthorization(null)
    setOperationError('')
    setOperationBusy(false)
    setShowClose(false)
    setShowReopen(false)
    setRecloseTarget(null)
    setLastOperation(null)
    setTransitionNotice('')
    setRecloseVerification(null)
    setActiveArea('active')
    setView({ status: 'idle', kind: null, data: null })
    authorizationInFlight.current = null
    recloseVerificationInFlight.current = null
    recloseActiveShiftId.current = null
  }, [authorizerShiftId, workflowIdentity])

  const load = useCallback(async ({ preserveActive = false } = {}) => {
    if (!scopeReady || !['manage', 'authorize'].includes(accessMode)) return
    if (accessMode === 'authorize' && selectedShiftId === null) return
    if (requestInFlight.current) return requestInFlight.current.promise
    const generation = ++requestGeneration.current
    const workflow = captureWorkflow()
    if (workflow.identity !== workflowIdentity) return
    const marker = { generation, workflow, promise: null }
    requestInFlight.current = marker
    if (preserveActive) {
      setRefreshing(true)
      setRefreshError('')
    } else {
      setView({ status: 'loading', kind: null, data: null })
    }
    marker.promise = (async () => {
      try {
        if (accessMode === 'authorize') {
          const detail = normalizePendingDetail(await loadPendingDetail({ shiftId: selectedShiftId }))
          if (generation === requestGeneration.current && workflowIsCurrent(workflow)) {
            setView({ status: 'ready', kind: 'authorization', data: detail })
          }
          return
        }
        const data = unwrap(await loadActive())
        if (data?.active === false && data?.config_state === 'inactive') {
          if (generation === requestGeneration.current && workflowIsCurrent(workflow)) {
            setView({ status: 'ready', kind: 'inactive', data: null })
          }
          return
        }
        const cashShift = normalizeCashShift(data)
        if (generation === requestGeneration.current && workflowIsCurrent(workflow)) {
          setView({ status: 'ready', kind: 'active', data: cashShift })
          setRefreshError('')
        }
      } catch {
        if (generation === requestGeneration.current && workflowIsCurrent(workflow)) {
          if (preserveActive) {
            setRefreshError('No se pudo actualizar el turno. Puedes reintentar manualmente.')
          } else {
            setView({ status: 'error', kind: null, data: null })
          }
        }
      } finally {
        if (requestInFlight.current === marker) requestInFlight.current = null
        if (generation === requestGeneration.current && workflowIsCurrent(workflow)) setRefreshing(false)
      }
    })()
    return marker.promise
  }, [accessMode, captureWorkflow, loadActive, loadPendingDetail, scopeReady, selectedShiftId, workflowIdentity, workflowIsCurrent])

  useEffect(() => {
    void load()
    return () => {
      requestGeneration.current += 1
      requestInFlight.current = null
    }
  }, [load])

  const refreshActive = useCallback(
    () => load({ preserveActive: true }),
    [load],
  )

  useEffect(() => {
    if (
      accessMode !== 'manage' || !scopeReady || view.status !== 'ready' || view.kind !== 'active'
      || activeArea !== 'active' || showClose || showReopen || recloseTarget
    ) {
      return undefined
    }
    const intervalId = scheduleRefresh(() => { void refreshActive() }, 60_000)
    return () => cancelRefresh(intervalId)
  }, [accessMode, activeArea, cancelRefresh, refreshActive, recloseTarget, scheduleRefresh, scopeReady, showClose, showReopen, view.kind, view.status])

  async function handleOpen(input) {
    const result = await openInitial(input)
    if (result?.status === 'completed') await load()
    return result
  }

  async function handleAuthorize(level) {
    if (view.kind !== 'authorization' || authorizationInFlight.current) return
    const workflow = captureWorkflow()
    if (!workflowIsCurrent(workflow)) return
    const marker = { workflow }
    authorizationInFlight.current = marker
    setOperationBusy(true)
    setOperationError('')
    try {
      const request = pendingAuthorization || {
        shiftId: view.data.shiftId,
        versionId: view.data.versionId,
        level,
      }
      const result = await authorizePending(request)
      if (!workflowIsCurrent(workflow) || authorizationInFlight.current !== marker) return
      if (result?.status === 'completed') {
        setPendingAuthorization(null)
        const completed = unwrap(result.data)
        if (completed?.state === 'closed') {
          requestGeneration.current += 1
          setView({ status: 'ready', kind: 'authorization_complete', data: completed })
        } else {
          if (!workflowIsCurrent(workflow) || authorizationInFlight.current !== marker) return
          await load()
        }
      } else {
        setPendingAuthorization(result?.request || request)
        setOperationError('La autorización quedó pendiente. Reintenta exactamente la misma operación.')
      }
    } catch {
      if (workflowIsCurrent(workflow) && authorizationInFlight.current === marker) {
        setOperationError('No se pudo autorizar el corte. Verifica tu nivel e inténtalo de nuevo.')
      }
    } finally {
      if (authorizationInFlight.current === marker) {
        authorizationInFlight.current = null
        if (workflowIsCurrent(workflow)) setOperationBusy(false)
      }
    }
  }

  async function handleCloseCompleted({ mode, result, request }) {
    const version = Number(result?.version)
    const nextShiftId = positiveId(result?.next_shift_id)
    const shiftId = positiveId(result?.shift_id)
    const detail = normalizeCashShift(result?.detail)
    if (
      !Number.isSafeInteger(version) || version < 1
      || shiftId === null || nextShiftId === null
      || !['closed', 'pending_auth'].includes(result?.state)
      || shiftId !== request.shiftId
      || version !== request.expectedVersion + 1
      || detail.shift.id !== shiftId
      || detail.shift.version !== version
      || detail.shift.state !== result.state
    ) {
      throw new TypeError('La respuesta final del corte no es válida.')
    }
    const completedOperation = {
      mode,
      shiftId,
      version,
      state: result.state,
      nextShiftId,
      needsManagerAuth: detail.needsManagerAuth,
      needsDirectorAuth: detail.needsDirectorAuth,
      authorizationCount: detail.authorizations.length,
    }
    if (mode === 'reclose') {
      const expectedActiveShiftId = positiveId(recloseActiveShiftId.current)
      setRecloseTarget(null)
      setLastOperation(null)
      await verifyRecloseActive({ completedOperation, expectedActiveShiftId })
      return
    }
    setLastOperation(completedOperation)
    setShowClose(false)
    await load()
  }

  async function handleCloseShift(operation, request) {
    if (operation === 'reclose') {
      const activeShiftId = view.kind === 'active' ? positiveId(view.data?.shift?.id) : null
      if (activeShiftId === null) throw new TypeError('No se pudo fijar el turno activo antes del recierre.')
      recloseActiveShiftId.current = activeShiftId
    }
    return closeShift(operation, request)
  }

  async function verifyRecloseActive(input = recloseVerification) {
    if (!input || recloseVerificationInFlight.current) {
      return recloseVerificationInFlight.current?.promise
    }
    const workflow = captureWorkflow()
    if (!workflowIsCurrent(workflow, { manage: true })) return null
    const marker = { workflow, promise: null }
    recloseVerificationInFlight.current = marker
    const verification = {
      completedOperation: input.completedOperation,
      expectedActiveShiftId: positiveId(input.expectedActiveShiftId),
      observedActiveShiftId: positiveId(input.observedActiveShiftId),
      status: 'checking',
    }
    setRecloseVerification(verification)
    marker.promise = (async () => {
      try {
        const active = normalizeCashShift(unwrap(await loadActive()))
        if (!workflowIsCurrent(workflow, { manage: true }) || recloseVerificationInFlight.current !== marker) return null
        if (!['open', 'reopened'].includes(active.shift.state)) {
          throw new TypeError('La lectura no confirmó un turno activo.')
        }
        const observedActiveShiftId = positiveId(active.shift.id)
        setView({ status: 'ready', kind: 'active', data: active })
        if (
          verification.expectedActiveShiftId !== null
          && observedActiveShiftId === verification.expectedActiveShiftId
        ) {
          setLastOperation({
            ...verification.completedOperation,
            verifiedActiveShiftId: observedActiveShiftId,
          })
          setRecloseVerification(null)
          recloseActiveShiftId.current = null
          return active
        }
        setRecloseVerification({
          ...verification,
          status: 'inconsistent',
          observedActiveShiftId,
        })
        return null
      } catch {
        if (workflowIsCurrent(workflow, { manage: true }) && recloseVerificationInFlight.current === marker) {
          setRecloseVerification({ ...verification, status: 'pending' })
        }
        return null
      } finally {
        if (recloseVerificationInFlight.current === marker) recloseVerificationInFlight.current = null
      }
    })()
    return marker.promise
  }

  async function handleReopened(shiftId) {
    const workflow = captureWorkflow()
    const reopened = normalizeCashShift(unwrap(await previewActive({ mode: 'active', shiftId })))
    if (!workflowIsCurrent(workflow, { manage: true })) return null
    if (reopened.shift.state !== 'reopened' || reopened.shift.id !== shiftId) {
      throw new TypeError('El servidor no confirmó el turno reabierto.')
    }
    const activeShiftId = view.kind === 'active' ? positiveId(view.data?.shift?.id) : null
    if (activeShiftId === null) throw new TypeError('No se pudo fijar el turno activo antes del recierre.')
    recloseActiveShiftId.current = activeShiftId
    setShowReopen(false)
    setRecloseTarget(reopened)
    return reopened
  }

  async function reloadStaleShift({ shiftId, mode }) {
    const workflow = captureWorkflow()
    if (!workflowIsCurrent(workflow, { manage: true })) {
      throw Object.assign(new Error('cash_shift_context_changed'), { code: 'cash_shift_context_changed' })
    }
    const raw = mode === 'reclose'
      ? unwrap(await loadShiftDetail({ shiftId }))
      : unwrap(await loadActive())
    const normalized = normalizeCashShift(raw)
    if (!workflowIsCurrent(workflow, { manage: true })) {
      throw Object.assign(new Error('cash_shift_context_changed'), { code: 'cash_shift_context_changed' })
    }
    if (mode === 'reclose') {
      if (normalized.shift.id !== shiftId || normalized.shift.state !== 'reopened') {
        throw new TypeError('El recierre ya no está disponible en su versión autoritativa.')
      }
      setRecloseTarget(normalized)
    } else {
      if (!['open', 'reopened'].includes(normalized.shift.state)) {
        throw new TypeError('El turno activo ya no está disponible para corte.')
      }
      setView({ status: 'ready', kind: 'active', data: normalized })
      setRefreshError('')
      if (normalized.shift.id !== shiftId) {
        setShowClose(false)
        setLastOperation(null)
        setTransitionNotice('El turno cambió; el arqueo anterior se descartó y no se aplicó.')
      }
    }
    return raw
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

  const wrapManage = (content) => (
    accessMode === 'manage'
      ? <ManageWorkspace activeArea={activeArea} onAreaChange={setActiveArea}>{content}</ManageWorkspace>
      : content
  )
  const activeHistoryBusinessDate = (
    view.kind === 'active'
    && ['open', 'reopened'].includes(view.data?.shift?.state)
  ) ? view.data.shift.businessDate : null
  const activeHistoryTimezone = view.kind === 'active'
    ? view.data?.period?.timezone
    : undefined
  if (accessMode === 'manage' && activeArea === 'history') {
    return (
      <ManageWorkspace activeArea={activeArea} onAreaChange={setActiveArea}>
        <CashShiftHistory
          accessMode={accessMode}
          sessionIdentity={workflowIdentity}
          activeBusinessDate={activeHistoryBusinessDate}
          timezone={activeHistoryTimezone}
          loadHistory={loadHistory}
          loadDetail={loadHistoryDetail}
          printWindow={printWindow}
          {...(historyNow ? { now: historyNow } : {})}
        />
      </ManageWorkspace>
    )
  }
  if (accessMode === 'manage' && activeArea === 'legacy') {
    return (
      <ManageWorkspace activeArea={activeArea} onAreaChange={setActiveArea}>
        <LegacyCashClosingHistory
          accessMode={accessMode}
          sessionIdentity={workflowIdentity}
          {...(loadLegacyHistory ? { loadHistory: loadLegacyHistory } : {})}
          {...(loadLegacyDetail ? { loadDetail: loadLegacyDetail } : {})}
          {...(legacyNow ? { now: legacyNow } : {})}
        />
      </ManageWorkspace>
    )
  }
  if (view.status === 'loading' || view.status === 'idle') {
    return wrapManage(<CashShiftState title="Cargando">Consultando el corte autorizado para tu alcance…</CashShiftState>)
  }
  if (view.status === 'error') {
    return wrapManage(
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
    return wrapManage(<CashShiftFirstOpenForm onPreview={previewInitial} onOpen={handleOpen} />)
  }
  if (recloseVerification) {
    const checking = recloseVerification.status === 'checking'
    const inconsistent = recloseVerification.status === 'inconsistent'
    return wrapManage(
      <CashShiftState
        title="Recierre confirmado"
        action={checking ? null : <button className="cash-shift-primary" type="button" onClick={() => verifyRecloseActive()}>Verificar turno activo</button>}
      >
        {checking
          ? 'El recierre quedó confirmado. Verificando de forma autoritativa el turno activo…'
          : inconsistent
            ? `El recierre está confirmado, pero el turno activo cambió de #${recloseVerification.expectedActiveShiftId || '—'} a #${recloseVerification.observedActiveShiftId || '—'}. La verificación permanece inconsistente.`
            : 'El recierre está confirmado, pero la verificación del turno activo está pendiente. Reintenta únicamente la lectura.'}
      </CashShiftState>
    )
  }
  if (recloseTarget) {
    return wrapManage(
      <div className="cash-shift-stack">
        <CashShiftState title="Turno sucesor sin cambios">El turno activo continúa operando mientras corriges el corte reabierto.</CashShiftState>
        <CashShiftCloseForm
          cashShift={recloseTarget}
          onPreview={previewActive}
          onClose={handleCloseShift}
          onCompleted={handleCloseCompleted}
          onStale={reloadStaleShift}
          sessionIdentity={workflowIdentity}
          onCancel={() => { recloseActiveShiftId.current = null; setRecloseTarget(null) }}
        />
      </div>
    )
  }
  if (showReopen) {
    return wrapManage(
      <CashShiftReopenForm
        loadDetail={loadShiftDetail}
        reopenShift={reopenShift}
        onReopened={handleReopened}
        sessionIdentity={workflowIdentity}
        onCancel={() => setShowReopen(false)}
      />
    )
  }
  if (showClose) {
    return wrapManage(
      <CashShiftCloseForm
        cashShift={view.data}
        onPreview={previewActive}
        onClose={handleCloseShift}
        onCompleted={handleCloseCompleted}
        onStale={reloadStaleShift}
        sessionIdentity={workflowIdentity}
        onCancel={() => setShowClose(false)}
      />
    )
  }
  return wrapManage(
    <div className="cash-shift-stack">
      {transitionNotice ? <p className="cash-shift-warning" role="status">{transitionNotice}</p> : null}
      {lastOperation ? (
        <p className="cash-shift-info" role="status">
          {lastOperation.mode === 'reclose'
            ? `Recierre guardado en versión ${lastOperation.version}; turno activo #${lastOperation.verifiedActiveShiftId} verificado sin cambios.`
            : lastOperation.state === 'pending_auth'
              ? `Corte #${lastOperation.shiftId} guardado en autorización pendiente, versión ${lastOperation.version}. Requiere ${[
                lastOperation.needsManagerAuth ? 'gerencia' : null,
                lastOperation.needsDirectorAuth ? 'dirección' : null,
              ].filter(Boolean).join(' y ') || 'revisión del servidor'}; ${lastOperation.authorizationCount} autorización(es) registrada(s). El turno sucesor #${lastOperation.nextShiftId} ya está activo.`
              : `Corte #${lastOperation.shiftId} guardado en versión ${lastOperation.version}. Turno sucesor #${lastOperation.nextShiftId} activo.`}
        </p>
      ) : null}
      <CashShiftActivePanel
        cashShift={view.data}
        layout={layout}
        refreshing={refreshing}
        refreshError={refreshError}
        onRefresh={refreshActive}
        onStartClose={() => { setTransitionNotice(''); setShowClose(true) }}
      />
      <section className="cash-shift-card cash-shift-reopen-launch">
        <h2>Corrección de un corte cerrado</h2>
        <p className="cash-shift-muted">La reapertura exige una razón y no cambia el turno actualmente activo.</p>
        <button className="cash-shift-secondary" type="button" onClick={() => setShowReopen(true)}>Reabrir un corte</button>
      </section>
    </div>
  )
}
