import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mobile = readFileSync(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url), 'utf8')
const desktop = readFileSync(new URL('../src/modules/admin/forms/AdminPosForm.jsx', import.meta.url), 'utf8')
const ticket = readFileSync(new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url), 'utf8')

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
    (loader.match(/requestId !== catalogRequestSeq\.current/g) || []).length >= 2,
    `${loaderName} must ignore stale success and error responses`,
  )
  assert.match(loader, /requestId === catalogRequestSeq\.current[\s\S]*setLoading\(false\)/)

  assert.match(
    source,
    /canOpenPosPayment\(cart, customer, \{\s*loading,\s*catalogCustomerId,\s*\}\)/,
  )
  const confirmPay = sliceFunction(source, 'async function confirmPay()', '\n\n  const ')
  assert.match(
    confirmPay,
    /canOpenPosPayment\(cart, customer, \{\s*loading,\s*catalogCustomerId,\s*\}\)/,
  )
  assert.match(confirmPay, /Espera a que termine de cargar la lista de precios/)

  const selectCustomer = sliceFunction(source, 'function selectCustomer(c)', '\n\n  ')
  assert.match(selectCustomer, /catalogRequestSeq\.current \+= 1/)
  assert.match(selectCustomer, /setCatalogCustomerId\(null\)/)
  assert.match(selectCustomer, /setPayConfirm\(null\)/)
}

test('mobile POS uses configurable flow and defensive sale response wiring', () => {
  assert.match(mobile, /flow = ADMIN_POS_FLOW/)
  assert.match(mobile, /normalizePosSaleResult\(result\)/)
  assert.match(mobile, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(mobile, /Venta creada pero sin folio/)
  assert.match(mobile, /saleResult\.status === 'uncertain'[\s\S]{0,300}setCart\(\[\]\)/)
  assertCatalogCoherenceContract(mobile, 'loadProducts')
})

test('desktop POS uses configurable flow and requires a customer before payment', () => {
  assert.match(desktop, /flow = ADMIN_POS_FLOW/)
  assert.match(desktop, /normalizePosSaleResult\(result\)/)
  assert.match(desktop, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(desktop, /Selecciona un cliente antes de cobrar/)
  assert.match(desktop, /saleResult\.status === 'uncertain'[\s\S]{0,300}setCart\(\[\]\)/)
  assertCatalogCoherenceContract(desktop, 'loadCatalog')
})

test('ticket and shell respect the active flow standalone configuration', () => {
  assert.match(ticket, /flow = ADMIN_POS_FLOW/)
  assert.match(ticket, /navigate\(flow\.posRoute\)/)
  assert.match(ticket, /flow\.allowSaleCancellation === true/)
  assert.match(shell, /hideNavigation = false/)
  assert.match(shell, /!hideNavigation &&/)
})
