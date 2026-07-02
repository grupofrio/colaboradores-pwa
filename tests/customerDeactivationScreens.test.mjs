import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readScreen(name) {
  return fs.readFileSync(path.join(root, `src/modules/supervisor-ventas/${name}.jsx`), 'utf8')
}

test('bajas hub loads summary and gates Sugey and Angelica links by job access', () => {
  const source = readScreen('ScreenBajasHub')

  assert.match(source, /getCustomerDeactivationSummary/)
  assert.match(source, /canAccessSugeyDeactivation/)
  assert.match(source, /canAccessAngelicaDeactivation/)
  assert.match(source, /DEFAULT_DEACTIVATION_JOB_CONFIG/)
  assert.match(source, /\/equipo\/bajas\/sugey/)
  assert.match(source, /\/equipo\/bajas\/angelica/)
  assert.match(source, /pending_sugey/)
  assert.match(source, /pending_angelica/)
  assert.match(source, /second_visit_required/)
  assert.match(source, /commercial_recovery/)
})
