import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getNavModules, buildMobileNav, buildDesktopNav,
  isNavItemActive, resolveActiveId, isNavHiddenForPath, normalizePath,
  HOME_ANCHOR, PROFILE_ANCHOR,
} from '../src/lib/navModel.js'

const ids = (arr) => arr.map((m) => m.id)
// Sesiones de prueba VÁLIDAS (contrato real: employee_id + session_token).
const s = (role) => ({ employee_id: 100, session_token: 'h.p.s', role })

// ── Fuente canónica única + orden por prioridad ─────────────────────────────
test('supervisor_ventas (Aida): Equipo es prioritario y va directo; universales a Más', () => {
  const session = s('supervisor_ventas')
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
  const session = s('gerente_sucursal')
  const m = buildMobileNav(session, '/')
  assert.deepEqual(ids(m.primary), ['admin_sucursal', 'gerente'])
  assert.deepEqual(ids(m.overflow), ['kpis', 'encuestas', 'logros'])
  assert.equal(m.hasMore, true)
  assert.ok(!ids(getNavModules(session)).includes('supervisor_ventas'), 'no ve Equipo')
})

test('usuario común (solo universales): 3 módulos directos, sin "Más"', () => {
  const m = buildMobileNav(s('rol_sin_modulos_especiales'), '/')
  assert.deepEqual(ids(m.primary), ['kpis', 'encuestas', 'logros'])
  assert.equal(m.hasMore, false)
  assert.equal(m.overflow.length, 0)
})

test('jefe_ruta: ve Mi Ruta pero NO admin/gerente/equipo', () => {
  const nav = ids(getNavModules(s('jefe_ruta')))
  assert.ok(nav.includes('cierre_ruta'))
  assert.ok(!nav.includes('admin_sucursal') && !nav.includes('gerente') && !nav.includes('supervisor_ventas'))
})

test('orden determinista: mismas roles => mismo orden en llamadas repetidas', () => {
  const a = ids(getNavModules(s('gerente_sucursal')))
  const b = ids(getNavModules(s('gerente_sucursal')))
  assert.deepEqual(a, b)
})

// ── Tower solo aparece con tower_status autoritativo (NO por x_job_key) ──────
test('sin tower_status: ningún rol (por x_job_key) ve Torre en la navegación', () => {
  const isTowerRoute = (r) => r === '/torre' || String(r).startsWith('/torre/')
  // Sesiones con SOLO role (x_job_key), sin session.employee.tower_status.
  for (const role of ['supervisor_ventas', 'gerente_sucursal', 'jefe_ruta', 'direccion_general', 'auxiliar_admin', 'operador_torres']) {
    const nav = getNavModules(s(role))
    assert.ok(nav.every((m) => !isTowerRoute(m.route)), `Torre ausente para ${role} sin tower_status`)
    assert.ok(!ids(nav).includes('torre_operativa'), `torre_operativa oculta para ${role}`)
  }
})

// ── Fail-closed: sesión inválida => CERO navegación (Codex BLOCKER 1) ───────
test('sesión inválida (null/{}): CERO módulos — ni siquiera universales', () => {
  assert.deepEqual(ids(getNavModules({})), [])
  assert.deepEqual(ids(getNavModules(null)), [])
})

// ── Estado activo / subrutas ────────────────────────────────────────────────
test('isNavItemActive: subrutas de /admin activan Admin; "/" solo exacto', () => {
  assert.equal(isNavItemActive('/admin', '/admin/gastos'), true)
  assert.equal(isNavItemActive('/admin', '/admin'), true)
  assert.equal(isNavItemActive('/', '/admin'), false)
  assert.equal(isNavItemActive('/', '/'), true)
  assert.equal(isNavItemActive('/admin', '/administracion'), false)
})

test('isNavItemActive: tolera trailing slash y query/hash', () => {
  assert.equal(isNavItemActive('/admin', '/admin/'), true)
  assert.equal(isNavItemActive('/admin', '/admin?tab=1'), true)
  assert.equal(isNavItemActive('/admin', '/admin/gastos#top'), true)
  assert.equal(isNavItemActive('/gerente', '/gerente/dashboard/'), true)
})

test('resolveActiveId: gana el match más específico; UN solo activo', () => {
  const items = [HOME_ANCHOR, { id: 'admin_sucursal', route: '/admin' }]
  assert.equal(resolveActiveId(items, '/admin/gastos'), 'admin_sucursal')
  assert.equal(resolveActiveId(items, '/'), 'home')
  assert.equal(resolveActiveId(items, '/otra-cosa'), null)
})

