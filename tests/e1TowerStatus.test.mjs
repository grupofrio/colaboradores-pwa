import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  validateTowerStatus,
  towerStatusUrl,
  fetchTowerStatus,
  assertSafeBase,
  resolveBoardView,
  ALLOWED_PROD_BASE,
  readAuthoritativeTowerStatus,
  ALLOWED_TOWER_STATUS,
} from '../src/modules/torre/e1/loadTowerStatus.js'

const HERE = dirname(fileURLToPath(import.meta.url))
// Fixtures de preview viven en src/ (NO en public/) para que un deploy no los sirva sin auth.
const FIX = join(HERE, '..', 'src', 'modules', 'torre', 'e1', 'fixtures')
const SRC = join(HERE, '..', 'src')
const read = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf-8'))
const samples = readdirSync(FIX).filter((f) => /^tower\.status\.[a-z0-9_]+\.json$/.test(f))
const GATED = ['direccion_general', 'comercial', 'finanzas']
const OPEN = ['admin_plataforma', 'gerente_sucursal', 'supervisor_ventas']

test('hay 6 samples de rol', () => {
  assert.equal(samples.length, 6)
})

test('todos los samples pasan validación del contrato', () => {
  for (const f of samples) {
    const doc = validateTowerStatus(read(f))
    assert.equal(doc.read_only, true)
    assert.ok(doc.version && doc.generated_for_role && doc.data_as_of)
    assert.equal(typeof doc.role_gate.is_gated, 'boolean')
    for (const m of doc.modules) {
      assert.ok(['operativo', 'piloto', 'parcial', 'pc', 'bloqueado', 'estado_admin'].includes(m.badge))
    }
  }
})

// ── Blocker 3 / minimización: roles gated NO exponen módulos en el asset público ──
test('fixtures gated van minimizados (modules == [])', () => {
  for (const r of GATED) {
    const d = read(`tower.status.${r}.json`)
    assert.equal(d.role_gate.is_gated, true)
    assert.equal(d.modules.length, 0, `${r} gated no debe exponer módulos en público`)
  }
})
test('fixtures no-gated sí traen módulos', () => {
  for (const r of OPEN) {
    const d = read(`tower.status.${r}.json`)
    assert.equal(d.role_gate.is_gated, false)
    assert.ok(d.modules.length > 0)
  }
})
test('gates por rol vienen en el contrato con su código', () => {
  assert.equal(read('tower.status.direccion_general.json').role_gate.gate, 'PEND-NOMINALES')
  assert.equal(read('tower.status.comercial.json').role_gate.gate, 'FASE-1.5')
  assert.equal(read('tower.status.finanzas.json').role_gate.gate, 'FASE-1.5')
})

// ── Blocker 1: base estático blindado ──
test('base "/e1" es válido; base peligroso/operativo NO en prod', () => {
  assert.equal(towerStatusUrl('gerente_sucursal'), '/e1/tower.status.gerente_sucursal.json')
  assert.equal(ALLOWED_PROD_BASE, '/e1')
  // prod (allowCustom por defecto false): cualquier base != "/e1" falla
  assert.throws(() => towerStatusUrl('x', '/api'))
  assert.throws(() => towerStatusUrl('x', '/fixtures'))
  assert.throws(() => assertSafeBase('/n8n'))
  assert.throws(() => assertSafeBase('https://evil.example/e1'))
})
test('base override SOLO en dev/test (allowCustom) y nunca peligroso', () => {
  // dev/test con allowCustom: base "limpia" permitida
  assert.equal(assertSafeBase('/fixtures', { allowCustom: true }), '/fixtures')
  // aún con allowCustom, base peligrosa/operativa/absoluta/traversal => falla
  for (const bad of ['https://evil/e1', '//evil', '/e1/../secret', '/n8n', '/api/x', 'http://x', '/rpc']) {
    assert.throws(() => assertSafeBase(bad, { allowCustom: true }), new RegExp('peligroso|no permitido'))
  }
})
test('role id inseguro siempre falla', () => {
  assert.throws(() => towerStatusUrl('../etc/passwd'))
  assert.throws(() => towerStatusUrl('rol con espacios'))
})
test('fetchTowerStatus queda blindado a "/e1" en prod (sin fetchImpl)', async () => {
  await assert.rejects(fetchTowerStatus('gerente_sucursal', { base: '/api' }))
  await assert.rejects(fetchTowerStatus('gerente_sucursal', { base: 'https://evil/e1' }))
})
test('fetchTowerStatus con fetchImpl inyectado permite base dev limpia', async () => {
  const doc = read('tower.status.supervisor_ventas.json')
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => doc })
  const got = await fetchTowerStatus('supervisor_ventas', { base: '/fixtures', fetchImpl: fakeFetch })
  assert.equal(got.generated_for_role, 'supervisor_ventas')
})

