import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const files = [
  'ScreenEmpaque.jsx',
  'ScreenTanque.jsx',
  'ScreenTanqueLista.jsx',
  'ScreenTransformacion.jsx',
]

for (const file of files) {
  test(`${file} uses the production light surface tokens`, () => {
    const source = fs.readFileSync(new URL(`../src/modules/produccion/${file}`, import.meta.url), 'utf8')
    assert.equal(source.includes("BRAND_TOKENS as TOKENS"), true)
  })
}