test('moreActive: el activo dentro del overflow marca "Más" (sin doble activo)', () => {
  // gerente: overflow = kpis/encuestas/logros → /kpis está en Más
  const m = buildMobileNav(s('gerente_sucursal'), '/kpis')
  assert.equal(m.activeId, 'kpis')
  assert.equal(m.moreActive, true)
  assert.ok(!m.primary.some((x) => x.id === m.activeId), 'el activo no está en las pestañas directas')
  // /admin está directo → Más NO activo
  const m2 = buildMobileNav(s('gerente_sucursal'), '/admin/gastos')
  assert.equal(m2.activeId, 'admin_sucursal')
  assert.equal(m2.moreActive, false)
})

// ── Política de navegación oculta (rutas full-screen) ───────────────────────
test('normalizePath: query/hash/trailing slash', () => {
  assert.equal(normalizePath('/ruta/cierre?paso=2'), '/ruta/cierre')
  assert.equal(normalizePath('/ruta/cierre/#x'), '/ruta/cierre')
  assert.equal(normalizePath('/'), '/')
  assert.equal(normalizePath(''), '/')
})

test('nav oculta: login y árbol completo de Tower', () => {
  assert.equal(isNavHiddenForPath('/login'), true)
  assert.equal(isNavHiddenForPath('/torre'), true)
  assert.equal(isNavHiddenForPath('/torre/backlog'), true)
  assert.equal(isNavHiddenForPath('/torre/backlog?state_bucket=open'), true)
})

test('nav oculta: subrutas operativas de captura; la RAÍZ del módulo la conserva', () => {
  // /ruta
  assert.equal(isNavHiddenForPath('/ruta'), false)
  for (const p of ['/ruta/checklist', '/ruta/carga', '/ruta/incidencias', '/ruta/control', '/ruta/inventario', '/ruta/corte', '/ruta/liquidacion', '/ruta/cierre', '/ruta/conciliacion', '/ruta/kpis']) {
    assert.equal(isNavHiddenForPath(p), true, `${p} oculta`)
  }
  // /produccion
  assert.equal(isNavHiddenForPath('/produccion'), false)
  for (const p of ['/produccion/checklist', '/produccion/ciclo', '/produccion/empaque', '/produccion/corte', '/produccion/transformacion', '/produccion/tanque', '/produccion/tanque/7', '/produccion/incidencia', '/produccion/cierre', '/produccion/declaracion-bolsas', '/produccion/handover', '/produccion/turno-entregado', '/produccion/reconciliacion']) {
    assert.equal(isNavHiddenForPath(p), true, `${p} oculta`)
  }
  // /almacen-pt, /entregas, /koldcup, /torres: raíz visible, subrutas ocultas
  for (const root of ['/almacen-pt', '/entregas', '/koldcup', '/torres']) {
    assert.equal(isNavHiddenForPath(root), false, `${root} raíz visible`)
    assert.equal(isNavHiddenForPath(root + '/x'), true, `${root}/x oculta`)
  }
})

test('nav oculta: POS/ticket/cierre de caja en admin; resto de admin visible', () => {
  assert.equal(isNavHiddenForPath('/admin'), false)
  assert.equal(isNavHiddenForPath('/admin/gastos'), false)
  assert.equal(isNavHiddenForPath('/admin/pos'), true)
  assert.equal(isNavHiddenForPath('/admin/ticket/123'), true)
  assert.equal(isNavHiddenForPath('/admin/cierre'), true)
  assert.equal(isNavHiddenForPath('/admin/cierre/'), true)
})

test('nav oculta: prefijos similares NO se ocultan por accidente', () => {
  assert.equal(isNavHiddenForPath('/rutas-nueva'), false)
  assert.equal(isNavHiddenForPath('/producciones'), false)
  assert.equal(isNavHiddenForPath('/torresota'), false)
  assert.equal(isNavHiddenForPath('/'), false)
  assert.equal(isNavHiddenForPath('/kpis'), false)
  assert.equal(isNavHiddenForPath('/equipo/dashboard'), false, 'equipo es gestión, conserva nav')
  assert.equal(isNavHiddenForPath('/gerente/dashboard'), false, 'gerente es gestión, conserva nav')
})

