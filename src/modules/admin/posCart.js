export function getDisplayStock(product) {
  return Number(product?.stock ?? product?.qty_available ?? 0)
}

export function getProductPrice(product) {
  return Number(
    product?.price_unit
    ?? product?.price
    ?? product?.list_price
    ?? product?.lst_price
    ?? 0,
  )
}

export function nextCartQtyWouldExceedStock(cart = [], product = {}, extraQty = 1) {
  const stock = getDisplayStock(product)
  const existing = cart.find((item) => item.product_id === product.id)
  const nextQty = (existing?.qty || 0) + extraQty
  return stock <= 0 || nextQty > stock
}

export function addProductToCart(cart = [], product = {}, options = {}) {
  const stock = getDisplayStock(product)
  const existing = cart.find((item) => item.product_id === product.id)
  const nextQty = (existing?.qty || 0) + 1
  if (options.enforceAvailableStock && (stock <= 0 || nextQty > stock)) {
    return cart
  }

  if (existing) {
    return cart.map((item) =>
      item.product_id === product.id
        ? { ...item, qty: item.qty + 1 }
        : item,
    )
  }

  return [
    ...cart,
    {
      product_id: product.id,
      name: product.name,
      qty: 1,
      price_unit: getProductPrice(product),
      stock,
    },
  ]
}

export function repriceCartFromCatalog(cart = [], products = []) {
  const productMap = new Map(
    (Array.isArray(products) ? products : []).map((product) => [product?.id, product]),
  )

  return cart.map((item) => {
    const updated = productMap.get(item.product_id)
    if (!updated) return item
    return {
      ...item,
      price_unit: getProductPrice(updated),
      stock: getDisplayStock(updated),
    }
  })
}

export function changeCartItemQty(cart = [], productId, delta, options = {}) {
  return cart
    .map((item) => {
      if (item.product_id !== productId) return item
      const qty = item.qty + delta
      if (qty <= 0) return null
      if (options.enforceAvailableStock && qty > Number(item.stock || 0)) {
        return item
      }
      return { ...item, qty }
    })
    .filter(Boolean)
}

export function stockLabel(stock) {
  return `Stock ${Number(stock || 0)}`
}
