import { useState } from 'react'
import { TOKENS } from '../../../tokens.js'

const PRODUCT_TYPES = [
  { value: 'consu', label: 'Consumible' },
  { value: 'product', label: 'Bien' },
  { value: 'service', label: 'Servicio' },
]

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: `1px solid ${TOKENS.colors.border}`, background: TOKENS.colors.surfaceSoft,
  color: TOKENS.colors.text, font: 'inherit',
}

/** El servidor deriva la compañía de la requisición; este formulario no la muestra
 * ni la acepta como dato editable. Catálogo/UoM son ids contractuales de Odoo. */
export default function ProductCreateDialog({ purchaseOrderId, onClose, onCreate, saving = false }) {
  const [form, setForm] = useState({ name: '', categ_id: '', uom_id: '', product_type: 'consu', default_code: '' })
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await onCreate({
        ...form,
        categ_id: Number(form.categ_id),
        uom_id: Number(form.uom_id),
      })
    } catch (err) {
      setError(err?.message || 'No fue posible crear el producto.')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Crear producto" style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center',
      padding: 16, background: 'rgba(0,0,0,0.68)',
    }}>
      <form onSubmit={submit} style={{ width: 'min(100%, 460px)', borderRadius: TOKENS.radius.lg, padding: 20, background: '#0D1829', border: `1px solid ${TOKENS.colors.border}`, boxShadow: TOKENS.shadow.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <div>
            <h2 style={{ margin: 0, color: TOKENS.colors.text, fontSize: 18 }}>Nuevo producto</h2>
            <p style={{ margin: '4px 0 16px', color: TOKENS.colors.textMuted, fontSize: 12 }}>Quedará disponible para futuras requisiciones de la empresa de este folio.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" style={{ border: 0, background: 'transparent', color: TOKENS.colors.textMuted, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={{ display: 'block', color: TOKENS.colors.textMuted, fontSize: 12, marginBottom: 12 }}>Nombre *
          <input required value={form.name} onChange={set('name')} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ color: TOKENS.colors.textMuted, fontSize: 12 }}>Categoría (ID) *
            <input required min="1" type="number" value={form.categ_id} onChange={set('categ_id')} style={{ ...inputStyle, marginTop: 5 }} />
          </label>
          <label style={{ color: TOKENS.colors.textMuted, fontSize: 12 }}>Unidad de medida (ID) *
            <input required min="1" type="number" value={form.uom_id} onChange={set('uom_id')} style={{ ...inputStyle, marginTop: 5 }} />
          </label>
        </div>
        <label style={{ display: 'block', color: TOKENS.colors.textMuted, fontSize: 12, margin: '12px 0' }}>Tipo *
          <select value={form.product_type} onChange={set('product_type')} style={{ ...inputStyle, marginTop: 5 }}>
            {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', color: TOKENS.colors.textMuted, fontSize: 12 }}>Referencia (opcional)
          <input value={form.default_code} onChange={set('default_code')} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        {error && <p role="alert" style={{ color: TOKENS.colors.error, fontSize: 12, margin: '12px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '10px 14px', borderRadius: 9, border: `1px solid ${TOKENS.colors.border}`, background: 'transparent', color: TOKENS.colors.textSoft, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '10px 14px', borderRadius: 9, border: 0, background: TOKENS.colors.blue2, color: 'white', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Creando…' : 'Crear producto'}</button>
        </div>
      </form>
    </div>
  )
}
