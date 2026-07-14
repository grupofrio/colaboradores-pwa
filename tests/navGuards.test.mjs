import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import { getEffectiveJobKeys } from '../src/lib/roleContext.js'
import { isValidAuthenticatedSession } from '../src/lib/session.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })

// La MISMA decisión que aplica ModuleRoleRoute en runtime (sesión → módulo → rol).
function canEnter(session, moduleId) {
  if (!isValidAuthenticatedSession(session)) return 'login'
  const module = getModuleById(moduleId)
  if (!module) return 'home'
  if (!isModuleVisibleForRoles(module, getEffectiveJobKeys(session))) return 'home'
  return 'monta'
}

// ── Matriz de autorización (URL directa = card = nav) ───────────────────────
test('gerente_sucursal: entra Admin/Gerente; NO Equipo/Ruta/Producción/Almacén', () => {
  const g = s('gerente_sucursal')
  assert.equal(canEnter(g, 'admin_sucursal'), 'monta')
  assert.equal(canEnter(g, 'gerente'), 'monta')
  assert.equal(canEnter(g, 'supervisor_ventas'), 'home')
  assert.equal(canEnter(g, 'cierre_ruta'), 'home')
  assert.equal(canEnter(g, 'registro_produccion'), 'home')
  assert.equal(canEnter(g, 'almacen_pt'), 'home')
})

test('supervisor_ventas: entra Equipo; NO Admin/Gerente sin permiso explícito', () => {
  const sv = s('supervisor_ventas')
  assert.equal(canEnter(sv, 'supervisor_ventas'), 'monta')
  assert.equal(canEnter(sv, 'admin_sucursal'), 'home')
  assert.equal(canEnter(sv, 'gerente'), 'home')
  assert.equal(canEnter(sv, 'torre_control'), 'home')
})

test('jefe_ruta/auxiliar_ruta: solo Mi Ruta (+universales); NO gestión', () => {
  for (const role of ['jefe_ruta', 'auxiliar_ruta']) {
    const jr = s(role)
    assert.equal(canEnter(jr, 'cierre_ruta'), 'monta', `${role} entra a Mi Ruta`)
    assert.equal(canEnter(jr, 'kpis'), 'monta', 'universal')
    assert.equal(canEnter(jr, 'admin_sucursal'), 'home')
    assert.equal(canEnter(jr, 'gerente'), 'home')
    assert.equal(canEnter(jr, 'supervisor_ventas'), 'home')
  }
})

test('rol desconocido/vacío: solo universales; múltiples job keys componen', () => {
  assert.equal(canEnter(s('rol_marciano'), 'admin_sucursal'), 'home')
  assert.equal(canEnter(s('rol_marciano'), 'kpis'), 'monta')
  assert.equal(canEnter(s(''), 'encuestas'), 'monta')
  // multi-rol: gerente + supervisor por additional_job_keys
  const multi = s('gerente_sucursal', { additional_job_keys: ['supervisor_ventas'] })
  assert.equal(canEnter(multi, 'admin_sucursal'), 'monta')
  assert.equal(canEnter(multi, 'supervisor_ventas'), 'monta')
})

test('sesión inválida: NINGÚN módulo monta (ni universales) → /login', () => {
  for (const bad of [null, undefined, {}, { employee_id: 1 }, { session_token: 'x' },
    { employee_id: 1, session_token: 'x', exp: 1 }]) {
    assert.equal(canEnter(bad, 'kpis'), 'login')
    assert.equal(canEnter(bad, 'admin_sucursal'), 'login')
  }
})

test('módulo desconocido: fail-closed a home aunque la sesión sea válida', () => {
  assert.equal(canEnter(s('gerente_sucursal'), 'modulo_inexistente'), 'home')
  assert.equal(canEnter(s('gerente_sucursal'), 'torre_backlog'), 'home', 'Tower NO está en el registry')
})

// ── App.jsx: cableado real de guards (text-scan) ────────────────────────────
test('ModuleRoleRoute existe y aplica la triple autoridad (sesión→módulo→rol)', () => {
  assert.match(appSrc, /function ModuleRoleRoute\(\{ moduleId, children \}\)/)
  assert.match(appSrc, /if \(!isValidAuthenticatedSession\(session\)\) return <Navigate to="\/login" replace \/>/)
  assert.match(appSrc, /isModuleVisibleForRoles\(module, getEffectiveJobKeys\(session\)\)/)
})

test('cada familia de módulo usa ModuleRoleRoute con su moduleId canónico', () => {
  const expected = [
    ['/kpis', 'kpis'], ['/surveys', 'encuestas'], ['/badges', 'logros'],
    ['/admin', 'admin_sucursal'], ['/gerente', 'gerente'], ['/equipo', 'supervisor_ventas'],
    ['/ruta', 'cierre_ruta'], ['/entregas', 'almacen_entregas'], ['/almacen-pt', 'almacen_pt'],
    ['/koldcup', 'koldcup'], ['/supervision', 'supervision_produccion'], ['/torres', 'torre_control'],
  ]
  for (const [routePath, mid] of expected) {
    const needle = `<Route path="${routePath}" element={<ModuleRoleRoute moduleId="${mid}">`
    assert.ok(appSrc.includes(needle), `${routePath} → ModuleRoleRoute ${mid}`)
    assert.ok(getModuleById(mid), `moduleId ${mid} existe en el registry`)
  }
})

