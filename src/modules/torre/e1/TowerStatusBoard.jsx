// E1-B — tablero READ-ONLY que consume tower.status.<role>.json (contrato E1-A).
// Presentacional puro: 0 writes, 0 endpoints, 0 acciones. Badges HONESTOS (color = badge_tone).
// El badge/label vienen del contrato (derivados del tracker por E1-A); este componente NO decide badges.
import { useEffect, useState } from "react";
import { fetchTowerStatus } from "./loadTowerStatus";

// Tonos alineados al vocabulario cerrado de E1-A (badges.json). Tema oscuro del PWA.
const TONE = {
  green: { bg: "rgba(34,197,94,0.14)", fg: "#22c55e" },
  teal: { bg: "rgba(20,184,166,0.14)", fg: "#2dd4bf" },
  amber: { bg: "rgba(245,158,11,0.14)", fg: "#f59e0b" },
  gray: { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8" },
  red: { bg: "rgba(239,68,68,0.14)", fg: "#ef4444" },
  slate: { bg: "rgba(100,116,139,0.16)", fg: "#cbd5e1" },
};

function Badge({ label, tone }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <span style={{
      background: t.bg, color: t.fg, borderRadius: 999, padding: "3px 10px",
      fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function GateBanner({ gate }) {
  if (!gate?.is_gated) return null;
  return (
    <div role="note" style={{
      border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.10)",
      color: "#f59e0b", borderRadius: 14, padding: "10px 14px", marginBottom: 14, fontSize: 13,
    }}>
      🔒 <strong>Superficie con gate ({gate.gate}).</strong> {gate.reason}{" "}
      <em>E1-B no expone contenido sensible hasta resolver el gate.</em>
    </div>
  );
}

function ModuleCard({ m }) {
  return (
    <article style={{
      border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
      borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>{m.name}</span>
        <Badge label={m.badge_label} tone={m.badge_tone} />
      </header>
      <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 13 }}>{m.description}</p>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
        <div><strong>Fuente:</strong> {m.source}</div>
        {m.residual ? <div><strong>Residual:</strong> {m.residual}</div> : null}
        {Array.isArray(m.can_not) && m.can_not.length
          ? <div><strong>No puede:</strong> {m.can_not.join(" · ")}</div> : null}
        <div style={{ opacity: 0.7 }}>{m.tracker_ref} · owner: {m.owner}</div>
      </div>
    </article>
  );
}

export default function TowerStatusBoard({ role, base = "/e1", fetchImpl }) {
  const [state, setState] = useState({ status: "loading", doc: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", doc: null, error: null });
    fetchTowerStatus(role, { base, ...(fetchImpl ? { fetchImpl } : {}) })
      .then((doc) => { if (alive) setState({ status: "ok", doc, error: null }); })
      .catch((e) => { if (alive) setState({ status: "error", doc: null, error: String(e.message || e) }); });
    return () => { alive = false; };
  }, [role, base, fetchImpl]);

  if (state.status === "loading") return <div style={{ color: "rgba(255,255,255,0.6)" }}>Cargando estado…</div>;
  if (state.status === "error") return <div style={{ color: "#ef4444" }}>No se pudo cargar tower.status: {state.error}</div>;

  const { doc } = state;
  return (
    <section aria-label={`KOLD Tower — estado (${doc.generated_for_role})`}>
      <GateBanner gate={doc.role_gate} />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12,
      }}>
        {doc.modules.map((m) => <ModuleCard key={m.id} m={m} />)}
      </div>
      <footer style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
        Solo lectura · datos al <strong>{doc.data_as_of}</strong> · fuente: {doc.source_of_truth} ·
        rol: {doc.generated_for_role} · contrato v{doc.version}
      </footer>
    </section>
  );
}
