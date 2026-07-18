// KOLD OS · Etapa 0A — Gate 5: M6 sin rutas docs/*.md ni telemetría forense en la
// capa principal. La evidencia técnica NO se elimina: baja a EvidenceSection.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readM6PresentationMeta } from '../src/lib/presentationMeta/adapters.js'
import { M6_API_LATEST_FIXTURE } from '../src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js'

const screen = readFileSync(
  new URL('../src/modules/caja-conciliacion/ScreenCajaConciliacionM6.jsx', import.meta.url), 'utf8')

test('el fixture del contrato SÍ trae la referencia docs/*.md (existía la fuga)', () => {
  const corrected = M6_API_LATEST_FIXTURE.capabilities?.lifecycle_states_unsupported?.corrected || ''
  assert.match(corrected, /docs\/M6_LIFECYCLE_CORRECTED_DECISION\.md/)
})

test('la copia curada de capa 1 NO contiene ninguna ruta docs/*.md', () => {
  assert.match(screen, /M6_UNSUPPORTED_REASON_COPY/)
  // el bloque de copy curado no debe portar una ruta docs/*.md
  const start = screen.indexOf('M6_UNSUPPORTED_REASON_COPY = Object.freeze')
  const block = screen.slice(start, start + 500)
  assert.ok(!/docs\/[A-Za-z0-9_/]+\.md/.test(block), 'la copia curada no debe tener rutas docs/*.md')
})

test('el render usa la copia curada por clave (mapeo explícito), no el texto crudo', () => {
  assert.match(screen, /M6_UNSUPPORTED_REASON_COPY\[estado\]\s*\|\|\s*razon/)
})

test('la telemetría forense salió de la capa 1 del header (midió/empacó/run/scope)', () => {
  // Las cadenas de telemetría inline del header ya no existen (solo el comentario).
  assert.ok(!/midió:\s*\{shortHash/.test(screen))
  assert.ok(!/empacó:\s*\{shortHash/.test(screen))
  assert.ok(!/run \{shortHash\(run\.run_id\)\}/.test(screen))
})

test('la telemetría se PRESERVA: baja a EvidenceSection vía el adaptador', () => {
  assert.match(screen, /import EvidenceSection from/)
  assert.match(screen, /readM6PresentationMeta\(payload\)\.technicalEvidence/)
  // el adaptador conserva la evidencia íntegra
  const ev = readM6PresentationMeta(M6_API_LATEST_FIXTURE).technicalEvidence
  assert.ok('run_id' in ev && 'executed_queries' in ev && 'auditor_build_sha' in ev)
})

test('el header incorpora DataFreshness (aviso de edad del dato)', () => {
  assert.match(screen, /import DataFreshness from/)
  assert.match(screen, /<DataFreshness dataAsOf=\{run\.finished_at\}/)
})
