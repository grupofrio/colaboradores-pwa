import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getActiveCashShift,
  getCashShiftDetail,
  previewCashShift,
  uploadCashShiftEvidence,
} from '../api.js'
import { normalizeCashShift } from '../cashShiftModel.js'
import { mutateShiftWithRecovery } from '../cashShiftService.js'
import { readEvidenceFile } from '../cashShiftCloseModel.js'
import CashShiftActivePanel from './CashShiftActivePanel.jsx'
import CashShiftCloseForm from './CashShiftCloseForm.jsx'
import CashShiftFirstOpenForm from './CashShiftFirstOpenForm.jsx'
import CashShiftReopenForm from './CashShiftReopenForm.jsx'

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
  uploadEvidence = uploadCashShiftEvidence,
  loadShiftDetail = getCashShiftDetail,
  reopenShift = defaultReopenShift,
  readEvidence = readEvidenceFile,
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
  const requestGeneration = useRef(0)
  const requestInFlight = useRef(null)
  const authorizationInFlight = useRef(false)
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
    authorizationInFlight.current = false
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
      authorizationInFlight.current = false
    }
  }, [])

  useEffect(() => {
    setSelectedShiftId(positiveId(authorizerShiftId))
    setManualShiftId('')
    setLookupError('')
    setPendingAuthorization(null)
    setOperationError('')
    setShowClose(false)
    setShowReopen(false)
    setRecloseTarget(null)
    setLastOperation(null)
    setView({ status: 'idle', kind: null, data: null })
    authorizationInFlight.current = false
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
      || showClose || showReopen || recloseTarget
    ) {
      return undefined
    }
    const intervalId = scheduleRefresh(() => { void refreshActive() }, 60_000)
    return () => cancelRefresh(intervalId)
  }, [accessMode, cancelRefresh, refreshActive, recloseTarget, scheduleRefresh, scopeReady, showClose, showReopen, view.kind, view.status])

  async function handleOpen(input) {
    const result = await openInitial(input)
    if (result?.status === 'completed') await load()
    return result
  }

  async function handleAuthorize(level) {
    if (view.kind !== 'authorization' || authorizationInFlight.current) return
    authorizationInFlight.current = true
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
      authorizationInFlight.current = false
      if (mounted.current) setOperationBusy(false)
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
    setLastOperation({
      mode,
      shiftId,
      version,
      state: result.state,
      nextShiftId,
      needsManagerAuth: detail.needsManagerAuth,
      needsDirectorAuth: detail.needsDirectorAuth,
      authorizationCount: detail.authorizations.length,
    })
    if (mode === 'reclose') {
      setRecloseTarget(null)
      return
    }
    setShowClose(false)
    await load()
  }

  async function handleReopened(shiftId) {
    const workflow = captureWorkflow()
    const reopened = normalizeCashShift(unwrap(await previewActive({ mode: 'active', shiftId })))
    if (!workflowIsCurrent(workflow, { manage: true })) return null
    if (reopened.shift.state !== 'reopened' || reopened.shift.id !== shiftId) {
      throw new TypeError('El servidor no confirmó el turno reabierto.')
    }
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
  if (recloseTarget) {
    return (
      <div className="cash-shift-stack">
        <CashShiftState title="Turno sucesor sin cambios">El turno activo continúa operando mientras corriges el corte reabierto.</CashShiftState>
        <CashShiftCloseForm
          cashShift={recloseTarget}
          onPreview={previewActive}
          onClose={closeShift}
          onEvidence={uploadEvidence}
          onCompleted={handleCloseCompleted}
          onStale={reloadStaleShift}
          sessionIdentity={workflowIdentity}
          readEvidence={readEvidence}
          onCancel={() => setRecloseTarget(null)}
        />
      </div>
    )
  }
  if (showReopen) {
    return (
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
    return (
      <CashShiftCloseForm
        cashShift={view.data}
        onPreview={previewActive}
        onClose={closeShift}
        onEvidence={uploadEvidence}
        onCompleted={handleCloseCompleted}
        onStale={reloadStaleShift}
        sessionIdentity={workflowIdentity}
        readEvidence={readEvidence}
        onCancel={() => setShowClose(false)}
      />
    )
  }
  return (
    <div className="cash-shift-stack">
      {lastOperation ? (
        <p className="cash-shift-info" role="status">
          {lastOperation.mode === 'reclose'
            ? `Recierre guardado en versión ${lastOperation.version}; el turno sucesor #${lastOperation.nextShiftId} no cambió.`
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
        onStartClose={() => setShowClose(true)}
      />
      <section className="cash-shift-card cash-shift-reopen-launch">
        <h2>Corrección de un corte cerrado</h2>
        <p className="cash-shift-muted">La reapertura exige una razón y no cambia el turno actualmente activo.</p>
        <button className="cash-shift-secondary" type="button" onClick={() => setShowReopen(true)}>Reabrir un corte</button>
      </section>
    </div>
  )
}
