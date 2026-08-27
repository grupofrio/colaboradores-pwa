// packingLocalStore.js
// Cache local de packing entries por turno, namespaced por empleado.
// Fuente de verdad: Odoo. Este store actua como fallback y respaldo
// para que el conteo no se pierda si Odoo devuelve vacio temporalmente.
//
// Estructura: { [shiftId]: { entries: [...], savedAt: ISO string } }
// Se mantienen los ultimos MAX_SHIFTS turnos; los mas viejos se purgan.

import {
  EMPLOYEE_SCOPED_KEYS,
  readEmployeeScopedJson,
  writeEmployeeScopedJson,
} from '../../lib/employeeScopedStorage.js'

const MAX_SHIFTS = 5

function readStore(employeeId) {
  const store = readEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.packing, employeeId, {})
  return store && typeof store === 'object' && !Array.isArray(store) ? store : {}
}

function writeStore(employeeId, data) {
  writeEmployeeScopedJson(EMPLOYEE_SCOPED_KEYS.packing, employeeId, data)
}

function pruneOldShifts(store) {
  const keys = Object.keys(store)
  if (keys.length <= MAX_SHIFTS) return store
  keys.sort((a, b) => ((store[a]?.savedAt || '') < (store[b]?.savedAt || '') ? -1 : 1))
  keys.slice(0, keys.length - MAX_SHIFTS).forEach(k => delete store[k])
  return store
}

/**
 * Lee las entradas locales de empaque para un turno.
 * @param {number} shiftId
 * @param {number} employeeId
 * @returns {Array}
 */
export function getLocalPackingEntries(shiftId, employeeId) {
  if (!shiftId || !employeeId) return []
  return readStore(employeeId)[String(shiftId)]?.entries || []
}

/**
 * Sobreescribe el cache local con los datos que vinieron de Odoo.
 * @param {number} shiftId
 * @param {Array} entries
 * @param {number} employeeId
 */
export function saveLocalPackingEntries(shiftId, entries, employeeId) {
  if (!shiftId || !employeeId || !Array.isArray(entries)) return
  const store = pruneOldShifts(readStore(employeeId))
  store[String(shiftId)] = {
    entries,
    savedAt: new Date().toISOString(),
    employee_id: Number(employeeId),
  }
  writeStore(employeeId, store)
}

/**
 * Agrega o actualiza una entrada individual al cache.
 * @param {number} shiftId
 * @param {object} entry
 * @param {number} employeeId
 */
export function addLocalPackingEntry(shiftId, entry, employeeId) {
  if (!shiftId || !employeeId || !entry?.id) return
  const existing = getLocalPackingEntries(shiftId, employeeId).filter(e => e.id !== entry.id)
  saveLocalPackingEntries(shiftId, [...existing, { ...entry, employee_id: Number(employeeId) }], employeeId)
}

/**
 * Total de kg empacados segun el cache local.
 * @param {number} shiftId
 * @param {number} employeeId
 * @returns {number}
 */
export function getLocalPackingTotalKg(shiftId, employeeId) {
  return getLocalPackingEntries(shiftId, employeeId).reduce((sum, e) => sum + (Number(e.total_kg) || 0), 0)
}

/**
 * Timestamp de la ultima sincronizacion con Odoo.
 * @param {number} shiftId
 * @param {number} employeeId
 * @returns {string|null}
 */
export function getLocalPackingSavedAt(shiftId, employeeId) {
  if (!shiftId || !employeeId) return null
  return readStore(employeeId)[String(shiftId)]?.savedAt || null
}
