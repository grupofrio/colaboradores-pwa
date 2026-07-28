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
  accessMode = 'denied',
  scopeReady = false,
  authorizerShiftId = null,
  layout = 'desktop',
  loadActive = getActiveCashShift,
  loadPendingDetail = getCashShiftDetail,
  previewInitial = previewCashShift,
  openInitial = defaultOpenInitial,
  authorizePending = defaultAuthorizePending,
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
  const requestGeneration = useRef(0)
  const requestInFlight = useRef(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestGeneration.current += 1
      requestInFlight.current = null
    }
  }, [])

  useEffect(() => {
    setSelectedShiftId(positiveId(authorizerShiftId))
    setManualShiftId('')
    setLookupError('')
    setPendingAuthorization(null)
    setOperationError('')
  }, [authorizerShiftId])

  const load = useCallback(async ({ preserveActive = false } = {}) => {
    if (!scopeReady || !['manage', 'authorize'].includes(accessMode)) return
    if (accessMode === 'authorize' && selectedShiftId === null) return
    if (requestInFlight.current) return requestInFlight.current.promise
    const generation = ++requestGeneration.current
    const marker = { generation, promise: null }
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
          setRefreshError('')
        }
      } catch {
        if (mounted.current && generation === requestGeneration.current) {
          if (preserveActive) {
            setRefreshError('No se pudo actualizar el turno. Puedes reintentar manualmente.')
          } else {
            setView({ status: 'error', kind: null, data: null })
          }
        }
      } finally {
        if (requestInFlight.current === marker) requestInFlight.current = null
        if (mounted.current && generation === requestGeneration.current) setRefreshing(false)
      }
    })()
    return marker.promise
  }, [accessMode, loadActive, loadPendingDetail, scopeReady, selectedShiftId])

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
    if (accessMode !== 'manage' || !scopeReady || view.status !== 'ready' || view.kind !== 'active') {
      return undefined
    }
    const intervalId = scheduleRefresh(() => { void refreshActive() }, 60_000)
    return () => cancelRefresh(intervalId)
  }, [accessMode, cancelRefresh, refreshActive, scheduleRefresh, scopeReady, view.kind, view.status])

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
  return (
    <CashShiftActivePanel
      cashShift={view.data}
      layout={layout}
      refreshing={refreshing}
      refreshError={refreshError}
      onRefresh={refreshActive}
    />
  )
}
