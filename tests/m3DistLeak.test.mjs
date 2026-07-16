import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { scanM3DistLeaks } from '../scripts/check_m3_dist_leaks.mjs'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'

test('scanner detecta linaje, fixture y agregados M3 medidos dentro del dist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'm3-leak-'))
  mkdirSync(path.join(root, 'assets'))
  writeFileSync(path.join(root, 'assets', 'app.js'), [
    M3_API_LATEST_FIXTURE.run.run_id,
    '9c709b47b3075b0e3e36b0acc3799b571ed15fe3',
    'total_incidences:15681',
  ].join('\n'))

  const leaks = scanM3DistLeaks(root)
  assert.ok(leaks.some((entry) => entry.marker === 'demo_run_id'))
  assert.ok(leaks.some((entry) => entry.marker === 'auditor_sha'))
  assert.ok(leaks.some((entry) => entry.marker === 'measured_total_incidences'))
})

test('scanner acepta un dist sin artefactos del fixture real', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'm3-clean-'))
  writeFileSync(path.join(root, 'app.js'), [
    'const feature="m3";',
    'const allowedEvidenceSource="xml_rpc_read_only_measurements";',
  ].join('\n'))
  assert.deepEqual(scanM3DistLeaks(root), [])
})

test('scanner no confunde procedencia genérica de otro módulo con fixture M3', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'm3-other-module-'))
  mkdirSync(path.join(root, 'assets'))
  writeFileSync(
    path.join(root, 'assets', 'other-module.js'),
    'const provenance = { kind: "real_code_generated_measured_aggregates" }',
  )

  assert.deepEqual(scanM3DistLeaks(root), [])
})
