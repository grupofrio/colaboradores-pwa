// E1-B — resolución de rol de sesión -> rol del contrato tower.status (E1-A). READ-ONLY, sin efectos.
// En archivo propio (no en la pantalla) para no romper react-refresh/fast-refresh (regla lint:
// un archivo de componente solo debe exportar componentes).
import { getEffectiveJobKeys } from "../../../lib/roleContext";

// Roles E1.5 (comercial/finanzas) quedan gated en el propio contrato; aquí solo resolvemos qué documento pedir.
export const JOBKEY_TO_ROLE = {
  direccion_general: "direccion_general",
  admin_plataforma: "admin_plataforma",
  gerente_sucursal: "gerente_sucursal",
  supervisor_ventas: "supervisor_ventas",
  comercial: "comercial",
  finanzas: "finanzas",
};

export function resolveTowerRole(session) {
  const keys = getEffectiveJobKeys(session || {});
  for (const k of keys) {
    if (JOBKEY_TO_ROLE[k]) return JOBKEY_TO_ROLE[k];
  }
  return null;
}
