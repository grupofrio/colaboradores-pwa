const CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
})

function money(value) {
  return CURRENCY.format(value)
}

function shiftLabel(type) {
  return type === 'night' ? 'Noche' : 'Día'
}

function paymentLabel(method) {
  return ({ cash: 'Efectivo', card: 'Terminal', credit: 'Crédito', transfer: 'Transferencia' })[method] || method
}

function stateLabel(state) {
  return ({ open: 'Abierto', pending_auth: 'Pendiente de autorización', closed: 'Cerrado', reopened: 'Reabierto' })[state] || state
}

function EmptyRow({ columns, children }) {
  return <tr><td colSpan={columns}>{children}</td></tr>
}

function AuditTable({ title, headers, children }) {
  return (
    <section className="cash-shift-print-section">
      <h3>{title}</h3>
      <div className="cash-shift-table-wrap">
        <table className="cash-shift-report-table">
          <thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

function defaultPrint() {
  globalThis.window?.print()
}

export default function CashShiftPrintView({ cashShift, onPrint = defaultPrint }) {
  if (!cashShift?.printable) {
    return (
      <section className="cash-shift-card" role="status">
        <h2>Reporte no imprimible</h2>
        <p>El backend no confirmó una fotografía cerrada y versionada para imprimir.</p>
      </section>
    )
  }

  const responsible = cashShift.responsible.employeeName || cashShift.responsible.userName || 'Sin responsable'
  return (
    <article className="cash-shift-card cash-shift-print-report" aria-labelledby="cash-shift-print-title">
      <header className="cash-shift-print-header">
        <div>
          <p className="cash-shift-eyebrow">REPORTE DE CORTE POS</p>
          <h2 id="cash-shift-print-title">{cashShift.folio}</h2>
          <p>Responsable: <strong>{responsible}</strong></p>
        </div>
        <button className="cash-shift-primary cash-shift-print-hide" type="button" onClick={onPrint}>Imprimir</button>
      </header>

      <dl className="cash-shift-period-grid cash-shift-print-summary">
        <div><dt>Fecha operativa</dt><dd>{cashShift.shift.businessDate}</dd></div>
        <div><dt>Turno</dt><dd>{shiftLabel(cashShift.shift.type)}</dd></div>
        <div><dt>Periodo real</dt><dd>{cashShift.period.openedAt} → {cashShift.period.closedAt || 'Abierto'}</dd></div>
        <div><dt>Zona horaria</dt><dd>{cashShift.period.timezone}</dd></div>
        <div><dt>Fotografía tomada</dt><dd>{cashShift.closedOrReclosedAt || 'Sin cierre'}</dd></div>
        <div><dt>Estado</dt><dd>{stateLabel(cashShift.shift.state)}</dd></div>
        <div><dt>Versión</dt><dd>Versión {cashShift.versionNumber}</dd></div>
      </dl>

      {cashShift.previousVersionId ? (
        <p className="cash-shift-info">
          Versión anterior #{cashShift.previousVersionId}. Razón de reapertura: {cashShift.reopenReason || 'Sin razón registrada'}.
        </p>
      ) : null}

      <AuditTable title="Pagos" headers={['Ticket', 'Método', 'Importe']}>
        {cashShift.payments.rows.length ? cashShift.payments.rows.map((row) => (
          <tr key={row.order_id}><td>#{row.order_id}</td><td>{paymentLabel(row.method)}</td><td>{money(row.amount)}</td></tr>
        )) : <EmptyRow columns={3}>Sin pagos</EmptyRow>}
        <tr className="cash-shift-table-total"><th scope="row">Total</th><td>Efectivo {money(cashShift.payments.cash)} · Terminal {money(cashShift.payments.card)}</td><td>{money(cashShift.payments.total)}</td></tr>
      </AuditTable>

      <AuditTable title="Productos" headers={['Producto', 'Cantidad', 'Peso', 'Importe']}>
        {cashShift.products.length ? cashShift.products.map((row) => (
          <tr key={row.product_id}>
            <td>{row.sku ? `${row.sku} · ` : ''}{row.product_name}</td>
            <td>{row.quantity}</td>
            <td>{row.weight_unknown ? 'Peso no disponible' : `${row.weight_total_kg} kg`}</td>
            <td>{money(row.amount_total)}</td>
          </tr>
        )) : <EmptyRow columns={4}>Sin productos</EmptyRow>}
      </AuditTable>

      <AuditTable title="Ventas y tickets" headers={['Folio', 'Canal', 'Método', 'Importe']}>
        {cashShift.sales.length ? cashShift.sales.map((row) => (
          <tr key={row.order_id}><td>{row.name} · #{row.order_id}</td><td>{row.channel}</td><td>{paymentLabel(row.payment_method)}</td><td>{money(row.amount_total)}</td></tr>
        )) : <EmptyRow columns={4}>Sin ventas</EmptyRow>}
      </AuditTable>

      <AuditTable title="Gastos" headers={['Folio', 'Concepto', 'Estado', 'Importe']}>
        {cashShift.expenses.length ? cashShift.expenses.map((row) => (
          <tr key={row.expense_id}><td>{row.name}</td><td>{row.concept}</td><td>{row.approval_state || 'Sin estado'}</td><td>{money(row.amount)}</td></tr>
        )) : <EmptyRow columns={4}>Sin gastos</EmptyRow>}
      </AuditTable>

      <AuditTable title="Cancelaciones" headers={['Ticket', 'Razón', 'Origen', 'Importe']}>
        {cashShift.cancellations.length ? cashShift.cancellations.map((row) => (
          <tr key={row.order_id}><td>{row.name} · #{row.order_id}</td><td>{row.reason_text || 'Sin razón histórica'}</td><td>{row.origin || 'Histórico'}</td><td>{money(row.amount_total)}</td></tr>
        )) : <EmptyRow columns={4}>Sin cancelaciones</EmptyRow>}
      </AuditTable>

      <AuditTable title="Ajustes" headers={['Tipo', 'Concepto', 'Actor', 'Importe']}>
        {cashShift.adjustments.length ? cashShift.adjustments.map((row) => (
          <tr key={row.id}><td>{row.type === 'income' ? 'Ingreso' : 'Egreso'}</td><td>{row.concept}</td><td>Empleado #{row.actor_employee_id}</td><td>{money(row.amount)}</td></tr>
        )) : <EmptyRow columns={4}>Sin ajustes</EmptyRow>}
      </AuditTable>

      <section className="cash-shift-print-section">
        <h3>Arqueo</h3>
        <dl className="cash-shift-period-grid cash-shift-print-summary">
          <div><dt>Fondo inicial</dt><dd>{money(cashShift.openingFund)}</dd></div>
          <div><dt>Esperado</dt><dd>{money(cashShift.totals.expectedCash)}</dd></div>
          <div><dt>Físico</dt><dd>{money(cashShift.physicalCash)}</dd></div>
          <div><dt>Diferencia</dt><dd>{money(cashShift.difference)}</dd></div>
        </dl>
        <AuditTable title="Denominaciones" headers={['Denominación', 'Conteo', 'Subtotal']}>
          {cashShift.denominations.length ? cashShift.denominations.map((row) => (
            <tr key={row.id || row.denomination}><td>{money(Number(row.denomination))}</td><td>{row.count}</td><td>{money(row.subtotal)}</td></tr>
          )) : <EmptyRow columns={3}>Sin denominaciones</EmptyRow>}
        </AuditTable>
        <p><strong>Nota de diferencia:</strong> {cashShift.differenceNote || 'Sin nota'}</p>
      </section>

      <section className="cash-shift-print-section">
        <h3>Evidencia</h3>
        <p>Presencia confirmada por backend: {cashShift.evidencePresent ? 'Sí' : 'No'}.</p>
        {cashShift.evidence ? (
          <dl className="cash-shift-period-grid cash-shift-print-summary">
            <div><dt>Presencia</dt><dd>Adjunta</dd></div>
            <div><dt>Referencia</dt><dd>{cashShift.evidence.reference}</dd></div>
            <div><dt>Digest</dt><dd>{cashShift.evidence.digest}</dd></div>
            <div><dt>Archivo</dt><dd>{cashShift.evidence.name}</dd></div>
          </dl>
        ) : <p>Sin evidencia adjunta.</p>}
      </section>

      <AuditTable title="Autorizaciones" headers={['Nivel', 'Actor', 'Fecha']}>
        {cashShift.authorizations.length ? cashShift.authorizations.map((row) => (
          <tr key={row.id}><td>{row.level === 'manager' ? 'Gerencia' : 'Dirección'}</td><td>Empleado #{row.actor_employee_id}</td><td>{row.authorized_at}</td></tr>
        )) : <EmptyRow columns={3}>Sin autorizaciones</EmptyRow>}
      </AuditTable>
    </article>
  )
}
