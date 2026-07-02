import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('App wires customer deactivation routes under equipo', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')

  assert.match(app, /ScreenBajasHub\s*=\s*lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/ScreenBajasHub'\)\)/)
  assert.match(app, /ScreenBajasSugey\s*=\s*lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/ScreenBajasSugey'\)\)/)
  assert.match(app, /ScreenBajasSugeyDetail\s*=\s*lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/ScreenBajasSugeyDetail'\)\)/)
  assert.match(app, /ScreenBajasAngelica\s*=\s*lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/ScreenBajasAngelica'\)\)/)
  assert.match(app, /ScreenBajasAngelicaDetail\s*=\s*lazy\(\(\) => import\('\.\/modules\/supervisor-ventas\/ScreenBajasAngelicaDetail'\)\)/)

  assert.match(app, /path="\/equipo\/bajas"/)
  assert.match(app, /path="\/equipo\/bajas\/sugey"/)
  assert.match(app, /path="\/equipo\/bajas\/sugey\/:requestId"/)
  assert.match(app, /path="\/equipo\/bajas\/angelica"/)
  assert.match(app, /path="\/equipo\/bajas\/angelica\/:requestId"/)
})
