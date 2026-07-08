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
} from '../src/modules/torre/e1/loadTowerStatus.js'

const HERE = dirname(fileURLToPath(import.meta.url))
// Fixtures de preview viven en src/ (NO en public/) para que un deploy no los sirva sin auth.
const FIX = join(HERE, '..', 'src', 'modules', 'torre', 'e1', 'fixtures')
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
