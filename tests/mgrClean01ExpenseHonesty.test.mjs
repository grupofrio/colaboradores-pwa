import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  stripExpenseCreateReservedFields,
  unwrapExpenseListEnvelope,
} from '../src/modules/admin/expenseListEnvelope.js'
import { createFuelExpense } from '../src/modules/admin/api.js'
import { buildFase0ExpensePayload } from '../src/modules/admin/expenseAccounting.js'
import {
  isGerentePilotReadOnly,
  ADMIN_NAV_ACCESS,
} from '../src/modules/admin/gerentePilotCaps.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalWindow = globalThis.window

function createLocalStorageMock() {
  let store = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalLocalStorage
  globalThis.window = originalWindow
})

test('unwrapExpenseListEnvelope: envelope with expenses array', () => {
  const out = unwrapExpenseListEnvelope({
    ok: true,
    data: { expenses: [{ id: 1 }], count: 1, total_amount: 10 },
  })
  assert.equal(out.status, 'ok')
  assert.equal(out.items.length, 1)
  assert.equal(out.meta.count, 1)
})

test('unwrapExpenseListEnvelope: real empty vs unavailable vs error', () => {
  assert.equal(
    unwrapExpenseListEnvelope({ ok: true, data: { expenses: [], count: 0 } }).status,
    'empty',
  )
  assert.equal(
    unwrapExpenseListEnvelope({ ok: true, data: { count: 0 } }).status,
    'unavailable',
  )
  const err = unwrapExpenseListEnvelope({ ok: false, message: 'boom' })
  assert.equal(err.status, 'error')
  assert.match(err.message, /boom/)
})

test('unwrapExpenseListEnvelope: bare array legacy', () => {
  assert.equal(unwrapExpenseListEnvelope([]).status, 'empty')
  assert.equal(unwrapExpenseListEnvelope([{ id: 9 }]).status, 'ok')
})

test('stripExpenseCreateReservedFields removes payment_mode variants', () => {
  const clean = stripExpenseCreateReservedFields({
    name: 'Papelería',
    total_amount: 50,
    payment_mode: 'company_account',
    paymentMode: 'company',
    employee_id: 717,
    product_id: 55,
  })
  assert.equal('payment_mode' in clean, false)
  assert.equal('paymentMode' in clean, false)
  assert.equal('employee_id' in clean, false)
  assert.equal(clean.product_id, 55)
  assert.equal(clean.total_amount, 50)
})

test('adminService.createExpense strips reserved fields before apiCreateExpense', () => {
  const src = readFileSync(join(root, 'src/modules/admin/adminService.js'), 'utf8')
  assert.match(src, /stripExpenseCreateReservedFields/)
  const fn = src.slice(
    src.indexOf('export async function createExpense'),
    src.indexOf('export async function createRequisition'),
  )
  assert.match(fn, /stripExpenseCreateReservedFields/)
})

test('createFuelExpense strips payment_mode before POST', async () => {
  globalThis.localStorage = createLocalStorageMock()
  globalThis.window = { dispatchEvent() {} }
  globalThis.localStorage.setItem('gf_session', JSON.stringify({
    session_token: 'tok',
    employee_id: 10,
  }))
  let sent
  globalThis.fetch = async (_url, options = {}) => {
    sent = JSON.parse(options.body)
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ ok: true, data: { expense_id: 44 } })
      },
    }
  }
  await createFuelExpense({
    name: 'Gasolina',
    total_amount: 250,
    quantity: 1,
    date: '2026-08-05',
    payment_mode: 'company_account',
    route_plan_id: 91,
    company_id: 9,
  })
  const payload = sent.params || sent
  assert.equal('payment_mode' in payload, false)
  assert.equal(payload.route_plan_id, 91)
  assert.equal(payload.company_id, undefined)
})

test('fase0 payload still ignores payment_mode if mistakenly passed', () => {
  const payload = buildFase0ExpensePayload({
    article: {
      product_id: 55,
      allowed_operations: ['purchase'],
      allowed_asset_kinds: [],
      requires_asset: false,
    },
    name: 'Papelería',
    amount: 200,
    quantity: 1,
    date: '2026-08-15',
    operation: 'purchase',
    payment_mode: 'own_account',
  })
  assert.equal('payment_mode' in payload, false)
})

test('Gerente RO sources hide create CTA and payment_mode UI', () => {
  const base = readFileSync(join(root, 'src/modules/shared/GastosScreenBase.jsx'), 'utf8')
  const form = readFileSync(join(root, 'src/modules/admin/forms/AdminGastosForm.jsx'), 'utf8')
  assert.match(base, /isGerentePilotReadOnly/)
  assert.match(base, /!readOnly &&/)
  assert.doesNotMatch(base, /payment_mode/)
  assert.doesNotMatch(base, /paymentMode/)
  assert.match(form, /isGerentePilotReadOnly/)
  assert.match(form, /\{!readOnly && \(/)
  assert.doesNotMatch(form, /payment_mode/)
  assert.doesNotMatch(form, /paymentMode/)
  assert.doesNotMatch(form, /Modo de pago/)
})

test('Gerente RO: pure gerente with writes OFF', () => {
  assert.equal(
    isGerentePilotReadOnly(
      { role: 'gerente_sucursal', additional_job_keys: [] },
      { gerenteWritesEnabled: false },
    ),
    true,
  )
  assert.equal(ADMIN_NAV_ACCESS.MIXED, 'mixed')
})

test('Hub caja is not ventas alias (available:false honesty)', () => {
  const hub = readFileSync(join(root, 'src/modules/admin/components/HubV2.jsx'), 'utf8')
  const svc = readFileSync(join(root, 'src/modules/admin/adminService.js'), 'utf8')
  assert.match(svc, /cash_shift_hub_source_unavailable/)
  assert.match(svc, /liquidaciones_hub_source_unavailable/)
  assert.match(svc, /requisitions_hub_source_unavailable/)
  assert.match(svc, /materia_prima_hub_source_unavailable/)
  assert.match(svc, /available:\s*false/)
  assert.match(hub, /sin fuente de caja/)
  assert.match(hub, /data-origin=\{k\.unavailable \? 'hub-kpi-unavailable' : 'hub-kpi'\}/)
  assert.match(hub, /fmtOrDash/)
  assert.doesNotMatch(svc, /caja:\s*\{\s*count:\s*sales\.length/)
})

test('AdminRequisicionForm has no dead approve/reject CTAs', () => {
  const src = readFileSync(join(root, 'src/modules/admin/forms/AdminRequisicionForm.jsx'), 'utf8')
  assert.doesNotMatch(src, /false\s*&&/)
  assert.doesNotMatch(src, /approveRequisition/)
  assert.doesNotMatch(src, /rejectRequisition/)
  assert.doesNotMatch(src, /handleApprove/)
})

test('BACKEND_CAPS default keeps gerenteWritesEnabled fail-closed', () => {
  const src = readFileSync(join(root, 'src/modules/admin/adminService.js'), 'utf8')
  assert.match(src, /gerenteWritesEnabled:\s*false/)
})
