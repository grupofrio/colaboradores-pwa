/**
 * MGR-GAP-006 — no-regresión absoluta del Copiloto Gerencial.
 *
 * El stack draft FE#163/164 (shell "Mi Sucursal") se basó en historia pre-copiloto
 * y NO declara `/gerente/copiloto` ni `ScreenCopilotoGerencial`. Cualquier port del
 * shell a `main` DEBE conservar Copiloto + Mi Sucursal simultáneamente.
 *
 * Este archivo falla si desaparece la ruta, el módulo, el lazy import o el acceso
 * en hub/menú para el rol Gerente.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import { getModuleRouteDecisionForSession } from '../src/lib/navModel.js'

const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const hubSrc = readFileSync(new URL('../src/modules/gerente/ScreenGerente.jsx', import.meta.url), 'utf8')
const screenSrc = readFileSync(
  new URL('../src/modules/gerente/ScreenCopilotoGerencial.jsx', import.meta.url),
  'utf8',
)

const gerenteSession = {
  employee_id: 100,
  session_token: 'h.p.s',
  role: 'gerente_sucursal',
}

test('MGR-GAP-006: registry expone copiloto_gerencial en /gerente/copiloto', () => {
  const mod = getModuleById('copiloto_gerencial')
  assert.ok(mod, 'módulo copiloto_gerencial debe existir')
  assert.equal(mod.route, '/gerente/copiloto')
  assert.equal(mod.status, 'live')
  assert.ok(isModuleVisibleForRoles(mod, ['gerente_sucursal']))
})

test('MGR-GAP-006: Gerente puede entrar a copiloto_gerencial por ModuleRoleRoute', () => {
  assert.equal(
    getModuleRouteDecisionForSession('copiloto_gerencial', gerenteSession),
    'allow',
  )
})

test('MGR-GAP-006: App.jsx declara lazy + Route /gerente/copiloto', () => {
  assert.match(appSrc, /ScreenCopilotoGerencial/)
  assert.match(
    appSrc,
    /path=["']\/gerente\/copiloto["']/,
  )
  assert.match(appSrc, /moduleId=["']copiloto_gerencial["']/)
})

test('MGR-GAP-006: hub Gerente ofrece acceso a /gerente/copiloto', () => {
  assert.match(hubSrc, /\/gerente\/copiloto/)
  assert.match(hubSrc, /Copiloto Gerencial/)
})

test('MGR-GAP-006: pantalla Copiloto Gerencial existe y no es stub vacío', () => {
  assert.match(screenSrc, /export default function ScreenCopilotoGerencial/)
  assert.match(screenSrc, /Copiloto Gerencial/)
  assert.ok(screenSrc.length > 500, 'pantalla no debe quedar vacía')
})
