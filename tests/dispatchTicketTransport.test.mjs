import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  folioFromFindTicketPath,
  normalizeDispatchTicketResult,
  normalizeFindTicketResult,
  normalizePendingTicketsResult,
} from '../src/modules/entregas/dispatchTicketTransport.js'

const apiSrc = readFileSync(
  fileURLToPath(new URL('../src/lib/api.js', import.meta.url)),
  'utf8',
)
const screenSrc = readFileSync(
  fileURLToPath(new URL('../src/modules/admin/ScreenTraspasoMateriaPrima.jsx', import.meta.url)),
  'utf8',
)

test('find-ticket adapter stays a thin RPC + normalize path', () => {
  assert.match(apiSrc, /folioFromFindTicketPath/)
  assert.match(apiSrc, /normalizeFindTicketResult/)
  assert.match(apiSrc, /normalizePendingTicketsResult/)
  assert.match(apiSrc, /normalizeDispatchTicketResult/)
  const findBlock = apiSrc.slice(
    apiSrc.indexOf("cleanPath === '/pwa-admin/find-ticket'"),
    apiSrc.indexOf("cleanPath === '/pwa-admin/sale-detail'"),
  )
  assert.doesNotMatch(findBlock, /customer: row\.customer/)
  assert.match(findBlock, /odooHttp\('GET'/)
})

test('normalizeFindTicketResult and pending/dispatch envelopes', () => {
  assert.equal(folioFromFindTicketPath('/pwa-admin/find-ticket?folio=S001'), 'S001')
  assert.equal(normalizeFindTicketResult({ ok: false }), null)
  const ticket = normalizeFindTicketResult({
    ok: true,
    data: { id: 9, partner_id: [3, 'Cliente'], amount_total: 12 },
  })
  assert.equal(ticket.customer, 'Cliente')
  assert.equal(ticket.total, 12)
  assert.deepEqual(normalizePendingTicketsResult({ data: { tickets: [{ id: 1, name: 'S1', amount_total: 4 }] } }), [
    { id: 1, name: 'S1', customer: '', total: 4, state: 'sale', date_order: null, warehouse_id: 0 },
  ])
  assert.equal(normalizeDispatchTicketResult({ ok: true, data: { id: 9 } }).success, true)
  assert.equal(normalizeDispatchTicketResult({ ok: false, message: 'fuera' }).error, 'fuera')
})

test('unavailable Traspaso MP block has no new inline styles', () => {
  const start = screenSrc.indexOf('if (!allowed)')
  const end = screenSrc.indexOf('if (loading)')
  const block = screenSrc.slice(start, end)
  assert.match(block, /traspaso-mp-unavailable/)
  assert.doesNotMatch(block, /style=\{\{/)
})
