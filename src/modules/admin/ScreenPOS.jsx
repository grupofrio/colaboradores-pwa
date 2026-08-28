// ─── ScreenPOS — entrada responsive al POS mostrador ────────────────────────
// En desktop (≥1024px) usa AdminShell + AdminPosForm (V2 backend live).
// En mobile se conserva la pantalla legacy como fallback.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../App'
import { getTypo } from '../../tokens'
import { BRAND_TOKENS as TOKENS } from '../../theme/brandTokens'
import { softWarehouse } from '../../lib/sessionGuards'
import { getPosCatalog, searchCustomers, getDefaultCustomer, createSaleOrder } from './api'
import { BACKEND_CAPS } from './adminService'
import { AdminProvider, useAdmin } from './AdminContext'
import AdminShell from './components/AdminShell'
import AdminPosForm from './forms/AdminPosForm'
import { logScreenError } from '../shared/logScreenError'
import SessionErrorState from '../../components/SessionErrorState'
import { computePosSummary } from './posPricing'
import {
  addProductToCart,
  changeCartItemQty,
  getDisplayStock,
  getProductPrice,
  repriceCartFromCatalog,
  stockLabel,
} from './posCart'
import {
  canRefreshCustomerPricelist,
  hasValidPosCustomer,
  normalizeDefaultCustomerResponse,
  normalizeCustomerResults,
  shouldLoadCustomerSuggestions,
  toPositiveSafeIntegerId,
} from './posCustomers'
import {
  ADMIN_POS_FLOW,
  ADMIN_POS_CONSULT_ONLY_COPY,
  assertCanonicalPosOperateAllowed,
  buildPosTicketPath,
  canMutateCanonicalPos,
  canOpenPosPayment,
  classifyPosSaleCreateError,
  emptyPosCustomer,
  normalizePosSaleResult,
  posClientIdentityKey,
  requiresCanonicalPosOperate,
} from './posFlow'

export default function ScreenPOS({ flow = ADMIN_POS_FLOW }) {
  const { session } = useSession()
  const navigate = useNavigate()
  const [sw, setSw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const warehouseId = softWarehouse(session)

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!warehouseId) {
    return (
      <SessionErrorState
        error={{ missing: 'warehouse_id' }}
        backTo={flow.backTo}
      />
    )
  }

  if (sw < 1024) {
    return (
      <AdminProvider>
        <MobilePOS warehouseId={warehouseId} flow={flow} />
      </AdminProvider>
    )
  }

  const standaloneDayBackProps = flow.standalone && flow.posScope === 'day'
    ? { backButtonLabel: 'Volver al inicio', backButtonSize: 44 }
    : {}

  return (
    <AdminProvider>
      <AdminShell
        activeBlock="pos"
        title={flow.title}
        onBack={() => navigate(flow.backTo)}
        {...standaloneDayBackProps}
        hideNavigation={flow.standalone}
        hideActivityFeed={flow.standalone}
      >
        {flow.salesRoute && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => navigate(flow.salesRoute)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                minHeight: 44,
                padding: '10px 16px', borderRadius: TOKENS.radius.pill,
                background: TOKENS.colors.surface,
                border: `1px solid ${TOKENS.colors.borderBlue}`,
                color: TOKENS.colors.blue3, fontSize: 13, fontWeight: 700,
              }}
            >
              Ventas de hoy
              <span aria-hidden="true">›</span>
            </button>
          </div>
        )}
        <AdminPosForm
          flow={flow}
          warehouseId={flow.posScope === 'day' ? warehouseId : undefined}
          companyId={flow.posScope === 'day' ? session?.company_id : undefined}
        />
      </AdminShell>
    </AdminProvider>
  )
}

