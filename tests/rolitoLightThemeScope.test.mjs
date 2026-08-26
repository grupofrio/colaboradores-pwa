import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const files = [
  'ScreenCicloRolito.jsx',
  'ScreenCiclo.jsx',
  'ScreenDeclaracionBolsas.jsx',
  'ScreenHandoverTurno.jsx',
  'ScreenMiTurno.jsx',
  'ScreenReconciliacionPT.jsx',
  'ScreenTurnoEntregado.jsx',
]

for (const file of files) {
  test(`${file} adopts the production light theme surface`, () => {
    const source = fs.readFileSync(new URL(`../src/modules/produccion/${file}`, import.meta.url), 'utf8')
    assert.equal(source.includes('BRAND_TOKENS as BRAND_TOKENS_LIGHT'), true)
    assert.equal(source.includes('isBrandLightSession'), true)
  })
}
