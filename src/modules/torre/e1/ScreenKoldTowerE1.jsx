// E1-B — pantalla READ-ONLY "KOLD Tower / Estado por rol". Consume tower.status (E1-A).
// IMPORTANTE: NO está montada en el router (App.jsx). Montarla/exponerla a usuarios requiere
// S/N posterior de Yamil (ver README de este directorio). Sin writes, sin endpoints, sin deploy.
import { useMemo } from "react";
import TowerStatusBoard from "./TowerStatusBoard";
import { resolveTowerRole } from "./resolveTowerRole";

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
