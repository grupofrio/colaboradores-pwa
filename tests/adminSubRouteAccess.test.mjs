// Bloque 5 — revalidación de rol por SUBRUTA de /admin.
//
// `/admin` estaba gateado UNA sola vez, en el elemento padre, con
// `moduleId="admin_sucursal"` — cuyos roles incluyen a `auxiliar_admin`. Todas
// las subrutas colgaban de ahí, así que el filtro por rol de "Aprobar gastos",
// "Liquidaciones" y "Materia prima" vivía SOLO en el menú: un auxiliar que
// escribiera la URL a mano entraba igual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { adminRouteAllows, ADMIN_ROUTE_ROLES } from '../src/modules/admin/adminRouteAccess.js'
import { NAV_ITEMS } from '../src/modules/admin/adminNavItems.js'

const appSource = readFileSync(
  fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8',
)

const RESTRINGIDAS = ['/admin/gastos/aprobar', '/admin/liquidaciones', '/admin/materia-prima']
const COMPARTIDAS = ['/admin', '/admin/pos', '/admin/gastos', '/admin/requisiciones', '/admin/cierre']

test('un auxiliar_admin NO entra a las rutas restringidas por URL directa', () => {
  for (const route of RESTRINGIDAS) {
    assert.equal(adminRouteAllows(route, ['auxiliar_admin']), false, route)
  }
})

test('gerente y dirección sí entran a las restringidas', () => {
  for (const route of RESTRINGIDAS) {
    assert.equal(adminRouteAllows(route, ['gerente_sucursal']), true, route)
    assert.equal(adminRouteAllows(route, ['direccion_general']), true, route)
  }
})

test('las rutas compartidas siguen abiertas para los tres roles', () => {
  for (const route of COMPARTIDAS) {
    for (const role of ['auxiliar_admin', 'gerente_sucursal', 'direccion_general']) {
      assert.equal(adminRouteAllows(route, [role]), true, `${route} / ${role}`)
    }
  }
})

test('un rol adicional basta (los job keys efectivos son una lista)', () => {
  assert.equal(adminRouteAllows('/admin/liquidaciones', ['auxiliar_admin', 'gerente_sucursal']), true)
})

test('fail-closed: sin roles, rol desconocido o ruta sin política declarada', () => {
  assert.equal(adminRouteAllows('/admin/liquidaciones', []), false)
  assert.equal(adminRouteAllows('/admin/liquidaciones', ['jefe_ruta']), false)
  assert.equal(adminRouteAllows('/admin/ruta-que-no-existe', ['direccion_general']), false,
    'una subruta nueva sin política no se abre sola')
  assert.equal(adminRouteAllows('', ['direccion_general']), false)
  assert.equal(adminRouteAllows('/admin/liquidaciones', null), false)
})

test('la política NO se duplica: sale de NAV_ITEMS, la misma fuente que el menú', () => {
  // Si menú y ruta tuvieran dos listas, volverían a divergir — que es
  // exactamente como se abrió este hueco.
  for (const item of NAV_ITEMS) {
    assert.deepEqual(
      [...(ADMIN_ROUTE_ROLES[item.route] || [])],
      [...item.roles],
      item.route,
    )
  }
})

test('toda subruta de /admin en App.jsx pasa por AdminSubRoute', () => {
  const adminBlock = appSource.slice(
    appSource.indexOf('<Route path="/admin"'),
    appSource.indexOf('{/* ── Almacenista Entregas'),
  )
  // Una subruta por línea; el <Route path="/admin"> padre no es auto-cerrado y
  // por eso no entra en este match (es el que monta el gate de MÓDULO).
  const rutas = [...adminBlock.matchAll(/^\s*<Route (path="[^"]*"|index) element=\{(.*?)\}\s*\/>\s*$/gm)]
  assert.ok(rutas.length >= 15, `se esperaban las subrutas de /admin, hubo ${rutas.length}`)
  for (const [, ruta, element] of rutas) {
    assert.match(element, /^<AdminSubRoute path="\/admin/, `${ruta} sin AdminSubRoute`)
  }
})

test('AdminSubRoute revalida sesión y rol, y devuelve a /admin si no pasa', () => {
  const guard = appSource.slice(
    appSource.indexOf('function AdminSubRoute('),
    appSource.indexOf('function ModuleRoleRoute('),
  )
  assert.match(guard, /isValidAuthenticatedSession/)
  assert.match(guard, /adminRouteAllows\(path, getEffectiveJobKeys\(session\)\)/)
  assert.match(guard, /<Navigate to="\/admin" replace \/>/)
})
