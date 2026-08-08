import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TOKENS, getTypo } from '../../tokens'
import { getSaleOrder, cancelSaleOrder } from './api'
import { BACKEND_CAPS } from './adminService'
import { computePosSummary, readServerAmounts } from './posPricing'
import {
  getPosCancelBlockMessage,
  getPosSaleStateLabel,
  isKnownPosCancelBlockCode,
} from './nightPosSales'
import { resolveTicketCustomerName } from './ticketCustomer'
import { printTicketViaQz } from './ticketPrinter'
import { toPositiveSafeIntegerId } from './posCustomers'
import {
  ADMIN_POS_FLOW,
  canCancelPosOrder,
  submitPosCancellation,
} from './posFlow'

const DAY_POS_ACCESS_ERROR = 'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.'

function getResolvedCancellationFailure(response) {
  let current = response
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    const status = typeof current.status === 'string' ? current.status.toLowerCase() : ''
    const failed = current.ok === false
      || current.success === false
      || status === 'error'
      || Boolean(current.error)
    if (failed) {
      const structuredData = current.data
        && typeof current.data === 'object'
        && !Array.isArray(current.data)
        ? current.data
        : null
      const structuredCode = typeof structuredData?.cancel_block_code === 'string'
        ? structuredData.cancel_block_code
        : ''
      const knownStructuredCode = isKnownPosCancelBlockCode(structuredCode)
      const safeUserMessage = knownStructuredCode
        && typeof structuredData?.user_message === 'string'
        ? structuredData.user_message.trim()
        : ''
      let code = ''
      let message = ''
      if (structuredCode) code = structuredCode
      if (!code && typeof current.code === 'string') code = current.code
      if (!code && typeof current.cancel_block_code === 'string') {
        code = current.cancel_block_code
      }
      if (typeof current.user_message === 'string') message = current.user_message
      if (!message && typeof current.message === 'string') message = current.message
      if (current.error && typeof current.error === 'object' && !Array.isArray(current.error)) {
        if (!code && typeof current.error.code === 'string') code = current.error.code
        if (!message && typeof current.error.message === 'string') {
          message = current.error.message
        }
      }
      if (!message && typeof current.error === 'string') message = current.error
      return {
        code,
        message: message || 'Error al cancelar la venta',
        safeUserMessage,
      }
    }
    current = current.data
  }
  return null
}

