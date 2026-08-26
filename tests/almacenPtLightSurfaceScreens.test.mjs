import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const LIGHT_CORE_FILES = [
  'ScreenAlmacenPT.jsx',
  'ScreenDeclaracionBolsasPT.jsx',
  'ScreenInventarioPT.jsx',
  'ScreenMermaPT.jsx',
  'ScreenRecepcion.jsx',
  'ScreenTraspasoPT.jsx',
]

for (const file of LIGHT_CORE_FILES) {
  test(`${file} uses almacen PT light theme helper`, () => {
    const source = fs.readFileSync(new URL(`../src/modules/almacen-pt/${file}`, import.meta.url), 'utf8')
    assert.match(source, /from '\.\/ptLightTheme'/)
    assert.match(source, /ALMACEN_PT_TOKENS as TOKENS|const UI = ALMACEN_PT_TOKENS/)
  })
}

test('ScreenHandoverPT injects light tokens into shared shell and confirm dialog', () => {
  const source = fs.readFileSync(new URL('../src/modules/almacen-pt/ScreenHandoverPT.jsx', import.meta.url), 'utf8')
  assert.match(source, /from '\.\/ptLightTheme'/)
  assert.match(source, /<ScreenShell[\s\S]*tokens=\{ALMACEN_PT_TOKENS\}/)
  assert.match(source, /<ConfirmDialog[\s\S]*tokens=\{ALMACEN_PT_TOKENS\}/)
})

test('ScreenTransformacionPT and materiales use light theme for almacenista pt', () => {
  const transform = fs.readFileSync(new URL('../src/modules/almacen-pt/ScreenTransformacionPT.jsx', import.meta.url), 'utf8')
  const transformationShell = fs.readFileSync(new URL('../src/modules/transformaciones/TransformationScreen.jsx', import.meta.url), 'utf8')
  const materialsNav = fs.readFileSync(new URL('../src/modules/almacen-pt/materialsNavigation.js', import.meta.url), 'utf8')

  assert.match(transform, /from '\.\/ptLightTheme'/)
  assert.match(transformationShell, /roleScope === 'pt'/)
  assert.match(materialsNav, /normalized === 'almacenista_pt'/)
  assert.match(materialsNav, /return 'light'/)
})
