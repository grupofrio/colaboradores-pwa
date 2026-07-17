// E1-B — tablero READ-ONLY que consume tower.status.<role>.json (contrato E1-A).
// Presentacional puro: 0 writes, 0 endpoints, 0 acciones. Estándar Enterprise con lo existente
// (inline styles + tokens del PWA; sin librerías nuevas). Roles gated NO renderizan módulos.
import { useEffect, useMemo, useState } from "react";
import { fetchTowerStatus, resolveBoardView, TOWER_STATUS_ERROR_KINDS } from "./loadTowerStatus";
import StateScreen from "../../../components/kold/StateScreen";

const C = {
  text: "#FFFFFF",
  soft: "rgba(255,255,255,0.82)",
  muted: "rgba(255,255,255,0.58)",
  low: "rgba(255,255,255,0.42)",
  border: "rgba(255,255,255,0.09)",
  surface: "rgba(255,255,255,0.035)",
};
// Tonos alineados al vocabulario cerrado de E1-A (badges.json).
const TONE = {
  green: { fg: "#34d399", bg: "rgba(52,211,153,0.13)", bd: "rgba(52,211,153,0.30)" },
  teal: { fg: "#2dd4bf", bg: "rgba(45,212,191,0.13)", bd: "rgba(45,212,191,0.30)" },
  amber: { fg: "#fbbf24", bg: "rgba(251,191,36,0.13)", bd: "rgba(251,191,36,0.30)" },
  gray: { fg: "#94a3b8", bg: "rgba(148,163,184,0.13)", bd: "rgba(148,163,184,0.30)" },
  red: { fg: "#f87171", bg: "rgba(248,113,113,0.13)", bd: "rgba(248,113,113,0.32)" },
  slate: { fg: "#cbd5e1", bg: "rgba(100,116,139,0.16)", bd: "rgba(100,116,139,0.32)" },
};
const tone = (t) => TONE[t] || TONE.gray;

const ROLE_LABEL = {
  direccion_general: "Dirección",
  admin_plataforma: "Plataforma",
  gerente_sucursal: "Gerente de sucursal",
  supervisor_ventas: "Supervisor / jefe de ruta",
  comercial: "Comercial",
  finanzas: "Finanzas",
};
const BADGE_ORDER = ["operativo", "piloto", "parcial", "estado_admin", "pc", "bloqueado"];
const TONE_FOR_BADGE = { operativo: "green", piloto: "teal", parcial: "amber", pc: "gray", bloqueado: "red", estado_admin: "slate" };
const BADGE_LABEL = { operativo: "Operativo", piloto: "Piloto", parcial: "Parcial", pc: "En clasificación", bloqueado: "Bloqueado", estado_admin: "Estado" };

function Pill({ children, t = "slate", title }) {
  const c = tone(t);
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.fg,
      border: `1px solid ${c.bd}`, borderRadius: 999, padding: "3px 10px", fontSize: 12,
      fontWeight: 700, lineHeight: 1.4, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Header({ role, gated }) {
  return (
    <header style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: -0.2, color: C.text }}>
          KOLD Tower · Estado
        </h2>
        <span style={{ fontSize: 13, color: C.muted }}>{ROLE_LABEL[role] || role}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <Pill t="teal" title="Esta superficie no ejecuta acciones">Solo lectura</Pill>
        <Pill t="slate">No ejecuta acciones</Pill>
        {gated ? <Pill t="amber">Acceso restringido</Pill> : null}
      </div>
    </header>
  );
}

function GatedBlock({ gate }) {
  return (
    <div role="note" aria-label="Superficie restringida" style={{
      border: `1px solid ${tone("amber").bd}`, background: tone("amber").bg, borderRadius: 18,
      padding: "22px 20px", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 22 }}>🔒</span>
        <strong style={{ fontSize: 16, color: C.text }}>Superficie restringida</strong>
        {gate?.gate ? <Pill t="amber">{gate.gate}</Pill> : null}
      </div>
      <p style={{ margin: 0, color: C.soft, fontSize: 14, maxWidth: 620, lineHeight: 1.5 }}>
        {gate?.reason || "Esta superficie requiere una condición previa antes de mostrar su contenido."}
      </p>
      <p style={{ margin: 0, color: C.muted, fontSize: 12.5 }}>
        Por seguridad, E1 no muestra los módulos de este rol hasta resolver la condición. Vista solo lectura.
      </p>
    </div>
  );
}

