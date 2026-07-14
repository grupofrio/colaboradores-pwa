// ─── session — validación ÚNICA y autoritativa de sesión autenticada ─────────
// Módulo PURO (sin React) para poder testearse y usarse igual en navModel,
// AppNav, AppShell y los guards de App.jsx. FUENTE DE VERDAD del contrato:
// ScreenLogin.buildSessionFromOdoo / buildLocalSessionToken y el bypass admin
// generan SIEMPRE: employee_id (número > 0), session_token (string no vacío),
// exp (unix segundos, opcional), role (x_job_key; PUEDE ser '' si el empleado
// no tiene puesto mapeado — eso NO invalida la sesión: solo ve universales).
//
// Reglas fail-closed (Codex PR #66 BLOCKER 1):
//   null / undefined / {} / no-objeto           → NO autenticado
//   employee_id ausente o inválido              → NO autenticado
//   session_token ausente / vacío / no-string   → NO autenticado
//   exp presente y vencido (o no numérico)      → NO autenticado
//   marcada expired/inactive                    → NO autenticado
//   sesión válida con rol básico o sin rol      → SÍ (universales)
//
// "Sin roles adicionales" NUNCA se confunde con "sin sesión": el rol NO forma
// parte de la validez de la sesión; solo de la visibilidad de módulos.

export function isValidAuthenticatedSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false

  const employeeId = session.employee_id
  const hasEmployee =
    (typeof employeeId === 'number' && Number.isFinite(employeeId) && employeeId > 0) ||
    (typeof employeeId === 'string' && employeeId.trim() !== '')
  if (!hasEmployee) return false

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
