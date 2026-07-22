import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { getSaleOrder, cancelSaleOrder } from './api'
import { BACKEND_CAPS } from './adminService'
import { computePosSummary } from './posPricing'

export default function ScreenTicket() {
  const { session } = useSession()
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Sale cancel flow (Sprint 4)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelResult, setCancelResult] = useState(null)

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline preexistente: efecto run-once on mount; refactor (useCallback) en PR aparte
  useEffect(() => { loadOrder() }, [orderId])

  async function loadOrder() {
    if (!orderId) { setError('Sin ID de orden'); setLoading(false); return }
    setLoading(true)
    try {
      const data = await getSaleOrder(orderId)
      const payload = data?.data ?? data
      setOrder(payload)
    } catch (e) {
      setError(e.message || 'Error cargando ticket')
    } finally { setLoading(false) }
  }

  async function doCancel() {
    if (!orderId) return
    if (!cancelReason.trim()) { setCancelError('Explica brevemente el motivo'); return }
    setCancelling(true)
    setCancelError('')
    try {
      const res = await cancelSaleOrder(orderId, cancelReason.trim())
      const data = res?.data ?? res
      setCancelResult(data || { ok: true })
      setConfirmOpen(false)
      // Refresca la orden para mostrar el state=cancel
      await loadOrder()
    } catch (e) {
      setCancelError(e?.message || 'Error al cancelar la venta')
    } finally {
      setCancelling(false)
    }
  }

  const orderState = order?.state || ''
  const canCancel =
    BACKEND_CAPS.saleCancel &&
    order &&
    orderState !== 'cancel' &&
    orderState !== 'done'

  const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const lines = order?.lines || order?.order_lines || []
  const { subtotal, total } = computePosSummary(lines)

  // Odoo devuelve date_order en UTC sin sufijo (ej. "2026-07-22 17:15:00"). Si se
  // parsea directo, el navegador lo toma como hora local y el ticket salía con
  // desfase (+6h). Lo interpretamos como UTC (append 'Z') y lo mostramos SIEMPRE
  // en hora de México, sin depender de la zona del equipo. Mismo patrón que
  // AdminGastosForm / liquidacionesResponse.
  const MX_TZ = 'America/Mexico_City'
  const now = order?.date_order
    ? new Date(String(order.date_order).replace(' ', 'T') + 'Z')
    : new Date()
  const dateStr = now.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: MX_TZ })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: MX_TZ })
  const folio = order?.name || `S${String(orderId).padStart(5, '0')}`

  // Mapping completo de métodos de pago (alineado con gf_pwa_admin.sale-create
  // y catálogo de account.payment.method + Odoo 18 POS payment terms)
  const PAYMENT_METHOD_LABELS = {
    cash:             'Efectivo',
    card:             'Terminal',
    credit_card:      'Tarjeta crédito',
    debit_card:       'Tarjeta débito',
    terminal:         'Terminal',
    transfer:         'Transferencia',
    bank_transfer:    'Transferencia',
    spei:             'SPEI',
    wire:             'Transferencia',
    check:            'Cheque',
    credit:           'Crédito',
    customer_account: 'Crédito cliente',
    wallet:           'Monedero',
    voucher:          'Vale',
    mixed:            'Pago mixto',
  }
  function paymentMethodLabel(raw) {
    if (!raw) return 'Efectivo'
    const key = String(raw).toLowerCase().trim()
    return PAYMENT_METHOD_LABELS[key] || raw
  }

  // Impresión térmica robusta: en vez de imprimir la página actual (que arrastra
  // el layout de la app — filter:invert, min-height:100dvh anidados — y provocaba
  // tira larga en blanco, colores invertidos y ticket incompleto), renderizamos el
  // ticket como un documento HTML LIMPIO (blanco/negro, 72mm, sin filtros) en un
  // iframe oculto y ese es el que se manda a la impresora.
  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ))
  }

  function buildTicketHtml() {
    const rows = lines.map((l) => {
      const qty = l.qty || l.product_uom_qty || 0
      const price = l.price_unit || 0
      return `<div class="row">
        <span class="pname">${esc(qty)} x ${esc(l.product_name || l.name || 'Producto')}</span>
        <span class="pnum">${esc(fmt(price))}</span>
        <span class="pnum b">${esc(fmt(qty * price))}</span>
      </div>`
    }).join('')

    // OJO: sin @page aquí. La altura exacta se inyecta en printTicket() tras medir
    // el contenido, porque "size: 72mm auto" hacía que el driver usara su alto por
    // defecto (3276mm) y salía una tira gigante en blanco.
    return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 72mm; background: #fff; color: #000; font-family: 'Segoe UI', Arial, sans-serif; }
      /* Ancho 72mm: sale centrado y hasta los bordes con el papel del driver
         "80(72) x 3276mm". Padding lateral pequeño para respirar. La única
         corrección que hace el código es el ALTO (ver printTicket): mide el
         ticket e inyecta @page con la altura exacta para no imprimir la tira
         gigante que trae ese papel (3276mm). El tamaño de papel debe quedar
         en el driver como "80(72) x 3276mm" (NO un formato personalizado, que
         descuadra el ancho). */
      .ticket { width: 72mm; padding: 2mm 3mm; }
      .center { text-align: center; }
      .brand { font-size: 15px; font-weight: 700; margin-top: 4px; }
      .sub { font-size: 10px; color: #444; }
      .meta { display: flex; justify-content: space-between; font-size: 10px; color: #333; margin-top: 8px; }
      .folio { font-size: 11px; font-weight: 700; margin-top: 4px; }
      .sep { border-top: 1px dashed #999; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; gap: 4px; }
      .pname { flex: 1; }
      .pnum { min-width: 44px; text-align: right; }
      .b { font-weight: 700; }
      .totals { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; }
      .total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 1px solid #000; padding-top: 5px; margin-top: 4px; }
      .pay { text-align: center; font-size: 10px; color: #333; margin: 8px 0; }
      .box { width: 88px; height: 88px; border: 2px solid #000; border-radius: 6px; margin: 8px auto; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .box .t { font-size: 8px; color: #555; }
      .box .f { font-size: 15px; font-weight: 700; }
      .foot { text-align: center; font-size: 9px; color: #444; line-height: 1.35; margin-top: 4px; }
      .foot.b { font-size: 10px; font-weight: 700; color: #000; margin-top: 4px; }
    </style></head><body>
      <div class="ticket">
        <div class="center brand">GRUPO FRIO</div>
        <div class="center sub">${esc(session?.warehouse_name || 'Sucursal')}</div>
        <div class="meta"><span>Fecha: ${esc(dateStr)}</span><span>Hora: ${esc(timeStr)}</span></div>
        <div class="folio">Folio: ${esc(folio)}</div>
        <div class="sep"></div>
        ${rows}
        <div class="sep"></div>
        <div class="totals"><span>Subtotal</span><span>${esc(fmt(subtotal))}</span></div>
        <div class="total"><span>TOTAL</span><span>${esc(fmt(total))}</span></div>
        <div class="pay">Metodo de pago: ${esc(paymentMethodLabel(order?.payment_method))}</div>
        <div class="sep"></div>
        <div class="box"><span class="t">TICKET</span><span class="f">${esc(folio)}</span></div>
        <div class="foot">Presente este ticket en almacen para recoger su producto</div>
        <div class="foot b">Gracias por su compra</div>
      </div>
    </body></html>`
  }

  function printTicket() {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    // Ancho real (no 0) para que el contenido haga layout y podamos MEDIR su alto.
    // Queda fuera de vista por el translate; no molesta al usuario.
    iframe.style.width = '72mm'
    iframe.style.height = '1px'
    iframe.style.opacity = '0'
    iframe.style.border = '0'
    iframe.style.transform = 'translateY(1000vh)'
    document.body.appendChild(iframe)

    const cleanup = () => {
      setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* noop */ } }, 1000)
    }

    const win = iframe.contentWindow
    const doc = win?.document
    if (!win || !doc) { cleanup(); return }
    win.addEventListener('afterprint', cleanup)
    doc.open()
    doc.write(buildTicketHtml())
    doc.close()

    const doPrint = () => {
      try {
        // Mide el alto REAL del ticket renderizado e inyecta @page con esa altura
        // exacta (+ pequeño margen para el corte). Así la hoja mide justo el ticket
        // y no la tira gigante que el driver usaba con "auto".
        const el = doc.querySelector('.ticket')
        const px = el ? el.getBoundingClientRect().height : 0
        const heightMm = Math.max(40, Math.ceil(px / 96 * 25.4) + 2) // px→mm (@96dpi) + 2mm gracia
        const style = doc.createElement('style')
        style.textContent = `@page { size: 72mm ${heightMm}mm; margin: 0; }`
        doc.head.appendChild(style)
      } catch { /* si algo falla, imprime igual con el alto por defecto */ }
      win.focus()
      win.print()
    }

    // Espera a que el layout esté listo (fuentes/render) antes de medir e imprimir.
    if (doc.readyState === 'complete') {
      setTimeout(doPrint, 60)
    } else {
      win.addEventListener('load', () => setTimeout(doPrint, 60))
    }
  }

  return (
    <div id="ticket-root" style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* La impresión NO usa @media print de esta página: el botón Imprimir
           renderiza el ticket en un iframe limpio (buildTicketHtml) para evitar
           el layout de la app (filter:invert + min-height:100dvh) que causaba
           tira en blanco, colores invertidos y ticket incompleto. */
        @media print {
          #ticket-actions { display: none !important; }
        }
      `}</style>

      <div id="ticket-wrap" style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button onClick={() => navigate('/admin/pos')} style={{
            width: 38, height: 38, borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>Ticket de Venta</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ ...typo.body, color: TOKENS.colors.error }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Cancel success banner */}
            {cancelResult && (
              <div style={{
                padding: '12px 14px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
                background: `${TOKENS.colors.error}10`, border: `1px solid ${TOKENS.colors.error}40`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TOKENS.colors.error, margin: 0 }}>
                  Venta cancelada{cancelResult?.picking_states ? ` · ${JSON.stringify(cancelResult.picking_states)}` : ''}
                </p>
              </div>
            )}
            {orderState === 'cancel' && !cancelResult && (
              <div style={{
                padding: '10px 14px', borderRadius: TOKENS.radius.sm, marginBottom: 12,
                background: `${TOKENS.colors.error}10`, border: `1px solid ${TOKENS.colors.error}40`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TOKENS.colors.error, margin: 0 }}>
                  Esta venta está cancelada
                </p>
              </div>
            )}

            {/* Ticket Card */}
            <div id="ticket-card" style={{
              background: '#ffffff', borderRadius: TOKENS.radius.xl, padding: '24px 20px',
              color: '#1a1a1a', marginBottom: 16,
            }}>
              {/* Logo + Header */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src="/icons/logo-grupo-frio.svg" alt="Grupo Frio" style={{ height: 40, marginBottom: 6 }} />
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>GRUPO FRIO</p>
                <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{session?.warehouse_name || 'Sucursal'}</p>
              </div>

              {/* Date / Folio */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Fecha: {dateStr}</span>
                <span style={{ fontSize: 11, color: '#888' }}>Hora: {timeStr}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Folio: {folio}</span>
              </div>

              {/* Separator */}
              <div style={{ borderTop: '1px dashed #ccc', marginBottom: 12 }} />

              {/* Product Lines */}
              {lines.map((l, i) => {
                const qty = l.qty || l.product_uom_qty || 0
                const price = l.price_unit || 0
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#333', flex: 1 }}>{qty} x {l.product_name || l.name || 'Producto'}</span>
                    <span style={{ fontSize: 11, color: '#333', minWidth: 50, textAlign: 'right' }}>{fmt(price)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', minWidth: 60, textAlign: 'right' }}>{fmt(qty * price)}</span>
                  </div>
                )
              })}

              {/* Separator */}
              <div style={{ borderTop: '1px dashed #ccc', margin: '12px 0' }} />

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#666' }}>Subtotal</span>
                <span style={{ fontSize: 12, color: '#333' }}>{fmt(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingTop: 6, borderTop: '1px solid #ddd' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>TOTAL</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{fmt(total)}</span>
              </div>

              {/* Payment method */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Metodo de pago: {paymentMethodLabel(order?.payment_method)}</span>
              </div>

              {/* Separator */}
              <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0 12px' }} />

              {/* QR Placeholder */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{
                  width: 100, height: 100, border: '2px solid #1a1a1a', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                }}>
                  <span style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>TICKET</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{folio}</span>
                </div>
              </div>

              {/* Footer messages */}
              <p style={{ fontSize: 10, color: '#666', textAlign: 'center', margin: '0 0 4px', lineHeight: '1.4' }}>
                Presente este ticket en almacen para recoger su producto
              </p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#333', textAlign: 'center', margin: 0 }}>
                Gracias por su compra
              </p>
            </div>

            {/* Action Buttons */}
            <div id="ticket-actions" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={printTicket} style={{
                  flex: 1, padding: '14px 0', borderRadius: TOKENS.radius.md,
                  background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                }}>
                  <span style={{ ...typo.body, color: TOKENS.colors.textSoft, fontWeight: 600 }}>Imprimir</span>
                </button>
                <button onClick={() => navigate('/admin/pos')} style={{
                  flex: 1, padding: '14px 0', borderRadius: TOKENS.radius.md,
                  background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                }}>
                  <span style={{ ...typo.body, color: 'white', fontWeight: 700 }}>Nueva Venta</span>
                </button>
              </div>

              {canCancel && (
                <button
                  onClick={() => { setConfirmOpen(true); setCancelError('') }}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: 'transparent', border: `1px solid ${TOKENS.colors.error}60`,
                  }}
                >
                  <span style={{ ...typo.body, color: TOKENS.colors.error, fontWeight: 700 }}>
                    Cancelar venta
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Confirm cancel modal */}
        {confirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => !cancelling && setConfirmOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(6, 10, 18, 0.72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20, backdropFilter: 'blur(6px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 420,
                background: TOKENS.colors.bg1,
                border: `1px solid ${TOKENS.colors.border}`,
                borderRadius: TOKENS.radius.xl,
                padding: 22,
              }}
            >
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                color: TOKENS.colors.error, margin: 0,
              }}>
                CANCELAR VENTA
              </p>
              <h2 style={{
                fontSize: 18, fontWeight: 700, color: TOKENS.colors.text,
                margin: '4px 0 12px', letterSpacing: '-0.02em',
              }}>
                {folio}
              </h2>
              <p style={{ fontSize: 12, color: TOKENS.colors.textMuted, margin: '0 0 12px' }}>
                La venta se cancela y se revierten los movimientos de inventario. La razón queda en el chatter.
              </p>

              <label style={{ fontSize: 11, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                Motivo *
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ej: Cliente se arrepintió / producto equivocado"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                  color: TOKENS.colors.text, fontSize: 13, outline: 'none',
                  fontFamily: "'DM Sans', sans-serif", resize: 'vertical', marginBottom: 10,
                }}
              />

              {cancelError && (
                <div style={{
                  padding: '8px 12px', borderRadius: TOKENS.radius.sm, marginBottom: 10,
                  background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`,
                  fontSize: 11, fontWeight: 600, color: TOKENS.colors.error,
                }}>
                  {cancelError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={cancelling}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                    fontSize: 12, fontWeight: 600, color: TOKENS.colors.textSoft,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={cancelling || !cancelReason.trim()}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.error}, #d44)`,
                    border: 'none',
                    fontSize: 12, fontWeight: 700, color: 'white',
                    fontFamily: "'DM Sans', sans-serif",
                    opacity: cancelling || !cancelReason.trim() ? 0.6 : 1,
                    cursor: cancelling ? 'wait' : 'pointer',
                  }}
                >
                  {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
