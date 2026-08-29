import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWarehouseStockByProduct,
  mergeProductsWithWarehouseStock,
} from '../src/modules/admin/posCatalog.js'
import { normalizePosCatalogResponse } from '../src/modules/admin/posProducts.js'

test('buildWarehouseStockByProduct aggregates on hand minus reserved by product', () => {
  const byProduct = buildWarehouseStockByProduct([
    { product_id: [10, 'Hielo'], quantity: 8, reserved_quantity: 3 },
    { product_id: [10, 'Hielo'], quantity: 2, reserved_quantity: 0.5 },
    { product_id: [11, 'Combo'], quantity: 1, reserved_quantity: 4 },
  ])

  assert.deepEqual(byProduct, {
    10: 6.5,
    11: 0,
  })
})

test('mergeProductsWithWarehouseStock preserves catalog and injects warehouse stock', () => {
  const merged = mergeProductsWithWarehouseStock(
    [
      { id: 10, name: 'Hielo', list_price: 85, sale_ok: true, available_in_pos: true },
      { id: 11, name: 'Combo', list_price: 120, sale_ok: true, available_in_pos: true },
      { id: 12, name: 'Oculto POS', list_price: 50, sale_ok: true, available_in_pos: false },
    ],
    { 10: 6.5 },
  )

  assert.deepEqual(merged, [
    {
      id: 10,
      name: 'Hielo',
      price: 85,
      stock: 6.5,
      barcode: '',
      weight: 0,
      sale_ok: true,
      available_in_pos: true,
    },
    {
      id: 11,
      name: 'Combo',
      price: 120,
      stock: 0,
      barcode: '',
      weight: 0,
      sale_ok: true,
      available_in_pos: true,
    },
  ])
})

test('normalizePosCatalogResponse keeps backend catalog, location and free stock', () => {
  const catalog = normalizePosCatalogResponse({
    ok: true,
    data: {
      company_id: 34,
      warehouse_id: 94,
      stock_location_id: 1330,
      stock_location_name: 'CGDL/Existencias',
      pricelist_id: 83,
      pricelist_name: 'Predeterminado',
      products: [
        {
          id: 750,
          name: 'KOLD BOLSA DE HIELO CILINDRO (5KG)',
          default_code: 'KOLD-5',
          stock: 80,
          qty_available: 80,
        },
      ],
    },
  })

  assert.equal(catalog.company_id, 34)
  assert.equal(catalog.warehouse_id, 94)
  assert.equal(catalog.stock_location_id, 1330)
  assert.equal(catalog.stock_location_name, 'CGDL/Existencias')
  assert.equal(catalog.products.length, 1)
  assert.equal(catalog.products[0].id, 750)
  assert.equal(catalog.products[0].stock, 80)
})
