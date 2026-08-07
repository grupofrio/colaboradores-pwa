// KOLD OS · Etapa 0A — adaptadores PresentationMeta contra el PAYLOAD REAL de cada
// módulo (no un shape común inventado). Verifica el path real, el valor presente y el
// comportamiento cuando el campo FALTA (null, sin inventar fuente/formalidad/auditor).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readM2PresentationMeta, readM3PresentationMeta, readM4PresentationMeta,
  readM5PresentationMeta, readM6PresentationMeta,
} from '../src/lib/presentationMeta/adapters.js'
import { M2_API_LATEST_FIXTURE } from '../src/modules/planeacion/m2/fixtures/apiLatestFixture.js'
import { M3_API_LATEST_FIXTURE } from '../src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'
import { M4_API_LATEST_FIXTURE } from '../src/modules/ventas/m4/fixtures/apiLatestFixture.js'
import { M5_API_LATEST_FIXTURE } from '../src/modules/inventario/m5/fixtures/apiLatestFixture.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

// ── M2: sin is_production_shell_run, sin rango, sin measurement_method, usa build_sha
test('M2 (real): period=days(90), formal=null, source=null, auditor=PASS, status=RED', () => {
  const m = readM2PresentationMeta(M2_API_LATEST_FIXTURE)
  assert.equal(m.dataAsOf, M2_API_LATEST_FIXTURE.run.finished_at)
  assert.deepEqual(m.period, { kind: 'days', days: 90 })
  assert.equal(m.formal, null, 'M2 NO emite is_production_shell_run ⇒ null (no se inventa)')
  assert.equal(m.source, null, 'M2 NO emite measurement_method ⇒ null (sin literal inventado)')
  assert.equal(m.auditor, 'PASS')
  assert.equal(m.status, 'RED')
  assert.deepEqual(m.companies, [1, 34, 35, 36])
  // build id: M2 usa build_sha, no auditor/contract
  assert.equal(m.technicalEvidence.build_sha, M2_API_LATEST_FIXTURE.run.build_sha)
  assert.equal(m.technicalEvidence.auditor_build_sha, null)
  assert.equal(m.decisionCaveats.length, 0, 'sin formalidad declarada ⇒ sin caveat no-formal')
})

// ── M3: tiene rango PERO el adaptador usa days (paridad con el screen)
test('M3 (real): period=days(90), formal=false, source=null, status=RED', () => {
  const m = readM3PresentationMeta(M3_API_LATEST_FIXTURE)
  assert.equal(m.period.kind, 'days')
  assert.equal(m.formal, false)
  assert.equal(m.source, null)
  assert.equal(m.status, 'RED')
  assert.ok(m.decisionCaveats.some((c) => /no formal/i.test(c)), 'is_production_shell_run=false ⇒ caveat')
})

// ── M4: rango real de fechas, status AMBER
test('M4 (real): period=range(2026-01-16→2026-07-15), source=null, status=AMBER', () => {
  const m = readM4PresentationMeta(M4_API_LATEST_FIXTURE)
  assert.equal(m.period.kind, 'range')
  assert.equal(m.period.start, '2026-01-16')
  assert.equal(m.period.endExclusive, '2026-07-15')
  assert.equal(m.source, null, 'M4 NO emite measurement_method')
  assert.equal(m.formal, false)
  assert.equal(m.status, 'AMBER')
})

// ── M5: rango, status AMBER
test('M5 (real): period=range, source=null, status=AMBER', () => {
  const m = readM5PresentationMeta(M5_API_LATEST_FIXTURE)
  assert.equal(m.period.kind, 'range')
  assert.equal(m.source, null)
  assert.equal(m.status, 'AMBER')
})

// ── M6: ÚNICO con measurement_method; rango; sin window_days
test('M6 (real): source=xml_rpc_read_only (único), period=range, status=AMBER', () => {
  const m = readM6PresentationMeta(M6_API_LATEST_FIXTURE)
  assert.equal(m.source, 'xml_rpc_read_only')
  assert.equal(m.period.kind, 'range')
  assert.equal(m.formal, false)
  assert.equal(m.status, 'AMBER')
  assert.ok(m.technicalEvidence.executed_queries > 0)
})

// ── invariante transversal: SOLO M6 tiene source; SOLO M2 carece de formal
test('transversal: measurement_method sólo lo emite M6', () => {
  assert.equal(readM2PresentationMeta(M2_API_LATEST_FIXTURE).source, null)
  assert.equal(readM3PresentationMeta(M3_API_LATEST_FIXTURE).source, null)
  assert.equal(readM4PresentationMeta(M4_API_LATEST_FIXTURE).source, null)
  assert.equal(readM5PresentationMeta(M5_API_LATEST_FIXTURE).source, null)
  assert.equal(readM6PresentationMeta(M6_API_LATEST_FIXTURE).source, 'xml_rpc_read_only')
})

test('transversal: ningún adaptador inventa formalidad/auditor/status ausentes', () => {
  // payload mínimo: solo finished_at. Todo lo demás null/[]; jamás un literal.
  for (const read of [readM2PresentationMeta, readM3PresentationMeta, readM4PresentationMeta,
    readM5PresentationMeta, readM6PresentationMeta]) {
    const m = read({ run: { finished_at: '2026-01-01T00:00:00Z' } })
    assert.equal(m.formal, null)
    assert.equal(m.source, null)
    assert.equal(m.auditor, null)
    assert.equal(m.status, null)
    assert.deepEqual(m.companies, [])
  }
})
