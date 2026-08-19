import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ADMIN_NAV_ACCESS,
  filterAdminNavForGerentePilot,
  isGerentePilotReadOnly,
  isGerenteSucursalPilotSession,
} from '../src/modules/admin/gerentePilotCaps.js'
import { isGerenteBrandSurface } from '../src/theme/gerenteBrandSurface.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shellSrc = readFileSync(join(root, 'src/modules/admin/components/AdminShell.jsx'), 'utf8')

/** Minimal NAV_ITEMS mirror for unit tests (keeps JSX out of node:test). */
const NAV_FIXTURE = [
  { id: 'hub', access: ADMIN_NAV_ACCESS.READ, status: 'live' },
  { id: 'gastos', access: ADMIN_NAV_ACCESS.MIXED, status: 'live' },
  { id: 'gastos-aprobar', access: ADMIN_NAV_ACCESS.WRITE, status: 'live' },
  { id: 'traspaso-mp', access: ADMIN_NAV_ACCESS.WRITE, status: 'live' },
  { id: 'mp', access: ADMIN_NAV_ACCESS.READ, status: 'live' },
]

test('AdminShell NAV_ITEMS declare access mode for every entry', () => {
  const ids = [...shellSrc.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  assert.ok(ids.includes('gastos-aprobar'))
  assert.ok(ids.includes('hub'))
  for (const id of ids) {
    const blockStart = shellSrc.indexOf(`id: '${id}'`)
    const slice = shellSrc.slice(blockStart, blockStart + 280)
    assert.match(slice, /access:\s*ADMIN_NAV_ACCESS\.(READ|WRITE|MIXED)/, `${id} missing access`)
  }
  assert.match(shellSrc, /id: 'gastos-aprobar'[\s\S]{0,200}access: ADMIN_NAV_ACCESS\.WRITE/)
  assert.match(shellSrc, /id: 'hub'[\s\S]{0,200}access: ADMIN_NAV_ACCESS\.READ/)
})

test('piloto Gerente read-only hides write invitations and locks mixed', () => {
  const session = { role: 'gerente_sucursal', additional_job_keys: [] }
  assert.equal(isGerenteSucursalPilotSession(session), true)
  assert.equal(isGerentePilotReadOnly(session, { gerenteWritesEnabled: false }), true)

  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, session, { gerenteWritesEnabled: false })
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'), 'Aprobar gastos oculto')
  assert.ok(!filtered.some((i) => i.id === 'traspaso-mp'), 'Traspaso MP write oculto')
  const mixed = filtered.find((i) => i.id === 'gastos')
  assert.equal(mixed.status, 'pending_backend')
  assert.match(mixed.lockedReason, /solo lectura/i)
})

test('piloto Gerente with writes ON keeps full nav', () => {
  const session = { role: 'gerente_sucursal', additional_job_keys: [] }
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, session, { gerenteWritesEnabled: true })
  assert.ok(filtered.some((i) => i.id === 'gastos-aprobar'))
  assert.equal(isGerentePilotReadOnly(session, { gerenteWritesEnabled: true }), false)
})

test('auxiliar dual-role is not treated as Gerente pilot read-only', () => {
  const session = { role: 'gerente_sucursal', additional_job_keys: ['auxiliar_admin'] }
  assert.equal(isGerenteSucursalPilotSession(session), false)
  assert.equal(isGerentePilotReadOnly(session, { gerenteWritesEnabled: false }), false)
})

test('Gerente brand surface covers gerente_sucursal without flipping other roles', () => {
  assert.equal(isGerenteBrandSurface({ role: 'gerente_sucursal' }), true)
  assert.equal(isGerenteBrandSurface({ role: 'supervisor_ventas' }), true)
  assert.equal(isGerenteBrandSurface({ role: 'supervisor_produccion' }), false)
  assert.equal(isGerenteBrandSurface({ role: 'auxiliar_admin' }), false)
})

test('AdminShell and BriefEmbed use Gerente brand surface helper', () => {
  const brief = readFileSync(join(root, 'src/modules/brief/BriefEmbedScreen.jsx'), 'utf8')
  const tab = readFileSync(join(root, 'src/modules/gerente/v2/tabs/AdminGerenteTab.jsx'), 'utf8')
  assert.match(shellSrc, /isGerenteBrandSurface/)
  assert.match(shellSrc, /filterAdminNavForGerentePilot/)
  assert.match(shellSrc, /BRAND_TOKENS/)
  assert.match(shellSrc, /DARK_TOKENS/)
  assert.match(brief, /isGerenteBrandSurface/)
  assert.match(tab, /isGerentePilotReadOnly/)
  assert.match(tab, /solo lectura/i)
})
