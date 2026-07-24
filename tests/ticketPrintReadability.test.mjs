import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildEscPosTicket } from '../src/modules/admin/ticketPrinter.js'

const ESC_POS_DOUBLE_HEIGHT = '\x1D!\x10'
const ESC_POS_NORMAL = '\x1D!\x00'

test('prints normal ticket text at double height without reducing the 48-column width', () => {
  const commands = buildEscPosTicket({
    sucursal: 'Iguala',
    dateStr: '24/07/2026',
    timeStr: '13:40',
    folio: 'S00123',
    lines: [{
      qty: 2,
      product_name: 'Bolsa de hielo de cinco kilogramos',
      price_unit: 40,
    }],
    fmt: (value) => `$${Number(value).toFixed(2)}`,
    subtotal: 80,
    total: 80,
    paymentLabel: 'Efectivo',
  })

  const firstBodySize = commands.indexOf(ESC_POS_DOUBLE_HEIGHT)
  const branchName = commands.indexOf('Iguala\n')
  assert.ok(firstBodySize >= 0)
  assert.ok(firstBodySize < branchName)

  const totalIndex = commands.findIndex((command) => (
    typeof command === 'string' && command.includes('TOTAL')
  ))
  const bodySizeAfterTotal = commands.indexOf(ESC_POS_DOUBLE_HEIGHT, totalIndex)
  const paymentIndex = commands.findIndex((command) => (
    typeof command === 'string' && command.includes('Metodo de pago:')
  ))
  assert.ok(bodySizeAfterTotal > totalIndex)
  assert.ok(bodySizeAfterTotal < paymentIndex)

  assert.ok(commands.includes('-'.repeat(48) + '\n'))
  assert.equal(commands.at(-2), ESC_POS_NORMAL)
})

test('enlarges every browser-fallback ticket text style without changing paper geometry', () => {
  const source = readFileSync(
    new URL('../src/modules/admin/ScreenTicket.jsx', import.meta.url),
    'utf8',
  )
  const printHtml = source.slice(
    source.indexOf('  function buildTicketHtml()'),
    source.indexOf('  async function printTicket()'),
  )

  const expectedSizes = [
    [/\.brand \{ font-size: 18px;/, 'brand'],
    [/\.sub \{ font-size: 12px;/, 'branch'],
    [/\.meta \{[^}]*font-size: 12px;/, 'date and time'],
    [/\.folio \{ font-size: 13px;/, 'folio'],
    [/\.row \{[^}]*font-size: 12px;/, 'product rows'],
    [/\.totals \{[^}]*font-size: 12px;/, 'subtotal'],
    [/\.total \{[^}]*font-size: 18px;/, 'total'],
    [/\.pay \{[^}]*font-size: 12px;/, 'payment method'],
    [/\.box \.t \{ font-size: 10px;/, 'ticket label'],
    [/\.box \.f \{ font-size: 18px;/, 'boxed folio'],
    [/\.foot \{[^}]*font-size: 11px;/, 'footer'],
    [/\.foot\.b \{ font-size: 12px;/, 'thank-you footer'],
  ]

  for (const [pattern, label] of expectedSizes) {
    assert.match(printHtml, pattern, `${label} did not use the approved font size`)
  }

  assert.match(printHtml, /html, body \{ width: 72mm;/)
  assert.match(printHtml, /\.ticket \{ width: 62mm; margin: 0 2mm 0 8mm;/)
  assert.doesNotMatch(
    source.slice(source.indexOf('  return ('), source.length),
    /fontSize: 13, fontWeight: 700, color: '#1a1a1a' \}>Folio:/,
    'the on-screen ticket must remain unchanged',
  )
})
