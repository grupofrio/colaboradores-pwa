import { useEffect, useRef, useState } from 'react'
import {
  validateAbsenceForm,
  validateJustificationForm,
} from '../attendanceState.js'

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const ACCEPTED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])

// eslint-disable-next-line react-refresh/only-export-components
export function validateAttachmentFile(file) {
  if (!file) return ''
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return 'El comprobante debe pesar hasta 5 MiB.'
  }
  const extension = String(file.name || '').toLocaleLowerCase('es-MX').split('.').pop()
  if (!ACCEPTED_MIMES.has(file.type) || !ACCEPTED_EXTENSIONS.has(extension)) {
    return 'El comprobante debe ser PDF, JPG o PNG.'
  }
  return ''
}

// eslint-disable-next-line react-refresh/only-export-components
export function readAttendanceAttachment(file, {
  readerFactory = () => new FileReader(),
} = {}) {
  const validationError = validateAttachmentFile(file)
  if (validationError) return Promise.reject(new Error(validationError))

  return new Promise((resolve, reject) => {
    const reader = readerFactory()
    reader.onerror = () => reject(new Error('No fue posible leer el comprobante.'))
    reader.onload = () => {
      const encoded = String(reader.result || '').split(',')[1]
      if (!encoded) {
        reject(new Error('No fue posible leer el comprobante.'))
        return
      }
      resolve({
        document_base64: encoded,
        document_name: file.name,
        document_mime: file.type,
      })
    }
    reader.readAsDataURL(file)
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAbsenceDraft({ mode, row = {} }) {
  if (mode === 'justify') {
    return {
      employee_id: row?.employee?.id ?? '',
      date: row?.date || '',
      justification_type: '',
      notes: row?.absence?.notes || '',
      version: row?.absence?.version || '',
      change_reason: '',
    }
  }
  return {
    employee_id: row?.employee?.id ?? '',
    date: row?.date || '',
    absence_reason: 'no_show',
    notes: '',
    confirm_unscheduled: false,
    change_reason: '',
  }
}

export function AbsenceModal({
  modal,
  saving,
  serverError = '',
  onClose,
  onSubmit,
}) {
  const { mode, row, forceUnscheduledConfirmation = false } = modal
  const [draft, setDraft] = useState(() => buildAbsenceDraft({ mode, row }))
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [reading, setReading] = useState(false)
  const firstFieldRef = useRef(null)
  const dialogRef = useRef(null)
  const justify = mode === 'justify'
  const needsUnscheduledConfirmation = !row.expected_workday || forceUnscheduledConfirmation
  const busy = saving || reading

  useEffect(() => {
    const previouslyFocused = document.activeElement
    firstFieldRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onClose()
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) || [])]
        const first = focusable[0]
        const last = focusable.at(-1)
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
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [busy, onClose])

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function selectFile(selected) {
    const validationError = validateAttachmentFile(selected)
    setFile(validationError ? null : selected)
    setErrors((current) => ({ ...current, document_base64: validationError || undefined }))
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return

    if (!justify) {
      const payload = {
        ...draft,
        confirm_unscheduled: needsUnscheduledConfirmation
          ? draft.confirm_unscheduled === true
          : false,
      }
      const validation = validateAbsenceForm(payload, {
        expectedWorkday: !needsUnscheduledConfirmation,
      })
      setErrors(validation.errors)
      if (validation.valid) onSubmit({ mode, row, payload })
      return
    }

    const baseValidation = validateJustificationForm(draft)
    const fileError = validateAttachmentFile(file)
    const nextErrors = {
      ...baseValidation.errors,
      ...(fileError ? { document_base64: fileError } : {}),
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setReading(true)
    try {
      const attachment = file ? await readAttendanceAttachment(file) : {}
      const payload = { ...draft, ...attachment }
      const finalValidation = validateJustificationForm(payload)
      setErrors(finalValidation.errors)
      if (finalValidation.valid) onSubmit({ mode, row, payload })
    } catch (error) {
      setErrors((current) => ({ ...current, document_base64: error.message }))
    } finally {
      setReading(false)
    }
  }

  const title = justify ? 'Justificar falta' : 'Registrar falta'

  return (
    <div className="attendance-modal-backdrop">
      <section
        aria-labelledby="absence-modal-title"
        aria-modal="true"
        className="attendance-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <p>Faltas · Iguala</p>
            <h2 id="absence-modal-title">{title}</h2>
          </div>
          <button aria-label="Cerrar formulario" disabled={saving} onClick={onClose} type="button">×</button>
        </header>

        <form onSubmit={submit}>
          <div className="attendance-modal-context">
            <span><strong>Empleado:</strong> {row.employee.name}</span>
            <span><strong>Fecha:</strong> {row.date}</span>
          </div>

          {justify ? (
            <label>
              Tipo de justificación
              <select
                aria-invalid={Boolean(errors.justification_type)}
                disabled={busy}
                name="justification_type"
                onChange={(event) => update('justification_type', event.target.value)}
                ref={firstFieldRef}
                required
                value={draft.justification_type}
              >
                <option value="">Selecciona una opción</option>
                <option value="imss">IMSS</option>
                <option value="funeral">Funeral</option>
                <option value="cita_medica">Cita médica</option>
                <option value="otro">Otro</option>
              </select>
              {errors.justification_type ? <span className="attendance-field-error">{errors.justification_type}</span> : null}
            </label>
          ) : (
            <label>
              Motivo de la falta
              <select
                aria-invalid={Boolean(errors.absence_reason)}
                disabled={busy}
                name="absence_reason"
                onChange={(event) => update('absence_reason', event.target.value)}
                ref={firstFieldRef}
                value={draft.absence_reason}
              >
                <option value="no_show">Sin presentarse</option>
                <option value="retardo_bloqueado">Retardo bloqueado</option>
                <option value="otro">Otro</option>
              </select>
              {errors.absence_reason ? <span className="attendance-field-error">{errors.absence_reason}</span> : null}
            </label>
          )}

          <label>
            Notas (opcional)
            <textarea
              disabled={busy}
              name="notes"
              onChange={(event) => update('notes', event.target.value)}
              rows="3"
              value={draft.notes}
            />
          </label>

          {justify ? (
            <label>
              Comprobante (opcional)
              <input
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                disabled={busy}
                name="attachment"
                onChange={(event) => selectFile(event.target.files?.[0] || null)}
                type="file"
              />
              <small>PDF, JPG o PNG de hasta 5 MiB.</small>
              {errors.document_base64 ? <span className="attendance-field-error">{errors.document_base64}</span> : null}
            </label>
          ) : null}

          {needsUnscheduledConfirmation ? (
            <label className="attendance-confirmation">
              <input
                checked={draft.confirm_unscheduled === true}
                disabled={busy}
                name="confirm_unscheduled"
                onChange={(event) => update('confirm_unscheduled', event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Falta no programada.</strong> Confirmo que debe registrarse aunque el calendario no marcaba jornada.
              </span>
              {errors.confirm_unscheduled ? <span className="attendance-field-error">{errors.confirm_unscheduled}</span> : null}
            </label>
          ) : null}

          <label>
            Motivo administrativo
            <textarea
              aria-invalid={Boolean(errors.change_reason)}
              disabled={busy}
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
            <button className="attendance-button attendance-button--primary" disabled={busy} type="submit">
              {busy ? 'Guardando…' : title}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
