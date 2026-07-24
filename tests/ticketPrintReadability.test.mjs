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
