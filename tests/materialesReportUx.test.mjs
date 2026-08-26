import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/modules/almacen-pt/ScreenMaterialesReport.jsx', import.meta.url), 'utf8')

test('ScreenMaterialesReport sends back navigation to materiales list base', () => {
  assert.equal(source.includes('const backTo = materialesBasePath'), true)
})

test('ScreenMaterialesReport uses high-contrast text inside the hero card', () => {
  assert.equal(source.includes("color: UI.colors.onPrimary"), true)
})
