import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../../App.jsx'
import { useToast } from '../../components/Toast.jsx'
import { readAttendanceAccess } from './access.js'
import {
  createAbsence,
  createAttendance,
  downloadAttendanceWorkbook,
  getAttendanceConflictTarget,
  getAttendanceErrorField,
  getAttendanceErrorMessage,
  getCapabilities,
  getAttendance,
  justifyAbsence,
  saveAttendanceWorkbook,
  updateAttendance,
} from './api.js'
import {
  filterAttendanceRows,
  getAttendanceDatePreset,
  serializeAttendanceFilters,
  validateAttendanceFilters,
} from './attendanceState.js'
import { AbsenceModal } from './components/AbsenceModal.jsx'
import { AttendanceFilters } from './components/AttendanceFilters.jsx'
import { AttendanceModal } from './components/AttendanceModal.jsx'
import { AttendanceRows } from './components/AttendanceRows.jsx'
import { AttendanceSummary } from './components/AttendanceSummary.jsx'
import { AuditDrawer } from './components/AuditDrawer.jsx'
import './asistencias.css'

const ACCESS_DENIED_CODE = 'attendance_access_denied'
const EXISTING_RECORD_CODES = new Set([
  'absence_already_exists',
  'absence_exists_for_date',
  'attendance_exists_for_date',
])

function initialFilters() {
  return {
    ...getAttendanceDatePreset('day'),
    analytic_code: '',
    search: '',
    status: '',
  }
}

function emptySnapshot() {
  return { summary: {}, rows: [] }
}

function focusAttendanceModalField(fieldName) {
  if (!fieldName) return
  setTimeout(() => {
    document.querySelector(`[role="dialog"] [name="${fieldName}"]`)?.focus()
  }, 0)
}

