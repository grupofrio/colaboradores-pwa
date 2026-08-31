import { CONTRACT_VERSION } from '../../lib/capabilityContract.js'

export const POS_CATALOG_UNAVAILABLE_COPY =
  'Catálogo no disponible. No se muestran productos de otra sesión o versión.'

export function posCatalogValidityKey({
  buildId = '',
  contractVersion = CONTRACT_VERSION,
  identityKey = '',
  warehouseId = null,
  posScope = '',
  assortmentStamp = '',
} = {}) {
  return [
    String(buildId || ''),
    String(contractVersion || ''),
    String(identityKey || ''),
    warehouseId || '',
    posScope || '',
    String(assortmentStamp || ''),
  ].join('|')
}

export function nextPosCatalogViewState(event, payload = {}) {
  switch (event) {
    case 'identity-change':
    case 'load-start':
      return {
        products: [],
        status: 'loading',
        error: '',
        validityKey: payload.validityKey || '',
      }
    case 'load-success': {
      const products = Array.isArray(payload.products) ? payload.products : []
      return {
        products,
        status: 'ready',
        error: '',
        validityKey: payload.validityKey || '',
      }
    }
    case 'caps-unavailable':
    case 'load-failure':
      return {
        products: [],
        status: 'unavailable',
        error: payload.errorMessage || POS_CATALOG_UNAVAILABLE_COPY,
        validityKey: payload.validityKey || '',
      }
    case 'late-response':
      return null
    default:
      return {
        products: [],
        status: 'unavailable',
        error: POS_CATALOG_UNAVAILABLE_COPY,
        validityKey: payload.validityKey || '',
      }
  }
}

export function posCatalogEmptyCopy({ status, productsLength = 0 } = {}) {
  if (status === 'unavailable') return POS_CATALOG_UNAVAILABLE_COPY
  if (!productsLength) return 'Sin productos en este almacén'
  return 'Sin coincidencias'
}

export function shouldIgnoreLatePosCatalogResponse({
  requestId,
  currentRequestId,
  startedFor,
  currentIdentityKey,
} = {}) {
  return requestId !== currentRequestId || startedFor !== currentIdentityKey
}
