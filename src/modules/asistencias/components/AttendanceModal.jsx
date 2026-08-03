import { useEffect, useRef, useState } from 'react'
import { validateAttendanceForm } from '../attendanceState.js'

const TITLES = {
  create: 'Registrar asistencia',
  add: 'Agregar tramo',
  correct: 'Corregir horario',
  close: 'Registrar salida',
}

function toDateTimeLocal(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return match ? match[1] : ''
}

function defaultTime(date, time) {
  return date ? `${date}T${time}` : ''
}

// eslint-disable-next-line react-refresh/only-export-components
export function getAttendanceInitialFocusField(mode) {
  return mode === 'close' ? 'check_out' : 'check_in'
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAttendanceDraft({ mode, row = {}, attendance = null }) {
  const update = mode === 'correct' || mode === 'close'
  return {
    employee_id: row?.employee?.id ?? '',
    date: row?.date || '',
    check_in: update
      ? toDateTimeLocal(attendance?.check_in)
      : defaultTime(row?.date, '08:00'),
    check_out: mode === 'correct'
      ? toDateTimeLocal(attendance?.check_out)
      : (mode === 'close' ? defaultTime(row?.date, '17:00') : ''),
    ...(update ? { version: attendance?.version || '' } : {}),
    change_reason: '',
  }
}

export function AttendanceModal({
  modal,
  saving,
  serverError = '',
  onClose,
  onSubmit,
}) {
  const { mode, row, attendance = null } = modal
  const [draft, setDraft] = useState(() => buildAttendanceDraft({ mode, row, attendance }))
  const [errors, setErrors] = useState({})
  const firstFieldRef = useRef(null)
  const dialogRef = useRef(null)
  const initialFocusField = getAttendanceInitialFocusField(mode)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    firstFieldRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose()
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) || [])]
        if (!focusable.length) {
          event.preventDefault()
          dialogRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable.at(-1)
        if (document.activeElement === dialogRef.current) {
          event.preventDefault()
          if (event.shiftKey) last?.focus()
          else first?.focus()
          return
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  useEffect(() => {
    if (saving) dialogRef.current?.focus()
  }, [saving])

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function submit(event) {
    event.preventDefault()
    const validation = validateAttendanceForm(draft, {
      mode: mode === 'create' || mode === 'add' ? 'create' : 'update',
    })
    setErrors(validation.errors)
    if (!validation.valid || saving) return
    onSubmit({ mode, row, attendance, payload: draft })
  }

  const title = TITLES[mode] || 'Administrar asistencia'
  const closeMode = mode === 'close'

  return (
    <div className="attendance-modal-backdrop">
      <section
        aria-labelledby="attendance-modal-title"
        aria-busy={saving}
        aria-modal="true"
        className="attendance-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex="-1"
      >
        <header>
          <div>
            <p>Asistencias · Iguala</p>
            <h2 id="attendance-modal-title">{title}</h2>
          </div>
          <button aria-label="Cerrar formulario" disabled={saving} onClick={onClose} type="button">×</button>
        </header>

        <form onSubmit={submit}>
          <div className="attendance-modal-context">
            <span><strong>Empleado:</strong> {row.employee.name}</span>
            <span><strong>Fecha:</strong> {row.date}</span>
          </div>

          <label>
            Entrada
            <input
              aria-invalid={Boolean(errors.check_in)}
              disabled={saving || closeMode}
              name="check_in"
              onChange={(event) => update('check_in', event.target.value)}
              ref={initialFocusField === 'check_in' ? firstFieldRef : undefined}
              required={mode === 'create' || mode === 'add' || mode === 'correct'}
              type="datetime-local"
              value={draft.check_in}
            />
            {errors.check_in ? <span className="attendance-field-error">{errors.check_in}</span> : null}
          </label>

          <label>
            Salida {mode === 'create' || mode === 'add' ? '(opcional)' : ''}
            <input
              aria-invalid={Boolean(errors.check_out)}
              disabled={saving}
              name="check_out"
              onChange={(event) => update('check_out', event.target.value)}
              ref={initialFocusField === 'check_out' ? firstFieldRef : undefined}
              required={closeMode}
              type="datetime-local"
              value={draft.check_out}
            />
            {errors.check_out ? <span className="attendance-field-error">{errors.check_out}</span> : null}
          </label>

          <label>
            Motivo administrativo
            <textarea
              aria-invalid={Boolean(errors.change_reason)}
              disabled={saving}
              name="change_reason"
              onChange={(event) => update('change_reason', event.target.value)}
              placeholder="Explica por qué se realiza este cambio"
              required
              rows="3"
              value={draft.change_reason}
            />
            {errors.change_reason ? <span className="attendance-field-error">{errors.change_reason}</span> : null}
          </label>

          {draft.version ? <p className="attendance-version">Versión verificada: {draft.version}</p> : null}
          {serverError ? <div className="attendance-form-error" role="alert">{serverError}</div> : null}

          <footer>
            <button className="attendance-button" disabled={saving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="attendance-button attendance-button--primary" disabled={saving} type="submit">
              {saving ? 'Guardando…' : title}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
