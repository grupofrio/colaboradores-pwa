import { durationFromWallTime } from '../cashShiftTime.js'

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function dateTime(value) {
  if (!value) return 'Por confirmar'
  return String(value).replace('T', ' ')
}

export default function CashShiftActivePanel({ cashShift, layout = 'desktop' }) {
  const { shift, period, schedule, totals } = cashShift
  const shiftLabel = shift.type === 'night' ? 'Noche' : 'Día'
  const day = Number(shift.businessDate.slice(-2))

  return (
    <section
      className="cash-shift-card cash-shift-active"
      aria-labelledby="cash-shift-active-title"
      data-cash-shift-source="server-active"
      data-layout={layout}
    >
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">TURNO EN CURSO</p>
          <h2 id="cash-shift-active-title">Turno activo · {shiftLabel} {day}</h2>
        </div>
        <span className={`cash-shift-status ${shift.type}`}>{shiftLabel}</span>
      </div>

      {schedule.overdue ? (
        <p className="cash-shift-warning" role="status">
          Este turno excedió la hora esperada. El corte sigue siendo manual.
        </p>
      ) : (
        <p className="cash-shift-info" role="status">
          El corte es manual; la hora esperada funciona como referencia.
        </p>
      )}

      <dl className="cash-shift-period-grid">
        <div><dt>Apertura real</dt><dd>{dateTime(period.openedAt)}</dd></div>
        <div><dt>Duración</dt><dd>{durationFromWallTime(period.openedAt, period.timezone)}</dd></div>
        <div><dt>Próximo corte esperado</dt><dd>{dateTime(schedule.expectedClose)}</dd></div>
        <div><dt>Fecha operativa</dt><dd>{shift.businessDate}</dd></div>
      </dl>

      <dl className="cash-shift-totals-grid">
        <div><dt>Ventas en efectivo</dt><dd>{money(totals.salesCash)}</dd></div>
        <div><dt>Ventas con terminal</dt><dd>{money(totals.salesCard)}</dd></div>
        <div><dt>Ventas totales</dt><dd>{money(totals.salesTotal)}</dd></div>
        <div><dt>Gastos</dt><dd>{money(totals.expenses)}</dd></div>
        <div className="cash-shift-total-emphasis"><dt>Efectivo esperado</dt><dd>{money(totals.expectedCash)}</dd></div>
      </dl>
    </section>
  )
}
