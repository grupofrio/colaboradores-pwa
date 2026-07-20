// Supervisor V2 · flag fail-closed (núcleo PURO). Ambos flags (global+sucursal)
// requeridos; override de dev solo en dev.
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSupervisorV2Flag, readSupervisorV2FlagFrom } from '../src/modules/supervisor-ventas/v2/flag.js'

test('flag: ambos ON ⇒ enabled (source both)', () => {
  const r = computeSupervisorV2Flag({ globalEnabled: true, branchEnabled: true })
  assert.equal(r.enabled, true); assert.equal(r.source, 'both')
})
test('flag: global OFF ⇒ disabled (fail-closed)', () => {
  assert.equal(computeSupervisorV2Flag({ globalEnabled: false, branchEnabled: true }).enabled, false)
})
test('flag: sucursal OFF ⇒ disabled (fail-closed)', () => {
  assert.equal(computeSupervisorV2Flag({ globalEnabled: true, branchEnabled: false }).enabled, false)
})
test('flag: ambos ausentes ⇒ disabled (unknown)', () => {
  const r = computeSupervisorV2Flag({})
  assert.equal(r.enabled, false); assert.equal(r.source, 'unknown')
})
test('flag: valores truthy no-boolean NO habilitan (=== true estricto)', () => {
  assert.equal(computeSupervisorV2Flag({ globalEnabled: 1, branchEnabled: 'yes' }).enabled, false)
})
test('flag: dev override solo aplica en dev', () => {
  assert.equal(computeSupervisorV2Flag({ devOverride: true, isDev: false }).enabled, false)
  assert.equal(computeSupervisorV2Flag({ devOverride: true, isDev: true }).enabled, true)
})
test('flag: reader desde sesión/capabilities', () => {
  const on = readSupervisorV2FlagFrom({ branch: { supervisor_v2_enabled: true } }, { supervisorV2: true })
  assert.equal(on.enabled, true)
  const off = readSupervisorV2FlagFrom({ branch: { supervisor_v2_enabled: true } }, { supervisorV2: false })
  assert.equal(off.enabled, false)
})
