/**
 * MGR-GAP-010 — Producción accesible para Gerente.
 * El fallback del shell a /brief-produccion debe estar autorizado para
 * gerente_sucursal (antes solo supervisor_produccion + direccion_general).
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import { getModuleRouteDecisionForSession } from '../src/lib/navModel.js'
import { BRIEFS } from '../src/modules/brief/briefCatalog.js'

const s = (role) => ({ employee_id: 100, session_token: 'h.p.s', role })

test('MGR-GAP-010: registry brief_produccion admite gerente_sucursal', () => {
  const mod = getModuleById('brief_produccion')
  assert.ok(mod)
  assert.equal(mod.route, '/brief-produccion')
  assert.ok(isModuleVisibleForRoles(mod, ['gerente_sucursal']))
  assert.ok(isModuleVisibleForRoles(mod, ['supervisor_produccion']))
})

test('MGR-GAP-010: ModuleRoleRoute allows gerente into brief_produccion', () => {
  assert.equal(getModuleRouteDecisionForSession('brief_produccion', s('gerente_sucursal')), 'allow')
})

test('MGR-GAP-010: briefCatalog viewerRoles incluye gerente_sucursal', () => {
  const brief = BRIEFS.find((b) => b.moduleId === 'brief_produccion' || b.route === '/brief-produccion')
  assert.ok(brief)
  assert.ok(brief.viewerRoles.includes('gerente_sucursal'))
})
