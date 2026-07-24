// ─── session — validación ÚNICA y autoritativa de sesión autenticada ─────────
// Módulo PURO (sin React) para poder testearse y usarse igual en navModel,
// AppNav, AppShell y los guards de App.jsx. FUENTE DE VERDAD del contrato:
// ScreenLogin.buildSessionFromOdoo / buildLocalSessionToken y el bypass admin
// generan SIEMPRE: employee_id (número > 0), session_token (string no vacío),
// exp (unix segundos, opcional), role (x_job_key; PUEDE ser '' si el empleado
// no tiene puesto mapeado — eso NO invalida la sesión: solo ve universales).
//
// Reglas fail-closed (Codex PR #66 BLOCKER 1 + ronda 2):
//   null / undefined / {} / no-objeto           → NO autenticado
//   employee_id NO entero positivo seguro       → NO autenticado
//     · number: Number.isInteger(id) && id > 0 && id ≤ MAX_SAFE_INTEGER
//     · string: exactamente /^[1-9]\d*$/ (entero decimal positivo) y, al
//       convertir, entero positivo seguro. "abc"/"5abc"/"1.5"/"-1"/"0"/"" → NO
//   session_token ausente / vacío / no-string   → NO autenticado
//   exp presente y vencido (o no numérico)      → NO autenticado
//   marcada expired/inactive                    → NO autenticado
//   sesión válida con rol básico o sin rol      → SÍ (universales)
//
// "Sin roles adicionales" NUNCA se confunde con "sin sesión": el rol NO forma
// parte de la validez de la sesión; solo de la visibilidad de módulos.

// employee_id: solo entero positivo seguro (number o string decimal puro).
function isValidEmployeeId(employeeId) {
  if (typeof employeeId === 'number') {
    return Number.isInteger(employeeId) && employeeId > 0 && employeeId <= Number.MAX_SAFE_INTEGER
  }
  if (typeof employeeId === 'string') {
    const trimmed = employeeId.trim()
    if (!/^[1-9]\d*$/.test(trimmed)) return false
    const n = Number(trimmed)
    return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER
  }
  return false
}

export function isValidAuthenticatedSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false

  if (!isValidEmployeeId(session.employee_id)) return false

  const token = session.session_token
  if (typeof token !== 'string' || token.trim() === '') return false

  if (session.exp !== undefined && session.exp !== null) {
    const exp = Number(session.exp)
    if (!Number.isFinite(exp)) return false
    if (Date.now() / 1000 > exp) return false
  }

  if (session.expired === true || session.inactive === true) return false

  return true
}