function MobilePOS({ warehouseId, flow = ADMIN_POS_FLOW }) {
  const { session } = useSession()
  const { capsReady, scopeState, odooUnavailable, sessionIdentity } = useAdmin()
  const navigate = useNavigate()
  const [sw, setSw] = useState(window.innerWidth)
  const typo = useMemo(() => getTypo(sw), [sw])
  const companyId = Number(session?.company_id || 0) || undefined
  const defaultCustomerName = flow.defaultCustomerName || 'VENTA PUBLICO'
  const identityKey = posClientIdentityKey({
    flow,
    sessionIdentity,
    companyId,
    warehouseId,
  })

  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Customer
  const [customer, setCustomer] = useState(() => emptyPosCustomer(flow))
  const [pricelist, setPricelist] = useState({ id: null, name: '' })
  const [catalogCustomerId, setCatalogCustomerId] = useState(null)
  const catalogRequestSeq = useRef(0)
  const defaultCustomerRequestSeq = useRef(0)
  const manualCustomerSelectionSeq = useRef(0)
  const identityKeyRef = useRef(identityKey)
  identityKeyRef.current = identityKey
  const [defaultCustomerState, setDefaultCustomerState] = useState({
    status: flow.posScope === 'day' ? 'pending' : 'ready',
    message: '',
  })
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customerResultRequestId, setCustomerResultRequestId] = useState(0)
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const customerSearchSeq = useRef(0)

  // Payment confirmation
  const [payConfirm, setPayConfirm] = useState(null) // 'cash' | 'card' | null
  const [cardRef, setCardRef] = useState('')

  function resetPaymentContext() {
    setPayConfirm(null)
    setCardRef('')
  }

  useEffect(() => {
    const handler = () => setSw(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadProducts = useCallback(async (selectedPartnerId) => {
    const startedFor = identityKey
    const requestId = ++catalogRequestSeq.current
    const requestedCustomerId = toPositiveSafeIntegerId(selectedPartnerId) || null
    setPayConfirm(null)
    setCardRef('')
    setCatalogCustomerId(null)
    setLoading(true)
    setError('')
    try {
      const catalog = await getPosCatalog({
        warehouseId,
        companyId,
        partnerId: selectedPartnerId || undefined,
        posScope: flow.posScope,
      })
      if (requestId !== catalogRequestSeq.current || startedFor !== identityKeyRef.current) return false
      const list = Array.isArray(catalog?.products) ? catalog.products : []
      setProducts(list)
      setPricelist({
        id: catalog?.pricelist_id || null,
        name: catalog?.pricelist_name || '',
      })
      setCart((prev) => repriceCartFromCatalog(prev, list))
      setCatalogCustomerId(requestedCustomerId)
      return true
    } catch (e) {
      if (requestId !== catalogRequestSeq.current || startedFor !== identityKeyRef.current) return false
      logScreenError('ScreenPOS', 'getPosCatalog', e)
      setError(flow.posScope === 'day' && e?.status === 403
        ? 'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.'
        : (e?.message || 'Error cargando productos'))
      return false
    } finally {
      if (requestId === catalogRequestSeq.current && startedFor === identityKeyRef.current) setLoading(false)
    }
  }, [companyId, flow.posScope, identityKey, warehouseId])

  useEffect(() => {
    catalogRequestSeq.current += 1
    defaultCustomerRequestSeq.current += 1
    customerSearchSeq.current += 1
    manualCustomerSelectionSeq.current += 1
    setProducts([])
    setCart([])
    setPricelist({ id: null, name: '' })
    setCustomer(emptyPosCustomer(flow))
    setCatalogCustomerId(null)
    setCustomerResults([])
    setCustomerQuery('')
    setShowCustomerSearch(false)
    setError('')
    setPayConfirm(null)
    setCardRef('')
  }, [identityKey, flow])

  useEffect(() => {
    loadProducts(customer.id)
  }, [customer.id, loadProducts])

  const loadDefaultCustomer = useCallback(async () => {
    const startedFor = identityKey
    const requestId = ++defaultCustomerRequestSeq.current
    const manualSelectionAtStart = manualCustomerSelectionSeq.current
    if (flow.posScope === 'day') {
      setDefaultCustomerState({ status: 'pending', message: '' })
    }
    try {
      const c = normalizeDefaultCustomerResponse(await getDefaultCustomer(
        companyId,
        { posScope: flow.posScope },
      ))
      if (requestId !== defaultCustomerRequestSeq.current || startedFor !== identityKeyRef.current) return
      if (!c?.id) {
        if (flow.posScope === 'day') {
          setDefaultCustomerState({
            status: 'failed',
            message: 'No se pudo consultar el POS día. Inténtalo de nuevo.',
          })
        }
        return
      }
      if (flow.posScope === 'day') {
        setDefaultCustomerState({ status: 'ready', message: '' })
      }
      if (manualSelectionAtStart === manualCustomerSelectionSeq.current) {
        setCustomer({
          id: c.id,
          name: c.name || (requiresCanonicalPosOperate(flow) ? '' : defaultCustomerName),
        })
      }
    } catch (e) {
      if (requestId !== defaultCustomerRequestSeq.current || startedFor !== identityKeyRef.current) return
      logScreenError('ScreenPOS', 'getDefaultCustomer', e)
      setError(flow.posScope === 'day' && e?.status === 403
        ? 'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.'
        : (e?.message || 'No se pudo cargar el cliente predeterminado.'))
      if (flow.posScope === 'day') {
        setDefaultCustomerState({
          status: 'failed',
          message: e?.message || 'No se pudo consultar el POS día. Inténtalo de nuevo.',
        })
      }
    }
  }, [companyId, defaultCustomerName, flow, identityKey])

  useEffect(() => {
    loadDefaultCustomer()
    return () => { defaultCustomerRequestSeq.current += 1 }
  }, [loadDefaultCustomer])

  // Filtered products
  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p => p.name?.toLowerCase().includes(q))
  }, [products, search])

  // Cart operations
  function addToCart(product) {
    resetPaymentContext()
    setCart((prev) => addProductToCart(prev, product))
  }

  function updateQty(productId, delta) {
    resetPaymentContext()
    setCart((prev) => changeCartItemQty(prev, productId, delta))
  }

  function removeItem(productId) {
    resetPaymentContext()
    setCart(prev => prev.filter(c => c.product_id !== productId))
  }

  const { subtotal, total } = computePosSummary(cart)
  const defaultCustomerReady = flow.posScope !== 'day'
    || defaultCustomerState.status === 'ready'
  const canOperatePos = canMutateCanonicalPos({
    flow,
    contract: BACKEND_CAPS,
    capsReady,
    scopeState,
    identityMatches: capsReady === true && scopeState === 'ready',
    odooUnavailable,
  })
  const canOpenPayment = canOperatePos && canOpenPosPayment(cart, customer, {
    loading,
    catalogCustomerId,
    defaultCustomerReady,
  })

  useEffect(() => {
    if (!canOperatePos) {
      setPayConfirm(null)
      setCardRef('')
    }
  }, [canOperatePos])

  function openPayment(method) {
    if (!canOpenPayment) return
    setCardRef('')
    setPayConfirm(method)
  }

  useEffect(() => {
    const requestId = ++customerSearchSeq.current
    let active = true
    let timer
    const isCurrent = () => active && customerSearchSeq.current === requestId

    setSearchingCustomer(false)
    setCustomerResults([])
    setCustomerResultRequestId(0)
    if (showCustomerSearch && shouldLoadCustomerSuggestions(customerQuery)) {
      timer = setTimeout(async () => {
        if (!isCurrent()) return
        setSearchingCustomer(true)
        try {
          const res = await searchCustomers(
            customerQuery,
            companyId,
            { posScope: flow.posScope },
          )
          if (!isCurrent()) return
          setCustomerResults(normalizeCustomerResults(res))
          setCustomerResultRequestId(requestId)
        } catch (e) {
          if (!isCurrent()) return
          logScreenError('ScreenPOS', 'searchCustomers', e)
          setCustomerResults([])
          if (flow.posScope === 'day') {
            setError(e?.message || 'No se pudo consultar el POS día. Inténtalo de nuevo.')
          }
        } finally {
          if (isCurrent()) setSearchingCustomer(false)
        }
      }, 400)
    }

    return () => {
      active = false
      clearTimeout(timer)
      if (customerSearchSeq.current === requestId) customerSearchSeq.current += 1
    }
  }, [companyId, customerQuery, flow.posScope, showCustomerSearch])

  function invalidateCustomerSearch() {
    customerSearchSeq.current += 1
    setSearchingCustomer(false)
    setCustomerResults([])
    setCustomerResultRequestId(0)
  }

  function toggleCustomerSearch() {
    resetPaymentContext()
    invalidateCustomerSearch()
    setShowCustomerSearch((visible) => !visible)
  }

  function changeCustomerQuery(value) {
    invalidateCustomerSearch()
    setCustomerQuery(value)
  }

  function selectCustomer(c, resultRequestId) {
    if (
      !showCustomerSearch
      || resultRequestId !== customerSearchSeq.current
    ) return
    const selectedCustomerId = toPositiveSafeIntegerId(c.id)
    const isSameCustomer = selectedCustomerId === toPositiveSafeIntegerId(customer.id)
    manualCustomerSelectionSeq.current += 1
    if (flow.posScope !== 'day') defaultCustomerRequestSeq.current += 1
    catalogRequestSeq.current += 1
    invalidateCustomerSearch()
    setCatalogCustomerId(null)
    setPayConfirm(null)
    setCardRef('')
    setLoading(true)
    setCustomer({ id: c.id, name: c.name })
    setError('')
    setShowCustomerSearch(false)
    setCustomerQuery('')
    if (isSameCustomer) loadProducts(selectedCustomerId)
  }

  function refreshPricelistForCustomer() {
    if (!canRefreshCustomerPricelist(customer)) return
    loadProducts(customer.id)
  }

  // Payment
  async function confirmPay() {
    if (!payConfirm || cart.length === 0) return
    if (requiresCanonicalPosOperate(flow) && !canOperatePos) {
      setPayConfirm(null)
      setError('El cobro del POS administrativo no está autorizado.')
      return
    }
    if (!hasValidPosCustomer(customer)) {
      setError('Selecciona un cliente antes de cobrar.')
      return
    }
    if (!canOpenPosPayment(cart, customer, {
      loading,
      catalogCustomerId,
      defaultCustomerReady,
    })) {
      setError(defaultCustomerReady
        ? 'Espera a que termine de cargar la lista de precios del cliente antes de cobrar.'
        : (defaultCustomerState.message || 'Espera a validar el cliente predeterminado del POS día.'))
      return
    }
    if (payConfirm === 'card' && cardRef.trim().length < 4) {
      setError('Ingresa el folio de la terminal (mínimo 4 caracteres).')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      assertCanonicalPosOperateAllowed({
        flow,
        contract: BACKEND_CAPS,
        capsReady,
        scopeState,
        identityMatches: capsReady === true && scopeState === 'ready',
        odooUnavailable,
      })
      const result = await createSaleOrder({
        warehouse_id: warehouseId,
        company_id: companyId,
        ...(flow.posScope === undefined ? {} : { pos_scope: flow.posScope }),
        partner_id: customer.id,
        pricelist_id: pricelist.id || undefined,
        payment_method: payConfirm,
        payment_reference: payConfirm === 'card' ? cardRef.trim() : undefined,
        lines: cart.map(c => ({ product_id: c.product_id, qty: c.qty, price_unit: c.price_unit })),
      })
      const saleResult = normalizePosSaleResult(result)
      if (saleResult.status === 'error') {
        setError(saleResult.message)
        return
      }
      if (saleResult.status === 'uncertain') {
        setCart([])
        setPayConfirm(null)
        setError(saleResult.message || 'Venta creada pero sin folio. No vuelvas a cobrar; verifica la venta.')
        return
      }
      const orderId = saleResult.orderId
      const ticketPath = buildPosTicketPath(flow, orderId)
      if (ticketPath) {
        navigate(ticketPath, { state: { order_id: orderId } })
      } else {
        setError('Venta creada pero sin folio')
      }
    } catch (e) {
      const saleError = classifyPosSaleCreateError(e)
      if (saleError.status === 'uncertain') {
        setCart([])
        setPayConfirm(null)
      }
      setError(flow.posScope === 'day' && e?.status === 403
        ? 'Tu perfil ya no tiene acceso al POS día. Solicita revisar el permiso.'
        : saleError.message)
    } finally { setSubmitting(false); setPayConfirm(null); setCardRef('') }
  }

  const fmt = (n) => '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

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
        input { font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', paddingBottom: cart.length > 0 ? 200 : 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 12 }}>
          <button
            type="button"
            aria-label={flow.standalone ? 'Volver al inicio' : 'Volver a Admin Sucursal'}
            onClick={() => navigate(flow.backTo)}
            style={{
              width: 44, height: 44, borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(15,42,61,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span style={{ ...typo.title, color: TOKENS.colors.textSoft }}>{flow.title}</span>
          {flow.salesRoute && (
            <button
              type="button"
              onClick={() => navigate(flow.salesRoute)}
              style={{
                marginLeft: 'auto', padding: '8px 11px', borderRadius: TOKENS.radius.pill,
                minHeight: 44,
                background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.borderBlue}`,
                color: TOKENS.colors.blue3, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              Ventas de hoy
            </button>
          )}
        </div>
        {!canOperatePos && requiresCanonicalPosOperate(flow) ? (
          <p role="status">{ADMIN_POS_CONSULT_ONLY_COPY}</p>
        ) : null}

        {(defaultCustomerState.status === 'failed' ? defaultCustomerState.message : error) && (
          <div style={{ padding: '10px 14px', borderRadius: TOKENS.radius.sm, background: TOKENS.colors.errorSoft, border: `1px solid ${TOKENS.colors.error}40`, marginBottom: 12 }}>
            <span style={{ ...typo.caption, color: TOKENS.colors.error }}>
              {defaultCustomerState.status === 'failed' ? defaultCustomerState.message : error}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 32, height: 32, border: '2px solid rgba(15,42,61,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ marginBottom: 14 }}>
              <input
                type="text" placeholder="Buscar producto..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: TOKENS.radius.md,
                  background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                  color: TOKENS.colors.text, fontSize: typo.body.fontSize, outline: 'none',
                }}
              />
            </div>

            {/* Product Grid */}
            <p style={{ ...typo.overline, color: TOKENS.colors.textSoft, marginBottom: 10 }}>PRODUCTOS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {filtered.map(p => {
                const stock = getDisplayStock(p)
                const inCart = cart.find(c => c.product_id === p.id)
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    style={{
                      padding: '12px 10px', borderRadius: TOKENS.radius.md,
                      background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
                      textAlign: 'left',
                      cursor: 'pointer',
                      position: 'relative',
                    }}>
                    <p style={{ ...typo.caption, color: TOKENS.colors.text, margin: 0, marginBottom: 4, lineHeight: '1.3' }}>{p.name}</p>
                    <p style={{ ...typo.title, color: TOKENS.colors.blue3, margin: 0 }}>{fmt(getProductPrice(p))}</p>
                    <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 2 }}>
                      {stockLabel(stock)}
                    </p>
                    {inCart && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        minWidth: 20, height: 20, borderRadius: TOKENS.radius.pill,
                        background: TOKENS.colors.success, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: 'white', padding: '0 5px',
                      }}>{inCart.qty}</div>
                    )}
                  </button>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <p style={{ ...typo.body, color: TOKENS.colors.textMuted, textAlign: 'center', padding: '20px 0' }}>No se encontraron productos</p>
            )}

            {/* Cart Section */}
            <p style={{ ...typo.overline, color: TOKENS.colors.textSoft, marginBottom: 10 }}>CARRITO</p>

            {/* Customer chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                padding: '6px 12px', borderRadius: TOKENS.radius.pill,
                background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
              }}>
                <span style={{ ...typo.caption, color: TOKENS.colors.textSoft }}>{customer.name}</span>
              </div>
              <button onClick={toggleCustomerSearch} style={{
                padding: '6px 10px', borderRadius: TOKENS.radius.pill,
                background: `${TOKENS.colors.blue2}18`, border: `1px solid ${TOKENS.colors.blue2}30`,
              }}>
                <span style={{ ...typo.caption, color: TOKENS.colors.blue3 }}>Cambiar cliente</span>
              </button>
              <button
                onClick={refreshPricelistForCustomer}
                disabled={loading || !canRefreshCustomerPricelist(customer)}
                style={{
                  padding: '6px 10px',
                  borderRadius: TOKENS.radius.pill,
                  background: loading ? TOKENS.colors.surface : `${TOKENS.colors.success}18`,
                  border: `1px solid ${loading ? TOKENS.colors.border : `${TOKENS.colors.success}35`}`,
                  cursor: loading ? 'wait' : canRefreshCustomerPricelist(customer) ? 'pointer' : 'not-allowed',
                  opacity: canRefreshCustomerPricelist(customer) ? 1 : 0.55,
                }}
              >
                <span style={{
                  ...typo.caption,
                  color: loading ? TOKENS.colors.textMuted : TOKENS.colors.success,
                }}>
                  {loading ? 'Actualizando...' : 'Actualizar lista'}
                </span>
              </button>
            </div>

            <div style={{ marginTop: -6, marginBottom: 12 }}>
              <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>
                {pricelist.name ? `Lista de precios: ${pricelist.name}` : 'Lista de precios por defecto'}
              </span>
            </div>

            {/* Customer Search Overlay */}
            {showCustomerSearch && (
              <div style={{
                padding: 14, borderRadius: TOKENS.radius.lg, marginBottom: 12,
                background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
              }}>
                <input
                  type="text" placeholder="Buscar cliente por nombre..."
                  value={customerQuery} onChange={e => changeCustomerQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: TOKENS.radius.sm,
                    background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                    color: TOKENS.colors.text, fontSize: typo.caption.fontSize, outline: 'none', marginBottom: 8,
                  }}
                />
                {searchingCustomer && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(15,42,61,0.12)', borderTop: '2px solid #2B8FE0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
                {customerResults.map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c, customerResultRequestId)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: TOKENS.radius.sm,
                    background: 'transparent', marginBottom: 2,
                  }}>
                    <span style={{ ...typo.caption, color: TOKENS.colors.text }}>{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            {cart.length === 0 ? (
              <div style={{
                padding: '30px 20px', borderRadius: TOKENS.radius.lg, textAlign: 'center',
                background: TOKENS.glass.panelSoft, border: `1px solid ${TOKENS.colors.border}`,
              }}>
                <p style={{ ...typo.body, color: TOKENS.colors.textMuted, margin: 0 }}>Agrega productos</p>
              </div>
            ) : (
              <div style={{
                borderRadius: TOKENS.radius.lg, overflow: 'hidden',
                background: TOKENS.glass.panel, border: `1px solid ${TOKENS.colors.border}`,
              }}>
                {cart.map(item => (
                  <div key={item.product_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${TOKENS.colors.border}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...typo.caption, color: TOKENS.colors.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                      <p style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: 0, marginTop: 1 }}>{fmt(item.price_unit)} c/u</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => updateQty(item.product_id, -1)} style={{
                        width: 26, height: 26, borderRadius: TOKENS.radius.sm,
                        background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: TOKENS.colors.textSoft, fontSize: 14, fontWeight: 700,
                      }}>-</button>
                      <span style={{ ...typo.caption, color: TOKENS.colors.text, minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} style={{
                        width: 26, height: 26, borderRadius: TOKENS.radius.sm,
                        background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: TOKENS.colors.textSoft, fontSize: 14, fontWeight: 700,
                      }}>+</button>
                    </div>
                    <span style={{ ...typo.caption, color: TOKENS.colors.blue3, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{fmt(item.qty * item.price_unit)}</span>
                    <button onClick={() => removeItem(item.product_id)} style={{
                      width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: TOKENS.colors.error, flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ height: 120 }} />
          </>
        )}
      </div>

      {/* Sticky Footer */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: flow.posScope === 'day'
            ? 'calc(64px + env(safe-area-inset-bottom))'
            : 0,
          left: 0, right: 0,
          background: TOKENS.colors.bg0, borderTop: `1px solid ${TOKENS.colors.border}`,
          padding: '12px 16px',
          paddingBottom: flow.posScope === 'day'
            ? 12
            : 'calc(12px + env(safe-area-inset-bottom))',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...typo.caption, color: TOKENS.colors.textMuted }}>Subtotal</span>
              <span style={{ ...typo.caption, color: TOKENS.colors.textSoft }}>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ ...typo.title, color: TOKENS.colors.text }}>Total</span>
              <span style={{ ...typo.title, color: TOKENS.colors.text }}>{fmt(total)}</span>
            </div>

            {!canOperatePos && requiresCanonicalPosOperate(flow) ? (
              <p role="status">{ADMIN_POS_CONSULT_ONLY_COPY}</p>
            ) : payConfirm ? (
              <div>
                <p style={{ ...typo.caption, color: TOKENS.colors.textSoft, textAlign: 'center', marginBottom: 8 }}>
                  Confirmar pago con {payConfirm === 'cash' ? 'Efectivo' : 'Terminal'}: {fmt(total)}
                </p>
                {payConfirm === 'card' && (
                  <div>
                    <label
                      htmlFor="mobile-pos-card-reference"
                      style={{ ...typo.caption, color: TOKENS.colors.warning, fontWeight: 700 }}
                    >
                      Folio de la terminal
                    </label>
                    <input
                      id="mobile-pos-card-reference"
                      type="text"
                      value={cardRef}
                      onChange={(event) => setCardRef(event.target.value)}
                      placeholder="Ej: 0012345"
                      aria-describedby="mobile-pos-card-reference-help"
                      autoFocus
                      maxLength={32}
                      style={{
                        width: '100%', padding: '10px 12px', marginTop: 4,
                        borderRadius: TOKENS.radius.md,
                        background: TOKENS.colors.surface,
                        border: `1px solid ${TOKENS.colors.warning}`,
                        color: TOKENS.colors.text,
                      }}
                    />
                    <p
                      id="mobile-pos-card-reference-help"
                      style={{ ...typo.caption, color: TOKENS.colors.textMuted, margin: '4px 0 8px' }}
                    >
                      Copia el folio exacto del comprobante (mínimo 4 caracteres).
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={resetPaymentContext} style={{
                    flex: 1, padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surface, border: `1px solid ${TOKENS.colors.border}`,
                  }}>
                    <span style={{ ...typo.body, color: TOKENS.colors.textSoft, fontWeight: 600 }}>Cancelar</span>
                  </button>
                  <button
                    onClick={confirmPay}
                    disabled={submitting || (payConfirm === 'card' && cardRef.trim().length < 4)}
                    style={{
                    flex: 1, padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                    opacity: (submitting || (payConfirm === 'card' && cardRef.trim().length < 4)) ? 0.6 : 1,
                  }}>
                    {submitting ? (
                      <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                    ) : (
                      <span style={{ ...typo.body, color: 'white', fontWeight: 700 }}>Confirmar</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => openPayment('cash')}
                  disabled={!canOpenPayment}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                    opacity: canOpenPayment ? 1 : 0.5,
                    cursor: canOpenPayment ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span style={{ ...typo.body, color: 'white', fontWeight: 700 }}>Efectivo</span>
                </button>
                <button
                  onClick={() => openPayment('card')}
                  disabled={!canOpenPayment}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                    opacity: canOpenPayment ? 1 : 0.5,
                    cursor: canOpenPayment ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span style={{ ...typo.body, color: 'white', fontWeight: 700 }}>Terminal</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
