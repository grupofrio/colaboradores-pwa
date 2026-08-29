import test from 'node:test'
import assert from 'node:assert/strict'
import { readUtf8Lf } from './helpers/readUtf8Lf.mjs'

const mobile = readUtf8Lf(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url))
const desktop = readUtf8Lf(new URL('../src/modules/admin/forms/AdminPosForm.jsx', import.meta.url))
const ticket = readUtf8Lf(new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url))
const shell = readUtf8Lf(new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url))

function sliceFunction(source, startNeedle, nextNeedle) {
  const start = source.indexOf(startNeedle)
  const end = source.indexOf(nextNeedle, start + startNeedle.length)
  assert.notEqual(start, -1, `${startNeedle} missing`)
  assert.notEqual(end, -1, `${nextNeedle} missing after ${startNeedle}`)
  return source.slice(start, end)
}

function assertCatalogCoherenceContract(source, loaderName) {
  assert.match(source, /useRef/)
  assert.match(source, /const \[catalogCustomerId, setCatalogCustomerId\] = useState\(null\)/)
  assert.match(source, /const catalogRequestSeq = useRef\(0\)/)

  const loader = sliceFunction(source, `const ${loaderName} = useCallback`, '\n\n  useEffect')
  assert.match(loader, /const requestId = \+\+catalogRequestSeq\.current/)
  assert.match(loader, /setCatalogCustomerId\(null\)/)
  assert.match(loader, /const requestedCustomerId =/)
  assert.match(loader, /setCatalogCustomerId\(requestedCustomerId\)/)
  assert.ok(
    (loader.match(/shouldIgnoreLatePosCatalogResponse\(/g) || []).length >= 2,
    `${loaderName} must ignore stale success and error responses`,
  )
  assert.match(loader, /requestId === catalogRequestSeq\.current[\s\S]*setLoading\(false\)/)

  assert.match(
    source,
    /canOpenPosPayment\(cart, customer, \{\s*loading,\s*catalogCustomerId,\s*defaultCustomerReady,\s*\}\)/,
  )
  const confirmPay = sliceFunction(source, 'async function confirmPay()', '\n\n  const ')
  assert.match(
    confirmPay,
    /canOpenPosPayment\(cart, customer, \{\s*loading,\s*catalogCustomerId,\s*defaultCustomerReady,\s*\}\)/,
  )
  assert.match(confirmPay, /Espera a que termine de cargar la lista de precios/)

  const selectCustomer = sliceFunction(source, 'function selectCustomer(c, resultRequestId)', '\n\n  ')
  assert.match(selectCustomer, /resultRequestId !== customerSearchSeq\.current/)
  assert.match(selectCustomer, /manualCustomerSelectionSeq\.current \+= 1/)
  assert.match(selectCustomer, /flow\.posScope !== 'day'[\s\S]{0,100}defaultCustomerRequestSeq\.current \+= 1/)
  assert.match(selectCustomer, /catalogRequestSeq\.current \+= 1/)
  assert.match(selectCustomer, /setCatalogCustomerId\(null\)/)
  assert.match(selectCustomer, /setPayConfirm\(null\)/)
}

function assertSaleCreateCatchContract(source) {
  const confirmPay = sliceFunction(source, 'async function confirmPay()', '\n\n  const ')
  const catchStart = confirmPay.lastIndexOf('} catch (e) {')
  assert.notEqual(catchStart, -1, 'createSaleOrder catch missing')

  const catchBlock = confirmPay.slice(catchStart)
  assert.match(catchBlock, /classifyPosSaleCreateError\(e\)/)
  assert.match(
    catchBlock,
    /saleError\.status === 'uncertain'[\s\S]{0,300}setCart\(\[\]\)[\s\S]{0,300}setPayConfirm\(null\)/,
  )
}

test('mobile POS uses configurable flow and defensive sale response wiring', () => {
  assert.match(mobile, /flow = ADMIN_POS_FLOW/)
  assert.match(mobile, /normalizePosSaleResult\(result\)/)
  assert.match(mobile, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(mobile, /Venta creada pero sin folio/)
  assert.match(mobile, /saleResult\.status === 'uncertain'[\s\S]{0,300}setCart\(\[\]\)/)
  assertCatalogCoherenceContract(mobile, 'loadProducts')
  assertSaleCreateCatchContract(mobile)
  assert.match(mobile, /posScope: flow\.posScope/)
  assert.match(mobile, /flow\.posScope === undefined[\s\S]{0,180}\{ pos_scope: flow\.posScope \}/)
  assert.match(
    mobile,
    /bottom: flow\.posScope === 'day'[\s\S]{0,160}'calc\(64px \+ env\(safe-area-inset-bottom\)\)'[\s\S]{0,80}: 0/,
    'el footer diurno queda arriba de la barra global móvil de 64px',
  )
  assert.match(
    mobile,
    /paddingBottom: flow\.posScope === 'day'[\s\S]{0,100}\? 12[\s\S]{0,100}: 'calc\(12px \+ env\(safe-area-inset-bottom\)\)'/,
    'el safe-area se reserva una sola vez en el flujo diurno',
  )
})

test('desktop POS uses configurable flow and requires a customer before payment', () => {
  assert.match(desktop, /flow = ADMIN_POS_FLOW/)
  assert.match(desktop, /normalizePosSaleResult\(result\)/)
  assert.match(desktop, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(desktop, /Selecciona un cliente antes de cobrar/)
  assert.match(desktop, /saleResult\.status === 'uncertain'[\s\S]{0,300}setCart\(\[\]\)/)
  assertCatalogCoherenceContract(desktop, 'loadCatalog')
  assertSaleCreateCatchContract(desktop)
  assert.match(desktop, /posScope: flow\.posScope/)
  assert.match(desktop, /flow\.posScope === undefined[\s\S]{0,180}\{ pos_scope: flow\.posScope \}/)
})

test('ticket and shell respect the active flow standalone configuration', () => {
  assert.match(ticket, /flow = ADMIN_POS_FLOW/)
  assert.match(ticket, /navigate\(flow\.posRoute\)/)
  assert.match(ticket, /canCancelPosOrder\(flow, order, BACKEND_CAPS\.saleCancel\)/)
  assert.match(ticket, /submitPosCancellation\(\{[\s\S]{0,300}flow,[\s\S]{0,300}orderId: normalizedRouteOrderId,[\s\S]{0,300}reasonCode: cancelReasonCode,[\s\S]{0,300}reason: cancelReason,[\s\S]{0,300}cancelFn: cancelSaleOrder/)
  assert.match(ticket, /getSaleOrder\(normalizedTargetId, \{ posScope: targetPosScope \}\)/)
  assert.match(ticket, /payloadOrderId !== normalizedTargetId/)
  assert.match(ticket, /normalizedDisplayedOrderId !== normalizedRouteOrderId/)
  assert.doesNotMatch(ticket, /saleCreateManagerThreshold|amount_total\s*[<>]=?|5000/)
  const doCancel = sliceFunction(ticket, 'async function doCancel()', '\n\n  function resetCancelReasons')
  assert.doesNotMatch(doCancel, /flow\.allowSaleCancellation|BACKEND_CAPS|canCancel\b/)
  assert.match(shell, /hideNavigation = false/)
  assert.match(shell, /!hideNavigation &&/)
})
