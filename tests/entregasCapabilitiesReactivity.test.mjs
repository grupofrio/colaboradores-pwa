import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  applyCapabilities,
  invalidateCashShiftCapabilities,
} from '../src/modules/admin/adminService.js'
import {
  getBackendCapabilitiesSnapshot,
  subscribeBackendCapabilities,
} from '../src/modules/admin/backendCapsStore.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const SESSION = {
  employee_id: 694,
  role: 'almacenista_entregas',
  additional_job_keys: [],
  company_id: 34,
  warehouse_id: 94,
  odoo_employee_token: 'token-694',
  session_token: 'h.p.s',
}

const VALID_CONTRACT = {
  contract_version: '2.0',
  effective_job_keys: ['almacenista_entregas'],
  published_scope: {
    company_id: 34,
    company_label: 'GLACIEM',
    plaza_id: 12,
    plaza_label: 'GUADALAJARA',
    warehouse_id: 94,
    warehouse_label: 'CEDIS GDL',
    analytic_id: 12,
    city_code: 'GDL',
    from_actor: false,
  },
  capabilities: {
    'materials.issue.iguala': denied('not_granted'),
    'delivery.transfer.gdl': allowed('confirm'),
    'delivery.return.gdl': allowed('capture'),
    'liquidation.read.gdl': denied('not_granted'),
    'liquidation.print.gdl': denied('not_granted'),
    'liquidation.receive_cash.gdl': denied('not_granted'),
    'liquidation.validate.gdl': denied('not_granted'),
    'liquidation.authorize_discrepancy.gdl': denied('not_granted'),
    'buyer.read': denied('not_granted'),
    'buyer.capture': denied('not_granted'),
    'buyer.approve': denied('not_granted'),
    'buyer.confirm': denied('not_granted'),
    'pos.read': denied('not_granted'),
    'pos.operate': denied('not_granted'),
    'attendance.read': denied('not_granted'),
    'attendance.capture': denied('not_granted'),
    'payroll.csc.read': denied('not_granted'),
    'payroll.csc.capture': denied('not_granted'),
  },
}

function denied(code) {
  return {
    allowed: false,
    mode: null,
    scopes: { company_ids: [], plaza_ids: [], warehouse_ids: [], analytic_ids: [] },
    limit: null,
    currency: null,
    deny: { code, reason: code },
  }
}

function allowed(mode) {
  return {
    allowed: true,
    mode,
    scopes: {
      company_ids: [34],
      plaza_ids: [12],
      warehouse_ids: [94],
      analytic_ids: [12],
    },
    limit: null,
    currency: null,
    deny: null,
  }
}

test('backend caps store notifica invalidación e hidratación para evitar UI stale en Entregas', () => {
  const seen = []
  const unsubscribe = subscribeBackendCapabilities(() => {
    seen.push(getBackendCapabilitiesSnapshot().revision)
  })

  const initial = getBackendCapabilitiesSnapshot().revision
  invalidateCashShiftCapabilities()
  applyCapabilities(VALID_CONTRACT, SESSION)
  unsubscribe()

  assert.equal(seen.length >= 2, true)
  assert.equal(seen[0] > initial, true)
  assert.equal(seen.at(-1) > seen[0], true)
})

test('Home, navbar y ModuleRoleRoute se suscriben al snapshot reactivo de capabilities', () => {
  const home = src('../src/screens/ScreenHome.jsx')
  const nav = src('../src/components/AppNav.jsx')
  const app = src('../src/App.jsx')

  assert.match(home, /useBackendCapabilitiesSnapshot/)
  assert.match(home, /getHomeModulesForSession\(session\)/)
  assert.match(nav, /useBackendCapabilitiesSnapshot/)
  assert.match(app, /useBackendCapabilitiesSnapshot/)
  assert.match(app, /function ModuleRoleRoute\(\{ moduleId, children \}\)/)
})
