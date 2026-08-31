import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ADMIN_NAV_ACCESS,
  clampGerentePilotWriteCapabilities,
  filterAdminNavForGerentePilot,
  isGerentePilotReadOnly,
  isGerenteSucursalPilotSession,
  resolveGerentePilotCapabilities,
} from '../src/modules/admin/gerentePilotCaps.js'
import { isGerenteBrandSurface } from '../src/theme/gerenteBrandSurface.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adminServiceSrc = readFileSync(join(root, 'src/modules/admin/adminService.js'), 'utf8')
const shellSrc = readFileSync(join(root, 'src/modules/admin/components/AdminShell.jsx'), 'utf8')
const navItemsSrc = readFileSync(join(root, 'src/modules/admin/adminNavItems.js'), 'utf8')
const tabSrc = readFileSync(join(root, 'src/modules/gerente/v2/tabs/AdminGerenteTab.jsx'), 'utf8')
const launcherSrc = readFileSync(join(root, 'src/modules/gerente/v2/adminGerenteLauncher.js'), 'utf8')
const routeAccessSrc = readFileSync(join(root, 'src/modules/admin/adminRouteAccess.js'), 'utf8')

/** Minimal NAV_ITEMS mirror for unit tests (keeps JSX out of node:test). */
const NAV_FIXTURE = [
  { id: 'hub', access: ADMIN_NAV_ACCESS.READ, status: 'live' },
  { id: 'gastos', access: ADMIN_NAV_ACCESS.MIXED, status: 'live' },
  { id: 'gastos-aprobar', access: ADMIN_NAV_ACCESS.WRITE, status: 'live' },
  { id: 'traspaso-mp', access: ADMIN_NAV_ACCESS.WRITE, status: 'live' },
  { id: 'mp', access: ADMIN_NAV_ACCESS.READ, status: 'live' },
]

const GERENTE_SESSION = { role: 'gerente_sucursal', additional_job_keys: [] }

function applyGerenteCaps(upstream, session = GERENTE_SESSION) {
  return clampGerentePilotWriteCapabilities(session, upstream)
}

test('BACKEND_CAPS default includes gerenteWritesEnabled=false (fail-closed)', () => {
  assert.match(adminServiceSrc, /gerenteWritesEnabled:\s*false/)
})

test('applyCapabilities boot/error paths fail-closed for Gerente writes', () => {
  assert.match(adminServiceSrc, /applyCapabilities\(\{ gerenteWritesEnabled: false \}/)
  assert.match(adminServiceSrc, /clampGerentePilotWriteCapabilities/)
})

test('applyCapabilities persists gerenteWritesEnabled from backend', () => {
  const off = applyGerenteCaps({ gerenteWritesEnabled: false, cashClosingWrite: true })
  assert.equal(off.gerenteWritesEnabled, false)
  assert.equal(off.cashClosingWrite, false)

  const on = applyGerenteCaps({ gerenteWritesEnabled: true, cashClosingWrite: true })
  assert.equal(on.gerenteWritesEnabled, true)
  assert.equal(on.cashClosingWrite, true)
})

test('AdminShell NAV_ITEMS declare access mode for every entry', () => {
  // CLEAN-02: NAV_ITEMS lives in adminNavItems.js (shared with AdminSubRoute).
  assert.match(shellSrc, /from '\.\.\/adminNavItems/)
  const ids = [...navItemsSrc.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  assert.ok(ids.includes('gastos-aprobar'))
  assert.ok(ids.includes('hub'))
  for (const id of ids) {
    const blockStart = navItemsSrc.indexOf(`id: '${id}'`)
    const slice = navItemsSrc.slice(blockStart, blockStart + 280)
    assert.match(slice, /access:\s*ADMIN_NAV_ACCESS\.(READ|WRITE|MIXED)/, `${id} missing access`)
  }
})

test('Caso A — capabilities loading: Gerente has no write nav', () => {
  const caps = resolveGerentePilotCapabilities(
    GERENTE_SESSION,
    { gerenteWritesEnabled: false, cashClosingWrite: true },
    false,
  )
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, GERENTE_SESSION, caps)
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'))
  assert.ok(!filtered.some((i) => i.id === 'traspaso-mp'))
  assert.equal(isGerentePilotReadOnly(GERENTE_SESSION, caps), true)
})

test('Caso B — capabilities HTTP error: fail-closed caps for Gerente', () => {
  const caps = applyGerenteCaps({ gerenteWritesEnabled: false, cashClosingWrite: true, saleCancel: true })
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, GERENTE_SESSION, caps)
  assert.equal(caps.gerenteWritesEnabled, false)
  assert.equal(caps.cashClosingWrite, false)
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'))
})

test('Caso C — capabilities success gerenteWritesEnabled=false: no write nav', () => {
  const caps = resolveGerentePilotCapabilities(
    GERENTE_SESSION,
    applyGerenteCaps({ gerenteWritesEnabled: false, cashClosingWrite: true }),
    true,
  )
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, GERENTE_SESSION, caps)
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'))
  assert.equal(isGerentePilotReadOnly(GERENTE_SESSION, caps), true)
})

