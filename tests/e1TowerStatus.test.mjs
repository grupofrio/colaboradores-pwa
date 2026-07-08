import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  validateTowerStatus,
  towerStatusUrl,
  fetchTowerStatus,
} from '../src/modules/torre/e1/loadTowerStatus.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, '..', 'public', 'e1')
const read = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf-8'))
const samples = readdirSync(FIX).filter((f) => /^tower\.status\.[a-z0-9_]+\.json$/.test(f))

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
      assert.ok(m.name && m.badge_label && m.tracker_ref)
    }
  }
})

test('gates por rol vienen en el propio contrato (Opción A)', () => {
  const dir = read('tower.status.direccion_general.json')
  assert.equal(dir.role_gate.is_gated, true)
  assert.equal(dir.role_gate.gate, 'PEND-NOMINALES')

  const ger = read('tower.status.gerente_sucursal.json')
  assert.equal(ger.role_gate.is_gated, false)

  for (const r of ['comercial', 'finanzas']) {
    const d = read(`tower.status.${r}.json`)
    assert.equal(d.role_gate.gate, 'FASE-1.5')
  }
})

test('WhatsApp sale bloqueado y n8n estado_admin (badges honestos)', () => {
  const plat = read('tower.status.admin_plataforma.json')
  const wa = plat.modules.find((m) => m.id === 'whatsapp_clientes')
  const n8n = plat.modules.find((m) => m.id === 'n8n_estado')
  assert.equal(wa.badge, 'bloqueado')
  assert.equal(n8n.badge, 'estado_admin')
})

test('towerStatusUrl rechaza role id inseguro', () => {
  assert.throws(() => towerStatusUrl('../etc/passwd'))
  assert.throws(() => towerStatusUrl('rol con espacios'))
  assert.equal(towerStatusUrl('gerente_sucursal'), '/e1/tower.status.gerente_sucursal.json')
})

test('validateTowerStatus rechaza contratos inválidos', () => {
  assert.throws(() => validateTowerStatus({ read_only: false }))
  assert.throws(() => validateTowerStatus({ read_only: true, version: '1', generated_for_role: 'x', data_as_of: 'y', role_gate: { is_gated: false }, modules: [{ id: 'x', badge: 'INVENTADO' }] }))
})

test('fetchTowerStatus usa fetchImpl inyectable (sin red real)', async () => {
  const doc = read('tower.status.supervisor_ventas.json')
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => doc })
  const got = await fetchTowerStatus('supervisor_ventas', { fetchImpl: fakeFetch })
  assert.equal(got.generated_for_role, 'supervisor_ventas')
})
