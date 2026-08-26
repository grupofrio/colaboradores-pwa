// Estado local versionado por empleado.
// Las claves históricas sin dueño se descartan; nunca se asignan a la
// siguiente persona. Toda lectura/mutación exige employee_id.

export const EMPLOYEE_SCOPED_KEYS = Object.freeze({
  transfers: 'gf_pt_transfers.v2.',
  receptions: 'gf_pt_receptions.v2.',
  packing: 'gfsc.packing_local.v3.',
})

export const UNOWNED_LEGACY_KEYS = Object.freeze([
  'gf_pt_transfers',
  'gf_pt_receptions',
  'gfsc.packing_local.v2',
])

function toEmployeeId(employeeId) {
  const id = Number(employeeId)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export function employeeScopedKey(prefix, employeeId) {
  const id = toEmployeeId(employeeId)
  if (!id) return null
  return `${prefix}${id}`
}

export function discardUnownedEmployeeScopedKeys(storage = globalThis.localStorage) {
  if (!storage) return
  for (const key of UNOWNED_LEGACY_KEYS) {
    try { storage.removeItem(key) } catch { /* ignore */ }
  }
}

export function readEmployeeScopedJson(prefix, employeeId, fallback) {
  const key = employeeScopedKey(prefix, employeeId)
  if (!key) return fallback
  try {
    const raw = globalThis.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeEmployeeScopedJson(prefix, employeeId, value) {
  const key = employeeScopedKey(prefix, employeeId)
  if (!key) return false
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function rowBelongsToEmployee(row, employeeId) {
  const id = toEmployeeId(employeeId)
  if (!id || !row || typeof row !== 'object') return false
  return Number(row.employee_id) === id
}
