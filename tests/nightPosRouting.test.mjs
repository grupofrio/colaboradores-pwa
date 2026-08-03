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

test('las rutas nocturnas montan POS, ventas y ticket con NightPosRoute', () => {
  assert.match(
    appSrc,
    /<Route\s+path="\/pos-nocturno"\s+element=\{<NightPosRoute>\s*<ScreenPOS\s+flow=\{NIGHT_POS_FLOW\}\s*\/>\s*<\/NightPosRoute>\}\s*\/>/,
  )
  assert.match(
    appSrc,
    /<Route\s+path="\/pos-nocturno\/ventas"\s+element=\{<NightPosRoute>\s*<ScreenNightPosSales\s*\/>\s*<\/NightPosRoute>\}\s*\/>/,
  )
  assert.match(
    appSrc,
    /<Route\s+path="\/pos-nocturno\/ticket\/:orderId"\s+element=\{<NightPosRoute>\s*<ScreenTicket\s+flow=\{NIGHT_POS_FLOW\}\s*\/>\s*<\/NightPosRoute>\}\s*\/>/,
  )
})

test('ventas nocturnas queda dentro del AppShell autenticado y fuera de /admin', () => {
  const shellStart = appSrc.indexOf('<Route element={<AppShell />}>')
  const salesRoute = appSrc.indexOf('<Route path="/pos-nocturno/ventas"')
  const adminStart = appSrc.indexOf('<Route path="/admin"')

  assert.notEqual(shellStart, -1)
  assert.ok(salesRoute > shellStart, 'la ruta está dentro del layout autenticado')
  assert.ok(salesRoute < adminStart, 'la ruta directa no pertenece al árbol /admin')
  assert.match(
    appSrc,
    /const ScreenNightPosSales\s*=\s*lazy\(\(\) => import\('\.\/modules\/admin\/ScreenNightPosSales'\)\)/,
  )
})
