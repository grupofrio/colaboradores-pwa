// M1-D prereq C.1 (preflight 2026-07-13): persistir en la sesión el rol Tower
// AUTORITATIVO que /api/employee-sign-in YA entrega en `employee.tower_status`
// (os_api/controllers/employee_login.py → get_pwa_tower_status(), fail-safe → null).
//
// Aquí SOLO se sanea forma (string corto, trimmed). STRICT-CASE (decisión de
// contrato, Codex PR #62): el backend entrega únicamente los valores canónicos
// exactos, así que NO se hace toLowerCase — una variante de mayúsculas jamás se
// convierte en un rol válido. La AUTORIZACIÓN sigue siendo del gate:
// readAuthoritativeTowerStatus aplica la allowlist fail-closed (esta capa NO
// amplía la allowlist ni inventa valores) y, en el endpoint M1, Odoo revalida
// el rol server-side con el token de empleado — el valor guardado en el
// cliente es UX, nunca autorización.

const MAX_TOWER_STATUS_LENGTH = 64

export function sanitizeTowerStatus(value) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned || cleaned.length > MAX_TOWER_STATUS_LENGTH) return null
  return cleaned
}

export function buildSessionEmployee(employeeData, employeeId) {
  return {
    id: Number(employeeId) || 0,
    tower_status: sanitizeTowerStatus(employeeData?.tower_status),
  }
}
