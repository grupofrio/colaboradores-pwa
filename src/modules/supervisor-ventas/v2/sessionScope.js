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

// Huella de sesión NO sensible (Codex §4/§6): se usa el `odoo_employee_session_id`
// que el backend (magic-link) ya provee como identificador de sesión — cambia por
// login y no es el token ni deriva de él (no longitud/sufijo/hash improvisado). Si
// no existe, cae a otros ids de sesión no sensibles; nunca al token de empleado.
// La seguridad NO depende de esta huella: solo separa cachés por sesión.
function sessionFingerprint(session) {
  return String(
    session.odoo_employee_session_id
    || session.gf_employee_session_id
    || session.session_id
    || '',
  )
}

/**
 * Clave de identidad de scope (string estable). Cambia si cambia CUALQUIERA de:
 * sesión (session_id), employee id, warehouse/branch, company, versión de contrato.
 * @param {object|null} session  sesión inyectable (null ⇒ lee gf_session)
 * @returns {string}
 */
export function sessionScopeKey(session = null) {
  const s = session || readSessionRaw()
  const emp = s.employee_id || (s.employee && s.employee.id) || ''
  const wh = s.warehouse_id || s.plant_warehouse_id || ''
  const company = s.company_id || ''
  const branch = s.branch_config_id || s.analytic_account_id || ''
  return [CACHE_CONTRACT_VERSION, sessionFingerprint(s), emp, wh, company, branch].join(':')
}

/** Snapshot de campos de scope (sin credenciales) para la capa reactiva §2. */
export function sessionScopeFields(session = null) {
  const s = session || readSessionRaw()
  return {
    employeeId: s.employee_id || (s.employee && s.employee.id) || null,
    effectiveBranchConfigId: s.branch_config_id || s.analytic_account_id || null,
    warehouseId: s.warehouse_id || s.plant_warehouse_id || null,
    companyId: s.company_id || null,
    tokenFingerprint: sessionFingerprint(s) || null,
  }
}