export default function ScreenTicket({ flow = ADMIN_POS_FLOW }) {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [printMsg, setPrintMsg] = useState('')

  // Sale cancel flow (Sprint 4)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelReasonCode, setCancelReasonCode] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelResult, setCancelResult] = useState(null)
  const cancelRequestRef = useRef(false)
  const cancelRequestSeq = useRef(0)
  const detailRequestSeq = useRef(0)
  const routeGenerationRef = useRef(0)
  const printMessageTimerRef = useRef(null)

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadOrder = useCallback(async (targetOrderId, targetPosScope, expectedGeneration) => {
    const normalizedTargetId = toPositiveSafeIntegerId(targetOrderId)
    const isCurrent = (requestId) => (
      routeGenerationRef.current === expectedGeneration
      && detailRequestSeq.current === requestId
    )
    const requestId = ++detailRequestSeq.current
    if (!normalizedTargetId) {
      if (isCurrent(requestId)) {
        setOrder(null)
        setError('Sin ID de orden')
        setLoading(false)
      }
      return false
    }
    if (isCurrent(requestId)) setLoading(true)
    try {
      const data = await getSaleOrder(normalizedTargetId, { posScope: targetPosScope })
      if (!isCurrent(requestId)) return false
      const payload = data?.data ?? data
      const payloadOrderId = toPositiveSafeIntegerId(payload?.id)
        || toPositiveSafeIntegerId(payload?.order_id)
      if (payloadOrderId !== normalizedTargetId) {
        setOrder(null)
        setError('No se pudo validar el ticket solicitado.')
        return false
      }
      setOrder(payload)
      setError('')
      return true
    } catch (e) {
      if (!isCurrent(requestId)) return false
      setOrder(null)
      setError(targetPosScope === 'day' && e?.status === 403
        ? DAY_POS_ACCESS_ERROR
        : (e.message || 'Error cargando ticket'))
      return false
    } finally {
      if (isCurrent(requestId)) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const generation = ++routeGenerationRef.current
    detailRequestSeq.current += 1
    cancelRequestSeq.current += 1
    cancelRequestRef.current = false
    setOrder(null)
    setError('')
    setLoading(true)
    setConfirmOpen(false)
    setCancelReasonCode('')
    setCancelReason('')
    setCancelling(false)
    setCancelError('')
    setCancelResult(null)
    clearTimeout(printMessageTimerRef.current)
    printMessageTimerRef.current = null
    setPrintMsg('')
    loadOrder(orderId, flow.posScope, generation)

    return () => {
      if (routeGenerationRef.current === generation) {
        routeGenerationRef.current += 1
        detailRequestSeq.current += 1
        cancelRequestSeq.current += 1
        cancelRequestRef.current = false
      }
      clearTimeout(printMessageTimerRef.current)
      printMessageTimerRef.current = null
    }
  }, [flow.posScope, loadOrder, orderId])

  async function doCancel() {
    if (cancelRequestRef.current) return
    const normalizedRouteOrderId = toPositiveSafeIntegerId(orderId)
    const normalizedDisplayedOrderId = toPositiveSafeIntegerId(order?.id)
      || toPositiveSafeIntegerId(order?.order_id)
    if (
      !normalizedRouteOrderId
      || normalizedDisplayedOrderId !== normalizedRouteOrderId
    ) {
      setCancelError('No se pudo validar el ticket solicitado.')
      return
    }
    const expectedGeneration = routeGenerationRef.current
    const requestId = ++cancelRequestSeq.current
    const isCurrent = () => (
      routeGenerationRef.current === expectedGeneration
      && cancelRequestSeq.current === requestId
    )
    cancelRequestRef.current = true
    setCancelling(true)
    setCancelError('')
    try {
      const result = await submitPosCancellation({
        flow,
        orderId: normalizedRouteOrderId,
        reasonCode: cancelReasonCode,
        reason: cancelReason,
        cancelFn: cancelSaleOrder,
      })
      if (!isCurrent()) return
      const resolvedFailure = getResolvedCancellationFailure(result)
      if (resolvedFailure !== null) {
        setCancelError(usesClosedCancelReasons
          ? (resolvedFailure.safeUserMessage
            || getPosCancelBlockMessage(resolvedFailure.code))
          : resolvedFailure.message)
        return
      }
      setCancelResult({ ok: true })
      setConfirmOpen(false)
      resetCancelReasons()
      // Refresca la orden para mostrar el state=cancel
      await loadOrder(normalizedRouteOrderId, flow.posScope, expectedGeneration)
    } catch (e) {
      if (!isCurrent()) return
      setCancelError(flow.posScope === 'day' && e?.status === 403
        ? DAY_POS_ACCESS_ERROR
        : (usesClosedCancelReasons
          ? getPosCancelBlockMessage(e?.code)
          : (e?.message || 'Error al cancelar la venta')))
    } finally {
      if (isCurrent()) {
        cancelRequestRef.current = false
        setCancelling(false)
      }
    }
  }

  function resetCancelReasons() {
    setCancelReasonCode('')
    setCancelReason('')
  }

  function closeCancelDialog() {
    if (cancelRequestRef.current) return
    setConfirmOpen(false)
    setCancelError('')
    resetCancelReasons()
  }

  const orderState = order?.state || ''
  const routeOrderId = toPositiveSafeIntegerId(orderId)
  const displayedOrderId = toPositiveSafeIntegerId(order?.id)
    || toPositiveSafeIntegerId(order?.order_id)
  const hasCurrentOrder = Boolean(routeOrderId) && displayedOrderId === routeOrderId
  const canCancel = hasCurrentOrder
    && canCancelPosOrder(flow, order, BACKEND_CAPS.saleCancel)
  const usesClosedCancelReasons = flow.cancellationMode === 'closed-reasons'
  const hasCancelReason = usesClosedCancelReasons
    ? Boolean(cancelReasonCode)
    : Boolean(cancelReason.trim())
  const cancelBlockMessage = usesClosedCancelReasons
    && BACKEND_CAPS.saleCancel === true
    && order
    && !canCancel
    ? getPosCancelBlockMessage(order.cancel_block_code)
    : ''

  const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const lines = order?.lines || order?.order_lines || []
  // El ticket es el documento que se lleva el cliente: tiene que decir lo que
  // Odoo facturó, no lo que el navegador estimó. Antes `computePosSummary`
  // fijaba `tax: 0` y el ticket imprimía el subtotal como TOTAL.
  const { subtotal: estimatedSubtotal } = computePosSummary(lines)
  const server = readServerAmounts(order)
  const subtotal = server.untaxed ?? estimatedSubtotal
  const tax = server.tax
  const total = server.total
  // `null` = el backend todavía no manda los importes (contrato viejo). Se
  // imprime «—», nunca un cero inventado.
  const money = (value) => (value === null || value === undefined ? '—' : fmt(value))

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
  const customerName = resolveTicketCustomerName(order)
  const authorizedWarehouseName = String(
    (Array.isArray(order?.warehouse_id) ? order.warehouse_id[1] : '')
    || (order?.warehouse_id && typeof order.warehouse_id === 'object'
      ? (order.warehouse_id.name || order.warehouse_id.display_name)
      : '')
    || order?.warehouse_name
    || 'Sucursal',
  ).trim() || 'Sucursal'

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
      /* Sólo margin:0 (sin 'size': el largo lo limita el papel del driver). */
      @page { margin: 0; }
      /* El driver topa el lienzo a 72mm (no acepta forms más anchos) y el printer
         arranca a imprimir con un OFFSET físico a la izquierda, que se comía el
         borde izquierdo del ticket. Como no podemos ensanchar el lienzo, hacemos
         el contenido más angosto (62mm) y lo EMPUJAMOS A LA DERECHA (margen
         izquierdo mayor que el derecho) para compensar ese offset. Así el texto
         cae completo dentro del área imprimible. */
      html, body { width: 72mm; background: #fff; color: #000; font-family: 'Segoe UI', Arial, sans-serif; }
      .ticket > :first-child { margin-top: 0 !important; }
      .ticket { width: 62mm; margin: 0 2mm 0 8mm; padding: 1.5mm 0; }
      .center { text-align: center; }
      .brand { font-size: 18px; font-weight: 700; margin-top: 4px; }
      .sub { font-size: 12px; color: #444; }
      .meta { display: flex; justify-content: space-between; font-size: 12px; color: #333; margin-top: 8px; }
      .folio { font-size: 13px; font-weight: 700; margin-top: 4px; }
      .customer { font-size: 12px; color: #333; margin-top: 2px; }
      .sep { border-top: 1px dashed #999; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; gap: 4px; }
      .pname { flex: 1; }
      .pnum { min-width: 44px; text-align: right; }
      .b { font-weight: 700; }
      .totals { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
      .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; border-top: 1px solid #000; padding-top: 5px; margin-top: 4px; }
      .pay { text-align: center; font-size: 12px; color: #333; margin: 8px 0; }
      .box { width: 88px; height: 88px; border: 2px solid #000; border-radius: 6px; margin: 8px auto; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .box .t { font-size: 10px; color: #555; }
      .box .f { font-size: 18px; font-weight: 700; }
      .foot { text-align: center; font-size: 11px; color: #444; line-height: 1.35; margin-top: 4px; }
      .foot.b { font-size: 12px; font-weight: 700; color: #000; margin-top: 4px; }
    </style></head><body>
      <div class="ticket">
        <div class="center brand">GRUPO FRIO</div>
        <div class="center sub">${esc(authorizedWarehouseName)}</div>
        <div class="meta"><span>Fecha: ${esc(dateStr)}</span><span>Hora: ${esc(timeStr)}</span></div>
        <div class="folio">Folio: ${esc(folio)}</div>
        <div class="customer">Cliente: ${esc(customerName)}</div>
        <div class="sep"></div>
        ${rows}
        <div class="sep"></div>
        <div class="totals"><span>Subtotal</span><span>${esc(money(subtotal))}</span></div>
        <div class="totals"><span>IVA</span><span>${esc(money(tax))}</span></div>
        <div class="total"><span>TOTAL</span><span>${esc(money(total))}</span></div>
        <div class="pay">Metodo de pago: ${esc(paymentMethodLabel(order?.payment_method))}</div>
        <div class="sep"></div>
        <div class="box"><span class="t">TICKET</span><span class="f">${esc(folio)}</span></div>
        <div class="foot">Presente este ticket en almacen para recoger su producto</div>
        <div class="foot b">Gracias por su compra</div>
      </div>
    </body></html>`
  }

  // Impresión: intenta QZ Tray (ESC/POS directo — ancho completo, corte de
  // cuchilla). Si QZ no está corriendo o falla, cae al método de iframe.
  async function printTicket() {
    clearTimeout(printMessageTimerRef.current)
    printMessageTimerRef.current = null
    setPrintMsg('')
    const expectedGeneration = routeGenerationRef.current
    try {
      await printTicketViaQz({
        sucursal: authorizedWarehouseName,
        dateStr,
        timeStr,
        folio,
        customerName,
        lines,
        fmt,
        subtotal,
        tax,
        total,
        paymentLabel: paymentMethodLabel(order?.payment_method),
      })
      return
    } catch (e) {
      if (routeGenerationRef.current !== expectedGeneration) return
      // QZ no disponible / rechazó → fallback iframe. Avisamos discretamente.
      setPrintMsg('Impresión directa no disponible, usando modo navegador.')
      printMessageTimerRef.current = setTimeout(() => {
        if (routeGenerationRef.current === expectedGeneration) setPrintMsg('')
        printMessageTimerRef.current = null
      }, 4000)
      printTicketFallback()
    }
  }

  function printTicketFallback() {
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

    // Sólo imprime. El tamaño de la hoja lo controla el papel del driver
    // (80(72) x 210mm). NO se inyecta @page height: medir e inyectar la altura
    // provocaba resultados impredecibles con este driver POS-80 — a veces tira
    // gigante en blanco, a veces una hoja minúscula cortada antes de imprimir.
    const doPrint = () => {
      win.focus()
      win.print()
    }

    if (doc.readyState === 'complete') {
      setTimeout(doPrint, 80)
    } else {
      win.addEventListener('load', () => setTimeout(doPrint, 80))
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
        .night-cancel-reason:focus-visible { outline: 3px solid ${TOKENS.colors.blue}; outline-offset: 3px; }
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
          <button
            type="button"
            aria-label="Volver al POS"
            onClick={() => navigate(flow.posRoute)}
            style={{
              width: 44, height: 44, borderRadius: TOKENS.radius.md,
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
                  Venta cancelada
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
                <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{authorizedWarehouseName}</p>
              </div>

              {/* Date / Folio */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Fecha: {dateStr}</span>
                <span style={{ fontSize: 11, color: '#888' }}>Hora: {timeStr}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Folio: {folio}</span>
                <div style={{ fontSize: 12, color: '#333', marginTop: 2 }}>
                  Cliente: {customerName}
                </div>
                <div style={{ fontSize: 12, color: '#333', marginTop: 2 }}>
                  Estado: {getPosSaleStateLabel(orderState)}
                </div>
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
                <span style={{ fontSize: 12, color: '#333' }}>{money(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#666' }}>IVA</span>
                <span style={{ fontSize: 12, color: '#333' }}>{money(tax)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingTop: 6, borderTop: '1px solid #ddd' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>TOTAL</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{money(total)}</span>
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
              {printMsg && (
                <p style={{ fontSize: 11, color: TOKENS.colors.textMuted, textAlign: 'center', margin: 0 }}>
                  {printMsg}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={printTicket} style={{
                  flex: 1, padding: '14px 0', borderRadius: TOKENS.radius.md,
                  background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                }}>
                  <span style={{ ...typo.body, color: TOKENS.colors.textSoft, fontWeight: 600 }}>Imprimir</span>
                </button>
                <button onClick={() => navigate(flow.posRoute)} style={{
                  flex: 1, padding: '14px 0', borderRadius: TOKENS.radius.md,
                  background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                }}>
                  <span style={{ ...typo.body, color: 'white', fontWeight: 700 }}>Nueva Venta</span>
                </button>
              </div>

              {cancelBlockMessage && (
                <p role="status" style={{
                  fontSize: 12, color: TOKENS.colors.textMuted, textAlign: 'center', margin: 0,
                }}>
                  {cancelBlockMessage}
                </p>
              )}

              {canCancel && (
                <button
                  onClick={() => { setConfirmOpen(true); setCancelError('') }}
                  style={{
                    width: '100%', minHeight: 44, padding: '12px 0', borderRadius: TOKENS.radius.md,
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
            aria-labelledby="cancel-sale-title"
            onClick={closeCancelDialog}
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
              <h2 id="cancel-sale-title" style={{
                fontSize: 18, fontWeight: 700, color: TOKENS.colors.text,
                margin: '4px 0 12px', letterSpacing: '-0.02em',
              }}>
                {folio}
              </h2>
              <p style={{ fontSize: 12, color: TOKENS.colors.textMuted, margin: '0 0 12px' }}>
                La venta se cancela y se revierten los movimientos de inventario. La razón queda en el chatter.
              </p>

              {usesClosedCancelReasons ? (
                <fieldset style={{ border: 0, padding: 0, margin: '0 0 10px' }}>
                  <legend style={{
                    fontSize: 11, color: TOKENS.colors.textMuted, marginBottom: 4,
                  }}>
                    Motivo *
                  </legend>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {flow.cancelReasons.map((reason) => {
                      const inputId = `cancel-reason-${reason.code}`
                      return (
                        <label
                          key={reason.code}
                          htmlFor={inputId}
                          style={{
                            minHeight: 44, padding: '8px 10px', borderRadius: TOKENS.radius.md,
                            background: TOKENS.colors.surface,
                            border: `1px solid ${cancelReasonCode === reason.code ? TOKENS.colors.blue : TOKENS.colors.border}`,
                            display: 'flex', alignItems: 'center', gap: 10,
                            color: TOKENS.colors.textSoft, fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          <input
                            className="night-cancel-reason"
                            id={inputId}
                            name="cancel-reason"
                            type="radio"
                            value={reason.code}
                            checked={cancelReasonCode === reason.code}
                            onChange={() => {
                              setCancelReasonCode(reason.code)
                              setCancelError('')
                            }}
                            style={{ width: 20, height: 20, margin: 0, flexShrink: 0 }}
                          />
                          <span>{reason.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ) : (
                <>
                  <label htmlFor="admin-cancel-reason" style={{ fontSize: 11, color: TOKENS.colors.textMuted, display: 'block', marginBottom: 4 }}>
                    Motivo *
                  </label>
                  <textarea
                    id="admin-cancel-reason"
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
                </>
              )}

              {cancelError && (
                <div role="alert" style={{
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
                  onClick={closeCancelDialog}
                  disabled={cancelling}
                  style={{
                    flex: 1, minHeight: 44, padding: '11px 0', borderRadius: TOKENS.radius.md,
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
                  disabled={cancelling || !hasCancelReason}
                  style={{
                    flex: 1, minHeight: 44, padding: '11px 0', borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.error}, #d44)`,
                    border: 'none',
                    fontSize: 12, fontWeight: 700, color: 'white',
                    fontFamily: "'DM Sans', sans-serif",
                    opacity: cancelling || !hasCancelReason ? 0.6 : 1,
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
