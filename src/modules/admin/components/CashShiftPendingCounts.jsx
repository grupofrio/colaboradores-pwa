function shiftLabel(type) {
  return type === 'night' ? 'Noche' : 'Día'
}

function dateTime(value) {
  return String(value || '').replace('T', ' ') || 'Por confirmar'
}

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Selector de arqueos separados por el servidor.
 *
 * Intencionalmente no suma efectivo ni infiere importes: el preview v2 de cada
 * turno es la única fuente para el formulario de arqueo.
 */
export default function CashShiftPendingCounts({
  status = 'idle',
  shifts = [],
  error = '',
  openingShiftId = null,
  onOpen,
  onRefresh,
}) {
  if (status === 'loading' || status === 'idle') {
    return (
      <section className="cash-shift-card cash-shift-pending-counts" aria-labelledby="cash-shift-pending-title">
        <p className="cash-shift-eyebrow">ARQUEOS PENDIENTES</p>
        <h2 id="cash-shift-pending-title">Arqueos pendientes</h2>
        <p className="cash-shift-muted" role="status">Consultando los turnos separados por el servidor…</p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="cash-shift-card cash-shift-pending-counts" aria-labelledby="cash-shift-pending-title">
        <p className="cash-shift-eyebrow">ARQUEOS PENDIENTES</p>
        <h2 id="cash-shift-pending-title">Arqueos pendientes</h2>
        <p className="cash-shift-error" role="alert">{error || 'No se pudo consultar los arqueos pendientes.'}</p>
        <button className="cash-shift-secondary" type="button" onClick={onRefresh}>Reintentar arqueos pendientes</button>
      </section>
    )
  }

  return (
    <section className="cash-shift-card cash-shift-pending-counts" aria-labelledby="cash-shift-pending-title">
      <div className="cash-shift-heading-row">
        <div>
          <p className="cash-shift-eyebrow">ARQUEOS PENDIENTES</p>
          <h2 id="cash-shift-pending-title">Arqueos pendientes</h2>
        </div>
        <button className="cash-shift-secondary" type="button" onClick={onRefresh}>Actualizar</button>
      </div>
      <p className="cash-shift-warning" role="status">
        Separe y etiquete el efectivo de cada turno terminado antes de continuar vendiendo. El nuevo turno ya opera con fondo $0.00.
      </p>
      {error ? <p className="cash-shift-error" role="alert">{error}</p> : null}
      {shifts.length === 0 ? (
        <p className="cash-shift-muted">No hay arqueos pendientes en tu alcance.</p>
      ) : (
        <ul className="cash-shift-pending-list">
          {shifts.map((shift) => {
            const label = `${shiftLabel(shift.shiftType)} ${Number(shift.businessDate.slice(-2))}`
            const opening = openingShiftId === shift.shiftId
            return (
              <li key={shift.shiftId}>
                <div className="cash-shift-heading-row">
                  <div>
                    <h3>{label}</h3>
                    <p className="cash-shift-muted">Fecha operativa {shift.businessDate}</p>
                  </div>
                  <span className={`cash-shift-status ${shift.shiftType}`}>Pendiente</span>
                </div>
                <dl className="cash-shift-period-grid">
                  <div><dt>Frontera programada</dt><dd>{dateTime(shift.scheduledBoundaryAt)}</dd></div>
                  <div><dt>Ejecución</dt><dd>{dateTime(shift.boundaryExecutedAt)}</dd></div>
                  <div><dt>Fin operativo</dt><dd>{dateTime(shift.operationalClosedAt)}</dd></div>
                  <div><dt>Importe esperado</dt><dd>{money(shift.expectedCash)}</dd></div>
                </dl>
                {shift.lateExecution ? (
                  <p className="cash-shift-warning">La separación se ejecutó tarde; documenta la excepción durante el arqueo.</p>
                ) : null}
                <button
                  className="cash-shift-primary"
                  type="button"
                  disabled={opening}
                  onClick={() => onOpen(shift)}
                >{opening ? 'Abriendo arqueo…' : `Capturar arqueo ${label}`}</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
