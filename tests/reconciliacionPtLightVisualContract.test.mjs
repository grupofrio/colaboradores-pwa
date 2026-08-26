import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/modules/produccion/ScreenReconciliacionPT.jsx', import.meta.url), 'utf8')

test('reconciliacion PT summary uses a soft light-blue surface instead of the old dark gray blend', () => {
  assert.match(source, /background: 'linear-gradient\(145deg, rgba\(0,119,187,0\.10\) 0%, rgba\(0,184,212,0\.15\) 100%\)'/)
  assert.doesNotMatch(source, /rgba\(15,23,42,0\.64\)/)
})

test('reconciliacion PT metric cards and fields stay aligned with light native controls', () => {
  assert.match(source, /background: 'rgba\(255,255,255,0\.82\)'/)
  assert.match(source, /colorScheme: 'light'/)
})

test('reconciliacion PT sticky actions use a softer light overlay', () => {
  assert.match(source, /backdropFilter: 'blur\(8px\)'/)
  assert.match(source, /rgba\(240,249,255,0\.98\) 52%/)
})
