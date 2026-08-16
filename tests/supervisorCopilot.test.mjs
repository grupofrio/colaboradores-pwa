import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getModuleById } from '../src/modules/registry.js'
import { getNavModules, getHomeModulesForSession } from '../src/lib/navModel.js'
import {
  isSupervisorCopilotPath,
  SUPERVISOR_COPILOT_CHAT,
  SUPERVISOR_COPILOT_CAPABILITIES,
  buildSupervisorCopilotChatBody,
} from '../src/lib/supervisorCopilotRoute.js'

const src = (rel) => readFileSync(fileURLToPath(new URL('../src/' + rel, import.meta.url)), 'utf8')
const s = (role) => ({ employee_id: 100, session_token: 'h.p.s', role })

test('N5: copiloto_supervisor exige capability real en nav y home', () => {
  const without = s('supervisor_ventas')
  const withCap = { ...s('supervisor_ventas'), capabilities: { supervisorCopilot: true } }
  assert.ok(!getNavModules(without).some((m) => m.id === 'copiloto_supervisor'))
  assert.ok(!getHomeModulesForSession(without).some((m) => m.id === 'copiloto_supervisor'))
  assert.ok(getNavModules(withCap).some((m) => m.id === 'copiloto_supervisor'))
  assert.ok(getHomeModulesForSession(withCap).some((m) => m.id === 'copiloto_supervisor'))
  const mod = getModuleById('copiloto_supervisor')
  assert.equal(mod.route, '/equipo/copiloto')
  assert.deepEqual(mod.roles, ['supervisor_ventas'])
  assert.ok(!getNavModules(s('gerente_sucursal')).some((m) => m.id === 'copiloto_supervisor'))
  assert.ok(!getNavModules(s('supervisor_ventas')).some((m) => m.id === 'copiloto_supervisor'))
  assert.ok(getNavModules({
    ...s('supervisor_ventas'),
    capabilities: { supervisorCopilot: true },
  }).some((m) => m.id === 'copiloto_supervisor'))
})

test('no abre el Copiloto Gerencial', () => {
  const screen = src('modules/supervisor-ventas/v2/copilot/ScreenCopilotoSupervisor.jsx')
  const app = src('App.jsx')
  assert.doesNotMatch(screen, /ScreenCopilotoGerencial/)
  assert.doesNotMatch(screen, /\/gerente\/copiloto/)
  assert.doesNotMatch(screen, /confirmCopilotInvoice/)
  assert.match(app, /path="\/equipo\/copiloto"/)
  assert.match(app, /ScreenCopilotoSupervisor/)
})

test('rutas Odoo /pwa-supv/copilot sin n8n ni factura', () => {
  assert.equal(SUPERVISOR_COPILOT_CHAT, '/pwa-supv/copilot/chat')
  assert.ok(isSupervisorCopilotPath(SUPERVISOR_COPILOT_CAPABILITIES))
  assert.ok(!isSupervisorCopilotPath('/pwa-gerente/copilot/chat'))
  const lib = src('lib/api.js')
  const route = src('lib/supervisorCopilotRoute.js')
  assert.match(lib, /directSupervisorCopilot/)
  assert.match(lib, /SUPERVISOR_COPILOT_CHAT/)
  assert.match(route, /\/pwa-supv\/copilot\/chat/)
  assert.doesNotMatch(route, /invoice/)
  const body = buildSupervisorCopilotChatBody({
    message: 'hola',
    capability: 'get_expenses_summary',
    branch_id: 99,
  })
  assert.equal(body.capability, 'get_expenses_summary')
  assert.equal(body.branch_id, undefined)
})

test('pantalla read-only y chip de mañana', () => {
  const screen = src('modules/supervisor-ventas/v2/copilot/ScreenCopilotoSupervisor.jsx')
  assert.match(screen, /get_tomorrow_readiness/)
  assert.match(screen, /Solo consulta/)
  assert.match(screen, /\/equipo\/rutas\/planear/)
  assert.doesNotMatch(screen, /publishRoutePlan|optimizeRoutePlan|assignRoutePlanResources/)
})

test('P0-05/P1-05: copiloto gated + unwrap error + allowlist', async () => {
  const mod = getModuleById('copiloto_supervisor')
  assert.equal(mod.status, 'gated')
  const {
    unwrapSupervisorCopilotPayload,
    isAllowedSupervisorCopilotHref,
  } = await import('../src/modules/supervisor-ventas/v2/copilot/copilotSupervisorModel.js')
  assert.throws(
    () => unwrapSupervisorCopilotPayload({ ok: true, status: 'error', user_message: 'apagado', error: 'FEATURE_DISABLED' }),
    (err) => err.code === 'FEATURE_DISABLED',
  )
  assert.equal(isAllowedSupervisorCopilotHref('/equipo/rutas/planear'), true)
  assert.equal(isAllowedSupervisorCopilotHref('https://evil.example/phish'), false)
  const shell = src('modules/supervisor-ventas/v2/SupervisorV2Shell.jsx')
  assert.match(shell, /hasSupervisorCopilotCapability/)
  assert.match(shell, /t\.key !== 'copiloto'/)
})
