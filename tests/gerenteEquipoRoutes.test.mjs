/**
 * Resolve Equipo/Más routes against ModuleRoleRoute registry — no source regex alone.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getModuleRouteDecisionForSession } from '../src/lib/navModel.js'
import { getModuleById } from '../src/modules/registry.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const gerenteSession = {
  employee_id: 717,
  session_token: 'h.p.s',
  role: 'gerente_sucursal',
  job_key: 'gerente_sucursal',
  roles: ['gerente_sucursal'],
  effective_job_keys: ['gerente_sucursal'],
}

test('registry: supervisor_ventas still denies pure gerente (no role widen)', () => {
  const decision = getModuleRouteDecisionForSession('supervisor_ventas', gerenteSession)
  assert.notEqual(decision, 'allow')
})

test('registry: gerente module allows Equipo wrappers', () => {
  assert.equal(getModuleRouteDecisionForSession('gerente', gerenteSession), 'allow')
  const mod = getModuleById('gerente')
  assert.ok(mod?.roles?.includes('gerente_sucursal'))
})

test('App mounts Equipo wrappers under moduleId gerente only', () => {
  const app = src('../src/App.jsx')
  for (const route of [
    '/gerente/equipo/hoy',
    '/gerente/equipo/radar',
    '/gerente/equipo/rutas',
    '/gerente/equipo/planear',
    '/gerente/equipo/clientes',
  ]) {
    const re = new RegExp(`path="${route}"[^>]*moduleId="gerente"|path="${route}"[\\s\\S]*?moduleId="gerente"`)
    assert.match(app, re, route)
  }
})

test('Copiloto preserved in registry + Más + App', () => {
  const copiloto = getModuleById('copiloto_gerencial')
  assert.equal(copiloto?.route, '/gerente/copiloto')
  assert.ok(copiloto?.roles?.includes('gerente_sucursal'))
  const mas = src('../src/modules/gerente/v2/tabs/MasGerenteTab.jsx')
  assert.match(mas, /\/gerente\/copiloto/)
  const app = src('../src/App.jsx')
  assert.match(app, /path="\/gerente\/copiloto"/)
})

test('surveys/badges/profile modules allow non-gerente universal or private', () => {
  // surveys/badges are ModuleRoleRoute; profile is PrivateRoute — Más must use canonical paths
  const mas = src('../src/modules/gerente/v2/tabs/MasGerenteTab.jsx')
  assert.match(mas, /'\/surveys'/)
  assert.match(mas, /'\/badges'/)
  assert.match(mas, /'\/profile'/)
  const app = src('../src/App.jsx')
  assert.match(app, /path="\/surveys"/)
  assert.match(app, /path="\/badges"/)
  assert.match(app, /path="\/profile"/)
})
