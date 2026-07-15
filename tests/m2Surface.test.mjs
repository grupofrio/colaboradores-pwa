import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, getModuleById, getModulesForRoles, isModuleVisibleForRoles } from '../src/modules/registry.js'
import { getNavModules, isNavHiddenForPath, buildDesktopNav } from '../src/lib/navModel.js'
import { ALLOWED_M2_BASE, M2_RUN_FILENAME, assertSafeM2Base, m2RunUrl, fetchM2Run } from '../src/modules/planeacion/m2/loadM2Run.js'
import { M2_FIXTURE_RUN, M2_FIXTURE_PROVENANCE } from '../src/modules/planeacion/m2/fixtures/realRun20260714.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const s = (role, extra = {}) => ({ employee_id: 100, session_token: 'h.p.s', role, ...extra })
const ids = (arr) => arr.map((m) => m.id)

// ── Catálogo canónico: módulo "Planeación" ──────────────────────────────────
test('registry: módulo planeacion completo, roles direccion_general, ruta /planeacion', () => {
  const mod = getModuleById('planeacion')
  assert.ok(mod, 'módulo planeacion en el registry')
  assert.equal(mod.label, 'Planeación')
  assert.equal(mod.route, '/planeacion')
  assert.deepEqual(mod.roles, ['direccion_general'])
  assert.equal(mod.status, 'live')
  assert.equal(mod.showOnHome, true)
  assert.equal(mod.showInNav, true)
  assert.equal(mod.towerGated, undefined, 'NO es towerGated: no mezcla el gate de Tower')
  const routes = MODULES.filter((m) => m.route === '/planeacion')
  assert.equal(routes.length, 1, 'sin duplicados')
})

test('tarjeta home + nav: direccion_general la ve; gerente/supervisor/ruta NO', () => {
  assert.ok(ids(getModulesForRoles(['direccion_general'])).includes('planeacion'), 'tarjeta')
  assert.ok(ids(getNavModules(s('direccion_general'))).includes('planeacion'), 'nav')
  for (const role of ['gerente_sucursal', 'supervisor_ventas', 'jefe_ruta', 'auxiliar_admin', 'operador_torres', 'rol_x']) {
    assert.ok(!ids(getModulesForRoles([role])).includes('planeacion'), `card ${role}`)
    assert.ok(!ids(getNavModules(s(role))).includes('planeacion'), `nav ${role}`)
  }
  assert.ok(!isModuleVisibleForRoles(getModuleById('planeacion'), []), 'sin roles => oculto')
})

test('nav: /planeacion NO está oculta (usa la nav global) y aparece en el rail desktop', () => {
  assert.equal(isNavHiddenForPath('/planeacion'), false)
  const d = buildDesktopNav(s('direccion_general'), '/planeacion')
  assert.ok(ids(d.modules).includes('planeacion'))
})

test('sesión inválida: la tarjeta/nav de planeacion no existe', () => {
  for (const bad of [null, {}, { role: 'direccion_general' }]) {
    assert.deepEqual(ids(getNavModules(bad)), [])
  }
})

// ── App.jsx: guard propio M2PlaneacionRoute (fail-closed) ───────────────────
test('App.jsx: M2PlaneacionRoute exige sesión válida y acceso global; monta /planeacion', () => {
  assert.match(appSrc, /function M2PlaneacionRoute\(\{ children \}\)/)
  const block = appSrc.slice(appSrc.indexOf('function M2PlaneacionRoute'), appSrc.indexOf('function M2PlaneacionRoute') + 500)
  assert.match(block, /isValidAuthenticatedSession\(session\)/, 'sesión estricta')
  assert.match(block, /readM2Access\(session\)\.level !== 'global'/, 'acceso M2 propio')
  assert.match(block, /Navigate to="\/login" replace/, 'sin sesión => login')
  assert.match(block, /Navigate to="\/" replace/, 'sin permiso => home')
  assert.ok(appSrc.includes('<Route path="/planeacion" element={<M2PlaneacionRoute><ScreenPlaneacionM2Mount /></M2PlaneacionRoute>} />'))
  assert.ok(!appSrc.includes('path="/planeacion" element={<ModuleRoleRoute'), 'no usa ModuleRoleRoute (gate propio)')
  assert.ok(!/path="\/planeacion"[^>]*TowerRoute/.test(appSrc), 'no reutiliza TowerRoute')
})

test('App.jsx: Tower intacto (M2 no toca TowerRoute ni /torre)', () => {
  assert.match(appSrc, /function TowerRoute\(\{ children \}\)/)
  assert.ok(appSrc.includes('<Route path="/torre/backlog" element={<TowerRoute>'))
})

// ── Loader: base allowlisted y fail-closed ──────────────────────────────────
test('loader: solo la base /m2; bases arbitrarias lanzan', () => {
  assert.equal(ALLOWED_M2_BASE, '/m2')
  assert.equal(m2RunUrl(), `/m2/${M2_RUN_FILENAME}`)
  assert.throws(() => assertSafeM2Base('https://evil.example'))
  assert.throws(() => assertSafeM2Base('//evil'))
  assert.throws(() => m2RunUrl('/otro'))
  assert.equal(assertSafeM2Base('/fixtures/x', { allowCustom: true }), '/fixtures/x')
})