function SummaryStrip({ modules }) {
  const counts = useMemo(() => {
    const acc = {};
    for (const m of modules) acc[m.badge] = (acc[m.badge] || 0) + 1;
    return acc;
  }, [modules]);
  const present = BADGE_ORDER.filter((b) => counts[b]);
  if (!present.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 14px" }}>
      {present.map((b) => <Pill key={b} t={TONE_FOR_BADGE[b]}>{counts[b]} {BADGE_LABEL[b]}</Pill>)}
      <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12, color: C.low }}>
        {modules.length} módulos
      </span>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8 }}>
      <dt style={{ color: C.low, fontWeight: 600 }}>{k}</dt>
      <dd style={{ margin: 0, color: C.muted }}>{v}</dd>
    </div>
  );
}

function ModuleCard({ m }) {
  return (
    <article style={{
      border: `1px solid ${C.border}`, background: C.surface, borderRadius: 16, padding: "14px 15px",
      display: "flex", flexDirection: "column", gap: 9, minWidth: 0,
    }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: C.text, minWidth: 0 }}>{m.name}</span>
        <Pill t={m.badge_tone}>{m.badge_label}</Pill>
      </header>
      <p style={{ margin: 0, color: C.soft, fontSize: 13, lineHeight: 1.45 }}>{m.description}</p>
      <dl style={{ margin: 0, display: "grid", gap: 4, fontSize: 12, color: C.muted }}>
        <Row k="Fuente" v={m.source} />
        {m.residual ? <Row k="Pendiente" v={m.residual} /> : null}
        {Array.isArray(m.can_not) && m.can_not.length ? <Row k="No permite" v={m.can_not.join(" · ")} /> : null}
      </dl>
      <footer style={{ fontSize: 11.5, color: C.low, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{m.tracker_ref}</span><span>owner: {m.owner}</span>
      </footer>
    </article>
  );
}

export default function TowerStatusBoard({ role, base = "/e1", fetchImpl, allowGatedPreview = false }) {
  const [state, setState] = useState({ status: "loading", doc: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", doc: null, error: null });
    fetchTowerStatus(role, { base, ...(fetchImpl ? { fetchImpl } : {}) })
      .then((doc) => alive && setState({ status: "ok", doc, error: null }))
      .catch((e) => {
        if (!alive) return;
        // El detalle técnico va a logging, NUNCA a la cara del usuario (sin HTML,
        // sin "Unexpected token"). El estado se deriva del `kind` tipado del loader.
        if (typeof console !== "undefined") console.warn("tower.status:", e && e.kind, String(e && e.message || e));
        setState({ status: "error", doc: null, error: { kind: e && e.kind } });
      });
    return () => { alive = false; };
  }, [role, base, fetchImpl]);

  if (state.status === "loading") return <div style={{ color: C.muted, padding: 4 }}>Cargando estado…</div>;
  if (state.status === "error") {
    const kind = state.error && state.error.kind;
    const copy = kind === TOWER_STATUS_ERROR_KINDS.NOT_PUBLISHED
      ? { title: "El mapa de estado de la Torre aún no está publicado",
          detail: "El resto de KOLD OS funciona con normalidad. Esta vista se habilitará cuando se publique su información." }
      : { title: "No se pudo cargar el estado de la Torre",
          detail: "Intenta de nuevo más tarde. El resto de KOLD OS funciona con normalidad." };
    return (
      <StateScreen title={copy.title} detail={copy.detail} tone="neutral"
        actionLabel="Volver al inicio" actionHref="/" />
    );
  }

  const { doc } = state;
  const view = resolveBoardView(doc, { allowGatedPreview });
  return (
    <section aria-label={`KOLD Tower estado (${doc.generated_for_role})`} style={{ maxWidth: 1120, margin: "0 auto" }}>
      <Header role={doc.generated_for_role} gated={view.blocked} />
      {view.blocked ? (
        <GatedBlock gate={view.gate} />
      ) : (
        <>
          <SummaryStrip modules={view.modules} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(clamp(240px, 30vw, 320px), 1fr))", gap: 12 }}>
            {view.modules.map((m) => <ModuleCard key={m.id} m={m} />)}
          </div>
        </>
      )}
      <footer style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.low, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        <span>Solo lectura · no ejecuta acciones</span>
        <span>Datos al <strong style={{ color: C.muted }}>{doc.data_as_of}</strong></span>
        <span>Fuente: {doc.source_of_truth}</span>
        <span style={{ marginLeft: "auto" }}>contrato v{doc.version}</span>
      </footer>
    </section>
  );
}
