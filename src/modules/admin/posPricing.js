// ─── Resumen del carrito del POS ────────────────────────────────────────────
// `computePosSummary` devolvía `tax: 0` SIEMPRE y presentaba el subtotal como
// total. No era una aproximación: era un número inventado, y el ticket que veía
// el cliente no cuadraba con la factura que emitía Odoo.
//
// El cliente NO puede calcular el impuesto: depende de los impuestos del
// producto, de la posición fiscal del cliente y del redondeo de Odoo. Así que no
// se calcula — se muestra el subtotal como lo que es, se declara que el impuesto
// lo pone Odoo, y el total REAL llega en la respuesta de `sale-create`
// (`amount_untaxed` / `amount_tax` / `amount_total`).

export function computePosSummary(lines = []) {
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line?.qty || line?.product_uom_qty || 0) * Number(line?.price_unit || 0),
    0,
  )

  return {
    subtotal,
    // `null` ≠ 0: el impuesto no se conoce en el cliente. Quien pinte esto debe
    // mostrar «—» o "lo calcula Odoo", nunca "$0.00".
    tax: null,
    total: null,
    // Lo único que el cliente sí puede afirmar.
    estimatedTotal: subtotal,
    taxSource: 'odoo',
  }
}

/** Importes REALES devueltos por `sale-create`. `null` cuando el backend
 *  todavía no los manda (contrato viejo), para no fingir un cero. */
export function readServerAmounts(saleResult) {
  const d = saleResult?.data ?? saleResult ?? {}
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
  const total = num(d.amount_total ?? d.total)
  return {
    untaxed: num(d.amount_untaxed),
    tax: num(d.amount_tax),
    total,
  }
}