export default function ScreenAsistencias() {
  const { session } = useSession()
  const toast = useToast()
  const [filters, setFilters] = useState(initialFilters)
  const [capabilities, setCapabilities] = useState(null)
  const [accessState, setAccessState] = useState('checking')
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [modal, setModal] = useState(null)
  const [auditTarget, setAuditTarget] = useState(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const requestSequenceRef = useRef(0)
  const hasSnapshotRef = useRef(false)
  const mutationInFlightRef = useRef(false)
  const exportInFlightRef = useRef(false)

  const filterValidation = useMemo(() => validateAttendanceFilters(filters), [filters])
  const serverFilters = useMemo(() => serializeAttendanceFilters(filters), [filters])
  const serverFilterKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters])
  const visibleRows = useMemo(
    () => filterAttendanceRows(snapshot.rows, { search: filters.search }),
    [filters.search, snapshot.rows],
  )
  const localAccess = readAttendanceAccess(session)
  const gateDrift = accessState === 'allowed' && localAccess.level !== 'manager'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    getCapabilities()
      .then((capabilities) => {
        if (cancelled) return
        capabilities = capabilities || {}
        setCapabilities(capabilities)
        if (!capabilities.allowed) {
          setAccessState('denied')
          setError(getAttendanceErrorMessage({ code: ACCESS_DENIED_CODE }))
          setLoading(false)
          return
        }
        setAccessState('allowed')
      })
      .catch((requestError) => {
        if (cancelled) return
        if (requestError?.code === ACCESS_DENIED_CODE) {
          setAccessState('denied')
        } else {
          setAccessState('error')
        }
        setError(getAttendanceErrorMessage(requestError))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (accessState !== 'allowed' || !filterValidation.valid) {
      if (accessState === 'allowed') {
        setLoading(false)
        setRefreshing(false)
      }
      return undefined
    }

    const requestSequence = ++requestSequenceRef.current
    let cancelled = false
    if (hasSnapshotRef.current) setRefreshing(true)
    else setLoading(true)
    setError('')

    getAttendance(JSON.parse(serverFilterKey))
      .then((response) => {
        if (cancelled || requestSequence !== requestSequenceRef.current) return
        setSnapshot({
          summary: response?.summary || {},
          rows: Array.isArray(response?.rows) ? response.rows : [],
        })
        hasSnapshotRef.current = true
      })
      .catch((requestError) => {
        if (cancelled || requestSequence !== requestSequenceRef.current) return
        if (requestError?.code === ACCESS_DENIED_CODE) {
          setAccessState('denied')
        }
        setError(getAttendanceErrorMessage(requestError))
      })
      .finally(() => {
        if (cancelled || requestSequence !== requestSequenceRef.current) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessState, filterValidation.valid, reloadVersion, serverFilterKey])

  const closeModal = useCallback(() => {
    if (mutationInFlightRef.current) return
    setModal(null)
    setModalError('')
  }, [])

  const closeAudit = useCallback(() => setAuditTarget(null), [])

  function changeFilters(nextFilters) {
    const datesChanged = nextFilters.date_from !== filters.date_from
      || nextFilters.date_to !== filters.date_to
    setFilters(datesChanged ? { ...nextFilters, preset: 'custom' } : nextFilters)
  }

  function changePreset(preset) {
    const dates = getAttendanceDatePreset(preset, filters)
    setFilters((current) => ({ ...current, ...dates }))
  }

  function openAttendance(mode, row, attendance = null) {
    setModalError('')
    setModal({ type: 'attendance', mode, row, attendance })
  }

  function openAbsence(mode, row) {
    setModalError('')
    setModal({ type: 'absence', mode, row })
  }

  async function performMutation(operation, successMessage) {
    if (mutationInFlightRef.current) return
    mutationInFlightRef.current = true
    setSaving(true)
    setModalError('')
    try {
      await operation()
      setModal(null)
      toast.success(successMessage)
      setReloadVersion((version) => version + 1)
    } catch (requestError) {
      const message = getAttendanceErrorMessage(requestError)
      setModalError(message)
      toast.error(message)
      if (requestError?.code === ACCESS_DENIED_CODE) {
        setModal(null)
        setAccessState('denied')
        setError(message)
        return
      }

      const conflictTarget = getAttendanceConflictTarget(requestError)
      if (EXISTING_RECORD_CODES.has(requestError?.code)) {
        setModal(null)
        setModalError('')
        setError(message)
        setReloadVersion((version) => version + 1)
        if (conflictTarget) setAuditTarget(conflictTarget)
        return
      }

      if (requestError?.code === 'unscheduled_absence_confirmation_required') {
        setModal((current) => current ? { ...current, forceUnscheduledConfirmation: true } : current)
      }
      if (requestError?.code === 'attendance_manager_user_not_configured') {
        focusAttendanceModalField('justification_type')
      }
      if (requestError?.code === 'stale_record' || requestError?.code === 'employee_out_of_scope') {
        setModal(null)
        setError(message)
        setReloadVersion((version) => version + 1)
        return
      }
      focusAttendanceModalField(getAttendanceErrorField(requestError))
    } finally {
      mutationInFlightRef.current = false
      setSaving(false)
    }
  }

  function saveAttendance({ mode, attendance, payload }) {
    const update = mode === 'correct' || mode === 'close'
    return performMutation(
      () => update
        ? updateAttendance(attendance.id, payload)
        : createAttendance(payload),
      update ? 'Asistencia actualizada.' : 'Asistencia registrada.',
    )
  }

  function saveAbsence({ mode, row, payload }) {
    return performMutation(
      () => mode === 'justify'
        ? justifyAbsence(row.absence.id, payload)
        : createAbsence(payload),
      mode === 'justify' ? 'Falta justificada.' : 'Falta registrada.',
    )
  }

  async function exportWorkbook() {
    if (exportInFlightRef.current || !filterValidation.valid) return
    exportInFlightRef.current = true
    setExporting(true)
    setError('')
    const activeFilters = { ...serverFilters }
    try {
      const workbook = await downloadAttendanceWorkbook(activeFilters)
      saveAttendanceWorkbook(workbook)
      toast.success('Excel descargado correctamente.')
    } catch (requestError) {
      const message = `${getAttendanceErrorMessage(requestError)} Los filtros se conservaron; pulsa Exportar Excel para reintentar.`
      setError(message)
      toast.error(message)
      if (requestError?.code === ACCESS_DENIED_CODE) setAccessState('denied')
    } finally {
      exportInFlightRef.current = false
      setExporting(false)
    }
  }

  if (accessState === 'denied') {
    return (
      <main className="attendance-screen attendance-screen--centered">
        <section className="attendance-access-state" role="alert">
          <span aria-hidden="true">🔒</span>
          <h1>Acceso denegado</h1>
          <p>{error || 'No tienes acceso a la administración de asistencias.'}</p>
          <a href="/">Volver al inicio</a>
        </section>
      </main>
    )
  }

  if (accessState === 'checking' || (loading && !hasSnapshotRef.current)) {
    return (
      <main className="attendance-screen attendance-screen--centered">
        <div className="attendance-loading" role="status">Validando acceso y cargando asistencias…</div>
      </main>
    )
  }

  if (accessState === 'error' && !hasSnapshotRef.current) {
    return (
      <main className="attendance-screen attendance-screen--centered">
        <section className="attendance-access-state" role="alert">
          <h1>No fue posible validar el acceso</h1>
          <p>{error}</p>
          <button className="attendance-button attendance-button--primary" onClick={() => window.location.reload()} type="button">
            Reintentar
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="attendance-screen">
      <header className="attendance-heading">
        <div>
          <p>Equipo de Iguala</p>
          <h1>Administración de asistencias</h1>
          <span>Horario local: {capabilities?.timezone || 'America/Mexico_City'}</span>
        </div>
        {refreshing ? <span className="attendance-refreshing" role="status">Actualizando…</span> : null}
      </header>

      {gateDrift ? (
        <div className="attendance-warning" role="alert">
          La autorización de Odoo y el acceso local no coinciden. Odoo permanece como autoridad.
        </div>
      ) : null}

      <AttendanceFilters
        disabled={loading}
        errors={filterValidation.errors}
        exporting={exporting}
        filters={filters}
        onChange={changeFilters}
        onExport={exportWorkbook}
        onPresetChange={changePreset}
      />

      {error ? (
        <div className="attendance-screen-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setReloadVersion((version) => version + 1)} type="button">Reintentar</button>
        </div>
      ) : null}

      <AttendanceSummary summary={snapshot.summary} />
      <AttendanceRows
        disabled={saving}
        onAbsence={openAbsence}
        onAttendance={openAttendance}
        onAudit={setAuditTarget}
        rows={visibleRows}
      />

      {modal?.type === 'attendance' ? (
        <AttendanceModal
          modal={modal}
          onClose={closeModal}
          onSubmit={saveAttendance}
          saving={saving}
          serverError={modalError}
        />
      ) : null}
      {modal?.type === 'absence' ? (
        <AbsenceModal
          modal={modal}
          onClose={closeModal}
          onSubmit={saveAbsence}
          saving={saving}
          serverError={modalError}
        />
      ) : null}
      {auditTarget ? <AuditDrawer onClose={closeAudit} target={auditTarget} /> : null}
    </main>
  )
}
