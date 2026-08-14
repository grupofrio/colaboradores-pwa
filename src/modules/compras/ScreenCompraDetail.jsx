import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { COMPANY_LABELS, TOKENS } from '../../tokens.js'
import ProductCreateDialog from './components/ProductCreateDialog.jsx'
import { getBuyerRequisitionUiState, retainBuyerWorkflowAfterFailure } from './requisitionState.js'
import {
  approveBuyerRequisition,
  confirmBuyerRequisition,
  createBuyerProduct,
  getBuyerRequisitionDetail,
  updateBuyerRequisition,
} from './api.js'

const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0))

function inputStyle() {
  return { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${TOKENS.colors.border}`, background: TOKENS.colors.surfaceSoft, color: TOKENS.colors.text, font: 'inherit' }
}

function currentLine(line, patch = {}) {
  return {
    product_id: patch.product_id ?? line.product_id,
    quantity: patch.quantity ?? line.product_qty,
    price_unit: patch.price_unit ?? line.price_unit,
  }
}

export default function ScreenCompraDetail() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [lineState, setLineState] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productLineId, setProductLineId] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getBuyerRequisitionDetail(poId)
      setDetail(result?.data || result)
      setLineState({})
    } catch (err) {
      setError(err?.message || 'No se pudo abrir la requisición.')
    } finally {
      setLoading(false)
    }
  }, [poId])

  useEffect(() => { load() }, [load])
  const dirty = Object.keys(lineState).length > 0
  const plazaAccountId = Number(detail?.gf_plaza_analytic_account_id || 0)
  const lines = Array.isArray(detail?.lines) ? detail.lines : []
  const { editable, canConfirm } = getBuyerRequisitionUiState(detail, action)

  const estimatedTotal = lines.reduce((sum, line) => {
    const current = currentLine(line, lineState[line.line_id])
    return sum + Number(current.quantity || 0) * Number(current.price_unit || 0)
  }, 0)

  function patchLine(lineId, patch) {
    setLineState((previous) => ({ ...previous, [lineId]: { ...(previous[lineId] || {}), ...patch } }))
    setNotice('')
  }

  function retainFailure(err) {
    const failed = retainBuyerWorkflowAfterFailure({ lineState, action, detail }, err)
    setLineState(failed.lineState)
    setAction(failed.action)
    setDetail(failed.detail)
    setError(failed.error)
  }

  async function saveChanges() {
    if (!dirty || saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updates = lines.filter((line) => lineState[line.line_id]).map((line) => ({ line_id: line.line_id, ...lineState[line.line_id] }))
      const result = await updateBuyerRequisition(detail.purchase_order_id || poId, updates)
      setDetail(result?.data || result)
      setLineState({})
      setNotice(result?.message || 'Cambios guardados.')
    } catch (err) {
      // No se limpia lineState: la persona conserva su captura para corregirla.
      retainFailure(err)
    } finally { setSaving(false) }
  }

  async function createProduct(values) {
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await createBuyerProduct(detail.purchase_order_id || poId, values)
      const payload = result?.data || result || {}
      if (!payload.product_id) throw new Error(result?.message || 'Odoo no devolvió el producto creado.')
      patchLine(productLineId, { product_id: Number(payload.product_id) })
      setProductLineId(0)
      setNotice(`${payload.name || 'Producto'} creado. Falta guardar la línea para aplicarlo.`)
    } finally { setSaving(false) }
  }

  async function approve() {
    if (dirty) { setError('Guarda los cambios antes de aprobar.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await approveBuyerRequisition(detail.purchase_order_id || poId)
      setAction('approved')
      setDetail((previous) => ({ ...previous, approval_state: 'approved' }))
      setNotice(result?.message || 'Requisición aprobada. Confirma explícitamente para generar la orden.')
    } catch (err) { retainFailure(err) } finally { setSaving(false) }
  }

  async function confirm() {
    if (dirty || !canConfirm) { setError('Primero guarda los cambios y aprueba la requisición.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await confirmBuyerRequisition(detail.purchase_order_id || poId)
      setAction('confirmed')
      setDetail((previous) => ({ ...previous, state: result?.data?.state || result?.state || 'purchase' }))
      setNotice(result?.message || 'Requisición confirmada.')
    } catch (err) { retainFailure(err) } finally { setSaving(false) }
  }

  if (loading) return <main style={{ minHeight: '100dvh', background: TOKENS.colors.bg0, color: TOKENS.colors.text, padding: 24 }}>Cargando requisición…</main>
  if (!detail) return <main style={{ minHeight: '100dvh', background: TOKENS.colors.bg0, color: TOKENS.colors.text, padding: 24 }}><button onClick={() => navigate('/compras-csc')}>Volver</button><p role="alert">{error || 'Requisición no disponible.'}</p></main>

  const company = detail.company_name || COMPANY_LABELS[detail.company_id] || `Empresa ${detail.company_id}`
  const readOnly = !editable
  return (
    <main style={{ minHeight: '100dvh', background: TOKENS.colors.bg0, color: TOKENS.colors.text, padding: '16px 16px 40px' }}>
      <div style={{ width: 'min(100%, 760px)', margin: '0 auto' }}>
        <button type="button" onClick={() => navigate('/compras-csc')} style={{ border: 0, padding: 0, background: 'transparent', color: TOKENS.colors.blue3, cursor: 'pointer' }}>← Compras CSC GF</button>
        <header style={{ padding: '16px 0', borderBottom: `1px solid ${TOKENS.colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><h1 style={{ margin: 0, fontSize: 22 }}>{detail.name || `PO ${poId}`}</h1><strong style={{ color: TOKENS.colors.blue3 }}>{money(estimatedTotal || detail.amount_total)}</strong></div>
          <p style={{ color: TOKENS.colors.textSoft, margin: '7px 0 0', fontSize: 13 }}>{company} · {detail.gf_plaza_analytic_account_name || 'Plaza no disponible'}</p>
          <p style={{ color: TOKENS.colors.textMuted, margin: '3px 0 0', fontSize: 12 }}>Almacén: {detail.authority_warehouse_name || 'No disponible'} · Solicitante: {detail.requested_by_employee_name || 'No disponible'}</p>
        </header>
        {error && <p role="alert" style={{ color: TOKENS.colors.error, background: TOKENS.colors.errorSoft, padding: 12, borderRadius: 10 }}>{error}</p>}
        {notice && <p role="status" style={{ color: TOKENS.colors.success, background: TOKENS.colors.successSoft, padding: 12, borderRadius: 10 }}>{notice}</p>}
        <section style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {lines.map((line) => {
            const patch = lineState[line.line_id] || {}
            const current = currentLine(line, patch)
            return <article key={line.line_id} style={{ padding: 14, borderRadius: TOKENS.radius.md, border: `1px solid ${TOKENS.colors.border}`, background: TOKENS.glass.panel }}>
              <strong>{line.product_name || `Producto ${line.product_id}`}</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 120px', gap: 10, marginTop: 12 }}>
                <label style={{ color: TOKENS.colors.textMuted, fontSize: 11 }}>Producto (ID)
                  <input disabled={readOnly} min="1" type="number" value={current.product_id || ''} onChange={(event) => patchLine(line.line_id, { product_id: Number(event.target.value) })} style={{ ...inputStyle(), marginTop: 4 }} />
                </label>
                <label style={{ color: TOKENS.colors.textMuted, fontSize: 11 }}>Cantidad
                  <input disabled={readOnly} min="0.001" step="0.001" type="number" value={current.quantity ?? ''} onChange={(event) => patchLine(line.line_id, { quantity: Number(event.target.value) })} style={{ ...inputStyle(), marginTop: 4 }} />
                </label>
                <label style={{ color: TOKENS.colors.textMuted, fontSize: 11 }}>Precio unitario
                  <input disabled={readOnly} min="0" step="0.01" type="number" value={current.price_unit ?? ''} onChange={(event) => patchLine(line.line_id, { price_unit: Number(event.target.value) })} style={{ ...inputStyle(), marginTop: 4 }} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'end', marginTop: 12 }}>
                <div><span style={{ color: TOKENS.colors.textMuted, fontSize: 11 }}>Analítica autorizada</span><p style={{ margin: '3px 0 0', fontSize: 12 }}>{detail.gf_plaza_analytic_account_name || `Cuenta ${plazaAccountId}`} · 100%</p></div>
                {!readOnly && <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => patchLine(line.line_id, { analytic_distribution: { [String(plazaAccountId)]: 100 } })} disabled={!plazaAccountId} style={{ border: `1px solid ${TOKENS.colors.borderBlue}`, borderRadius: 8, padding: '8px 10px', background: 'transparent', color: TOKENS.colors.blue3, cursor: 'pointer' }}>Aplicar analítica</button><button type="button" onClick={() => setProductLineId(line.line_id)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: TOKENS.colors.blueGlow, color: TOKENS.colors.blue3, cursor: 'pointer' }}>Nuevo producto</button></div>}
              </div>
            </article>
          })}
        </section>
        {(editable || canConfirm) && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          {editable && <>
            <button type="button" disabled={!dirty || saving} onClick={saveChanges} style={{ border: 0, borderRadius: 9, padding: '11px 14px', background: TOKENS.colors.blue2, color: 'white', fontWeight: 700, cursor: !dirty || saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Procesando…' : 'Guardar cambios'}</button>
            <button type="button" disabled={dirty || saving} onClick={approve} style={{ border: `1px solid ${TOKENS.colors.warning}`, borderRadius: 9, padding: '11px 14px', background: 'transparent', color: TOKENS.colors.warning, fontWeight: 700, cursor: dirty || saving ? 'not-allowed' : 'pointer' }}>Aprobar</button>
          </>}
          {canConfirm && <button type="button" disabled={dirty || saving} onClick={confirm} style={{ border: 0, borderRadius: 9, padding: '11px 14px', background: TOKENS.colors.success, color: '#031307', fontWeight: 700, cursor: dirty || saving ? 'not-allowed' : 'pointer' }}>Confirmar</button>}
        </div>}
      </div>
      {productLineId > 0 && <ProductCreateDialog purchaseOrderId={detail.purchase_order_id || poId} saving={saving} onClose={() => setProductLineId(0)} onCreate={createProduct} />}
    </main>
  )
}
