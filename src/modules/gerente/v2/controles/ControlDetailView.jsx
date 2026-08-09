// ─── Gerente V2 · Controles · detalle de una regla (lista de items) ──────────
// Lista el mínimo para ACTUAR: id, fecha, capturista, monto, motivo de la marca.
// Read-only: no hay acciones de escritura aquí. La columna de motivo explica por
// qué el backend marcó cada renglón.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'
import { formatTotal, ruleMeta } from './controlsCatalog.js'

const C = TOKENS.colors

const fmtDate = (d) => {
  if (!d) return '—'
  const s = String(d).replace(' ', 'T')
  const dt = new Date(s.length <= 10 ? s + 'T12:00:00' : s + 'Z')
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ControlDetailView({ ruleKey, items, onBack }) {
  const meta = ruleMeta(ruleKey)
  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, color: C.blue3, cursor: 'pointer', marginBottom: 10 }}>
        ‹ Volver a controles
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{meta?.label || ruleKey}</h1>
      <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 14px' }}>{meta?.desc}</p>

      {!items || items.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted }}>Sin renglones para mostrar.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {['Fecha', 'Capturista', 'Monto', 'Motivo de la marca', 'Ref.'].map((h) => (
                  <th key={h} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: C.textLow, padding: '6px 10px', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id ?? i} style={{ borderBottom: `1px solid ${C.border}33` }}>
                  <td style={{ fontSize: 12, color: C.text, padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(it.date || it.date_order || it.create_date)}</td>
                  <td style={{ fontSize: 12, color: C.text, padding: '8px 10px' }}>{it.capturista || it.employee || '—'}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: C.text, padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatTotal(meta, it.amount ?? it.total ?? it.total_amount)}</td>
                  <td style={{ fontSize: 12, color: C.textMuted, padding: '8px 10px' }}>{it.reason || it.motivo || '—'}</td>
                  <td style={{ fontSize: 12, color: C.textLow, padding: '8px 10px', whiteSpace: 'nowrap' }}>{it.reference || it.ref || (it.id != null ? `#${it.id}` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 11, color: C.textLow, marginTop: 14 }}>
        Solo lectura. Este panel señala qué revisar; la acción se toma en el módulo correspondiente.
      </p>
    </div>
  )
}
