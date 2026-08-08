import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  cashShiftAccessMode,
  isCashShiftNavigationVisible,
} from '../src/lib/navModel.js'

const shellSource = readFileSync(
  new URL('../src/modules/admin/components/AdminShell.jsx', import.meta.url),
  'utf8',
)
const hubSource = readFileSync(
  new URL('../src/modules/admin/ScreenAdminPanel.jsx', import.meta.url),
  'utf8',
)
const screenSource = readFileSync(
  new URL('../src/modules/admin/ScreenCierreCaja.jsx', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const navItemsSource = readFileSync(new URL('../src/modules/admin/adminNavItems.js', import.meta.url), 'utf8')

test('cash-shift navigation fails closed and accepts only own server booleans', () => {
  assert.equal(isCashShiftNavigationVisible({}), false)
  assert.equal(isCashShiftNavigationVisible({ cashShiftManage: false, cashShiftAuthorize: false }), false)
  assert.equal(isCashShiftNavigationVisible({ cashShiftManage: 1 }), false)
  assert.equal(isCashShiftNavigationVisible({ cashShiftAuthorize: 'true' }), false)
  assert.equal(isCashShiftNavigationVisible(Object.create({ cashShiftManage: true })), false)
  assert.equal(isCashShiftNavigationVisible({ cashShiftManage: true }), true)
  assert.equal(isCashShiftNavigationVisible({ cashShiftAuthorize: true }), true)
})

test('manage takes precedence and authorizer-only never becomes general management', () => {
  assert.equal(cashShiftAccessMode({}), 'denied')
  assert.equal(cashShiftAccessMode({ cashShiftAuthorize: true }), 'authorize')
  assert.equal(cashShiftAccessMode({ cashShiftManage: true }), 'manage')
  assert.equal(cashShiftAccessMode({ cashShiftManage: true, cashShiftAuthorize: true }), 'manage')
})

test('admin desktop and mobile navigation use the same server capability gate and label', () => {
  // NAV_ITEMS se movió a adminNavItems.js (fuente única compartida con la
  // autorización por subruta). El ítem sigue existiendo y con el mismo label.
  assert.match(navItemsSource, /label:\s*['"]Cortes de caja['"]/)
  assert.match(shellSource, /import \{ NAV_ITEMS \} from '\.\.\/adminNavItems'/)
  assert.match(shellSource, /isCashShiftNavigationVisible/)
  assert.match(hubSource, /label:\s*['"]Cortes de caja['"]/)
  assert.match(hubSource, /isCashShiftNavigationVisible/)
  assert.doesNotMatch(shellSource, /allow_manage_pos_cash_shifts|allow_authorize_cash_closing|is_direccion_general/)
  assert.doesNotMatch(hubSource, /allow_manage_pos_cash_shifts|allow_authorize_cash_closing|is_direccion_general/)
})

test('the existing /admin/cierre route remains wired to a screen-level safe gate', () => {
  // La ruta sigue montando ScreenCierreCaja (el gate a nivel pantalla), ahora
  // envuelta en AdminSubRoute, que revalida el rol de la SUBRUTA. Antes el rol
  // solo se comprobaba una vez en el padre /admin.
  assert.match(appSource, /<Route path="cierre" element=\{<AdminSubRoute path="\/admin\/cierre"><ScreenCierreCaja \/><\/AdminSubRoute>\}/)
  assert.match(screenSource, /cashShiftAccessMode/)
  assert.match(screenSource, /capabilitiesReady|capsReady/)
  assert.doesNotMatch(screenSource, /AdminCierreForm|getTodaySales|getTodayExpenses|getCashClosing/)
  assert.doesNotMatch(screenSource, /allow_manage_pos_cash_shifts|allow_authorize_cash_closing|is_direccion_general/)
})

test('Hector, day POS and an auxiliary legacy role cannot self-grant a cash-shift mode', () => {
  for (const session of [
    { name: 'Hector Tapia', night_pos: true, allow_manage_pos_cash_shifts: true },
    { role: 'pos_diurno', pos_diurno: true, allow_authorize_cash_closing: true },
    { role: 'auxiliar_admin', cash_closing_write: true },
  ]) {
    assert.equal(cashShiftAccessMode(session), 'denied')
    assert.equal(isCashShiftNavigationVisible(session), false)
  }
})
