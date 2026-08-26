import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  EMPLOYEE_SCOPED_KEYS,
  UNOWNED_LEGACY_KEYS,
  discardUnownedEmployeeScopedKeys,
  clearOutgoingEmployeeScopedState,
  employeeScopedKey,
  readEmployeeScopedJson,
  writeEmployeeScopedJson,
  rowBelongsToEmployee,
} from '../src/lib/employeeScopedStorage.js'

const originalLocalStorage = globalThis.localStorage
const ptServiceSrc = readFileSync(
  fileURLToPath(new URL('../src/modules/almacen-pt/ptService.js', import.meta.url)),
  'utf8',
)

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null },
    setItem(key, value) { store.set(key, String(value)) },
    removeItem(key) { store.delete(key) },
    clear() { store.clear() },
    key(index) { return [...store.keys()][index] ?? null },
    get length() { return store.size },
  }
}

function writeTransfer(employeeId, row) {
  const list = readEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, employeeId, [])
  const next = Array.isArray(list) ? list : []
  next.unshift({
    timestamp: new Date().toISOString(),
    pending_validation: true,
    ...row,
    employee_id: Number(employeeId),
  })
  writeEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, employeeId, next)
}

function todayTransfers(employeeId) {
  const all = readEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, employeeId, [])
  if (!Array.isArray(all)) return []
  return all.filter((row) => rowBelongsToEmployee(row, employeeId))
}

function reservationMap({ warehouseId, destinationWarehouseId, employeeId } = {}) {
  const items = todayTransfers(employeeId).filter((row) => {
    if (!rowBelongsToEmployee(row, employeeId)) return false
    if (warehouseId && Number(row.warehouse_id || 0) !== Number(warehouseId)) return false
    if (destinationWarehouseId && Number(row.destination_warehouse_id || row.cedis_id || 0) !== Number(destinationWarehouseId)) return false
    return row.pending_validation !== false
  })
  const reservation = {}
  for (const row of items) {
    for (const line of Array.isArray(row.lines) ? row.lines : []) {
      const productId = Number(line.product_id || 0)
      const qty = Number(line.qty || line.quantity || 0)
      if (productId > 0 && qty > 0) {
        reservation[productId] = (reservation[productId] || 0) + qty
      }
    }
  }
  return reservation
}

function resolveByPicking(pickingId, action, employeeId) {
  if (!Number(employeeId) || !Number(pickingId)) return false
  const all = readEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, employeeId, [])
  if (!Array.isArray(all)) return false
  let changed = false
  const next = all.map((row) => {
    if (!rowBelongsToEmployee(row, employeeId)) return row
    const rowPicking = Number(row.picking_id || row.backend_id || row.id || 0)
    if (!rowPicking || rowPicking !== Number(pickingId || 0)) return row
    changed = true
    return { ...row, pending_validation: false, resolved_action: action }
  })
  if (changed) writeEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, employeeId, next)
  return changed
}

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock()
})

test.afterEach(() => {
  globalThis.localStorage = originalLocalStorage
})

test('ptService exige employee_id en lecturas y mutaciones locales', () => {
  assert.match(ptServiceSrc, /export function getTodayTransfersLocal\(employeeId\)/)
  assert.match(ptServiceSrc, /export function getTodayReceptionsLocal\(employeeId\)/)
  assert.match(ptServiceSrc, /export function resolveLocalTransferByPicking\(pickingId, action = 'accepted', employeeId\)/)
  assert.match(ptServiceSrc, /if \(!Number\(employeeId\) \|\| !Number\(pickingId\)\) return false/)
  assert.match(ptServiceSrc, /rowBelongsToEmployee\(row, employeeId\)/)
  assert.match(ptServiceSrc, /row\.picking_id \|\| row\.backend_id \|\| row\.id/)
  assert.match(ptServiceSrc, /EMPLOYEE_SCOPED_KEYS\.transfers/)
  assert.match(ptServiceSrc, /EMPLOYEE_SCOPED_KEYS\.receptions/)
  assert.doesNotMatch(ptServiceSrc, /localStorage\.getItem\('gf_pt_transfers'\)/)
})

