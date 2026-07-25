import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mobile = readFileSync(new URL('../src/modules/admin/ScreenPOS.jsx', import.meta.url), 'utf8')
const desktop = readFileSync(new URL('../src/modules/admin/forms/AdminPosForm.jsx', import.meta.url), 'utf8')
const ticket = readFileSync(new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url), 'utf8')

test('mobile POS uses configurable flow and defensive sale response wiring', () => {
  assert.match(mobile, /flow = ADMIN_POS_FLOW/)
  assert.match(mobile, /const data = result\?\.data \?\? result/)
  assert.match(mobile, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(mobile, /Venta creada pero sin folio/)
  assert.match(mobile, /canOpenPosPayment\(cart, customer\)/)
})

test('desktop POS uses configurable flow and requires a customer before payment', () => {
  assert.match(desktop, /flow = ADMIN_POS_FLOW/)
  assert.match(desktop, /buildPosTicketPath\(flow, orderId\)/)
  assert.match(desktop, /canOpenPosPayment\(cart, customer\)/)
  assert.match(desktop, /Selecciona un cliente antes de cobrar/)
})

test('ticket and shell respect the active flow standalone configuration', () => {
  assert.match(ticket, /flow = ADMIN_POS_FLOW/)
  assert.match(ticket, /navigate\(flow\.posRoute\)/)
  assert.match(shell, /hideNavigation = false/)
  assert.match(shell, /!hideNavigation &&/)
})
