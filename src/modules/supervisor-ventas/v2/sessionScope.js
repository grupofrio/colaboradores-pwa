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

// Huella de sesión NO sensible (Codex §4/§6): usa el `odoo_employee_session_id`
// del magic-link (cambia por login, no es el token ni deriva de él). Cadena de
// fallback: otros ids de sesión → `gf_scope_nonce` (nonce local generado al
// persistir la sesión, §6). NUNCA cae a longitud/sufijo/hash del token. Si aún así
// no hay ninguno (sesión legacy), el fallback es un marcador NO VACÍO derivado del
// empleado (distingue empleados; el nonce separa re-logins de la misma persona).
// La seguridad NO depende de esta huella: solo separa cachés por sesión.
function sessionFingerprint(session) {
  const id = session.odoo_employee_session_id
    || session.gf_employee_session_id
    || session.session_id
    || session.gf_scope_nonce
  if (id) return String(id)
  const emp = session.employee_id || (session.employee && session.employee.id)
  return emp ? `emp${emp}` : 'anon'
}

/**
 * IDENTIDAD CANÓNICA de sesión (Codex §3, YELLOW). Fuente ÚNICA usada por App.jsx,
 * sessionStore, sessionScope, comparación multi-tab e invalidación de cachés — NO
 * se duplica la lógica en varios archivos. Normaliza los aliases reales:
 *   session_id: odoo_employee_session_id | gf_employee_session_id | session_id |
 *               gf_scope_nonce  (huella no sensible, §6)
 *   branchId:  effective_branch_config_id | branch_config_id | branch_id |
 *              analytic_account_id
 * `sessionKey` NO serializa el token; `credentialVersion` permite comparar de forma
 * segura dentro del flujo de sesión (deriva de la huella no sensible, no del token).
 * @param {object|null} session  sesión inyectable (null ⇒ lee gf_session)
 * @returns {{sessionKey, employeeId, branchId, warehouseId, companyId, role, credentialVersion}}
 */
export function buildSessionIdentity(session = null) {
  const s = session || readSessionRaw()
  const fp = sessionFingerprint(s) // no vacío (§6)
  const employeeId = s.employee_id || (s.employee && s.employee.id) || null
  const branchId = s.effective_branch_config_id || s.branch_config_id || s.branch_id || s.analytic_account_id || null
  const warehouseId = s.warehouse_id || s.plant_warehouse_id || null
  const companyId = s.company_id || null
  const role = s.role || null
  const sessionKey = [CACHE_CONTRACT_VERSION, fp, employeeId || '', warehouseId || '', companyId || '', branchId || '', role || ''].join(':')
  return { sessionKey, employeeId, branchId, warehouseId, companyId, role, credentialVersion: fp }
}

/**
 * §5/§6: garantiza que una sesión tenga una huella no sensible estable. Si la
 * sesión (legacy) no trae ningún session_id NI nonce, devuelve una COPIA con
 * `gf_scope_nonce` generado (no vacío, no token, no derivado del token). Una
 * sesión sin empleado (no logueada) o que ya tiene id/nonce se devuelve tal cual.
 * Pura y testeable (usada por App.jsx al inicializar/adoptar sesión).
 * @param {object|null} session
 * @returns {object|null}
 */
export function ensureSessionScopeNonce(session) {
  if (!session || typeof session !== 'object') return session
  if (session.odoo_employee_session_id || session.gf_employee_session_id || session.session_id || session.gf_scope_nonce) return session
  if (!(session.employee_id || (session.employee && session.employee.id))) return session
  let nonce
  try {
    nonce = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`
  } catch { nonce = `n${Date.now()}` }
  return { ...session, gf_scope_nonce: nonce }
}

/** Clave de identidad de scope (string estable). Delega en buildSessionIdentity. */
export function sessionScopeKey(session = null) {
  return buildSessionIdentity(session).sessionKey
}

/** Snapshot de campos de scope (sin credenciales) para la capa reactiva §2.
 *  Deriva de la identidad canónica (sin duplicar lógica). */
export function sessionScopeFields(session = null) {
  const id = buildSessionIdentity(session)
  return {
    employeeId: id.employeeId,
    effectiveBranchConfigId: id.branchId,
    warehouseId: id.warehouseId,
    companyId: id.companyId,
    role: id.role,
    tokenFingerprint: id.credentialVersion || null,
  }
}
