// ─── Supervisor V2 · identidad de SESIÓN/SUCURSAL para claves de caché ────────
// Codex §5/§6: las claves de caché de day-control y route-stops DEBEN incluir una
// identidad NO manipulable por el usuario (no basta `day:${date}`). Se deriva de
// la sesión real (huella del token de empleado, employee id, warehouse/branch,
// company) + versión de contrato de caché. Al cambiar sesión / token / empleado /
// sucursal / company, la clave CAMBIA ⇒ no se reutiliza data de otro scope y una
// respuesta anterior (de otra identidad) no puede pintar como si fuera la actual.
//
// `session` es inyectable (tests SSR/node sin localStorage). Sin argumento, lee
// defensivamente `gf_session` de localStorage.

// Sube esta versión cuando cambie la FORMA de lo cacheado (invalida todo lo viejo).
export const CACHE_CONTRACT_VERSION = 'v2.1'

// Lectura DEFENSIVA de la sesión (SSR/node ⇒ sin localStorage ⇒ {}).
export function readSessionRaw() {
  try {
    if (typeof localStorage === 'undefined') return {}
    return JSON.parse(localStorage.getItem('gf_session') || '{}')
  } catch {
    return {}
  }
}

// Huella estable del token de empleado (identidad de sesión) SIN exponer el token
// completo en la clave: solo su longitud + últimos 10 caracteres.
function tokenFingerprint(session) {
  const t = String(session.odoo_employee_token || session.gf_employee_token || '')
  return t ? `${t.length}_${t.slice(-10)}` : ''
}

/**
 * Clave de identidad de scope (string estable). Cambia si cambia CUALQUIERA de:
 * token de empleado, employee id, warehouse/branch, company, versión de contrato.
 * @param {object|null} session  sesión inyectable (null ⇒ lee gf_session)
 * @returns {string}
 */
export function sessionScopeKey(session = null) {
  const s = session || readSessionRaw()
  const emp = s.employee_id || (s.employee && s.employee.id) || ''
  const wh = s.warehouse_id || s.plant_warehouse_id || ''
  const company = s.company_id || ''
  const branch = s.analytic_account_id || s.branch_config_id || ''
  return [CACHE_CONTRACT_VERSION, tokenFingerprint(s), emp, wh, company, branch].join(':')
}
