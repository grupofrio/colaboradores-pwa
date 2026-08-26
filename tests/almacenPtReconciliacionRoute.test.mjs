import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('almacen PT reconcile route is mounted without production operator guard', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(
    app,
    /<Route path="\/almacen-pt\/reconciliacion" element={<ModuleRoleRoute moduleId="almacen_pt"><ScreenReconciliacionPT \/><\/ModuleRoleRoute>} \/>/,
  )
})

test('almacen PT screens navigate to their own reconcile route', () => {
  const home = readFileSync(new URL('../src/modules/almacen-pt/ScreenAlmacenPT.jsx', import.meta.url), 'utf8')
  const recepcion = readFileSync(new URL('../src/modules/almacen-pt/ScreenRecepcion.jsx', import.meta.url), 'utf8')

  assert.match(home, /route: '\/almacen-pt\/reconciliacion'/)
  assert.match(recepcion, /navigate\('\/almacen-pt\/reconciliacion', \{ state: \{ backTo: '\/almacen-pt\/recepcion' \} \}\)/)
})

test('reconcile screen preserves caller-specific backTo when continuing to traspaso', () => {
  const source = readFileSync(new URL('../src/modules/produccion/ScreenReconciliacionPT.jsx', import.meta.url), 'utf8')

  assert.match(source, /const selfRoute = location\.pathname\.startsWith\('\/almacen-pt'\)/)
  assert.match(source, /navigate\('\/almacen-pt\/traspaso', \{ state: \{ backTo: selfRoute \} \}\)/)
})
