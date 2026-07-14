import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getNavModules, buildMobileNav, buildDesktopNav,
  isNavItemActive, resolveActiveId, isNavHiddenForPath,
  HOME_ANCHOR, PROFILE_ANCHOR,
} from '../src/lib/navModel.js'

const ids = (arr) => arr.map((m) => m.id)

// ── Fuente canónica única + orden por prioridad ─────────────────────────────
test('supervisor_ventas (Aida): Equipo es prioritario y va directo; universales a Más', () => {
  const session = { role: 'supervisor_ventas' }
  const nav = getNavModules(session)
  assert.equal(nav[0].id, 'supervisor_ventas', 'Equipo primero por navPriority 10')
  assert.ok(ids(nav).includes('kpis') && ids(nav).includes('encuestas') && ids(nav).includes('logros'))

  const m = buildMobileNav(session, '/')
  assert.deepEqual(ids(m.primary), ['supervisor_ventas', 'kpis'])
  assert.deepEqual(ids(m.overflow), ['encuestas', 'logros'])
  assert.equal(m.hasMore, true)
  // No ve módulos de gestión que no le corresponden
  assert.ok(!ids(nav).includes('admin_sucursal'))
  assert.ok(!ids(nav).includes('gerente'))
})

test('gerente_sucursal (Angélica): Admin Sucursal + Gerente directos; KPIs/Encuestas/Premios a Más', () => {
  const session = { role: 'gerente_sucursal' }
  const m = buildMobileNav(session, '/')
  assert.deepEqual(ids(m.primary), ['admin_sucursal', 'gerente'])
  assert.deepEqual(ids(m.overflow), ['kpis', 'encuestas', 'logros'])
  assert.equal(m.hasMore, true)
  assert.ok(!ids(getNavModules(session)).includes('supervisor_ventas'), 'no ve Equipo')
})

test('usuario común (solo universales): 3 módulos directos, sin "Más"', () => {
  const session = { role: 'rol_sin_modulos_especiales' }
  const m = buildMobileNav(session, '/')
  assert.deepEqual(ids(m.primary), ['kpis', 'encuestas', 'logros'])
  assert.equal(m.hasMore, false)
  assert.equal(m.overflow.length, 0)
})

test('jefe_ruta: ve Mi Ruta pero NO admin/gerente/equipo', () => {
  const nav = ids(getNavModules({ role: 'jefe_ruta' }))
  assert.ok(nav.includes('cierre_ruta'))
  assert.ok(!nav.includes('admin_sucursal') && !nav.includes('gerente') && !nav.includes('supervisor_ventas'))
})

// ── Tower nunca aparece ─────────────────────────────────────────────────────
test('ningún rol ve Tower en la navegación (no está en el registry)', () => {
  for (const role of ['supervisor_ventas', 'gerente_sucursal', 'jefe_ruta', 'direccion_general', 'auxiliar_admin']) {
    const nav = getNavModules({ role })
    assert.ok(nav.every((m) => !String(m.route).startsWith('/torre')), `Tower ausente para ${role}`)
    assert.ok(!ids(nav).includes('torre_backlog') && !ids(nav).includes('torre_operativa'))
  }
})

// ── Fail-closed sin sesión ──────────────────────────────────────────────────
test('sesión vacía: solo universales (["*"]); nada de gestión', () => {
  const nav = ids(getNavModules({}))
  assert.ok(!nav.includes('admin_sucursal') && !nav.includes('gerente') && !nav.includes('supervisor_ventas'))
})

// ── Estado activo / subrutas ────────────────────────────────────────────────
test('isNavItemActive: subrutas de /admin activan Admin; "/" solo exacto', () => {
  assert.equal(isNavItemActive('/admin', '/admin/pos'), true)
  assert.equal(isNavItemActive('/admin', '/admin'), true)
  assert.equal(isNavItemActive('/', '/admin'), false)
  assert.equal(isNavItemActive('/', '/'), true)
  assert.equal(isNavItemActive('/admin', '/administracion'), false)
})

test('resolveActiveId: gana el match más específico', () => {
  const items = [HOME_ANCHOR, { id: 'admin_sucursal', route: '/admin' }]
  assert.equal(resolveActiveId(items, '/admin/gastos'), 'admin_sucursal')
  assert.equal(resolveActiveId(items, '/'), 'home')
})

test('isNavHiddenForPath: oculto en /login', () => {
  assert.equal(isNavHiddenForPath('/login'), true)
  assert.equal(isNavHiddenForPath('/'), false)
  assert.equal(isNavHiddenForPath('/admin'), false)
})

// ── Desktop ─────────────────────────────────────────────────────────────────
test('buildDesktopNav: rail con TODOS los módulos + anclas', () => {
  const d = buildDesktopNav({ role: 'gerente_sucursal' }, '/gerente/dashboard')
  assert.equal(d.home.id, 'home')
  assert.equal(d.profile.id, 'perfil')
  assert.ok(ids(d.modules).includes('admin_sucursal') && ids(d.modules).includes('gerente'))
  assert.equal(d.activeId, 'gerente')
})

// ── Contrato de anclas ──────────────────────────────────────────────────────
test('anclas fijas Inicio/Yo', () => {
  assert.equal(HOME_ANCHOR.route, '/')
  assert.equal(PROFILE_ANCHOR.route, '/profile')
})

// ── Guard de fuente única: componentes derivan del navModel ─────────────────
test('AppNav y AppShell derivan del navModel (fuente única, no hardcode)', () => {
  const appNav = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')
  const appShell = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8')
  assert.match(appNav, /from '\.\.\/lib\/navModel/, 'AppNav importa navModel')
  assert.match(appNav, /aria-label/, 'AppNav tiene aria-label')
  assert.match(appNav, /Más|M\\u00e1s/, 'AppNav tiene botón Más')
  assert.match(appNav, /Escape/, 'AppNav cierra el sheet con Escape')
  assert.ok(!/const NAV\s*=\s*\[/.test(appNav), 'AppNav no reintroduce un array NAV hardcodeado')
  assert.match(appShell, /AppNav/, 'AppShell monta AppNav')
  assert.match(appShell, /Outlet/, 'AppShell usa Outlet')
})

// ── Guard de regresión: las 5 pantallas ya no definen su propio BottomNav ────
test('las pantallas universales ya no definen BottomNav local', () => {
  for (const f of ['ScreenHome', 'ScreenKPIs', 'ScreenSurveys', 'ScreenBadges', 'ScreenProfile']) {
    const src = readFileSync(new URL(`../src/screens/${f}.jsx`, import.meta.url), 'utf8')
    assert.ok(!/function BottomNav\s*\(/.test(src), `${f} no define BottomNav local`)
  }
})
