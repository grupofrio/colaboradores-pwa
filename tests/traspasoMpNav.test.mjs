import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { isTraspasoMpNavigationVisible } from '../src/lib/navModel.js'
import { adminRouteAllows } from '../src/modules/admin/adminRouteAccess.js'
import { NAV_ITEMS } from '../src/modules/admin/adminNavItems.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const AUX = { role: 'auxiliar_admin', employee_id: 694 }
const ROUTE = '/admin/traspaso-materia-prima'
const NAV_ID = 'traspaso-mp'

function menuShowsTraspaso(roles, capabilities) {
  return NAV_ITEMS.some((item) => (
    item.id === NAV_ID
    && item.roles.some((role) => roles.includes(role))
    && isTraspasoMpNavigationVisible(capabilities)
  ))
}

test('sin capabilities cargadas: menú, hub y deep-link coinciden en oculto', () => {
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

test('traspasoMp=false y traspasoMp=true dan la misma respuesta en menú y deep-link', () => {
  assert.equal(isTraspasoMpNavigationVisible({ traspasoMp: false }), false)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], {
    session: AUX,
    capabilities: { traspasoMp: false },
  }), false)
  assert.equal(menuShowsTraspaso(['auxiliar_admin'], { traspasoMp: false }), false)

  assert.equal(isTraspasoMpNavigationVisible({ traspasoMp: true }), true)
  assert.equal(adminRouteAllows(ROUTE, ['auxiliar_admin'], {
    session: AUX,
    capabilities: { traspasoMp: true },
  }), true)
  assert.equal(menuShowsTraspaso(['auxiliar_admin'], { traspasoMp: true }), true)
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
