import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('NightPosRoute falla cerrado por sesión e identidad antes de montar children', () => {
  const guard = appSrc.match(/function NightPosRoute\(\{ children \}\) \{[\s\S]*?\n\}/)

  assert.ok(guard, 'existe function NightPosRoute')
  assert.match(guard[0], /isValidAuthenticatedSession\(session\)/)
  assert.match(guard[0], /canAccessHectorNightPos\(session\)/)
  assert.match(
    guard[0],
    /if \(!isValidAuthenticatedSession\(session\)\) return <Navigate to="\/login" replace \/>/,
  )
  assert.match(
    guard[0],
    /if \(!canAccessHectorNightPos\(session\)\) return <Navigate to="\/" replace \/>/,
  )
  assert.match(guard[0], /return children/)
})

test('las rutas nocturnas montan POS y ticket con NightPosRoute y NIGHT_POS_FLOW', () => {
  assert.match(
    appSrc,
    /<Route\s+path="\/pos-nocturno"\s+element=\{<NightPosRoute>\s*<ScreenPOS\s+flow=\{NIGHT_POS_FLOW\}\s*\/>\s*<\/NightPosRoute>\}\s*\/>/,
  )
  assert.match(
    appSrc,
    /<Route\s+path="\/pos-nocturno\/ticket\/:orderId"\s+element=\{<NightPosRoute>\s*<ScreenTicket\s+flow=\{NIGHT_POS_FLOW\}\s*\/>\s*<\/NightPosRoute>\}\s*\/>/,
  )
})
