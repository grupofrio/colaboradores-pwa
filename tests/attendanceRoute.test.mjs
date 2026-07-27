import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('attendance route: direct access uses the same canonical session-aware policy', () => {
  assert.match(app, /import \{ isModuleVisibleForSession \} from '\.\/lib\/navModel'/)
  assert.match(app, /function AttendanceRoute\(\{ children \}\)/)

  const start = app.indexOf('function AttendanceRoute')
  assert.notEqual(start, -1, 'AttendanceRoute debe existir')
  const block = app.slice(start, start + 650)
  assert.match(block, /isValidAuthenticatedSession\(session\)/)
  assert.match(block, /getModuleById\('asistencias'\)/)
  assert.match(block, /isModuleVisibleForSession\(module, session\)/)
  assert.match(block, /<Navigate to="\/login" replace \/>/)
  assert.match(block, /<Navigate to="\/" replace \/>/)
})

test('attendance route: /asistencias is lazy loaded behind AttendanceRoute', () => {
  assert.match(
    app,
    /const ScreenAsistencias = lazy\(\(\) => import\('\.\/modules\/asistencias\/ScreenAsistencias'\)\)/,
  )
  assert.match(
    app,
    /<Route path="\/asistencias" element=\{<AttendanceRoute><ScreenAsistencias \/><\/AttendanceRoute>\} \/>/,
  )
})
