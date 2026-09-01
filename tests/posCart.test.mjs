import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addProductToCart,
  changeCartItemQty,
  repriceCartFromCatalog,
  getProductPrice,
  stockLabel,
} from '../src/modules/admin/posCart.js'

test('addProductToCart allows a product with zero stock', () => {
  const cart = addProductToCart([], {
    id: 10,
    name: 'Hielo',
    stock: 0,
    price: 85,
  })

  assert.deepEqual(cart, [
    {
      product_id: 10,
      name: 'Hielo',
      qty: 1,
      price_unit: 85,
      stock: 0,
    },
  ])
})

test('addProductToCart refuses zero stock when the admin POS enforces availability', () => {
  const cart = addProductToCart([], {
    id: 10,
    name: 'Hielo',
    stock: 0,
    price: 85,
  }, { enforceAvailableStock: true })

  assert.deepEqual(cart, [])
})

test('addProductToCart refuses a qty above free stock when enforced', () => {
  const first = addProductToCart([], {
    id: 10,
    name: 'Hielo',
    stock: 1,
    price: 85,
  }, { enforceAvailableStock: true })
  const second = addProductToCart(first, {
    id: 10,
    name: 'Hielo',
    stock: 1,
    price: 85,
  }, { enforceAvailableStock: true })

  assert.equal(first[0].qty, 1)
  assert.equal(second[0].qty, 1)
})

test('getProductPrice prefers pricelist price_unit over list_price', () => {
  assert.equal(getProductPrice({ price_unit: 70, list_price: 85 }), 70)
})

test('addProductToCart uses price_unit returned by the selected customer catalog', () => {
  const cart = addProductToCart([], {
    id: 10,
    name: 'Hielo',
    price_unit: 70,
    list_price: 85,
  })

  assert.equal(cart[0].price_unit, 70)
})

test('changeCartItemQty allows quantity above visible stock', () => {
  const cart = changeCartItemQty([
    {
      product_id: 10,
      name: 'Hielo',
      qty: 1,
      price_unit: 85,
      stock: 0,
    },
  ], 10, 1)

  assert.equal(cart[0].qty, 2)
})

test('changeCartItemQty keeps the qty when admin POS stock is exhausted', () => {
  const cart = changeCartItemQty([
    {
      product_id: 10,
      name: 'Hielo',
      qty: 1,
      price_unit: 85,
      stock: 1,
    },
  ], 10, 1, { enforceAvailableStock: true })

  assert.equal(cart[0].qty, 1)
})

test('changeCartItemQty removes the row when quantity drops to zero', () => {
  const cart = changeCartItemQty([
    {
      product_id: 10,
      name: 'Hielo',
      qty: 1,
      price_unit: 85,
      stock: 0,
    },
  ], 10, -1)

  assert.deepEqual(cart, [])
})

test('stockLabel stays neutral when stock is zero', () => {
  assert.equal(stockLabel(0), 'Stock 0')
})

test('repriceCartFromCatalog updates each line with the selected customer prices', () => {
  const repriced = repriceCartFromCatalog([
    {
      product_id: 10,
      name: 'Hielo 5kg',
      qty: 2,
      price_unit: 85,
      stock: 10,
    },
    {
      product_id: 11,
      name: 'Molido chico',
      qty: 1,
      price_unit: 90,
      stock: 4,
    },
  ], [
    { id: 10, price: 70, stock: 8 },
    { id: 11, price: 120, stock: 3 },
  ])

  assert.deepEqual(repriced, [
    {
      product_id: 10,
      name: 'Hielo 5kg',
      qty: 2,
      price_unit: 70,
      stock: 8,
    },
    {
      product_id: 11,
      name: 'Molido chico',
      qty: 1,
      price_unit: 120,
      stock: 3,
    },
  ])
})

test('repriceCartFromCatalog uses price_unit from the selected customer catalog', () => {
  const repriced = repriceCartFromCatalog([
    {
      product_id: 10,
      name: 'Hielo 5kg',
      qty: 2,
      price_unit: 85,
      stock: 10,
    },
  ], [
    { id: 10, price_unit: 70, list_price: 85, stock: 8 },
  ])

  assert.equal(repriced[0].price_unit, 70)
})

test('repriceCartFromCatalog keeps the old line values when the product is missing from the new catalog', () => {
  const repriced = repriceCartFromCatalog([
    {
      product_id: 10,
      name: 'Hielo 5kg',
      qty: 2,
      price_unit: 85,
      stock: 10,
    },
  ], [])

  assert.deepEqual(repriced, [
    {
      product_id: 10,
      name: 'Hielo 5kg',
      qty: 2,
      price_unit: 85,
      stock: 10,
    },
  ])
})
