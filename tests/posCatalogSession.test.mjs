import test from 'node:test'
import assert from 'node:assert/strict'

import { CONTRACT_VERSION } from '../src/lib/capabilityContract.js'
import {
  POS_CATALOG_UNAVAILABLE_COPY,
  nextPosCatalogViewState,
  posCatalogEmptyCopy,
  posCatalogValidityKey,
  shouldIgnoreLatePosCatalogResponse,
} from '../src/modules/admin/posCatalogSession.js'

test('posCatalogValidityKey changes with contract, employee, warehouse and assortment', () => {
  const base = posCatalogValidityKey({
    buildId: 'sha-new',
    identityKey: 'admin-pos|emp-a|34|94',
    warehouseId: 94,
    posScope: '',
    assortmentStamp: 'KOLD-5|KOLDCUP',
  })
  assert.match(base, new RegExp(CONTRACT_VERSION))
  assert.notEqual(
    base,
    posCatalogValidityKey({
      buildId: 'sha-old',
      identityKey: 'admin-pos|emp-a|34|94',
      warehouseId: 94,
      assortmentStamp: 'KOLD-5|KOLDCUP',
    }),
  )
  assert.notEqual(
    base,
    posCatalogValidityKey({
      buildId: 'sha-new',
      identityKey: 'admin-pos|emp-b|34|94',
      warehouseId: 94,
      assortmentStamp: 'KOLD-5|KOLDCUP',
    }),
  )
  assert.notEqual(
    base,
    posCatalogValidityKey({
      buildId: 'sha-new',
      identityKey: 'admin-pos|emp-a|34|94',
      warehouseId: 89,
      assortmentStamp: 'KOLD-5|KOLDCUP',
    }),
  )
  assert.notEqual(
    base,
    posCatalogValidityKey({
      buildId: 'sha-new',
      identityKey: 'admin-pos|emp-a|34|94',
      warehouseId: 94,
      assortmentStamp: 'STG-POS-UNIT',
    }),
  )
})

test('nextPosCatalogViewState never keeps an old catalog while loading or failing', () => {
  const loading = nextPosCatalogViewState('load-start')
  assert.deepEqual(loading.products, [])
  assert.equal(loading.status, 'loading')

  const identity = nextPosCatalogViewState('identity-change')
  assert.deepEqual(identity.products, [])
  assert.equal(identity.status, 'loading')

  const ok = nextPosCatalogViewState('load-success', {
    products: [{ id: 750, name: 'KOLD-5' }],
  })
  assert.equal(ok.status, 'ready')
  assert.equal(ok.products.length, 1)

  const failed = nextPosCatalogViewState('load-failure', {
    errorMessage: 'timeout',
  })
  assert.deepEqual(failed.products, [])
  assert.equal(failed.status, 'unavailable')
  assert.equal(failed.error, 'timeout')

  const caps = nextPosCatalogViewState('caps-unavailable')
  assert.deepEqual(caps.products, [])
  assert.equal(caps.status, 'unavailable')
  assert.equal(caps.error, POS_CATALOG_UNAVAILABLE_COPY)

  assert.equal(nextPosCatalogViewState('late-response'), null)
})

test('late catalog responses are ignored when identity or request seq changed', () => {
  assert.equal(shouldIgnoreLatePosCatalogResponse({
    requestId: 1,
    currentRequestId: 2,
    startedFor: 'a',
    currentIdentityKey: 'a',
  }), true)
  assert.equal(shouldIgnoreLatePosCatalogResponse({
    requestId: 2,
    currentRequestId: 2,
    startedFor: 'a',
    currentIdentityKey: 'b',
  }), true)
  assert.equal(shouldIgnoreLatePosCatalogResponse({
    requestId: 2,
    currentRequestId: 2,
    startedFor: 'a',
    currentIdentityKey: 'a',
  }), false)
})

test('empty catalog copy distinguishes unavailable from a real empty warehouse', () => {
  assert.equal(
    posCatalogEmptyCopy({ status: 'unavailable', productsLength: 14 }),
    POS_CATALOG_UNAVAILABLE_COPY,
  )
  assert.equal(
    posCatalogEmptyCopy({ status: 'ready', productsLength: 0 }),
    'Sin productos en este almacén',
  )
})