test('Caso D — capabilities success gerenteWritesEnabled=true: write nav visible', () => {
  const caps = resolveGerentePilotCapabilities(
    GERENTE_SESSION,
    applyGerenteCaps({ gerenteWritesEnabled: true, cashClosingWrite: true }),
    true,
  )
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, GERENTE_SESSION, caps)
  assert.ok(filtered.some((i) => i.id === 'gastos-aprobar'))
  assert.equal(isGerentePilotReadOnly(GERENTE_SESSION, caps), false)
})

test('Caso E — híbrido gerente+auxiliar: fail-closed (unión de roles no escapa RO)', () => {
  const session = {
    employee_id: 717,
    session_token: 'h.p.s',
    role: 'gerente_sucursal',
    additional_job_keys: ['auxiliar_admin'],
  }
  // Brand/pure pilot marker still false for dual-role primary semantics.
  assert.equal(isGerenteSucursalPilotSession(session), false)
  // Write clamp follows backend: any gerente authority is RO when writes OFF.
  assert.equal(isGerentePilotReadOnly(session, { gerenteWritesEnabled: false }), true)
  const caps = resolveGerentePilotCapabilities(session, { gerenteWritesEnabled: false }, false)
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, session, caps)
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'))
})

test('MIXED modules stay navigable read-only in AdminShell and AdminGerenteTab', () => {
  const filtered = filterAdminNavForGerentePilot(NAV_FIXTURE, GERENTE_SESSION, { gerenteWritesEnabled: false })
  const mixed = filtered.find((i) => i.id === 'gastos')
  assert.equal(mixed.status, 'live')
  assert.equal(mixed.readOnlyPilot, true)
  assert.match(mixed.lockedReason, /solo lectura/i)
  assert.ok(!filtered.some((i) => i.id === 'gastos-aprobar'))
  assert.ok(filtered.some((i) => i.id === 'mp'))
})

test('AdminShell and AdminGerenteTab share resolveGerentePilotCapabilities + filterAdminNavForGerentePilot', () => {
  assert.match(shellSrc, /resolveGerentePilotCapabilities/)
  assert.match(shellSrc, /filterAdminNavForGerentePilot/)
  assert.match(tabSrc, /resolveGerentePilotCapabilities/)
  assert.match(tabSrc, /buildGerenteAdminLauncherItems/)
  assert.match(tabSrc, /bootCapabilities/)
  assert.match(launcherSrc, /NAV_ITEMS/)
  assert.match(launcherSrc, /filterAdminNavForGerentePilot/)
  assert.match(routeAccessSrc, /isGerentePilotReadOnly/)
  assert.match(routeAccessSrc, /ADMIN_NAV_ACCESS\.WRITE/)
})

test('Gerente brand surface covers gerente_sucursal without flipping other roles', () => {
  assert.equal(isGerenteBrandSurface({ role: 'gerente_sucursal' }), true)
  assert.equal(isGerenteBrandSurface({ role: 'auxiliar_admin' }), false)
})