test('claves históricas sin dueño se descartan y no se asignan a 694', () => {
  globalThis.localStorage.setItem('gf_pt_transfers', JSON.stringify([
    { employee_id: 738, picking_id: 501, lines: [{ product_id: 1, qty: 9 }] },
  ]))
  globalThis.localStorage.setItem('gf_pt_receptions', JSON.stringify([{ employee_id: 738 }]))
  globalThis.localStorage.setItem('gfsc.packing_local.v2', JSON.stringify({ 88: { entries: [{ id: 1 }] } }))

  discardUnownedEmployeeScopedKeys()

  for (const key of UNOWNED_LEGACY_KEYS) {
    assert.equal(globalThis.localStorage.getItem(key), null, key)
  }
  assert.equal(todayTransfers(694).length, 0)
  assert.equal(readEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.transfers, 694, []).length || 0, 0)
})

test('cambio 738 → 694 no lee ni muta el log del empleado anterior', () => {
  writeTransfer(738, {
    picking_id: 501,
    backend_id: 501,
    warehouse_id: 76,
    lines: [{ product_id: 11, qty: 4 }],
  })
  writeTransfer(694, {
    picking_id: 501,
    backend_id: 501,
    warehouse_id: 94,
    lines: [{ product_id: 22, qty: 2 }],
  })

  const key738 = employeeScopedKey(EMPLOYEE_SCOPED_KEYS.transfers, 738)
  const key694 = employeeScopedKey(EMPLOYEE_SCOPED_KEYS.transfers, 694)
  assert.notEqual(key738, key694)

  const mine = todayTransfers(694)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].employee_id, 694)
  assert.equal(mine[0].lines[0].product_id, 22)

  const previous = todayTransfers(738)
  assert.equal(previous.length, 1)
  assert.equal(previous[0].employee_id, 738)
})

test('colisión de picking_id no cruza empleados', () => {
  writeTransfer(738, { picking_id: 777, backend_id: 777, warehouse_id: 76, lines: [{ product_id: 1, qty: 3 }] })
  writeTransfer(694, { picking_id: 777, backend_id: 777, warehouse_id: 94, lines: [{ product_id: 1, qty: 3 }] })

  assert.equal(resolveByPicking(777, 'accepted', 694), true)
  assert.equal(todayTransfers(694)[0].pending_validation, false)
  assert.equal(todayTransfers(738)[0].pending_validation, true)
  assert.equal(resolveByPicking(777, 'accepted'), false)
})

test('mapa de reservaciones solo suma filas del empleado y almacén pedidos', () => {
  writeTransfer(694, {
    warehouse_id: 94,
    destination_warehouse_id: 116,
    lines: [{ product_id: 50, qty: 7 }],
  })
  writeTransfer(738, {
    warehouse_id: 94,
    destination_warehouse_id: 116,
    lines: [{ product_id: 50, qty: 99 }],
  })

  const map = reservationMap({
    warehouseId: 94,
    destinationWarehouseId: 116,
    employeeId: 694,
  })
  assert.equal(map[50], 7)
  assert.deepEqual(reservationMap({ warehouseId: 94, employeeId: 0 }), {})
})

test('cambio de identidad 738 → 694 borra claves operativas de 738 y conserva preferencias', () => {
  const storage = globalThis.localStorage
  storage.setItem('gf_pt_transfers.v2.738', JSON.stringify([{ employee_id: 738 }]))
  storage.setItem('gf_pt_receptions.v2.738', JSON.stringify([{ employee_id: 738 }]))
  storage.setItem('gfsc.packing_local.v3.738', JSON.stringify({ 1: { entries: [] } }))
  storage.setItem('gf_ui_theme', 'dark')
  storage.setItem('printer_pref', 'tm-t20')

  clearOutgoingEmployeeScopedState(738, storage)

  assert.equal(storage.getItem('gf_pt_transfers.v2.738'), null)
  assert.equal(storage.getItem('gf_pt_receptions.v2.738'), null)
  assert.equal(storage.getItem('gfsc.packing_local.v3.738'), null)
  assert.equal(storage.getItem('gf_ui_theme'), 'dark')
  assert.equal(storage.getItem('printer_pref'), 'tm-t20')

  const nextSession = {
    employee_id: 694,
    role: 'almacenista_entregas',
    session_token: 'tok-694',
  }
  storage.setItem('gf_session', JSON.stringify(nextSession))
  const persisted = JSON.parse(storage.getItem('gf_session'))
  assert.equal(persisted.employee_id, 694)
  assert.equal(persisted.role, 'almacenista_entregas')
  assert.equal(storage.getItem(employeeScopedKey(EMPLOYEE_SCOPED_KEYS.transfers, 694)), null)
})
