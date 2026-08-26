import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('produccion has its own materiales route guarded by registro_produccion', () => {
  assert.equal(appSource.includes('<Route path="/produccion/materiales" element={<ModuleRoleRoute moduleId="registro_produccion"><ProductionOperatorRoute><ScreenMaterialesIssue /></ProductionOperatorRoute></ModuleRoleRoute>} />'), true)
})

test('produccion materiales create route redirects back to materiales list', () => {
  assert.equal(appSource.includes('<Route path="/produccion/materiales/crear" element={<Navigate to="/produccion/materiales" replace />} />'), true)
})

test('almacen pt materiales route stays guarded by almacen_pt', () => {
  assert.equal(appSource.includes('<Route path="/almacen-pt/materiales" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesIssue /></ModuleRoleRoute>} />'), true)
})

test('almacen pt keeps create route for materiales issues', () => {
  assert.equal(appSource.includes('<Route path="/almacen-pt/materiales/crear" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenMaterialesCrearIssue /></ModuleRoleRoute>} />'), true)
})
