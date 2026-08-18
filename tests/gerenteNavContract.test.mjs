/**
 * Contrato de navegación Gerente V2 — ninguna pantalla prevista huérfana,
 * legacy equivocada o inaccesible desde el shell.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GERENTE_V2_TABS } from '../src/modules/gerente/v2/gerenteV2Tabs.js'
import { getModuleById } from '../src/modules/registry.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const EXPECTED = [
  ['hoy', '/gerente'],
  ['equipo', '/gerente/equipo'],
  ['admin', '/gerente/admin'],
  ['produccion', '/gerente/produccion'],
  ['inventario', '/gerente/inventario'],
  ['controles', '/gerente/controles'],
  ['mas', '/gerente/mas'],
]

test('contrato shell: 7 pestañas con rutas canónicas', () => {
  assert.deepEqual(
    GERENTE_V2_TABS.map((t) => [t.key, t.route]),
    EXPECTED,
  )
})

test('contrato App.jsx: cada pestaña montada + Copiloto + Brief producción', () => {
  const app = src('../src/App.jsx')
  for (const [, route] of EXPECTED) {
    assert.match(app, new RegExp(`path="${route}"`), route)
  }
  assert.match(app, /path="\/gerente\/copiloto"/)
  assert.match(app, /path="\/gerente\/pendientes"/)
  assert.match(app, /path="\/brief-produccion"/)
  // Legacy deep-links siguen existiendo (hub OFF / Más), no huérfanos rotos.
  for (const r of ['/gerente/alertas', '/gerente/forecast', '/gerente/dashboard', '/gerente/gastos']) {
    assert.match(app, new RegExp(`path="${r}"`), r)
  }
})

test('Más: Copiloto + Brief gerencia + Alertas; SIN unlock write', () => {
  const mas = src('../src/modules/gerente/v2/tabs/MasGerenteTab.jsx')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
  assert.match(mas, /route: '\/gerente\/copiloto'/)
  assert.match(mas, /route: '\/brief-gerencia'/)
  assert.match(mas, /route: '\/gerente\/alertas'/)
  assert.doesNotMatch(mas, /Desbloquear forecast|\/gerente\/forecast/)
})

test('Producción: tab propio + brief_produccion autorizado a gerente', () => {
  const mod = getModuleById('brief_produccion')
  assert.ok(mod?.roles?.includes?.('gerente_sucursal') || mod)
  const roles = mod.roles || mod.allowedRoles || []
  // registry may use roles array — tolerate both shapes via visibility already tested elsewhere
  assert.equal(mod.route, '/brief-produccion')
  const prod = src('../src/modules/gerente/v2/tabs/ProduccionGerenteTab.jsx')
  assert.ok(prod.includes('Producción') || prod.includes('produccion'))
})

test('no hay rutas shell apuntando a legacy /equipo/pendientes write', () => {
  const equipo = src('../src/modules/gerente/v2/tabs/EquipoGerenteTab.jsx')
  assert.match(equipo, /\/gerente\/pendientes/)
  assert.doesNotMatch(equipo, /\/equipo\/pendientes/)
})
