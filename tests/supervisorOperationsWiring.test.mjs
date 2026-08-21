import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const entry = readFileSync(
  new URL(
    '../src/modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx',
    import.meta.url,
  ),
  'utf8',
)

test('App cablea una sola raíz /equipo al nuevo coordinador', () => {
  assert.match(app, /ScreenSupervisorOperationsEntry/)
  assert.match(app, /function EquipoHome\(\)/)
  assert.match(
    app,
    /path="\/equipo"[^]*?<EquipoHome\s*\/>/,
  )
  const equipoHome = app.slice(app.indexOf('function EquipoHome()'), app.indexOf('function getStoredSession()'))
  assert.match(equipoHome, /legacy=\{<ScreenSupervisorOperationsEntry\s*\/>\}/)
  assert.equal((app.match(/path="\/equipo"/g) || []).length, 1)
  assert.ok(!app.includes('const ScreenControlComercial'))
})

test('las subrutas existentes de supervisor permanecen intactas', () => {
  for (const route of [
    '/equipo/vendedor/:vendedorId',
    '/equipo/sin-visitar',
    '/equipo/cierre',
    '/equipo/pronostico',
    '/equipo/clientes',
    '/equipo/recuperacion',
  ]) {
    assert.ok(app.includes(`path="${route}"`), route)
  }
})

test('el coordinador invalida respuestas tardías antes de cada publicación async', () => {
  assert.match(entry, /const requestGenerationRef = useRef\(0\)/)
  assert.ok(
    (entry.match(/requestGenerationRef\.current \+= 1/g) || []).length >= 2,
    'refresh y cleanup incrementan la generación',
  )
  assert.match(entry, /const generation = requestGenerationRef\.current/)
  assert.ok(
    (entry.match(/requestGenerationRef\.current !== generation/g) || []).length >= 3,
    'callbacks y resolución final comparan la misma generación',
  )
  assert.match(entry, /if \(requestGenerationRef\.current !== generation\) return/)
})

test('la recarga reinicia Hoy/Ayer y no programa retries automáticos', () => {
  assert.match(entry, /setActiveDay\('today'\)/)
  assert.match(entry, /setTodayState\(stateCopy\('loading'\)\)/)
  assert.match(entry, /setYesterdayState\(\{ kind: 'idle' \}\)/)
  assert.doesNotMatch(entry, /setInterval|setTimeout/)
})
