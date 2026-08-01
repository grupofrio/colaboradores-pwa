// E1-B/E1-C.2 — pantalla READ-ONLY "KOLD Tower / Estado por rol". Consume tower.status (E1-A).
// El rol lo AUTORIZA Odoo: se lee de session.employee.tower_status (entregado en el login).
// La PWA OBEDECE ese valor; resolveTowerRole.js (job keys del cliente) queda LEGACY y NO autoriza.
// IMPORTANTE: NO está montada en el router (App.jsx). Montarla/exponerla a usuarios requiere
// S/N posterior de Yamil (ver README de este directorio). Sin writes, sin endpoints, sin deploy.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TowerStatusBoard from "./TowerStatusBoard";
import { readAuthoritativeTowerStatus } from "./loadTowerStatus";

export default function ScreenKoldTowerE1({ session }) {
  // Rol AUTORITATIVO (Odoo). null / valor no permitido => estado seguro: sin superficie Tower.
  const role = useMemo(() => readAuthoritativeTowerStatus(session), [session]);
  const navigate = useNavigate();
  return (
    <main style={{ padding: 16, color: "#fff" }}>
      {/* SALIDA (bug 2026-08-01): `/torre` está en NAV_HIDDEN_EXACT (navModel) para
          que sea full-screen, pero la pantalla no tenía ningún control de regreso
          y dejaba al usuario atrapado — `/torre/backlog` sí conserva el nav. Se
          respeta la intención full-screen y se agrega la salida aquí, no se
          reactiva el nav global. */}
      <button
        type="button"
        onClick={() => navigate("/")}
        data-testid="tower-back"
        aria-label="Volver al inicio"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
          padding: "8px 14px", borderRadius: 999, cursor: "pointer",
          background: "transparent", color: "#61b2ff",
          border: "1px solid rgba(97,178,255,0.28)", fontSize: 13, fontWeight: 700,
        }}
      >
        ← Inicio
      </button>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>KOLD Tower — Estado por rol</h1>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 0 }}>
        Vista <strong>solo lectura</strong> del mapa real del sistema (E1). Los badges son honestos y
        derivados del tracker de gobernanza (E1-A). No hay acciones, envíos ni escritura.
      </p>
      {role
        ? <TowerStatusBoard role={role} />
        : <div style={{ color: "rgba(255,255,255,0.6)" }}>Tu sesión no tiene una superficie Tower autorizada.</div>}
    </main>
  );
}
