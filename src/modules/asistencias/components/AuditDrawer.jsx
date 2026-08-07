import { useEffect, useRef, useState } from 'react'
import { getAuditHistory } from '../api.js'
import { getAttendanceErrorMessage } from '../attendanceState.js'

const FIELD_LABELS = {
  check_in: 'Entrada',
  check_out: 'Salida',
  date: 'Fecha',
  absence_reason: 'Motivo de falta',
  justification_type: 'Tipo de justificación',
  notes: 'Notas',
  state: 'Estado',
  justified: 'Justificada',
  rolling_count_30d: 'Faltas en 30 días',
  worked_hours: 'Horas trabajadas',
  document_name: 'Comprobante',
  document_mime: 'Tipo de comprobante',
}
const HIDDEN_FIELDS = /(?:base64|binary|token|password|document_content)/i

function visibleEntries(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  return Object.entries(snapshot)
    .filter(([key]) => !HIDDEN_FIELDS.test(key))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] || key.replaceAll('_', ' '),
      value: readableAuditValue(value),
    }))
}

function readableAuditValue(value) {
  if (value === null || value === undefined || value === '') return 'Sin valor'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (Array.isArray(value)) return value.map(readableAuditValue).join(', ')
  if (typeof value === 'object') {
    if (value.name) return String(value.name)
    return Object.entries(value)
      .filter(([key]) => !HIDDEN_FIELDS.test(key))
      .map(([key, nested]) => `${FIELD_LABELS[key] || key}: ${readableAuditValue(nested)}`)
      .join(' · ')
  }
  return String(value)
}

function formatChangedAt(value) {
  if (!value) return 'Fecha no disponible'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(parsed)
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAuditRequest({ model, recordId, limit = 25, offset = 0 }) {
  return { model, recordId, pagination: { limit, offset } }
}

// eslint-disable-next-line react-refresh/only-export-components
export function nextAuditOffset({ offset = 0, limit = 25, total = 0 }, direction) {
  const maxOffset = Math.max(0, Math.floor(Math.max(0, total - 1) / limit) * limit)
  return Math.min(maxOffset, Math.max(0, offset + direction * limit))
}

export function AuditDrawer({ target, onClose }) {
  const [result, setResult] = useState({ rows: [], total: 0, limit: 25, offset: 0 })
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sequenceRef = useRef(0)
  const closeRef = useRef(null)
  const drawerRef = useRef(null)

  useEffect(() => {
    setOffset(0)
  }, [target.model, target.recordId])

  useEffect(() => {
    const sequence = ++sequenceRef.current
    let cancelled = false
    setLoading(true)
    setError('')

    const request = buildAuditRequest({
      model: target.model,
      recordId: target.recordId,
      limit: 25,
      offset,
    })
    getAuditHistory(request.model, request.recordId, request.pagination)
      .then((response) => {
        if (cancelled || sequence !== sequenceRef.current) return
        setResult({
          rows: Array.isArray(response?.rows) ? response.rows : [],
          total: Number(response?.total) || 0,
          limit: Number(response?.limit) || 25,
          offset: Number(response?.offset) || 0,
        })
      })
      .catch((requestError) => {
        if (cancelled || sequence !== sequenceRef.current) return
        setError(getAttendanceErrorMessage(requestError))
      })
      .finally(() => {
        if (!cancelled && sequence === sequenceRef.current) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [offset, target.model, target.recordId])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    closeRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const focusable = [...(drawerRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
  }, [onClose])

  const pagination = {
    offset: result.offset,
    limit: result.limit,
    total: result.total,
  }
  const from = result.total ? result.offset + 1 : 0
  const to = Math.min(result.total, result.offset + result.rows.length)

  return (
    <div className="attendance-drawer-backdrop">
      <aside
        aria-labelledby="attendance-audit-title"
        aria-modal="true"
        className="attendance-audit-drawer"
        ref={drawerRef}
        role="dialog"
      >
        <header>
          <div>
            <p>Auditoría</p>
            <h2 id="attendance-audit-title">Historial de cambios</h2>
            <span>{target.label}</span>
          </div>
          <button aria-label="Cerrar historial" onClick={onClose} ref={closeRef} type="button">×</button>
        </header>

        <div className="attendance-audit-content">
          {loading ? <div className="attendance-loading" role="status">Cargando historial…</div> : null}
          {error ? <div className="attendance-form-error" role="alert">{error}</div> : null}
          {!loading && !error && !result.rows.length ? (
            <div className="attendance-empty">Este registro todavía no tiene eventos de auditoría.</div>
          ) : null}

          {result.rows.map((entry) => (
            <article className="attendance-audit-entry" key={entry.id}>
              <header>
                <div>
                  <strong>{entry.action || 'Cambio administrativo'}</strong>
                  <span>{entry.actor?.name || 'Responsable no disponible'}</span>
                </div>
                <time dateTime={entry.changed_at}>{formatChangedAt(entry.changed_at)}</time>
              </header>
              <p><strong>Motivo:</strong> {entry.change_reason || 'Sin motivo visible'}</p>
              <div className="attendance-audit-snapshots">
                <section aria-label="Valores anteriores">
                  <h3>Antes</h3>
                  <dl>
                    {visibleEntries(entry.before).map((field) => (
                      <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                    ))}
                  </dl>
                </section>
                <section aria-label="Valores posteriores">
                  <h3>Después</h3>
                  <dl>
                    {visibleEntries(entry.after).map((field) => (
                      <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                    ))}
                  </dl>
                </section>
              </div>
            </article>
          ))}
        </div>

        <footer>
          <span>{from}–{to} de {result.total}</span>
          <div>
            <button
              disabled={loading || result.offset <= 0}
              onClick={() => setOffset(nextAuditOffset(pagination, -1))}
              type="button"
            >
              Anterior
            </button>
            <button
              disabled={loading || result.offset + result.limit >= result.total}
              onClick={() => setOffset(nextAuditOffset(pagination, 1))}
              type="button"
            >
              Siguiente
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
