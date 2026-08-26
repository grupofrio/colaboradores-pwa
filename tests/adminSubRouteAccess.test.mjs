// CLEAN-02 — AdminSubRoute + identity + Metabase honesty.
//
// Deep-link security must match the menu: roles from NAV_ITEMS, access from
// CLEAN-01, Gerente RO when gerente_writes=0, capabilities (cash-shift).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  adminRouteAllows,
  adminRoutePolicy,
  ADMIN_ROUTE_ROLES,
} from '../src/modules/admin/adminRouteAccess.js'
import { NAV_ITEMS } from '../src/modules/admin/adminNavItems.js'
import {
  ADMIN_NAV_ACCESS,
  resolveGerentePilotCapabilities,
} from '../src/modules/admin/gerentePilotCaps.js'
import { IDENTITY_GATE_IDS } from '../src/modules/admin/identityGates.js'
import {
  canAccessNightPos,
  hasHectorTapiaIdentity,
} from '../src/modules/admin/nightPosAccess.js'
import {
  isPosBreakdownSession,
  isAngelicaJaimesSession,
} from '../src/modules/admin/angyPosSalesBreakdown.js'
import { buildGerenteAdminLauncherItems } from '../src/modules/gerente/v2/adminGerenteLauncher.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const appSource = src('../src/App.jsx')

const GERENTE_RO = {
  role: 'gerente_sucursal',
  employee_id: 717,
  additional_job_keys: [],
}
const CAPS_WRITES_OFF = { gerenteWritesEnabled: false, cashShiftRead: true }
const CAPS_WRITES_ON = { gerenteWritesEnabled: true, cashShiftRead: true, cashShiftManage: true }

const RESTRINGIDAS = ['/admin/gastos/aprobar', '/admin/liquidaciones', '/admin/materia-prima']
const COMPARTIDAS = ['/admin', '/admin/pos', '/admin/gastos', '/admin/requisiciones']
const WRITE_ROUTES = NAV_ITEMS.filter((i) => i.access === ADMIN_NAV_ACCESS.WRITE).map((i) => i.route)

// ── AdminSubRoute / deep-link ────────────────────────────────────────────────

test('ruta visible permitida → PASS (roles compartidos)', () => {
  for (const route of COMPARTIDAS) {
    assert.equal(
      adminRouteAllows(route, ['gerente_sucursal'], { session: GERENTE_RO, capabilities: CAPS_WRITES_OFF }),
      true,
      route,
    )
  }
})

test('ruta WRITE con gerente_writes=0 → DENIED (piloto RO)', () => {
  assert.ok(WRITE_ROUTES.includes('/admin/gastos/aprobar'))
  for (const route of WRITE_ROUTES) {
    assert.equal(
      adminRouteAllows(route, ['gerente_sucursal'], { session: GERENTE_RO, capabilities: CAPS_WRITES_OFF }),
      false,
      `RO must deny ${route}`,
    )
  }
  // Nested write extras (not in menu) also denied
  for (const route of ['/admin/bolsas/validar', '/admin/materiales/validar', '/admin/materiales/resolver-rechazo']) {
    assert.equal(
      adminRouteAllows(route, ['gerente_sucursal'], { session: GERENTE_RO, capabilities: CAPS_WRITES_OFF }),
      false,
      route,
    )
  }
})

test('ruta WRITE con gerente_writes=1 → PASS for gerente', () => {
  assert.equal(
    adminRouteAllows('/admin/gastos/aprobar', ['gerente_sucursal'], {
      session: GERENTE_RO,
      capabilities: CAPS_WRITES_ON,
    }),
    true,
  )
})

test('ruta inexistente → DENIED', () => {
  assert.equal(adminRouteAllows('/admin/ruta-que-no-existe', ['direccion_general']), false)
  assert.equal(adminRouteAllows('/admin/no-policy', ['gerente_sucursal'], {
    session: GERENTE_RO,
    capabilities: CAPS_WRITES_OFF,
  }), false)
})

test('deep-link manual a módulo no permitido (auxiliar) → DENIED', () => {
  for (const route of RESTRINGIDAS) {
    assert.equal(adminRouteAllows(route, ['auxiliar_admin']), false, route)
  }
})

