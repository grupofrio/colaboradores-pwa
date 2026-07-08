// E1-B — pantalla READ-ONLY "KOLD Tower / Estado por rol". Consume tower.status (E1-A).
// IMPORTANTE: NO está montada en el router (App.jsx). Montarla/exponerla a usuarios requiere
// S/N posterior de Yamil (ver README de este directorio). Sin writes, sin endpoints, sin deploy.
import { useMemo } from "react";
import { getEffectiveJobKeys } from "../../../lib/roleContext";
import TowerStatusBoard from "./TowerStatusBoard";

// Mapa job_key de sesión -> rol del contrato E1-A. Roles E1.5 (comercial/finanzas) quedan
// gated en el propio contrato; aquí solo resolvemos qué documento pedir.
const JOBKEY_TO_ROLE = {
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

export default function ScreenKoldTowerE1({ session }) {
  const role = useMemo(() => resolveTowerRole(session), [session]);
  return (
    <main style={{ padding: 16, color: "#fff" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>KOLD Tower — Estado por rol</h1>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 0 }}>
        Vista <strong>solo lectura</strong> del mapa real del sistema (E1). Los badges son honestos y
        derivados del tracker de gobernanza (E1-A). No hay acciones, envíos ni escritura.
      </p>
      {role
        ? <TowerStatusBoard role={role} />
        : <div style={{ color: "rgba(255,255,255,0.6)" }}>Tu rol no tiene una superficie E1 asignada todavía.</div>}
    </main>
  );
}