// ── Desktop ─────────────────────────────────────────────────────────────────
test('buildDesktopNav: rail con TODOS los módulos + anclas', () => {
  const d = buildDesktopNav(s('gerente_sucursal'), '/gerente/dashboard')
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
test('AppNav y AppShell derivan del navModel + sesión estricta (fuente única)', () => {
  const appNav = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')
  const appShell = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8')
  assert.match(appNav, /from '\.\.\/lib\/navModel/, 'AppNav importa navModel')
  assert.match(appNav, /isValidAuthenticatedSession/, 'AppNav valida sesión estricta')
  assert.match(appNav, /aria-label/, 'AppNav tiene aria-label')
  assert.match(appNav, /Más|M\\u00e1s/, 'AppNav tiene botón Más')
  assert.ok(!/const NAV\s*=\s*\[/.test(appNav), 'AppNav no reintroduce un array NAV hardcodeado')
  assert.match(appShell, /AppNav/, 'AppShell monta AppNav')
  assert.match(appShell, /Outlet/, 'AppShell usa Outlet')
  assert.match(appShell, /isValidAuthenticatedSession/, 'AppShell valida sesión estricta')
  assert.match(appShell, /railWidthFor/, 'AppShell reserva el ancho real del rail (compacto/completo)')
})

// ── Accesibilidad del sheet "Más" (marcadores de implementación) ─────────────
test('MoreSheet: dialog accesible completo (trap, labelledby, cierre, scroll lock)', () => {
  const appNav = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')
  assert.match(appNav, /role="dialog"/, 'role dialog')
  assert.match(appNav, /aria-modal="true"/, 'aria-modal')
  assert.match(appNav, /aria-labelledby="gf-more-sheet-title"/, 'labelledby apunta al título real')
  assert.match(appNav, /id="gf-more-sheet-title"/, 'el título existe con ese id')
  assert.match(appNav, /Escape/, 'cierra con Escape')
  assert.match(appNav, /e\.key !== 'Tab'/, 'focus trap maneja Tab')
  assert.match(appNav, /shiftKey/, 'focus trap maneja Shift+Tab')
  assert.match(appNav, /Cerrar menú de módulos/, 'botón visible de cerrar')
  assert.match(appNav, /body\.style\.overflow = 'hidden'/, 'bloquea scroll del body')
  assert.match(appNav, /pushTransientHistoryEntry\(window\.history, MORE_SHEET_HISTORY_KEY\)/, 'abrir Más crea una entrada efímera')
  assert.match(appNav, /consumeTransientHistoryEntry\(window\.history, MORE_SHEET_HISTORY_KEY\)/, 'cerrar Más consume la entrada efímera')
  assert.match(appNav, /window\.addEventListener\('popstate', onMoreHistoryPop\)/, 'Back cierra el sheet desde AppNav')
  assert.match(appNav, /onClick=\{openMore\}/, 'el botón Más usa el contrato de apertura')
  assert.match(appNav, /if \(moreClosingRef\.current\) return/, 'un doble cierre no consume dos entradas')
  assert.match(appNav, /pendingMoreRouteRef\.current = route/, 'elegir un módulo espera a consumir el marcador')
  assert.match(appNav, /if \(pendingRoute\) navigate\(pendingRoute\)/, 'navega después de cerrar el historial efímero')
  assert.match(appNav, /moreBtnRef\.current\?\.focus\(\)/, 'restaura el foco al botón Más')
  assert.match(appNav, /closeBtnRef\.current\?\.focus\(\)/, 'foco inicial predecible')
  assert.match(appNav, /aria-current=\{nav\.moreActive && !moreOpen \? 'page' : undefined\}/, 'Más marca activo (page) solo con sheet cerrado')
})

// ── Rail compacto (compresión desktop Admin 1024–1439 — hallazgo Codex) ─────
test('rail desktop: compacto en 1024–1439, completo desde 1440', async () => {
  const { railWidthFor, RAIL_FULL_MIN, DESKTOP_RAIL_WIDTH_COMPACT } = await import('../src/lib/navModel.js')
  assert.equal(RAIL_FULL_MIN, 1440, 'umbral de rail completo = 1440')
  assert.equal(DESKTOP_RAIL_WIDTH_COMPACT, 76, 'rail compacto de 76px')
  assert.equal(railWidthFor(375), 0, 'móvil: sin rail')
  assert.equal(railWidthFor(1024), 76)
  assert.equal(railWidthFor(1280), 76)
  assert.equal(railWidthFor(1366), 76)
  assert.equal(railWidthFor(1440), 232)
  assert.equal(railWidthFor(1920), 232)
  const appNav = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')
  assert.match(appNav, /compact=\{w < RAIL_FULL_MIN\}/, 'DesktopRail recibe compact por viewport')
})

// ── Guard de regresión: las 5 pantallas ya no definen nav local ──────────────
test('pantallas universales sin BottomNav local NI arrays de nav residuales', () => {
  for (const f of ['ScreenHome', 'ScreenKPIs', 'ScreenSurveys', 'ScreenBadges', 'ScreenProfile']) {
    const src = readFileSync(new URL(`../src/screens/${f}.jsx`, import.meta.url), 'utf8')
    assert.ok(!/function BottomNav\s*\(/.test(src), `${f} no define BottomNav local`)
    assert.ok(!/NAV_ITEMS/.test(src), `${f} sin NAV_ITEMS residual`)
    assert.ok(!/const NAV\s*=\s*\[/.test(src), `${f} sin array NAV hardcodeado`)
  }
})