test('nested admin routes: ticket MIXED allowed under RO; write extras denied', () => {
  assert.equal(
    adminRouteAllows('/admin/ticket', ['gerente_sucursal'], {
      session: GERENTE_RO,
      capabilities: CAPS_WRITES_OFF,
    }),
    true,
  )
  assert.equal(adminRoutePolicy('/admin/ticket')?.access, ADMIN_NAV_ACCESS.MIXED)
  assert.equal(adminRoutePolicy('/admin/materiales/validar')?.access, ADMIN_NAV_ACCESS.WRITE)
})

test('traspaso-mp: sin capability → DENIED; con traspasoMp → PASS (menú ≡ deep-link)', () => {
  const aux = { role: 'auxiliar_admin', employee_id: 694 }
  const route = '/admin/traspaso-materia-prima'
  assert.equal(
    adminRouteAllows(route, ['auxiliar_admin'], { session: aux, capabilities: {} }),
    false,
    'caps vacías / no cargadas fallan cerrado',
  )
  assert.equal(
    adminRouteAllows(route, ['auxiliar_admin'], { session: aux, capabilities: { traspasoMp: false } }),
    false,
  )
  assert.equal(
    adminRouteAllows(route, ['auxiliar_admin'], { session: aux, capabilities: { traspasoMp: true } }),
    true,
  )
})

test('cierre respeta capability cash-shift (parity AdminShell)', () => {
  // cashShiftRead alone is NOT enough — navModel requires manage|authorize.
  assert.equal(
    adminRouteAllows('/admin/cierre', ['auxiliar_admin'], {
      session: { role: 'auxiliar_admin', employee_id: 1 },
      capabilities: { cashShiftRead: true },
    }),
    false,
  )
  assert.equal(
    adminRouteAllows('/admin/cierre', ['auxiliar_admin'], {
      session: { role: 'auxiliar_admin', employee_id: 1 },
      capabilities: { cashShiftManage: true },
    }),
    true,
  )
  // AdminSubRoute passes resolveGerentePilotCapabilities() — RO clamps manage.
  const clamped = resolveGerentePilotCapabilities(
    GERENTE_RO,
    { gerenteWritesEnabled: false, cashShiftManage: true },
    true,
  )
  assert.equal(clamped.cashShiftManage, false)
  assert.equal(
    adminRouteAllows('/admin/cierre', ['gerente_sucursal'], {
      session: GERENTE_RO,
      capabilities: clamped,
    }),
    false,
  )
})

test('fail-closed: sin roles / rol desconocido / null', () => {
  assert.equal(adminRouteAllows('/admin/liquidaciones', []), false)
  assert.equal(adminRouteAllows('/admin/liquidaciones', ['jefe_ruta']), false)
  assert.equal(adminRouteAllows('/admin/liquidaciones', null), false)
  assert.equal(adminRouteAllows('', ['direccion_general']), false)
})

test('política de roles sale de NAV_ITEMS (sin lista paralela)', () => {
  for (const item of NAV_ITEMS) {
    assert.deepEqual([...(ADMIN_ROUTE_ROLES[item.route] || [])], [...item.roles], item.route)
    assert.equal(adminRoutePolicy(item.route)?.access, item.access, item.route)
  }
})

