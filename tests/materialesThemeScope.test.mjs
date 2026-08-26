import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const screenFiles = [
  'ScreenMaterialesIssue.jsx',
  'ScreenMaterialesReport.jsx',
  'ScreenMaterialesCrearIssue.jsx',
  'ScreenMaterialesReconcile.jsx',
]

for (const file of screenFiles) {
  test(`${file} resolves materiales surface theme contextually`, () => {
    const source = fs.readFileSync(new URL(`../src/modules/almacen-pt/${file}`, import.meta.url), 'utf8')
    assert.equal(source.includes('resolveMaterialesSurfaceTheme'), true)
  })
}
