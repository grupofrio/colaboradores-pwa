// --- AdminPosForm — Venta mostrador V2 (desktop) --------------------------
// Backend: `gf_pwa_admin.sale-create` + `pos-products` + `customers`.
// Mobile legacy sigue en ScreenPOS.jsx < 1024px.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND_TOKENS as TOKENS } from '../../../theme/brandTokens'
import { useAdmin } from '../AdminContext'
import AuthBanner from '../../../components/AuthBanner'
import { useToast } from '../../../components/Toast'
import {
  getPosCatalog,
  searchCustomers,
  getDefaultCustomer,
  createSaleOrder,
} from '../api'
import { BACKEND_CAPS } from '../adminService'
import {
  addProductToCart,
  changeCartItemQty,
  getDisplayStock,
  getProductPrice,
  nextCartQtyWouldExceedStock,
  repriceCartFromCatalog,
  stockLabel,
} from '../posCart'
import {
  canRefreshCustomerPricelist,
  hasValidPosCustomer,
  normalizeDefaultCustomerResponse,
  normalizeCustomerResults,
  shouldLoadCustomerSuggestions,
  toPositiveSafeIntegerId,
} from '../posCustomers'
import { logScreenError } from '../../shared/logScreenError'
import { computePosSummary } from '../posPricing'
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
} from '../posFlow'

const fmt = (n) => '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Umbrales de venta (UI — backend debe re-validar)
// eslint-disable-next-line react-refresh/only-export-components
export const POS_THRESHOLDS = {
  MANAGER_AUTH: 5000,
  DIRECTOR_AUTH: 50000,
}

