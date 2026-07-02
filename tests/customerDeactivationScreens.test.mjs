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

test('Sugey screens load queue and submit GPS photo verification payload', () => {
  const queue = readScreen('ScreenBajasSugey')
  const detail = readScreen('ScreenBajasSugeyDetail')

  assert.match(queue, /getSugeyDeactivationQueue/)
  assert.match(queue, /normalizeDeactivationRequest/)
  assert.match(queue, /\/equipo\/bajas\/sugey\/\$\{request\.id\}/)

  assert.match(detail, /getCustomerDeactivationDetail/)
  assert.match(detail, /verifyCustomerDeactivationAsSugey/)
  assert.match(detail, /validateSugeyVerificationForm/)
  assert.match(detail, /buildSugeyVerificationPayload/)
  assert.match(detail, /navigator\.geolocation\.getCurrentPosition/)
  assert.match(detail, /PhotoCapture/)
  assert.match(detail, /photo_base64/)
})

test('Angelica screens load queue and submit approval decision payload', () => {
  const queue = readScreen('ScreenBajasAngelica')
  const detail = readScreen('ScreenBajasAngelicaDetail')

  assert.match(queue, /getAngelicaDeactivationQueue/)
  assert.match(queue, /normalizeDeactivationRequest/)
  assert.match(queue, /\/equipo\/bajas\/angelica\/\$\{request\.id\}/)

  assert.match(detail, /getCustomerDeactivationDetail/)
  assert.match(detail, /decideCustomerDeactivationAsAngelica/)
  assert.match(detail, /validateAngelicaDecisionForm/)
  assert.match(detail, /buildAngelicaDecisionPayload/)
  assert.match(detail, /ANGELICA_DECISIONS/)
  assert.match(detail, /request_photo_url/)
  assert.match(detail, /sugey_photo_url/)
})
