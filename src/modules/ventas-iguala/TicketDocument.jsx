const CDMX_TIME_ZONE = 'America/Mexico_City'

function money(amount, currency = 'MXN') {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: currency || 'MXN', minimumFractionDigits: 2,
  }).format(value)
}

function dateTime(orderedAt) {
  const date = orderedAt ? new Date(orderedAt) : new Date()
  if (Number.isNaN(date.getTime())) return { date: '—', time: '—' }

  return {
    date: new Intl.DateTimeFormat('es-MX', {
      timeZone: CDMX_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date),
    time: new Intl.DateTimeFormat('es-MX', {
      timeZone: CDMX_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date),
  }
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function documentSubtotal(ticket, lines) {
  if (typeof ticket?.subtotal === 'number' && Number.isFinite(ticket.subtotal)) return ticket.subtotal
  return lines.reduce((sum, line) => sum + finiteNumber(line?.line_total), 0)
}

export default function TicketDocument({ ticket, printId }) {
  const safeTicket = ticket && typeof ticket === 'object' ? ticket : {}
  const lines = Array.isArray(safeTicket.lines) ? safeTicket.lines : []
  const { date, time } = dateTime(safeTicket.ordered_at)
  const subtotal = documentSubtotal(safeTicket, lines)
  const total = finiteNumber(safeTicket.amount_total ?? safeTicket.total)
  const payment = safeTicket.payment && typeof safeTicket.payment === 'object' ? safeTicket.payment : {}
  const paymentLabel = payment.label || payment.method || 'Efectivo'
  const breakdown = Array.isArray(payment.breakdown) ? payment.breakdown : []
  const folio = safeTicket.folio || '—'

  return (
    <article className="gf-ticket-document" id={printId || undefined}>
      <style>{`
        .gf-batch-ticket-print { display: none; }
        .gf-ticket-document {
          width: min(100%, 80mm); background: #fff; color: #1a1a1a;
          border-radius: 16px; padding: 24px 20px; margin: 0 auto 16px;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          .ventas-iguala-screen { display: none !important; }
          .gf-batch-ticket-print { display: block !important; }
          .gf-ticket-document {
            width: 80mm !important; max-width: 80mm !important;
            min-height: 1px; break-after: page; page-break-after: always;
            background: #fff !important; color: #000 !important;
            border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
            padding: 4mm !important; margin: 0 !important;
          }
          .gf-ticket-document:last-child { break-after: auto; page-break-after: auto; }
          .gf-ticket-document * { color: #000 !important; }
        }
      `}</style>

      <header style={{ textAlign: 'center', marginBottom: 16 }}>
        <img src="/icons/logo-grupo-frio.svg" alt="Grupo Frio" style={{ height: 40, marginBottom: 6 }} />
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>GRUPO FRIO</p>
        <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{safeTicket.warehouse_name || 'Sucursal'}</p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#666' }}>
        <span>Fecha: {date}</span>
        <span>Hora: {time}</span>
      </div>
      <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 700 }}>Folio: {folio}</div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>Cliente: {safeTicket.customer?.name || 'Público general'}</div>

      <div style={{ borderTop: '1px dashed #ccc', marginBottom: 12 }} />
      {lines.map((line, index) => {
        const quantity = finiteNumber(line?.quantity)
        const unitPrice = finiteNumber(line?.unit_price)
        const lineTotal = finiteNumber(line?.line_total)
        return (
          <div key={`${line?.product_id || line?.product_name || 'line'}-${index}`} style={{ display: 'flex', gap: 6, marginBottom: 6, fontSize: 11 }}>
            <span style={{ color: '#333', flex: 1 }}>{quantity} x {line?.product_name || 'Producto'}</span>
            <span style={{ color: '#333', minWidth: 50, textAlign: 'right' }}>{money(unitPrice, safeTicket.currency)}</span>
            <span style={{ color: '#1a1a1a', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{money(lineTotal, safeTicket.currency)}</span>
          </div>
        )
      })}

      <div style={{ borderTop: '1px dashed #ccc', margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: '#666' }}>Subtotal</span>
        <span>{money(subtotal, safeTicket.currency)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingTop: 6, borderTop: '1px solid #ddd', fontSize: 18, fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>{money(total, safeTicket.currency)}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: breakdown.length ? 8 : 12, fontSize: 11, color: '#666' }}>
        Metodo de pago: {paymentLabel}
      </div>
      {breakdown.length > 0 && (
        <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>
          {breakdown.map((part, index) => (
            <div key={`${part?.method || part?.label || 'payment'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span>{part?.label || part?.method || 'Pago'}</span>
              <span>{money(part?.amount, safeTicket.currency)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0 12px' }} />
      <p style={{ fontSize: 10, color: '#666', textAlign: 'center', margin: '0 0 4px', lineHeight: 1.4 }}>
        Presente este ticket en almacen para recoger su producto
      </p>
      <p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', margin: 0 }}>Gracias por su compra</p>
    </article>
  )
}
