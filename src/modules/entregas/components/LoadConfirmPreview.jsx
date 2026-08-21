import { TOKENS as DARK_TOKENS } from '../../../tokens'

// `tokens` OPCIONAL con default OSCURO: solo lo usa ScreenCargaUnidades, que
// pasa BRAND_TOKENS cuando la sesión es almacenista_entregas (o supervisión).
export default function LoadConfirmPreview({
  rows = [],
  typo,
  unitName = '',
  locationName = '',
  stockVerified = false,
  tokens = DARK_TOKENS,
}) {
  if (!rows.length) return null

  const TOKENS = tokens
  const totalRequested = rows.reduce((sum, row) => sum + Number(row.requested || 0), 0)
  const insufficientCount = stockVerified ? rows.filter((row) => !row.sufficient).length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '12px 14px',
        borderRadius: TOKENS.radius.lg,
        background: TOKENS.colors.surfaceSoft,
        border: `1px solid ${TOKENS.colors.borderBlue}`,
      }}>
        <p style={{ margin: 0, color: TOKENS.colors.text, fontSize: 13, fontWeight: 700 }}>
          Resumen previo de carga
        </p>
        <p style={{ margin: '4px 0 0', color: TOKENS.colors.textMuted, fontSize: 12, lineHeight: 1.45 }}>
          {`${locationName || 'CEDIS'} -> ${unitName || 'Unidad'}`}
        </p>
        <p style={{ margin: '6px 0 0', color: TOKENS.colors.textSoft, fontSize: 12, lineHeight: 1.45 }}>
          {rows.length} producto{rows.length !== 1 ? 's' : ''} · {totalRequested} unidad{totalRequested !== 1 ? 'es' : ''}
          {stockVerified
            ? (insufficientCount > 0 ? ` · ${insufficientCount} con faltante` : '')
            : ' · stock sin verificar'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <div
            key={row.product_id}
            style={{
              padding: '10px 12px',
              borderRadius: TOKENS.radius.md,
              background: !stockVerified
                ? TOKENS.colors.surfaceSoft
                : row.sufficient
                  ? TOKENS.colors.successSoft
                  : TOKENS.colors.errorSoft,
              border: `1px solid ${!stockVerified
                ? TOKENS.colors.borderBlue
                : row.sufficient
                  ? TOKENS.colors.success + '30'
                  : TOKENS.colors.error + '3D'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <p style={{
                margin: 0,
                color: TOKENS.colors.text,
                fontSize: typo?.caption?.fontSize || 12,
                fontWeight: 700,
                flex: 1,
                minWidth: 0,
              }}>
                {row.product_name || `Producto ${row.product_id}`}
              </p>
              <span style={{
                color: !stockVerified ? TOKENS.colors.blue : row.sufficient ? TOKENS.colors.success : TOKENS.colors.error,
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {!stockVerified ? 'SIN VERIFICAR' : row.sufficient ? 'OK' : 'FALTA'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <MiniMetric label="En almacén" value={stockVerified ? row.onHand : 'N/D'} tokens={TOKENS} />
              <MiniMetric label="Se resta" value={row.requested} tokens={TOKENS} />
              <MiniMetric
                label="Quedaría"
                value={stockVerified ? row.remaining : 'N/D'}
                valueColor={!stockVerified || row.remaining >= 0 ? TOKENS.colors.text : TOKENS.colors.error}
                tokens={TOKENS}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniMetric({ label, value, valueColor, tokens = DARK_TOKENS }) {
  const TOKENS = tokens
  return (
    <div style={{
      minWidth: 88,
      padding: '7px 9px',
      borderRadius: TOKENS.radius.sm,
      background: TOKENS.colors.surfaceSoft,
      border: `1px solid ${TOKENS.colors.border}`,
    }}>
      <p style={{ margin: 0, color: TOKENS.colors.textMuted, fontSize: 10, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: '3px 0 0', color: valueColor || TOKENS.colors.text, fontSize: 13, fontWeight: 700 }}>
        {value}
      </p>
    </div>
  )
}