test('producción: ModuleRoleRoute envuelve a ProductionOperatorRoute (roles + turno)', () => {
  assert.match(appSrc, /<Route path="\/produccion" element=\{<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute>/)
  const wrapped = appSrc.match(/moduleId="registro_produccion"><ProductionOperatorRoute/g) || []
  assert.ok(wrapped.length >= 13, `todas las subrutas de producción envueltas (${wrapped.length})`)
})

test('cero allowlists duplicadas: RUTA_ALLOWED_ROLES y RouteRoleRoute eliminados', () => {
  assert.ok(!appSrc.includes('RUTA_ALLOWED_ROLES'), 'sin allowlist duplicada de /ruta')
  assert.ok(!appSrc.includes('RouteRoleRoute'), 'guard viejo eliminado')
})

test('Tower conserva TowerRoute especializado (rol autoritativo) + sesión estricta', () => {
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.match(appSrc, /readAuthoritativeTowerStatus\(session\)/)
  assert.ok(appSrc.includes('<Route path="/torre" element={<TowerRoute>'))
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
  // Tower NO pasa por ModuleRoleRoute (torre_control=/torres es OTRO módulo).
  assert.ok(!appSrc.includes('moduleId="torre_backlog"') && !appSrc.includes('moduleId="torre_operativa"'))
  assert.ok(!/path="\/torre(\/backlog)?" element=\{<ModuleRoleRoute/.test(appSrc), 'Tower usa TowerRoute, no ModuleRoleRoute')
  // TowerRoute también exige sesión válida (no solo truthy)
  const towerBlock = appSrc.slice(appSrc.indexOf('function TowerRoute'), appSrc.indexOf('function TowerRoute') + 400)
  assert.match(towerBlock, /isValidAuthenticatedSession/)
})

test('getStoredSession y PrivateRoute usan la validación estricta única', () => {
  const stored = appSrc.slice(appSrc.indexOf('function getStoredSession'), appSrc.indexOf('function getStoredSession') + 700)
  assert.match(stored, /isValidAuthenticatedSession/, 'getStoredSession valida y limpia sesiones corruptas')
  const priv = appSrc.slice(appSrc.indexOf('function PrivateRoute'), appSrc.indexOf('function PrivateRoute') + 300)
  assert.match(priv, /isValidAuthenticatedSession/, 'PrivateRoute exige sesión válida')
})

test('AppShell envuelve las rutas autenticadas; login queda fuera', () => {
  assert.match(appSrc, /<Route element=\{<AppShell \/>\}>/)
  const loginIdx = appSrc.indexOf('<Route path="/login"')
  const shellIdx = appSrc.indexOf('<Route element={<AppShell />}>')
  assert.ok(loginIdx !== -1 && shellIdx !== -1 && loginIdx < shellIdx, 'login fuera del AppShell')
})

// ── Fuente única en TODO src/: sin arrays de navegación global duplicados ────
test('ninguna pantalla reimplementa la navegación global (barrido src/)', () => {
  // Marcadores de la vieja barra: un array con Inicio+Yo apuntando a '/' y '/profile'.
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (!/\.(jsx?|mjs)$/.test(entry)) continue
      if (/navModel\.js$|registry\.js$|AppNav\.jsx$/.test(entry)) continue
      const src = readFileSync(p, 'utf8')
      if (/label:\s*['"]Inicio['"][\s\S]{0,240}path:\s*['"]\/['"]/m.test(src) &&
          /['"]\/profile['"]/.test(src)) {
        offenders.push(path.relative(root, p))
      }
    }
  }
  walk(root)
  assert.deepEqual(offenders, [], `navegación global duplicada en: ${offenders.join(', ')}`)
})

// ── CI compila de verdad ─────────────────────────────────────────────────────
test('workflow CI ejecuta npm run build (el job "build" compila)', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(ci, /npm run build/, 'CI corre npm run build')
  assert.match(ci, /npm run lint/)
  assert.match(ci, /npm test/)
  assert.match(ci, /check_public_e1/)
})

// ── AdminShell: feed lateral solo con ancho holgado (≥1366) ──────────────────
test('AdminShell no compone triple panel en 1024–1365', () => {
  const shell = readFileSync(new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url), 'utf8')
  assert.match(shell, /showActivityFeed = !hideActivityFeed && sw >= 1366/)
  assert.match(shell, /showActivityFeed \? '220px 1fr 320px' : '220px 1fr'/)
  assert.match(shell, /\{showActivityFeed && <ActivityFeed/)
})

// ── Registry sano: todo módulo con ruta y roles no-vacíos ────────────────────
const isTowerRoute = (r) => r === '/torre' || String(r).startsWith('/torre/')
test('registry: módulos completos; el único /torre es torre_operativa (towerGated)', () => {
  for (const m of MODULES) {
    assert.ok(m.id && m.route && Array.isArray(m.roles) && m.roles.length > 0, `módulo ${m.id} completo`)
    if (isTowerRoute(m.route)) {
      // El único módulo Tower permitido es torre_operativa y DEBE ser towerGated
      // (visibilidad por tower_status autoritativo, no por x_job_key).
      assert.equal(m.id, 'torre_operativa', `único /torre = torre_operativa (no ${m.id})`)
      assert.equal(m.towerGated, true, 'torre_operativa debe ser towerGated')
      assert.equal(m.route, '/torre/backlog')
    } else {
      assert.notEqual(m.towerGated, true, `solo torre_operativa es towerGated (no ${m.id})`)
    }
  }
})