// ── Blocker 2: gated NO renderiza módulos (decisión pura) ──
test('resolveBoardView: gated => blocked, sin módulos, con código de gate', () => {
  const dir = read('tower.status.direccion_general.json')
  const view = resolveBoardView(dir)
  assert.equal(view.blocked, true)
  assert.equal(view.modules.length, 0)
  assert.equal(view.gate.gate, 'PEND-NOMINALES')
})
test('resolveBoardView: no-gated => no bloqueado, con módulos', () => {
  const ger = read('tower.status.gerente_sucursal.json')
  const view = resolveBoardView(ger)
  assert.equal(view.blocked, false)
  assert.ok(view.modules.length > 0)
})
test('resolveBoardView: preview gated SOLO con flag explícito (nunca por default)', () => {
  const dir = read('tower.status.direccion_general.json')
  assert.equal(resolveBoardView(dir).blocked, true) // default seguro
  assert.equal(resolveBoardView(dir, { allowGatedPreview: true }).blocked, false)
})

test('WhatsApp sale bloqueado y n8n estado_admin (badges honestos)', () => {
  const plat = read('tower.status.admin_plataforma.json')
  assert.equal(plat.modules.find((m) => m.id === 'whatsapp_clientes').badge, 'bloqueado')
  assert.equal(plat.modules.find((m) => m.id === 'n8n_estado').badge, 'estado_admin')
})

test('validateTowerStatus rechaza contratos inválidos', () => {
  assert.throws(() => validateTowerStatus({ read_only: false }))
  assert.throws(() => validateTowerStatus({
    read_only: true, version: '1', generated_for_role: 'x', data_as_of: 'y',
    role_gate: { is_gated: false }, modules: [{ id: 'x', badge: 'INVENTADO' }],
  }))
})

// ════════════════════════════════════════════════════════════════════════════
// E1-C.2 — la PWA consume el rol AUTORITATIVO de Odoo (session.employee.tower_status).
// Odoo decide el rol; la PWA obedece. /e1 NO autoriza; resolveTowerRole = legacy.
// ════════════════════════════════════════════════════════════════════════════

// Espeja la decisión de render del screen (ScreenKoldTowerE1): rol autoritativo -> superficie; null -> sin módulos.
function surfaceFor(session) {
  const role = readAuthoritativeTowerStatus(session)
  if (!role) return { role: null, rendered: false, modules: [] }
  const view = resolveBoardView(read(`tower.status.${role}.json`))
  return { role, rendered: !view.blocked, modules: view.modules }
}

test('allowlist de tower_status = exactamente {admin_plataforma, supervisor_ventas}', () => {
  assert.deepEqual([...ALLOWED_TOWER_STATUS].sort(), ['admin_plataforma', 'supervisor_ventas'])
})

test('test_admin_status_renders_admin_surface', () => {
  const s = surfaceFor({ employee: { tower_status: 'admin_plataforma' } })
  assert.equal(s.role, 'admin_plataforma')
  assert.equal(s.rendered, true)
  assert.ok(s.modules.length > 0)
})

test('test_supervisor_status_renders_supervisor', () => {
  const s = surfaceFor({ employee: { tower_status: 'supervisor_ventas' } })
  assert.equal(s.role, 'supervisor_ventas')
  assert.equal(s.rendered, true)
  assert.ok(s.modules.length > 0)
})

test('test_null_status_renders_no_modules', () => {
  const s = surfaceFor({ employee: { tower_status: null } })
  assert.equal(s.role, null)
  assert.equal(s.rendered, false)
  assert.equal(s.modules.length, 0)
  // sin employee / sin sesión tampoco hay superficie
  assert.equal(readAuthoritativeTowerStatus({}), null)
  assert.equal(readAuthoritativeTowerStatus(undefined), null)
  assert.equal(readAuthoritativeTowerStatus({ employee: {} }), null)
})

