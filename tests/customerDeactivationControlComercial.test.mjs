import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Control Comercial exposes bajas action only through job permission helpers', () => {
  const source = fs.readFileSync(path.join(root, 'src/modules/supervisor-ventas/ScreenControlComercial.jsx'), 'utf8')

  assert.match(source, /useSession/)
  assert.match(source, /canAccessSugeyDeactivation/)
  assert.match(source, /canAccessAngelicaDeactivation/)
  assert.match(source, /DEFAULT_DEACTIVATION_JOB_CONFIG/)
  assert.match(source, /\/equipo\/bajas/)
  assert.match(source, /canOpenBajas/)
  assert.match(source, /visibleQuickActions/)
  assert.doesNotMatch(source, /QUICK_ACTIONS\s*=\s*\[[\s\S]*route:\s*'\/equipo\/bajas'/)
})
