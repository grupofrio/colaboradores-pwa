import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getModuleById, isModuleVisibleForRoles } from '../src/modules/registry.js'
import {
  buildCopilotChatBody,
  filterManagerCopilotParams,
  isManagerCopilotPath,
  MANAGER_COPILOT_CHAT,
  MANAGER_COPILOT_CAPABILITIES,
  MANAGER_COPILOT_HISTORY,
  MANAGER_COPILOT_INVOICE_CONFIRM,
  buildCopilotInvoiceConfirmBody,
} from '../src/lib/managerCopilotRoute.js'
import { buildMobileNav, getNavModules } from '../src/lib/navModel.js'

const apiSrc = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8')
const screenSrc = readFileSync(new URL('../src/modules/gerente/ScreenCopilotoGerencial.jsx', import.meta.url), 'utf8')
const copilotApiSrc = readFileSync(new URL('../src/modules/gerente/copilotApi.js', import.meta.url), 'utf8')
const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

const s = (role) => ({ employee_id: 100, session_token: 'h.p.s', role })
const ids = (arr) => arr.map((m) => m.id)

test('registry: copiloto_gerencial solo gerente_sucursal', () => {
  const mod = getModuleById('copiloto_gerencial')
  assert.ok(mod)
  assert.equal(mod.route, '/gerente/copiloto')
  assert.equal(mod.status, 'live')
  assert.ok(isModuleVisibleForRoles(mod, ['gerente_sucursal']))
  assert.ok(!isModuleVisibleForRoles(mod, ['supervisor_ventas']))
  assert.ok(!isModuleVisibleForRoles(mod, ['auxiliar_admin']))
  assert.ok(!isModuleVisibleForRoles(mod, ['jefe_ruta']))
})

test('nav gerente: copiloto en overflow, no desplaza Admin/Gerente', () => {
  const m = buildMobileNav(s('gerente_sucursal'), '/')
  assert.deepEqual(ids(m.primary), ['admin_sucursal', 'gerente'])
  assert.ok(ids(m.overflow).includes('copiloto_gerencial'))
  assert.ok(!ids(getNavModules(s('supervisor_ventas'))).includes('copiloto_gerencial'))
})

test('ruta dedicada: no n8n y no generic readModel', () => {
  assert.match(apiSrc, /function directManagerCopilot/)
  assert.match(apiSrc, /directManagerCopilot,/)
  assert.match(copilotApiSrc, /\/pwa-gerente\/copilot\/chat/)
  assert.doesNotMatch(copilotApiSrc, /n8n/)
  assert.doesNotMatch(screenSrc, /readModelSorted/)
  assert.ok(appSrc.includes('moduleId="copiloto_gerencial"'))
})

test('isManagerCopilotPath allowlist exacta', () => {
  assert.equal(isManagerCopilotPath(MANAGER_COPILOT_CHAT), true)
  assert.equal(isManagerCopilotPath(MANAGER_COPILOT_HISTORY), true)
  assert.equal(isManagerCopilotPath(MANAGER_COPILOT_CAPABILITIES), true)
  assert.equal(isManagerCopilotPath(MANAGER_COPILOT_INVOICE_CONFIRM), true)
  assert.equal(isManagerCopilotPath('/pwa-gerente/alerts'), false)
  assert.equal(isManagerCopilotPath('/pwa-gerente/copilot/chat/../alerts'), false)
})

test('body de chat NO incluye branch_id ni company_id', () => {
  const body = buildCopilotChatBody({
    message: '¿Cómo vamos?',
    conversation_id: 12,
    capability: 'get_sales_vs_target',
    branch_id: 7,
    company_id: 99,
    employee_id: 1,
  })
  assert.equal(body.message, '¿Cómo vamos?')
  assert.equal(body.capability, 'get_sales_vs_target')
  assert.ok(!('branch_id' in body))
  assert.ok(!('company_id' in body))
  assert.ok(!('employee_id' in body))
})

test('query de history solo deja conversation_id', () => {
  const params = filterManagerCopilotParams(new URLSearchParams({
    conversation_id: '9',
    branch_id: '7',
    employee_id: '1',
  }))
  assert.deepEqual(params, { conversation_id: '9' })
})

test('pantalla: sucursal de sesión/backend, chips, retry, sin branch_id', () => {
  assert.match(screenSrc, /Copiloto Gerencial/)
  assert.match(screenSrc, /session\?\.sucursal/)
  assert.match(screenSrc, /Reintentar/)
  assert.match(screenSrc, /¿Cómo vamos hoy\?/)
  assert.match(screenSrc, /FEATURE_DISABLED/)
  assert.doesNotMatch(screenSrc, /branch_id/)
  assert.match(screenSrc, /data\.cards/)
  assert.match(screenSrc, /data\?\.llm/)
  assert.match(screenSrc, /Confirmar factura/)
  assert.match(screenSrc, /Descargar PDF/)
  assert.match(copilotApiSrc, /\/pwa-gerente\/copilot\/invoice\/confirm/)
})

test('confirmación de factura no lleva branch_id', () => {
  const body = buildCopilotInvoiceConfirmBody({
    confirmation_token: 'tok',
    branch_id: 7,
    company_id: 9,
  })
  assert.equal(body.confirmation_token, 'tok')
  assert.ok(!('branch_id' in body))
  assert.ok(!('company_id' in body))
})

test('handler reconstruye body seguro (no reenvía branch_id del caller)', () => {
  assert.match(apiSrc, /buildCopilotChatBody\(body \|\| \{\}\)/)
})