test('test_invalid_status_renders_nothing', () => {
  const invalids = [
    'direccion_general', 'gerente_sucursal', 'comercial', 'finanzas', // roles reales pero NO permitidos en v1
    'root', 'admin', 'x', '', '   ', 123, true, {}, ['admin_plataforma'], // basura / tipos no-string
  ]
  for (const bad of invalids) {
    assert.equal(
      readAuthoritativeTowerStatus({ employee: { tower_status: bad } }), null,
      `valor inválido debe tratarse como null: ${JSON.stringify(bad)}`
    )
  }
  const s = surfaceFor({ employee: { tower_status: 'gerente_sucursal' } })
  assert.equal(s.rendered, false)
  assert.equal(s.modules.length, 0)
})

test('test_resolveTowerRole_does_not_authorize', () => {
  // gf_session es editable: el cliente pone role/job keys de "admin_plataforma" — exactamente el input
  // que consume resolveTowerRole.js (LEGACY). Ese camino de cliente NO autoriza la superficie:
  // la autorización la decide SOLO readAuthoritativeTowerStatus (Odoo: session.employee.tower_status).
  const clientForged = { role: 'admin_plataforma', additional_job_keys: ['direccion_general'] }
  assert.equal(readAuthoritativeTowerStatus(clientForged), null) // sin tower_status de Odoo => sin rol
  assert.equal(surfaceFor(clientForged).rendered, false)         // no renderiza superficie
  // Aunque el cliente afirme un rol, el screen (ScreenKoldTowerE1) usa readAuthoritativeTowerStatus,
  // NO resolveTowerRole, para decidir qué mostrar.
})

test('test_no_appjsx_mount', () => {
  // App.jsx (router) NO importa ni monta la pantalla Tower E1.
  const appJsx = readFileSync(join(SRC, 'App.jsx'), 'utf-8')
  assert.ok(!/ScreenKoldTowerE1/.test(appJsx), 'App.jsx no debe referenciar ScreenKoldTowerE1')
})

test('test_no_visible_route', () => {
  // Ningún archivo de src/ (fuera del propio módulo torre/e1) importa/monta la pantalla => sin ruta visible.
  const e1Dir = join('torre', 'e1')
  const offenders = []
  const walk = (dir) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name)
      if (d.isDirectory()) { walk(p); continue }
      if (!/\.(jsx?|mjs)$/.test(d.name)) continue
      if (p.includes(e1Dir)) continue // el propio módulo define el screen, no lo monta
      if (/ScreenKoldTowerE1/.test(readFileSync(p, 'utf-8'))) offenders.push(p)
    }
  }
  walk(SRC)
  assert.deepEqual(offenders, [], `ScreenKoldTowerE1 no debe montarse fuera de su módulo: ${offenders.join(', ')}`)
})

test('test_no_new_endpoint_fetch', () => {
  // El loader consume SOLO el asset estático /e1; jamás un endpoint operativo (api/rpc/odoo/n8n/…).
  assert.equal(towerStatusUrl('admin_plataforma'), '/e1/tower.status.admin_plataforma.json')
  assert.equal(towerStatusUrl('supervisor_ventas'), '/e1/tower.status.supervisor_ventas.json')
  for (const bad of ['/api', '/odoo-api', '/rpc', '/n8n', '/webhook', 'https://x/e1']) {
    assert.throws(() => towerStatusUrl('admin_plataforma', bad))
  }
  // readAuthoritativeTowerStatus es PURO (no toca red): resolver el rol NO hace fetch a ningún endpoint.
  assert.equal(readAuthoritativeTowerStatus({ employee: { tower_status: 'admin_plataforma' } }), 'admin_plataforma')
})

test('test_e1_not_used_as_authorization', () => {
  // Aunque exista /e1/tower.status.admin_plataforma.json (fixture), NO autoriza: manda tower_status de Odoo.
  const forged = {
    role: 'admin_plataforma',                 // job key del cliente (editable) — no autoriza
    additional_job_keys: ['direccion_general'],
    employee: { tower_status: null },         // Odoo dice: sin rol
  }
  assert.equal(readAuthoritativeTowerStatus(forged), null)
  assert.equal(surfaceFor(forged).rendered, false)
  // Y el tower_status de Odoo MANDA sobre el role del cliente:
  const s = { role: 'direccion_general', employee: { tower_status: 'supervisor_ventas' } }
  assert.equal(readAuthoritativeTowerStatus(s), 'supervisor_ventas')
})