export default function AdminPosForm({ flow = ADMIN_POS_FLOW, warehouseId: warehouseIdProp, companyId: companyIdProp }) {
  const navigate = useNavigate()
  const { companyId: adminCompanyId, companyLabel, warehouseId: adminWarehouseId, sucursal, capsReady, scopeState, odooUnavailable, sessionIdentity } = useAdmin()
  const warehouseId = warehouseIdProp || adminWarehouseId
  const companyId = companyIdProp || adminCompanyId
  const defaultCustomerName = flow.defaultCustomerName || 'VENTA PUBLICO'
  const identityKey = posClientIdentityKey({
    flow,
    sessionIdentity,
    companyId,
    warehouseId,
  })

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState(() => emptyPosCustomer(flow))
  const [pricelist, setPricelist] = useState({ id: null, name: '' })
  const [catalogLocationName, setCatalogLocationName] = useState('')
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
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customerResultRequestId, setCustomerResultRequestId] = useState(0)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const customerSearchSeq = useRef(0)
  const [payConfirm, setPayConfirm] = useState(null)
  const [cardRef, setCardRef] = useState('')
  const toast = useToast()

  function resetPaymentContext() {
    setPayConfirm(null)
    setCardRef('')
  }

  const loadCatalog = useCallback(async (selectedPartnerId) => {
    const startedFor = identityKey
    const requestId = ++catalogRequestSeq.current
    const requestedCustomerId = toPositiveSafeIntegerId(selectedPartnerId) || null
    setPayConfirm(null)
    setCardRef('')
    setCatalogCustomerId(null)
    if (!warehouseId) {
      setProducts([])
      setPricelist({ id: null, name: '' })
      setError('Tu sesión no tiene almacén asignado. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }

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
      setCatalogLocationName(catalog?.stock_location_name || '')
      setCart((prev) => repriceCartFromCatalog(prev, list))
      setCatalogCustomerId(requestedCustomerId)
      return true
    } catch (e) {
      if (requestId !== catalogRequestSeq.current || startedFor !== identityKeyRef.current) return false
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
    setCatalogLocationName('')
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
    loadCatalog(customer.id)
  }, [customer.id, loadCatalog])

  useEffect(() => {
    let alive = true
    const requestId = ++defaultCustomerRequestSeq.current
    const manualSelectionAtStart = manualCustomerSelectionSeq.current
    if (flow.posScope === 'day') {
      setDefaultCustomerState({ status: 'pending', message: '' })
    }
    ;(async () => {
      try {
        const res = await getDefaultCustomer(companyId, { posScope: flow.posScope })
        const c = normalizeDefaultCustomerResponse(res)
        if (!alive || requestId !== defaultCustomerRequestSeq.current) return
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
        if (!alive || requestId !== defaultCustomerRequestSeq.current) return
        logScreenError('AdminPosForm', 'getDefaultCustomer', e)
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
    })()
    return () => {
      alive = false
      if (defaultCustomerRequestSeq.current === requestId) {
        defaultCustomerRequestSeq.current += 1
      }
    }
  }, [companyId, defaultCustomerName, flow, identityKey])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.default_code || p.sku || '').toLowerCase().includes(q),
    )
  }, [products, search])

  function addToCart(product) {
    resetPaymentContext()
    setCart((prev) => addProductToCart(prev, product, {
      enforceAvailableStock: requiresCanonicalPosOperate(flow),
    }))
  }

  function updateQty(productId, delta) {
    resetPaymentContext()
    setCart((prev) => changeCartItemQty(prev, productId, delta, {
      enforceAvailableStock: requiresCanonicalPosOperate(flow),
    }))
  }

  function removeItem(productId) {
    resetPaymentContext()
    setCart((prev) => prev.filter((c) => c.product_id !== productId))
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
          logScreenError('AdminPosForm', 'searchCustomers', e)
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
    if (isSameCustomer) loadCatalog(selectedCustomerId)
  }

  async function refreshPricelistForCustomer() {
    if (!canRefreshCustomerPricelist(customer)) return
    const ok = await loadCatalog(customer.id)
    if (ok) toast.success('Lista de precios actualizada')
  }

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

    if (payConfirm === 'card') {
      const ref = cardRef.trim()
      if (ref.length < 4) {
        toast.error('Ingresa el folio de la terminal (mínimo 4 caracteres)')
        return
      }
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
        sucursal_code: sucursal || undefined,
        partner_id: customer.id,
        payment_method: payConfirm,
        payment_reference: payConfirm === 'card' ? cardRef.trim() : undefined,
        pricelist_id: pricelist.id || undefined,
        lines: cart.map((c) => ({
          product_id: c.product_id,
          qty: c.qty,
          price_unit: c.price_unit,
        })),
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
        await loadCatalog(customer.id)
        toast.success('Venta registrada')
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
    } finally {
      setSubmitting(false)
      setPayConfirm(null)
      setCardRef('')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: TOKENS.radius.md,
    background: TOKENS.colors.surface,
    border: `1px solid ${TOKENS.colors.border}`,
    color: TOKENS.colors.text,
    fontSize: 14,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: TOKENS.colors.textLow,
          margin: 0,
        }}>
          VENTA MOSTRADOR · {companyLabel.toUpperCase()}
          {catalogLocationName ? ` · ${catalogLocationName}` : ''}
        </p>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: TOKENS.colors.text,
          margin: '4px 0 0',
        }}>
          POS
        </h1>
        {!canOperatePos && requiresCanonicalPosOperate(flow) ? (
          <p role="status">{ADMIN_POS_CONSULT_ONLY_COPY}</p>
        ) : null}
      </div>

      {(defaultCustomerState.status === 'failed' ? defaultCustomerState.message : error) && (
        <div style={{
          padding: '10px 14px',
          borderRadius: TOKENS.radius.sm,
          marginBottom: 12,
          background: TOKENS.colors.errorSoft,
          border: `1px solid ${TOKENS.colors.error}40`,
          fontSize: 12,
          fontWeight: 600,
          color: TOKENS.colors.error,
        }}>
          {defaultCustomerState.status === 'failed' ? defaultCustomerState.message : error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start',
      }}>
        <div style={{
          padding: 22,
          borderRadius: TOKENS.radius.xl,
          background: TOKENS.glass.panel,
          border: `1px solid ${TOKENS.colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Buscar producto por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: TOKENS.colors.textLow, whiteSpace: 'nowrap' }}>
              {loading ? '...' : `${filtered.length} / ${products.length}`}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{
                width: 28,
                height: 28,
                border: '2px solid rgba(15,42,61,0.12)',
                borderTop: '2px solid #2B8FE0',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              borderRadius: TOKENS.radius.lg,
              textAlign: 'center',
              background: TOKENS.glass.panelSoft,
              border: `1px dashed ${TOKENS.colors.border}`,
            }}>
              <p style={{ fontSize: 13, color: TOKENS.colors.textMuted, margin: 0 }}>
                {products.length === 0 ? 'Sin productos en este almacén' : 'Sin coincidencias'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 10,
              maxHeight: 'calc(100dvh - 260px)',
              overflowY: 'auto',
              paddingRight: 4,
            }}>
              {filtered.map((p) => {
                const stock = getDisplayStock(p)
                const inCart = cart.find((c) => c.product_id === p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={requiresCanonicalPosOperate(flow) && nextCartQtyWouldExceedStock(cart, p)}
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '12px 12px 10px',
                      borderRadius: TOKENS.radius.md,
                      background: inCart ? `${TOKENS.colors.blue2}14` : TOKENS.colors.surface,
                      border: `1px solid ${inCart ? TOKENS.colors.blue2 : TOKENS.colors.border}`,
                      textAlign: 'left',
                      cursor: 'pointer',
                      position: 'relative',
                      minHeight: 92,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <p style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: TOKENS.colors.text,
                      margin: 0,
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {p.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: TOKENS.colors.blue3 }}>
                        {fmt(getProductPrice(p))}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: TOKENS.colors.textMuted }}>
                        {stockLabel(stock)}
                      </span>
                    </div>
                    {inCart && (
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        minWidth: 22,
                        height: 22,
                        borderRadius: TOKENS.radius.pill,
                        background: TOKENS.colors.success,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'white',
                        padding: '0 6px',
                      }}>
                        {inCart.qty}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: 22,
          borderRadius: TOKENS.radius.xl,
          background: TOKENS.glass.panel,
          border: `1px solid ${TOKENS.colors.border}`,
          position: 'sticky',
          top: 84,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 100px)',
        }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: TOKENS.colors.textLow,
            margin: '0 0 12px',
          }}>
            CLIENTE
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              flex: 1,
              minWidth: 0,
              padding: '8px 12px',
              borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.surface,
              border: `1px solid ${TOKENS.colors.border}`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 13,
              color: TOKENS.colors.textSoft,
            }}>
              {customer.name}
            </div>
            <button
              type="button"
              onClick={toggleCustomerSearch}
              style={{
                padding: '8px 12px',
                borderRadius: TOKENS.radius.md,
                background: `${TOKENS.colors.blue2}18`,
                border: `1px solid ${TOKENS.colors.blue2}30`,
                fontSize: 11,
                fontWeight: 600,
                color: TOKENS.colors.blue3,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={refreshPricelistForCustomer}
              disabled={loading || !canRefreshCustomerPricelist(customer)}
              style={{
                padding: '8px 12px',
                borderRadius: TOKENS.radius.md,
                background: loading ? TOKENS.colors.surface : `${TOKENS.colors.success}18`,
                border: `1px solid ${loading ? TOKENS.colors.border : `${TOKENS.colors.success}35`}`,
                fontSize: 11,
                fontWeight: 600,
                color: loading ? TOKENS.colors.textMuted : TOKENS.colors.success,
                fontFamily: "'DM Sans', sans-serif",
                cursor: loading ? 'wait' : canRefreshCustomerPricelist(customer) ? 'pointer' : 'not-allowed',
                opacity: canRefreshCustomerPricelist(customer) ? 1 : 0.55,
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar lista'}
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: TOKENS.colors.textLow }}>
              {pricelist.name ? `Lista de precios: ${pricelist.name}` : 'Lista de precios por defecto'}
            </span>
          </div>

          {showCustomerSearch && (
            <div style={{
              padding: 12,
              borderRadius: TOKENS.radius.md,
              marginBottom: 12,
              background: TOKENS.colors.surfaceSoft,
              border: `1px solid ${TOKENS.colors.border}`,
            }}>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={customerQuery}
                onChange={(e) => changeCustomerQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: TOKENS.radius.sm,
                  background: TOKENS.colors.surface,
                  border: `1px solid ${TOKENS.colors.border}`,
                  color: TOKENS.colors.text,
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 8,
                }}
              />
              {searchingCustomer && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(15,42,61,0.12)',
                    borderTop: '2px solid #2B8FE0',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              )}
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {!searchingCustomer && customerResults.length === 0 && (
                  <div style={{
                    padding: '10px 8px',
                    fontSize: 11,
                    color: TOKENS.colors.textMuted,
                  }}>
                    {customerQuery.trim().length === 1
                      ? 'Escribe al menos 2 letras para buscar.'
                      : 'No se encontraron clientes para esta búsqueda.'}
                  </div>
                )}
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c, customerResultRequestId)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: TOKENS.radius.sm,
                      background: c.id === customer.id ? `${TOKENS.colors.blue2}18` : 'transparent',
                      border: `1px solid ${c.id === customer.id ? `${TOKENS.colors.blue2}35` : 'transparent'}`,
                      fontSize: 12,
                      color: TOKENS.colors.text,
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: 4,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: TOKENS.colors.textLow,
            margin: '4px 0 10px',
          }}>
            CARRITO · {cart.length}
          </p>

          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            marginBottom: 12,
            borderRadius: TOKENS.radius.md,
            border: `1px solid ${TOKENS.colors.border}`,
          }}>
            {cart.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: TOKENS.colors.textMuted, margin: 0 }}>
                  Agrega productos desde el panel izquierdo
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderBottom: `1px solid ${TOKENS.colors.border}30`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: TOKENS.colors.text,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: 10, color: TOKENS.colors.textMuted, margin: '2px 0 0' }}>
                      {fmt(item.price_unit)} c/u
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product_id, -1)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: TOKENS.radius.sm,
                        background: TOKENS.colors.surface,
                        border: `1px solid ${TOKENS.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: TOKENS.colors.textSoft,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      -
                    </button>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: TOKENS.colors.text,
                      minWidth: 22,
                      textAlign: 'center',
                    }}>
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product_id, 1)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: TOKENS.radius.sm,
                        background: TOKENS.colors.surface,
                        border: `1px solid ${TOKENS.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: TOKENS.colors.textSoft,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      +
                    </button>
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: TOKENS.colors.blue3,
                    minWidth: 64,
                    textAlign: 'right',
                  }}>
                    {fmt(item.qty * item.price_unit)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product_id)}
                    style={{
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: TOKENS.colors.error,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{
            padding: '12px 14px',
            borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.surfaceSoft,
            border: `1px solid ${TOKENS.colors.border}`,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: TOKENS.colors.textMuted }}>Subtotal</span>
              <span style={{ fontSize: 12, color: TOKENS.colors.textSoft }}>{fmt(subtotal)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 6,
              borderTop: `1px solid ${TOKENS.colors.border}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TOKENS.colors.text }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: TOKENS.colors.text }}>{fmt(total)}</span>
            </div>
          </div>

          {!canOperatePos && requiresCanonicalPosOperate(flow) ? (
            <p role="status">
              {ADMIN_POS_CONSULT_ONLY_COPY}
            </p>
          ) : payConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 11, color: TOKENS.colors.textSoft, textAlign: 'center', margin: 0 }}>
                Confirmar pago con <strong>{payConfirm === 'cash' ? 'Efectivo' : 'Terminal'}</strong> — {fmt(total)}
              </p>

              {total > POS_THRESHOLDS.DIRECTOR_AUTH && (
                <AuthBanner
                  level="director"
                  title="Venta excepcional"
                  reason={`Monto de ${fmt(total)} requiere autorización de dirección.`}
                />
              )}
              {total > POS_THRESHOLDS.MANAGER_AUTH && total <= POS_THRESHOLDS.DIRECTOR_AUTH && (
                <AuthBanner
                  level="manager"
                  title="Venta con monto alto"
                  reason={`Monto de ${fmt(total)} requiere autorización del gerente de sucursal.`}
                />
              )}

              {payConfirm === 'card' && (
                <div>
                  <label
                    htmlFor="desktop-pos-card-reference"
                    style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: TOKENS.colors.warning }}
                  >
                    FOLIO DE LA TERMINAL *
                  </label>
                  <input
                    id="desktop-pos-card-reference"
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Ej: 0012345"
                    aria-describedby="desktop-pos-card-reference-help"
                    autoFocus
                    maxLength={32}
                    style={{
                      ...inputStyle,
                      marginTop: 4,
                      borderColor: cardRef.trim().length >= 4 ? TOKENS.colors.border : TOKENS.colors.warning,
                    }}
                  />
                  <p
                    id="desktop-pos-card-reference-help"
                    style={{ fontSize: 10, color: TOKENS.colors.textLow, margin: '4px 0 0' }}
                  >
                    Copia el folio exacto del comprobante de la terminal (mín. 4 caracteres).
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={resetPaymentContext}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: TOKENS.radius.md,
                    background: TOKENS.colors.surface,
                    border: `1px solid ${TOKENS.colors.border}`,
                    fontSize: 13,
                    fontWeight: 600,
                    color: TOKENS.colors.textSoft,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPay}
                  disabled={submitting || (payConfirm === 'card' && cardRef.trim().length < 4)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    borderRadius: TOKENS.radius.md,
                    background: `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                    opacity: (submitting || (payConfirm === 'card' && cardRef.trim().length < 4)) ? 0.5 : 1,
                    cursor: submitting ? 'wait' : 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'white',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {submitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => openPayment('cash')}
                disabled={!canOpenPayment}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  borderRadius: TOKENS.radius.md,
                  background: cart.length === 0
                    ? TOKENS.colors.surface
                    : `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                  border: cart.length === 0 ? `1px solid ${TOKENS.colors.border}` : 'none',
                  opacity: canOpenPayment ? 1 : 0.5,
                  cursor: canOpenPayment ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'white',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => openPayment('card')}
                disabled={!canOpenPayment}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  borderRadius: TOKENS.radius.md,
                  background: cart.length === 0
                    ? TOKENS.colors.surface
                    : `linear-gradient(135deg, ${TOKENS.colors.blue}, ${TOKENS.colors.blue2})`,
                  border: cart.length === 0 ? `1px solid ${TOKENS.colors.border}` : 'none',
                  opacity: canOpenPayment ? 1 : 0.5,
                  cursor: canOpenPayment ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'white',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Terminal
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
