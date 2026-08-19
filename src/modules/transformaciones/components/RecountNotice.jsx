import { TOKENS } from '../../../tokens'

// Aviso de recuento.
//
// No bloquea: pide volver a contar. El campo de bolsas queda VACIO a
// proposito — un "¿estas seguro?" se contesta que si sin ir a contar.
//
// Todo lo que se muestra viene del servidor (`evaluation`): el esperado, la
// desviacion y el umbral los decide Odoo. Esta vista no compara nada.
export default function RecountNotice({ evaluation, firstCount, typo, onCancel }) {
  if (!evaluation) return null
  const expected = Number(evaluation.expected_output_qty_units || 0)
  const variance = Number(evaluation.variance_pct || 0)
  const arriba = evaluation.direction === 'arriba'

  return (
    <div style={{
      marginBottom: 12,
      padding: 16,
      borderRadius: TOKENS.radius.xl,
      background: 'rgba(245,158,11,0.10)',
      border: '1px solid rgba(245,158,11,0.35)',
    }}>
      <p style={{ ...typo.title, color: TOKENS.colors.warning, margin: 0 }}>
        Verifica el conteo
      </p>
      <p style={{ ...typo.body, color: TOKENS.colors.textSoft, margin: '8px 0 0' }}>
        Capturaste <b>{firstCount}</b> y la receta esperaba <b>{expected.toFixed(0)}</b>
        {' '}({arriba ? '+' : ''}{variance.toFixed(0)} %). Vuelve a contar y captura el número otra vez.
      </p>
      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '8px 0 0' }}>
        Si al recontar sale el mismo número, captúralo igual: los dos conteos quedan registrados.
      </p>
      <button
        onClick={onCancel}
        style={{
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: TOKENS.radius.pill,
          background: TOKENS.colors.surface,
          border: `1px solid ${TOKENS.colors.border}`,
          color: TOKENS.colors.textMuted,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Dejar {firstCount} y continuar
      </button>
    </div>
  )
}
