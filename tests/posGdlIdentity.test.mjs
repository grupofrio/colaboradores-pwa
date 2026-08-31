import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ADMIN_POS_FLOW,
  DAY_POS_FLOW,
  NIGHT_POS_FLOW,
  emptyPosCustomer,
  posClientIdentityKey,
  requiresCanonicalPosOperate,
} from '../src/modules/admin/posFlow.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

test('admin POS starts without a public-customer placeholder', () => {
  assert.deepEqual(emptyPosCustomer(ADMIN_POS_FLOW), { id: null, name: '' })
  assert.equal(emptyPosCustomer(DAY_POS_FLOW).name, 'VENTA PUBLICO IGUALA')
  assert.equal(emptyPosCustomer(NIGHT_POS_FLOW).name, 'VENTA PUBLICO')
})

test('738→694 or Iguala→GDL changes the admin POS identity key', () => {
  const iguala738 = posClientIdentityKey({
    flow: ADMIN_POS_FLOW,
    sessionIdentity: 'v2.1:s738:738:89:34:931:almacenista_entregas',
    companyId: 34,
    warehouseId: 89,
  })
  const gdl694 = posClientIdentityKey({
    flow: ADMIN_POS_FLOW,
    sessionIdentity: 'v2.1:s694:694:94:34:818:almacenista_entregas',
    companyId: 34,
    warehouseId: 94,
  })
  assert.notEqual(iguala738, gdl694)
  assert.match(gdl694, /^admin-pos\|/)
  assert.equal(
    posClientIdentityKey({ flow: DAY_POS_FLOW, companyId: 34, warehouseId: 89 }),
    posClientIdentityKey({
      flow: DAY_POS_FLOW,
      sessionIdentity: 'changed',
      companyId: 34,
      warehouseId: 89,
    }),
  )
})

test('ScreenPOS and AdminPosForm reset catalog, customer, cart and late requests on identity change', () => {
  const mobile = src('../src/modules/admin/ScreenPOS.jsx')
  const desktop = src('../src/modules/admin/forms/AdminPosForm.jsx')
  for (const slice of [mobile, desktop]) {
    assert.match(slice, /posClientIdentityKey\(/)
    assert.match(slice, /emptyPosCustomer\(flow\)/)
    assert.match(slice, /catalogRequestSeq\.current \+= 1/)
    assert.match(slice, /defaultCustomerRequestSeq\.current \+= 1/)
    assert.match(slice, /setProducts\(\[\]\)/)
    assert.match(slice, /setPricelist\(\{ id: null, name: '' \}\)/)
    assert.match(slice, /setCatalogLocationName\(''\)/)
    assert.match(slice, /setCart\(\[\]\)/)
    assert.doesNotMatch(slice, /setCustomer\(\{ id: null, name: defaultCustomerName \}\)/)
    assert.match(slice, /requiresCanonicalPosOperate\(flow\) \? '' : defaultCustomerName/)
    assert.match(slice, /identityKey/)
  }
})

test('service worker stays self-destroying so a previous POS cache cannot keep Iguala', () => {
  const vite = src('../vite.config.js')
  assert.match(vite, /selfDestroying:\s*true/)
  assert.equal(requiresCanonicalPosOperate(ADMIN_POS_FLOW), true)
})

test('preview/staging PWA cannot keep a silent production Odoo rewrite', () => {
  const vercel = src('../vercel.json')
  assert.doesNotMatch(vercel, /grupofrio-gf\.odoo\.com/)
  assert.match(src('../src/App.jsx'), /StagingEnvironmentBanner/)
})
