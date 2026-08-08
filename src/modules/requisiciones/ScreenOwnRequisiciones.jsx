import { useCallback, useEffect, useState } from 'react'
import { TOKENS } from '../../tokens'
import ProductPicker from '../admin/components/ProductPicker'
import { isOwnRequisitionCancellable, recordPurchaseOrderId } from './ownPayload'
import {
  cancelOwnRequisition,
  createOwnRequisition,
  getOwnRequisitions,
} from './ownApi'
import { cancelOwnRequisitionWithMessage, submitOwnRequisition } from './ownUiActions'

const emptyLine = () => ({ product: null, quantity: 1 })

function recordsFrom(response) {
  const data = response?.data ?? response
  if (Array.isArray(data?.requisitions)) return data.requisitions
  return Array.isArray(data) ? data : []
}

function statusLabel(record) {
  return record?.operational_state_label || record?.state_label || record?.state || 'Borrador'
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: TOKENS.radius.md,
  background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
  color: TOKENS.colors.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif",
}

export default function ScreenOwnRequisiciones() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // La respuesta ya llega limitada por el servidor a la identidad y scope.
      setRecords(recordsFrom(await getOwnRequisitions()))
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar tus requisiciones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function updateLine(index, patch) {
    setLines((current) => current.map((line, currentIndex) => (
      currentIndex === index ? { ...line, ...patch } : line
    )))
  }

  function removeLine(index) {
    if (lines.length > 1) setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function submit() {
    const validLines = lines.filter((line) => line.product && Number(line.quantity) > 0)
    if (!title.trim()) { setError('Ingresa un título para la requisición.'); return }
    if (!validLines.length) { setError('Agrega al menos un producto con cantidad.'); return }

    setSubmitting(true)
    setError('')
    setMessage('')
    const form = { name: title, notes, lines }
    const result = await submitOwnRequisition(form, () => (
      createOwnRequisition({
        name: title,
        notes,
        lines: validLines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
      })
    ))
    if (!result.ok) {
      // No se limpia el formulario: la persona puede corregir y reenviar.
      setError(result.error)
      setSubmitting(false)
      return
    }
    setTitle('')
    setNotes('')
    setLines([emptyLine()])
    setMessage('Requisición creada.')
    await load()
    setSubmitting(false)
  }

  async function cancel(record) {
    const purchaseOrderId = recordPurchaseOrderId(record)
    if (!isOwnRequisitionCancellable(record) || cancellingId === purchaseOrderId) return
    setCancellingId(purchaseOrderId)
    setError('')
    setMessage('')
    const result = await cancelOwnRequisitionWithMessage(record, () => cancelOwnRequisition(purchaseOrderId))
    if (!result.ok) {
      setError(result.error)
      setCancellingId(null)
      return
    }
    setMessage(result.message)
    await load()
    setCancellingId(null)
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 96px' }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ color: TOKENS.colors.textLow, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', margin: 0 }}>GUADALAJARA</p>
        <h1 style={{ color: TOKENS.colors.text, fontSize: 26, margin: '5px 0 0' }}>Requisiciones</h1>
      </header>

      {error && <Notice role="alert" color={TOKENS.colors.error} background={TOKENS.colors.errorSoft}>{error}</Notice>}
      {message && <Notice role="status" color={TOKENS.colors.success} background={TOKENS.colors.successSoft}>{message}</Notice>}

      <section style={{ padding: 20, borderRadius: TOKENS.radius.xl, background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`, marginBottom: 24 }}>
        <p style={{ color: TOKENS.colors.textLow, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 14px' }}>NUEVA REQUISICIÓN</p>
        <label htmlFor="own-requisition-title" style={{ color: TOKENS.colors.textMuted, fontSize: 12 }}>Título *</label>
        <input id="own-requisition-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Material de limpieza" style={{ ...inputStyle, margin: '5px 0 14px' }} />

        <label style={{ color: TOKENS.colors.textMuted, fontSize: 12 }}>Productos *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '5px 0 10px' }}>
          {lines.map((line, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <ProductPicker value={line.product} onChange={(product) => updateLine(index, { product })} scope="requisition" placeholder={`Producto ${index + 1}`} />
              <input aria-label={`Cantidad ${index + 1}`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} style={{ ...inputStyle, width: 88, textAlign: 'center' }} />
              <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} style={secondaryButton(lines.length === 1)}>Quitar</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} style={secondaryButton(false)}>+ Agregar producto</button>

        <label htmlFor="own-requisition-notes" style={{ color: TOKENS.colors.textMuted, display: 'block', fontSize: 12, marginTop: 14 }}>Notas (opcional)</label>
        <textarea id="own-requisition-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Urgencia o justificación" style={{ ...inputStyle, resize: 'vertical', margin: '5px 0 14px' }} />
        <button type="button" onClick={submit} disabled={submitting} style={primaryButton(submitting)}>{submitting ? 'Creando…' : 'Crear requisición'}</button>
      </section>

      <section>
        <h2 style={{ color: TOKENS.colors.text, fontSize: 17, margin: '0 0 12px' }}>Mis requisiciones</h2>
        {loading ? <p style={{ color: TOKENS.colors.textMuted }}>Cargando…</p> : records.length === 0 ? <p style={{ color: TOKENS.colors.textMuted }}>No tienes requisiciones todavía.</p> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {records.map((record) => (
              <article key={recordPurchaseOrderId(record)} style={{ padding: 16, borderRadius: TOKENS.radius.lg, background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: TOKENS.colors.text }}>{record.name || `Requisición ${recordPurchaseOrderId(record)}`}</strong>
                  <p style={{ color: TOKENS.colors.textMuted, fontSize: 12, margin: '4px 0 0' }}>{statusLabel(record)}</p>
                </div>
                {isOwnRequisitionCancellable(record) && (
                  <button type="button" onClick={() => cancel(record)} disabled={cancellingId === recordPurchaseOrderId(record)} style={secondaryButton(cancellingId === recordPurchaseOrderId(record))}>{cancellingId === recordPurchaseOrderId(record) ? 'Cancelando…' : 'Cancelar'}</button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Notice({ role, color, background, children }) {
  return <div role={role} aria-live="polite" style={{ color, background, border: `1px solid ${color}55`, borderRadius: TOKENS.radius.md, fontSize: 13, marginBottom: 14, padding: '10px 12px' }}>{children}</div>
}

function primaryButton(disabled) {
  return {
    width: '100%', padding: '13px 16px', border: 0, borderRadius: TOKENS.radius.md,
    background: TOKENS.colors.blue2, color: 'white', cursor: disabled ? 'wait' : 'pointer',
    fontSize: 14, fontWeight: 700, opacity: disabled ? 0.65 : 1,
  }
}

function secondaryButton(disabled) {
  return {
    padding: '9px 12px', borderRadius: TOKENS.radius.md, background: TOKENS.colors.surface,
    border: `1px solid ${TOKENS.colors.border}`, color: TOKENS.colors.textSoft,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, opacity: disabled ? 0.5 : 1,
  }
}
