import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../App'
import { TOKENS, getTypo } from '../../tokens'
import { getSaleOrder, cancelSaleOrder } from './api'
import { BACKEND_CAPS } from './adminService'
import { computePosSummary } from './posPricing'
import TicketDocument from '../ventas-iguala/TicketDocument'

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

  const lines = order?.lines || order?.order_lines || []
  const { subtotal, total } = computePosSummary(lines)
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

  const ticket = order && {
    folio,
    ordered_at: order.date_order,
    warehouse_name: session?.warehouse_name,
    customer: {
      name: order.partner_name || order.customer_name || order.customer?.name || 'Público general',
    },
    lines: lines.map((line) => {
      const quantity = Number(line?.qty || line?.product_uom_qty || 0)
      const unitPrice = Number(line?.price_unit || 0)
      return {
        product_id: line?.product_id,
        product_name: line?.product_name || line?.name || 'Producto',
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice,
      }
    }),
    subtotal,
    amount_total: total,
    currency: 'MXN',
    payment: {
      method: order.payment_method,
      label: paymentMethodLabel(order.payment_method),
      amount: total,
      breakdown: Array.isArray(order.payment_breakdown) ? order.payment_breakdown : [],
    },
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(160deg, ${TOKENS.colors.bg0} 0%, ${TOKENS.colors.bg1} 50%, ${TOKENS.colors.bg2} 100%)`,
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        button { border: none; background: none; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .gf-single-ticket-content > * { display: none !important; }
          .gf-single-ticket-content > .gf-ticket-document { display: block !important; }
        }
      `}</style>

      <div className="gf-single-ticket-content" style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
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

            <TicketDocument ticket={ticket} />

            {/* Action Buttons */}
            <div id="ticket-actions" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.print()} style={{
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