test('toda subruta de /admin en App.jsx pasa por AdminSubRoute con session+caps', () => {
  const adminBlock = appSource.slice(
    appSource.indexOf('<Route path="/admin"'),
    appSource.indexOf('{/* ── Almacenista Entregas'),
  )
  const rutas = [...adminBlock.matchAll(/^\s*<Route (path="[^"]*"|index) element=\{(.*?)\}\s*\/>\s*$/gm)]
  assert.ok(rutas.length >= 15, `se esperaban las subrutas de /admin, hubo ${rutas.length}`)
  for (const [, ruta, element] of rutas) {
    assert.match(element, /^<AdminSubRoute path="\/admin/, `${ruta} sin AdminSubRoute`)
  }
  const guard = appSource.slice(
    appSource.indexOf('function AdminSubRoute('),
    appSource.indexOf('function ModuleRoleRoute('),
  )
  assert.match(guard, /isValidAuthenticatedSession/)
  assert.match(guard, /resolveGerentePilotCapabilities/)
  assert.match(guard, /adminRouteAllows\(path, getEffectiveJobKeys\(session\),/)
  assert.match(guard, /<Navigate to="\/admin" replace \/>/)
})

// ── AdminGerenteTab ↔ AdminShell parity ──────────────────────────────────────

test('AdminGerenteTab launcher usa NAV_ITEMS + mismo filtro RO (no deep-link huérfano)', () => {
  const items = buildGerenteAdminLauncherItems(GERENTE_RO, CAPS_WRITES_OFF)
  const routes = items.map((i) => i.route)
  assert.ok(routes.includes('/admin'))
  assert.ok(routes.includes('/admin/gastos'))
  assert.ok(!routes.includes('/admin/gastos/aprobar'), 'WRITE aprobar must be absent under RO')
  assert.ok(!routes.includes('/admin/traspaso-materia-prima'), 'WRITE traspaso not in launcher / filtered')
  for (const item of items) {
    assert.equal(
      adminRouteAllows(item.route, ['gerente_sucursal'], {
        session: GERENTE_RO,
        capabilities: CAPS_WRITES_OFF,
      }),
      true,
      `launcher tile ${item.route} must pass AdminSubRoute`,
    )
  }
})

// ── Identity gates ───────────────────────────────────────────────────────────

test('mismo nombre / otro id → DENIED (Night POS + POS breakdown)', () => {
  const hectorName = { name: 'Héctor Tapia', session_token: 't', employee_id: 99999, role: 'almacenista_entregas' }
  assert.equal(canAccessNightPos(hectorName), false)
  assert.equal(hasHectorTapiaIdentity(hectorName), false)

  const angelicaName = { name: 'Angélica Jaimes Domínguez', employee_id: 99999 }
  assert.equal(isPosBreakdownSession(angelicaName), false)
  assert.equal(isAngelicaJaimesSession(angelicaName), false)
})

test('id correcto / nombre cambiado → PASS', () => {
  assert.equal(canAccessNightPos({
    employee_id: IDENTITY_GATE_IDS.nightPos[0],
    session_token: 't',
    role: 'almacenista_entregas',
    name: 'Nombre Cambiado Totalmente',
  }), true)
  assert.equal(isPosBreakdownSession({
    employee_id: IDENTITY_GATE_IDS.posBreakdown[0],
    name: 'Otro Nombre',
  }), true)
})

test('employee_id null / missing → DENIED (fail-closed)', () => {
  assert.equal(canAccessNightPos({ session_token: 't', role: 'almacenista_entregas', name: 'Héctor Tapia' }), false)
  assert.equal(isPosBreakdownSession({ name: 'Angélica Jaimes' }), false)
  assert.equal(isPosBreakdownSession({ employee_id: null }), false)
  assert.equal(isPosBreakdownSession({ employee_id: 0 }), false)
  assert.equal(isPosBreakdownSession({}), false)
})

test('api.js POS Angelica scope ya no matchea por nombre', () => {
  const api = src('../src/lib/api.js')
  assert.match(api, /isPosBreakdownEmployee/)
  assert.doesNotMatch(api, /ANGELICA_JAIMES_NAME_PARTS/)
  assert.doesNotMatch(api, /angelica',\s*'jaimes/)
})

// ── Metabase legacy ──────────────────────────────────────────────────────────

test('Metabase CTA absent from Gerente hubs; legacy dashboard route is honesty-safe', () => {
  const legacyHub = src('../src/modules/gerente/ScreenGerente.jsx')
  assert.doesNotMatch(legacyHub, /id: 'dashboard'/)
  assert.doesNotMatch(legacyHub, /route: '\/gerente\/dashboard'/)

  const mas = src('../src/modules/gerente/v2/tabs/MasGerenteTab.jsx')
  assert.doesNotMatch(mas, /\/gerente\/dashboard/)
  assert.doesNotMatch(mas, /VITE_METABASE/)

  const hoy = src('../src/modules/gerente/v2/tabs/HoyGerenteTab.jsx')
  assert.doesNotMatch(hoy, /metabase|Metabase|VITE_METABASE/i)

  const dash = src('../src/modules/gerente/ScreenDashboardGerente.jsx')
  const dashCode = dash.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(dashCode, /<iframe/)
  assert.doesNotMatch(dashCode, /VITE_METABASE_URL|metabaseUrl/)
  assert.match(dash, /Dashboard en preparación|sin filtro de sucursal|todas las sucursales/i)

  assert.match(appSource, /path="\/gerente\/dashboard"/)
})
