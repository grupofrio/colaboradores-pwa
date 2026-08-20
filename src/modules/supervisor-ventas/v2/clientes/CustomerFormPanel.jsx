// Panel puro create/edit cliente (SSR-testeable). name solo editable en create.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '10px 12px',
  borderRadius: TOKENS.radius.md, border: `1px solid ${C.border}`, background: C.surface,
  color: C.text,
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: C.textSoft, marginBottom: 4, display: 'block' }

export default function CustomerFormPanel({
  mode = 'create', // create | edit
  draft = {},
  onChange,
  onSubmit,
  onCancel,
  saving = false,
  error = '',
  success = '',
  nameReadOnly = false,
}) {
  const title = mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'
  const set = (key) => (e) => onChange && onChange({ ...draft, [key]: e.target.value })

  return (
    <section
      data-testid={mode === 'create' ? 'clientes-create-panel' : 'clientes-edit-panel'}
      aria-label={title}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
        padding: 16, marginBottom: 14,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: C.text }}>{title}</h2>

      <label style={labelStyle} htmlFor="cli-name">Nombre {mode === 'create' ? '*' : ''}</label>
      <input
        id="cli-name"
        data-testid="clientes-field-name"
        value={draft.name || ''}
        onChange={set('name')}
        disabled={nameReadOnly || saving}
        readOnly={nameReadOnly}
        placeholder="Nombre del cliente"
        style={{ ...fieldStyle, marginBottom: 10, opacity: nameReadOnly ? 0.75 : 1 }}
      />

      <label style={labelStyle} htmlFor="cli-phone">Teléfono</label>
      <input id="cli-phone" data-testid="clientes-field-phone" value={draft.phone || ''} onChange={set('phone')} disabled={saving} style={{ ...fieldStyle, marginBottom: 10 }} />

      <label style={labelStyle} htmlFor="cli-email">Email</label>
      <input id="cli-email" data-testid="clientes-field-email" value={draft.email || ''} onChange={set('email')} disabled={saving} style={{ ...fieldStyle, marginBottom: 10 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="cli-lat">Latitud</label>
          <input id="cli-lat" data-testid="clientes-field-lat" value={draft.latitude || ''} onChange={set('latitude')} disabled={saving} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="cli-lng">Longitud</label>
          <input id="cli-lng" data-testid="clientes-field-lng" value={draft.longitude || ''} onChange={set('longitude')} disabled={saving} style={fieldStyle} />
        </div>
      </div>

      {error ? (
        <div data-testid="clientes-form-error" role="alert" style={{
          fontSize: 13, color: '#b91c1c', background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.3)',
          borderRadius: TOKENS.radius.md, padding: '9px 11px', marginBottom: 10,
        }}>{error}</div>
      ) : null}
      {success ? (
        <div data-testid="clientes-form-success" role="status" style={{
          fontSize: 13, color: '#15803d', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: TOKENS.radius.md, padding: '9px 11px', marginBottom: 10,
        }}>{success}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" data-testid="clientes-form-cancel" onClick={onCancel} disabled={saving} style={{
          minHeight: 44, padding: '0 14px', borderRadius: TOKENS.radius.md, border: `1px solid ${C.border}`,
          background: C.surfaceSoft, color: C.textSoft, fontWeight: 700, cursor: 'pointer',
        }}>Cancelar</button>
        <button type="button" data-testid="clientes-form-save" onClick={onSubmit} disabled={saving} style={{
          minHeight: 44, padding: '0 16px', borderRadius: TOKENS.radius.md, border: 'none',
          background: C.blue3 || '#1d4ed8', color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? 'Guardando…' : (mode === 'create' ? 'Crear cliente' : 'Guardar')}</button>
      </div>
    </section>
  )
}
