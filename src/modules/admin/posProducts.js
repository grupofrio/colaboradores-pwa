import { readPosScopeOption } from './posFlow.js'

function toQuery(filters = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const search = query.toString()
  return search ? `?${search}` : ''
}

export function buildPosCatalogPath(filters = {}) {
  const posScope = readPosScopeOption(filters)
  const { warehouseId, partnerId } = filters
  return `/pwa-admin/pos-products${toQuery({
    warehouse_id: warehouseId,
    partner_id: partnerId,
    pos_scope: posScope,
  })}`
}

export function buildPosCustomerSearchPath(query, companyOrOptions, maybeOptions = {}) {
  const options = companyOrOptions && typeof companyOrOptions === 'object'
    ? companyOrOptions
    : maybeOptions
  const posScope = readPosScopeOption(options)
  return `/pwa-admin/customers${toQuery({
    q: query,
    pos_scope: posScope,
  })}`
}

function normalizeRelation(value) {
  if (Array.isArray(value)) {
    return {
      id: Number(value[0] || 0) || false,
      name: String(value[1] || '').trim(),
    }
  }
  if (value && typeof value === 'object') {
    return {
      id: Number(value.id || 0) || false,
      name: String(value.name || value.display_name || '').trim(),
    }
  }
  return {
    id: Number(value || 0) || false,
    name: '',
  }
}

export function normalizePosCatalogResponse(payload) {
  const data = payload?.data ?? payload ?? {}
  const pricelist = normalizeRelation(
    data?.pricelist_id
    || data?.pricelist
    || data?.price_list
    || data?.priceList,
  )
  return {
    pricelist_id: pricelist.id,
    pricelist_name: String(data?.pricelist_name || pricelist.name || '').trim(),
    company_id: Number(data?.company_id || 0) || null,
    warehouse_id: Number(data?.warehouse_id || 0) || null,
    stock_location_id: Number(data?.stock_location_id || 0) || null,
    stock_location_name: String(data?.stock_location_name || '').trim(),
    assortment_enforced: Boolean(data?.assortment_enforced),
    assortment_stamp: String(data?.assortment_stamp || '').trim(),
    products: normalizePosProductsResponse(payload),
  }
}

export function normalizePosProductsResponse(payload) {
  if (Array.isArray(payload)) return payload

  const data = payload?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(payload?.products)) return payload.products
  if (Array.isArray(data?.products)) return data.products

  return []
}
