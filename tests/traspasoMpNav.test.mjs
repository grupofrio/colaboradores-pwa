import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { isTraspasoMpNavigationVisible } from '../src/lib/navModel.js'
import { adminRouteAllows } from '../src/modules/admin/adminRouteAccess.js'
import { NAV_ITEMS } from '../src/modules/admin/adminNavItems.js'
import { CONTRACT_VERSION, emptyCatalog } from '../src/lib/capabilityContract.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const AUX = { role: 'auxiliar_admin', employee_id: 694 }
const ROUTE = '/admin/traspaso-materia-prima'
const NAV_ID = 'traspaso-mp'

function contract(overrides = {}) {
  return {
    contract_version: CONTRACT_VERSION,
    capabilities: { ...emptyCatalog('not_granted'), ...overrides },
    published_scope: { company_id: 34, warehouse_id: 89 },
  }
}

function allowedIssue() {
  return {
    allowed: true,
    mode: 'confirm',
    scopes: { company_ids: [34], plaza_ids: [1], warehouse_ids: [89], analytic_ids: [] },
    limit: null,
    currency: null,
    deny: null,
  }
}

function menuShowsTraspaso(roles, capabilities) {
  return NAV_ITEMS.some((item) => (
    item.id === NAV_ID
    && item.roles.some((role) => roles.includes(role))
    && isTraspasoMpNavigationVisible(capabilities)
  ))
}

test('sin contrato v2: menú, hub y deep-link coinciden en oculto', () => {
  const caps = {}
  assert.equal(isTraspasoMpNavigationVisible(caps), false)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], { session: AUX, capabilities: caps }), false)
  assert.equal(menuShowsTraspaso(['auxiliar_admin'], caps), false)

  const hub = src('../src/modules/admin/ScreenAdminPanel.jsx')
  const shell = src('../src/modules/admin/components/AdminShell.jsx')
  const access = src('../src/modules/admin/adminRouteAccess.js')
  assert.match(hub, /capsReady && isTraspasoMpNavigationVisible\(BACKEND_CAPS\)/)
  assert.match(shell, /navItemsForRoles/)
  assert.match(access, /item\.id !== 'traspaso-mp' \|\| isTraspasoMpNavigationVisible\(capabilities\)/)
  assert.match(access, /policy\.navId === 'traspaso-mp' && !isTraspasoMpNavigationVisible\(capabilities\)/)
})

test('flag plano traspasoMp no abre el módulo; solo materials.issue.iguala', () => {
  assert.equal(isTraspasoMpNavigationVisible({ traspasoMp: true }), false)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], {
    session: AUX,
    capabilities: { traspasoMp: true },
  }), false)

  const off = contract()
  assert.equal(isTraspasoMpNavigationVisible(off), false)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], { session: AUX, capabilities: off }), false)

  const on = contract({ 'materials.issue.iguala': allowedIssue() })
  assert.equal(isTraspasoMpNavigationVisible(on), true)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], { session: AUX, capabilities: on }), true)
  assert.equal(menuShowsTraspaso(['auxiliar_admin'], on), true)
})

test('capacidad heredada o proto no abre Traspaso MP', () => {
  const proto = Object.create({ traspasoMp: true })
  assert.equal(isTraspasoMpNavigationVisible(proto), false)
  assert.equal(isTraspasoMpNavigationVisible({ traspasoMp: 'true' }), false)
})

test('la pantalla no envía issued_by ni cae a warehouse 76', () => {
  const screen = src('../src/modules/admin/ScreenTraspasoMateriaPrima.jsx')
  const service = src('../src/modules/almacen-pt/materialsService.js')
  assert.doesNotMatch(screen, /issuedBy|issued_by/)
  assert.doesNotMatch(screen, /\b76\b/)
  assert.match(screen, /data-origin="traspaso-mp-unavailable"/)
  const transfer = service.slice(
    service.indexOf('export async function traspasoMpIgualaTransfer'),
    service.indexOf('export async function getDispatchConfig'),
  )
  assert.doesNotMatch(transfer, /issued_by/)
})