test('loader: 404 => unavailable; JSON corrupto => invalid; contrato roto => invalid; válido => ok', async () => {
  const mk = (impl) => fetchM2Run({ fetchImpl: impl })
  assert.equal((await mk(async () => ({ ok: false, status: 404 }))).state, 'unavailable')
  assert.equal((await mk(async () => { throw new Error('net') })).state, 'unavailable')
  assert.equal((await mk(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad') } }))).state, 'invalid')
  assert.equal((await mk(async () => ({ ok: true, status: 200, json: async () => ({ status: 'OK' }) }))).state, 'invalid')
  const ok = await mk(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(M2_FIXTURE_RUN)) }))
  assert.equal(ok.state, 'ok')
  assert.equal(ok.report.duration_ms, 342)
})

// ── READ-ONLY duro: cero verbos de escritura en todo el módulo M2 ───────────
const M2_DIR = fileURLToPath(new URL('../src/modules/planeacion', import.meta.url))
const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(jsx?|mjs)$/.test(entry)) acc.push(p)
  }
  return acc
}

test('read-only: el módulo M2 no emite POST/PUT/PATCH/DELETE ni usa api() de escritura', () => {
  for (const file of walk(M2_DIR)) {
    const src = readFileSync(file, 'utf8')
    assert.ok(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(src), `${path.basename(file)} sin verbos de escritura`)
    assert.ok(!/\bexecute_kw\b|\bxmlrpc\b/i.test(src), `${path.basename(file)} sin llamadas Odoo directas`)
    assert.ok(!/localStorage\.setItem|sessionStorage\.setItem/.test(src), `${path.basename(file)} no persiste estado local`)
  }
})

test('read-only: la pantalla no ofrece botones de corrección/escritura', () => {
  const screen = readFileSync(path.join(M2_DIR, 'ScreenPlaneacionM2.jsx'), 'utf8')
  for (const forbidden of ['Corregir', 'Asignar territorio', 'Ejecutar solver', 'Cerrar hallazgo', 'Liquidar', 'Guardar cambios']) {
    assert.ok(!screen.includes(forbidden), `sin botón "${forbidden}"`)
  }
  assert.ok(screen.includes('auto_fix = false'), 'declara la política en la UI')
  assert.ok(screen.includes('READ-ONLY'), 'badge read-only visible')
})

test('estados honestos: técnico (PASS/FAIL/STALE/UNAVAILABLE) separado del operativo (GREEN/AMBER/RED)', () => {
  const screen = readFileSync(path.join(M2_DIR, 'ScreenPlaneacionM2.jsx'), 'utf8')
  assert.ok(screen.includes('AUDITOR:'), 'chip técnico')
  assert.ok(screen.includes('DATOS:'), 'chip operativo')
  assert.ok(screen.includes('M2 está funcionando y detectó incumplimientos'), 'copy honesto')
  assert.ok(screen.includes("get('demo') === '1'"), 'modo demo explícito')
})

// ── BLINDAJE: el run real jamás se sirve desde public/ ──────────────────────
test('blindaje: public/ no contiene JSON del run M2 (kold.tower.m2.*)', () => {
  const PUBLIC = fileURLToPath(new URL('../public', import.meta.url))
  const leaked = []
  const walkPublic = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry)
      if (statSync(p).isDirectory()) walkPublic(p)
      else if (/^kold\.tower\.m2\..*\.json$/i.test(entry) || /^m2[._-].*\.json$/i.test(entry)) leaked.push(p)
    }
  }
  walkPublic(PUBLIC)
  assert.deepEqual(leaked, [], 'ningún run M2 servible sin auth')
})

// ── Procedencia del fixture: reconstrucción declarada, no evidencia real ────
test('fixture: declara procedencia sintética y NO suplanta el hash de evidencia real', () => {
  assert.equal(M2_FIXTURE_PROVENANCE.kind, 'sanitized_reconstruction')
  assert.equal(M2_FIXTURE_PROVENANCE.real_run.evidence_sha256,
    '317252aac2653ef0f650725a0372419ce413502ef83713949a9a720a83310435')
  assert.notEqual(M2_FIXTURE_RUN.evidence_sha256, M2_FIXTURE_PROVENANCE.real_run.evidence_sha256,
    'el fixture usa su propio marcador, no el hash real')
  assert.equal(M2_FIXTURE_RUN.build_sha, M2_FIXTURE_PROVENANCE.real_run.auditor_build_sha,
    'el build del auditor sí es el real (propiedad del código)')
  assert.equal(M2_FIXTURE_RUN.manifest_sha256, M2_FIXTURE_PROVENANCE.real_run.manifest_sha256,
    'el manifest hash es determinista del código del auditor')
})

// ── No-regresión: ScreenHome de main intacto (cero solape con PR #67) ───────
test('ScreenHome (main) sigue derivando tarjetas de getModulesForRoles — M2 no lo toca', () => {
  const home = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
  assert.match(home, /getModulesForRoles\(getEffectiveJobKeys\(session\)\)/)
  assert.ok(!home.includes('planeacion'), 'sin cableado especial: la tarjeta sale del registry')
})
