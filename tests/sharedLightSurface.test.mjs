import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isSharedLightSurfaceSession } from '../src/theme/sharedLightSurface.js'

const sess = (role, extra = {}) => ({ employee_id: 718, session_token: 'h.p.s', role, ...extra })

test('shared light surface keeps current explicit roles and adds almacenista_pt', () => {
  for (const role of [
    'operador_rolito',
    'operador_barra',
    'auxiliar_produccion',
    'supervisor_produccion',
    'almacenista_pt',
    'almacenista_entregas',
    'jefe_ruta',
    'auxiliar_ruta',
    'favy_cedis',
    'gerente_sucursal',
    'supervisor_ventas',
  ]) {
    assert.equal(isSharedLightSurfaceSession(sess(role)), true, `${role} debe usar superficie clara compartida`)
  }

  for (const role of ['auxiliar_admin', 'operador_torres', 'direccion_general', '']) {
    assert.equal(isSharedLightSurfaceSession(sess(role)), false, `${role || '(sin rol)'} sigue fuera de esta superficie`)
  }
})

test('shared light surface is fail-closed for invalid sessions', () => {
  for (const bad of [null, undefined, 'texto', 42, [], {}]) {
    assert.equal(isSharedLightSurfaceSession(bad), false)
  }
})

test('ScreenHome and AppNav use the shared helper instead of inline role arrays', () => {
  const home = readFileSync(new URL('../src/screens/ScreenHome.jsx', import.meta.url), 'utf8')
  const nav = readFileSync(new URL('../src/components/AppNav.jsx', import.meta.url), 'utf8')

  assert.match(home, /from '\.\.\/theme\/sharedLightSurface'/)
  assert.match(home, /const\s+lightHome\s*=\s*isSharedLightSurfaceSession\(session\)/)
  assert.doesNotMatch(home, /almacenista_entregas', 'jefe_ruta', 'auxiliar_ruta', 'favy_cedis'/)

  assert.match(nav, /from '\.\.\/theme\/sharedLightSurface'/)
  assert.match(nav, /const\s+light\s*=\s*isSharedLightSurfaceSession\(session\)/)
  assert.doesNotMatch(nav, /almacenista_entregas', 'jefe_ruta', 'auxiliar_ruta', 'favy_cedis'/)
})
