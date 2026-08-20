// ─── Gates de identidad por employee_id (antes: por NOMBRE) ─────────────────
//
// Dos funciones de la app decidían acceso comparando el NOMBRE de la sesión
// contra literales: `['hector','tapia']` y `['angelica','jaimes']`. Un nombre no
// es una identidad:
//
//   · Se puede colisionar. Cualquier empleado que se llame igual entra.
//   · Medido en producción: "Angelica Jaimes Dominguez" tiene TRES fichas de
//     hr.employee vivas — 717 (compañía 34, Gerente de Sucursal), 2518
//     (compañía 35) y 2521 (compañía 36). El gate por nombre las aceptaba las
//     tres sin distinguir compañía.
//   · Depende de cómo esté escrito el nombre en la ficha, no de una decisión.
//
// `employee_id` sí es identidad: lo emite el servidor al iniciar sesión y no se
// escribe a mano en un campo de texto. Los ids son configurables por entorno
// para que cambiar a quién aplica una vista no requiera tocar código.
//
// ⚠️ ALCANCE: esto sigue siendo un gate de UI, igual que el que reemplaza. La
// autorización real la imponen los endpoints (`_day_pos_*` en `gf_pwa_admin` ya
// valida alcance server-side). Lo que cambia es que la puerta del cliente deja
// de abrirse con una cadena de texto.

/** Parsea "717,2518" → [717, 2518]. Ignora basura silenciosamente. */
function parseIdList(raw) {
  return String(raw || '')
    .split(',')
    .map((chunk) => Number(String(chunk).trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

function envIds(key, fallback) {
  const fromEnv = parseIdList(import.meta.env?.[key])
  return fromEnv.length ? fromEnv : fallback
}

// Defaults medidos en producción (hr.employee).
// Night POS: "Hector Tapia Avino" — id 728, compañía 34 (Glaciem).
const NIGHT_POS_EMPLOYEE_IDS = envIds('VITE_NIGHT_POS_EMPLOYEE_IDS', [728])
// Desglose POS por SKU: las tres fichas de "Angelica Jaimes Dominguez".
const POS_BREAKDOWN_EMPLOYEE_IDS = envIds('VITE_POS_BREAKDOWN_EMPLOYEE_IDS', [717, 2518, 2521])

function sessionEmployeeId(session = {}) {
  const raw = session?.employee_id ?? session?.employee?.id ?? 0
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : 0
}

/** Fail-closed: sin employee_id en la sesión, no pasa nadie. */
function matchesAllowlist(session, allowlist) {
  const id = sessionEmployeeId(session)
  if (!id) return false
  return allowlist.includes(id)
}

export function isNightPosEmployee(session = {}) {
  return matchesAllowlist(session, NIGHT_POS_EMPLOYEE_IDS)
}

export function isPosBreakdownEmployee(session = {}) {
  return matchesAllowlist(session, POS_BREAKDOWN_EMPLOYEE_IDS)
}

// Export para tests y para diagnóstico.
export const IDENTITY_GATE_IDS = Object.freeze({
  nightPos: Object.freeze([...NIGHT_POS_EMPLOYEE_IDS]),
  posBreakdown: Object.freeze([...POS_BREAKDOWN_EMPLOYEE_IDS]),
})
