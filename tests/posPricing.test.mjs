import test from 'node:test'
import assert from 'node:assert/strict'

import { computePosSummary, readServerAmounts } from '../src/modules/admin/posPricing.js'

// El test anterior afirmaba `tax: 0` y `total === subtotal`. Eso NO era una
// aproximación: era un número inventado, y el ticket que se llevaba el cliente
// no cuadraba con la factura que emitía Odoo. Ahora se afirma lo contrario: el
// cliente no conoce el impuesto y no lo finge.

test('el resumen del carrito NO inventa el impuesto', () => {
  const summary = computePosSummary([
    { qty: 2, price_unit: 85 },
    { qty: 1, price_unit: 120.5 },
  ])

  assert.equal(summary.subtotal, 290.5)
  assert.equal(summary.estimatedTotal, 290.5, 'lo único que el cliente puede afirmar')
  assert.equal(summary.tax, null, 'null ≠ 0: el impuesto no se conoce en el cliente')
  assert.equal(summary.total, null, 'el total real lo devuelve Odoo')
  assert.equal(summary.taxSource, 'odoo')
})

test('acepta las dos formas de línea y el carrito vacío', () => {
  assert.equal(computePosSummary([{ product_uom_qty: 3, price_unit: 10 }]).subtotal, 30)
  assert.equal(computePosSummary([]).subtotal, 0)
  assert.equal(computePosSummary().subtotal, 0)
})

test('readServerAmounts toma los importes REALES de Odoo', () => {
  const amounts = readServerAmounts({
    data: { amount_untaxed: 250, amount_tax: 40, amount_total: 290 },
  })
  assert.deepEqual(amounts, { untaxed: 250, tax: 40, total: 290 })
})

test('readServerAmounts distingue "no vino" de cero', () => {
  // Contrato viejo: solo `total`. El impuesto no vino ⇒ null, para que la UI
  // imprima «—» en vez de un $0.00 que el cliente leería como "sin IVA".
  const legacy = readServerAmounts({ data: { total: 290 } })
  assert.equal(legacy.total, 290)
  assert.equal(legacy.tax, null)
  assert.equal(legacy.untaxed, null)

  const vacio = readServerAmounts(null)
  assert.deepEqual(vacio, { untaxed: null, tax: null, total: null })

  // Un cero REAL sí se conserva.
  const exento = readServerAmounts({ data: { amount_untaxed: 100, amount_tax: 0, amount_total: 100 } })
  assert.equal(exento.tax, 0)
})

test('funciona con el envelope y sin él', () => {
  assert.equal(readServerAmounts({ amount_total: 99 }).total, 99)
  assert.equal(readServerAmounts({ data: { amount_total: 99 } }).total, 99)
})
