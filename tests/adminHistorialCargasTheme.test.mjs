import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { TOKENS } from '../src/tokens.js'
import { BRAND_TOKENS } from '../src/theme/brandTokens.js'
import { getHistorialCargasTheme } from '../src/modules/entregas/historialCargasTheme.js'

test('admin historial de cargas uses the light admin palette', () => {
  assert.equal(getHistorialCargasTheme(true), BRAND_TOKENS)
})

test('entregas historial de cargas keeps the dark entregas palette', () => {
  assert.equal(getHistorialCargasTheme(false), TOKENS)
})

test('historial de cargas screen does not reference the removed TOKENS identifier directly', () => {
  const source = fs.readFileSync(
    new URL('../src/modules/entregas/ScreenHistorialCargas.jsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /\bTOKENS\./)
})
