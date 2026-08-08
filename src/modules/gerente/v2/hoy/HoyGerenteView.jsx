// ─── Gerente V2 · Hoy (tablero nativo del día de la sucursal) ────────────────
// Vista PURA: recibe el payload de /pwa-gerente/today y lo pinta. Sin iframe
// Metabase, sin snapshot del mes rotulado "hoy". Cada tarjeta declara su fuente
// y su fecha; `null ≠ 0`, y una fuente sin cablear se dice, no se inventa.
import { BRAND_TOKENS as TOKENS } from '../../../../theme/brandTokens'

const C = TOKENS.colors

const money = (n) => (n === null || n === undefined ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX'))

function Card({ title, children, tone = C.blue3, foot }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.lg,
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tone }} />
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.textLow, margin: 0 }}>
        {title}
      </p>
      <div style={{ marginTop: 8 }}>{children}</div>
      {foot && <p style={{ fontSize: 11, color: C.textMuted, margin: '8px 0 0' }}>{foot}</p>}
    </div>
  )
}

function Unavailable({ reason }) {
  const human = {
    no_branch_warehouses: 'Sin almacenes de sucursal configurados.',
    route_source_present_not_wired: 'Fuente presente, pendiente de cablear con Sebas.',
    route_source_unavailable: 'Sin fuente de ventas de ruta en este ambiente.',
    cash_shift_unavailable: 'Sin módulo de caja en este ambiente.',
    attendance_unavailable: 'Sin módulo de asistencias.',
    employee_analytic_unavailable: 'Empleados sin analítica de sucursal.',
  }[reason] || 'Sin dato disponible.'
  return <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>«—» {human}</p>
}

export default function HoyGerenteView({ data, scope, onRefresh }) {
  if (!data) {
    return <p style={{ color: C.textMuted, padding: 20 }}>Sin datos del día.</p>
  }
  const { pos_sales: pos, route_sales: route, expenses, cash, attendance, date } = data

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: C.textLow, margin: 0 }}>
            MI SUCURSAL · HOY
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '2px 0 0', letterSpacing: '-0.02em' }}>
            {scope?.branch_name || 'Mi sucursal'}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>al {date}</span>
          {onRefresh && (
            <button onClick={onRefresh} style={{
              display: 'block', marginTop: 4, fontSize: 12, color: C.blue3,
              textDecoration: 'underline', cursor: 'pointer',
            }}>Actualizar</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {/* Venta mostrador */}
        <Card title="VENTA MOSTRADOR (HOY)" tone={C.blue3}
          foot={pos?.available ? `${num(pos.count)} tickets · ${pos.source}` : undefined}>
          {pos?.available
            ? <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{money(pos.total)}</span>
            : <Unavailable reason={pos?.reason} />}
        </Card>

        {/* Venta de ruta */}
        <Card title="VENTA DE RUTA (HOY)" tone={C.blue2}
          foot={route?.available ? route.source : undefined}>
          {route?.available
            ? <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{money(route.total)}</span>
            : <Unavailable reason={route?.reason} />}
        </Card>

        {/* Gastos */}
        <Card title="GASTOS DEL DÍA" tone={C.warning}
          foot={expenses?.available ? `${num(expenses.count)} registros` : undefined}>
          {expenses?.available
            ? <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{money(expenses.total)}</span>
            : <Unavailable reason={expenses?.reason} />}
        </Card>

        {/* Caja */}
        <Card title="CAJA" tone={C.success}
          foot={cash?.available && cash?.has_data ? `Último corte: ${cash.state || '—'}` : undefined}>
          {!cash?.available
            ? <Unavailable reason={cash?.reason} />
            : !cash.has_data
              ? <span style={{ fontSize: 13, color: C.textMuted }}>Sin cortes registrados</span>
              : (
                <div>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: cash.is_open ? C.warning : C.success,
                  }}>
                    {cash.is_open ? 'ABIERTA' : 'CERRADA'}
                  </span>
                  {cash.difference !== null && cash.difference !== undefined && (
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>
                      Diferencia último cierre: {money(cash.difference)}
                    </p>
                  )}
                </div>
              )}
        </Card>

        {/* Asistencias */}
        <Card title="ASISTENCIAS DE HOY" tone={C.blue}
          foot={attendance?.available && attendance?.has_data ? `de ${num(attendance.total_employees)} de la sucursal` : undefined}>
          {!attendance?.available
            ? <Unavailable reason={attendance?.reason} />
            : !attendance.has_data
              ? <span style={{ fontSize: 13, color: C.textMuted }}>Sin personal en sucursal</span>
              : (
                <div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{num(attendance.checked_in)}</span>
                  <span style={{ fontSize: 13, color: C.textMuted }}> checaron</span>
                  {attendance.missing > 0 && (
                    <p style={{ fontSize: 12, color: C.warning, margin: '4px 0 0' }}>
                      {num(attendance.missing)} sin checar
                    </p>
                  )}
                </div>
              )}
        </Card>
      </div>
    </div>
  )
}
