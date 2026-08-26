import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet as _apiGet, getSession } from "../lib/api";
import { isBrandLightSession } from "../theme/useBrandPalette";
import PanelKpisSupervisor from "../modules/supervisor-ventas/kpis/PanelKpis";

/* ============================================================================
   DESIGN TOKENS (mismo sistema que Pantalla 2)
============================================================================ */
const TOKENS = {
  colors: {
    bg0: "#f3f7fc",
    bg1: "#eef4fb",
    bg2: "#e6eef8",
    surface: "rgba(255,255,255,0.95)",
    surfaceSoft: "rgba(255,255,255,0.82)",
    surfaceStrong: "rgba(232,240,250,0.95)",
    border: "rgba(21,73,155,0.12)",
    borderBlue: "rgba(43,143,224,0.2)",
    blue: "#15499B",
    blue2: "#2B8FE0",
    blue3: "#61b2ff",
    blueGlow: "rgba(43,143,224,0.14)",
    text: "#12263f",
    textSoft: "#344b67",
    textMuted: "#5f7490",
    textLow: "#71859f",
    success: "#228b5d",
    successSoft: "rgba(34,139,93,0.10)",
    warning: "#b7791f",
    error: "#c75a63",
    errorSoft: "rgba(199,90,99,0.10)",
  },
  radius: { sm: 14, md: 18, lg: 22, xl: 24, pill: 999 },
  shadow: {
    soft: "0 8px 20px rgba(21,73,155,0.08)",
    md: "0 14px 30px rgba(21,73,155,0.10)",
    lg: "0 20px 44px rgba(21,73,155,0.14)",
    blue: "0 0 22px rgba(43,143,224,0.16)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.82)",
  },
  glass: {
    panel: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,251,255,0.96))",
    panelSoft: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,252,0.96))",
    hero: "linear-gradient(180deg, rgba(43,143,224,0.10), rgba(255,255,255,0.98))",
  },
  motion: { fast: "180ms ease", normal: "280ms ease", spring: "380ms cubic-bezier(0.34,1.56,0.64,1)" },
};

const SHOW_DEV_SWITCHER = true;

/* ============================================================================
   API CONFIG
============================================================================ */
const apiGet = _apiGet;

function getTypo(sw) {
  const sm = sw < 340;
  return {
    display: { fontSize: sm ? 22 : 28, fontWeight: 700, letterSpacing: "-0.04em" },
    h1:      { fontSize: sm ? 20 : 24, fontWeight: 700, letterSpacing: "-0.03em" },
    h2:      { fontSize: sm ? 17 : 20, fontWeight: 700, letterSpacing: "-0.02em" },
    body:    { fontSize: sm ? 12 : 14, fontWeight: 500 },
    caption: { fontSize: sm ? 11 : 12, fontWeight: 500 },
    overline:{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em" },
  };
}

/* ============================================================================
   NAV (mismo que Pantalla 2)
============================================================================ */

/* ============================================================================
   PARTÍCULAS
============== ============================================================== */
function IceParticles() {
  const p = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id:i, x:(i*37+11)%100, y:(i*53+7)%100, size:(i%3)+1,
    delay:(i*0.4)%6, duration:((i%4)*1.5)+7, opacity:(i%4)*0.03+0.03,
  })), []);
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      {p.map(x => <div key={x.id} style={{ position:"absolute", left:`${x.x}%`, top:`${x.y}%`, width:x.size, height:x.size, borderRadius:"50%", background:"rgba(71,161,255,0.7)", opacity:x.opacity, animation:`float ${x.duration}s ${x.delay}s ease-in-out infinite alternate` }}/>)}
    </div>
  );
}

/* ============================================================================
   FADE IN
============================================================================ */
function FadeIn({ children, delay = 0, y = 12 }) {
  const [v, setV] = useState(false);
  useEffect(() => { const t = setTimeout(() => setV(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{ opacity:v?1:0, transform:v?"translateY(0)":`translateY(${y}px)`, transition:`opacity ${TOKENS.motion.normal}, transform ${TOKENS.motion.normal}` }}>
      {children}
    </div>
  );
}

/* ============================================================================
   PERIOD SELECTOR
============================================================================ */
const PERIODS = [
  { id:"hoy",    label:"Hoy" },
  { id:"semana", label:"Semana" },
  { id:"mes",    label:"Mes" },
];

function PeriodSelector({ value, onChange, sw }) {
  return (
    <div style={{ display:"flex", gap:6, padding:"4px", background:"rgba(255,255,255,0.92)", border:`1px solid ${TOKENS.colors.border}`, borderRadius:TOKENS.radius.pill, alignSelf:"flex-start" }}>
      {PERIODS.map(p => {
        const active = p.id === value;
        return (
          <button key={p.id} onClick={() => onChange(p.id)} style={{ border:"none", cursor:"pointer", padding: sw < 340 ? "10px 12px" : "11px 18px", minHeight:44, /* Touch target ≥44px — estándar Apple HIG */ borderRadius:TOKENS.radius.pill, background:active?"linear-gradient(90deg,#15499B,#2B8FE0)":"transparent", color:active?"#ffffff":TOKENS.colors.textMuted, fontSize:sw<340?11:12, fontWeight:700, transition:`all ${TOKENS.motion.normal}`, boxShadow:active?TOKENS.shadow.blue:"none", letterSpacing:"0.02em", fontFamily:"inherit" }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   METABASE EMBED SIMULADO
   En producción: src viene de n8n con JWT firmado
   /webhook/metabase-token?dashboard_id=X&period=hoy&employee_id=123
============================================================================ */

// Skeleton loader mientras carga el iframe
function EmbedSkeleton() {
  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", gap:12, padding:"16px" }}>
      {[80, 120, 90, 150].map((h, i) => (
        <div key={i} style={{ height:h, borderRadius:14, background:"linear-gradient(90deg, rgba(43,143,224,0.04) 0%, rgba(43,143,224,0.10) 50%, rgba(43,143,224,0.04) 100%)", backgroundSize:"200% 100%", animation:`shimmer 1.6s ${i*0.2}s ease-in-out infinite` }}/>
      ))}
    </div>
  );
}

// Dashboard simulado (reemplaza al iframe real en producción)
function KpisUnavailable({ sw }) {
  const typo = getTypo(sw);
  return (
    <div
      data-origin="kpis-unavailable"
      data-testid="kpis-unavailable"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "24px 32px",
        textAlign: "center",
      }}
    >
      <p style={{ ...typo.h2, color: TOKENS.colors.textSoft, margin: 0 }}>
        KPIs no disponibles
      </p>
      <p style={{ ...typo.body, color: TOKENS.colors.textMuted, margin: 0, lineHeight: 1.5 }}>
        No hay un dashboard configurado para este puesto. No se muestran cifras simuladas.
      </p>
    </div>
  );
}

/* ============================================================================
   METABASE FRAME (iframe real o estado no disponible)
============================================================================ */

function MetabaseFrame({ period, sw, sh, embedHeight, jobKey, refreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const prevPeriod = useRef(period);

  useEffect(() => {
    if (prevPeriod.current !== period) {
      setLoading(true);
      setHasError(false);
      prevPeriod.current = period;
    }
  }, [period]);

  // Cargar token Metabase real desde Odoo.
  // Si el endpoint no existe o falla, mostramos "no disponible".
  // NUNCA propagar error que pueda causar logout — este
  // endpoint está en la lista de "optionalEndpoint" del interceptor global.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHasError(false);
    const key = jobKey || getSession()?.job_key || "VENDEDOR";
    apiGet(`/pwa-metabase-token?job_key=${encodeURIComponent(key)}`)
      .then(res => {
        if (cancelled) return;
        // El handler directo de lib/api.js siempre responde con shape consistente:
        //   { success: true,  embed_url: "https://..." }  → usar iframe
        //   { success: false, embed_url: null, reason: ... } → no disponible
        if (res?.success && res?.embed_url) {
          const sep = res.embed_url.includes('?') ? '&' : '?';
          setEmbedUrl(`${res.embed_url}${sep}period=${encodeURIComponent(period)}`);
        } else {
          setEmbedUrl(null);
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        // Swallow — este endpoint es opcional. Nunca debe causar logout.
        // El interceptor ya no propaga 401 de este path, pero por si acaso.
        console.warn('[ScreenKPIs] Metabase token no disponible:', err?.message || err);
        setEmbedUrl(null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey, refreshKey, jobKey, period]);

  const handleRetry = () => {
    setLoading(true);
    setHasError(false);
    setRetryKey(k => k + 1);
  };

  return (
    <div style={{ width:"100%", height:embedHeight, borderRadius:20, overflow:"hidden", border:`1px solid ${TOKENS.colors.borderBlue}`, background:"rgba(255,255,255,0.96)", position:"relative", flexShrink:0 }}>
      {/* Header del frame */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:36, background:"rgba(247,251,255,0.98)", borderBottom:"1px solid rgba(21,73,155,0.08)", display:"flex", alignItems:"center", gap:8, padding:"0 14px", zIndex:2 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} style={{ width:8, height:8, borderRadius:"50%", background:c, opacity:0.6 }}/>)}
        </div>
        <div style={{ flex:1, height:20, borderRadius:6, background:"rgba(43,143,224,0.06)", display:"flex", alignItems:"center", paddingLeft:8 }}>
          <span style={{ fontSize:9, color:"rgba(95,116,144,0.85)", letterSpacing:"0.04em" }}>dashboard.grupofrio.mx · Mis KPIs</span>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ position:"absolute", top:36, left:0, right:0, bottom:0 }}>
        {hasError ? (
          /* ── Error state: conductor sin señal ── */
          <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:"24px 32px", textAlign:"center" }}>
            <div style={{ width:56, height:56, borderRadius:18, background:"rgba(183,121,31,0.10)", border:"1px solid rgba(183,121,31,0.20)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
              📡
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:TOKENS.colors.textSoft, margin:"0 0 6px" }}>
                No se pudieron cargar los datos
              </p>
              <p style={{ fontSize:12, color:TOKENS.colors.textMuted, margin:0, lineHeight:1.5 }}>
                Revisa tu conexión a internet e intenta de nuevo.
              </p>
            </div>
            <button
              onClick={handleRetry}
              style={{ border:"none", cursor:"pointer", padding:"12px 24px", minHeight:44, /* Touch target ≥44px */ borderRadius:TOKENS.radius.pill, background:"linear-gradient(90deg,#15499B,#2B8FE0)", color:TOKENS.colors.text, fontSize:13, fontWeight:700, boxShadow:TOKENS.shadow.blue, fontFamily:"inherit" }}
            >
              ↩ Reintentar conexión
            </button>
          </div>
        ) : loading ? (
          <EmbedSkeleton/>
        ) : embedUrl ? (
          <iframe
            key={retryKey}
            src={embedUrl}
            title="KPI Dashboard"
            style={{ width:"100%", height:"100%", border:"none" }}
            onError={() => setHasError(true)}
          />
        ) : (
          <KpisUnavailable sw={sw}/>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   KPI SCREEN PRINCIPAL
============================================================================ */
// ── Rama por ROL ─────────────────────────────────────────────────────────────
// `supervisor_ventas` ve un panel NATIVO con dato real. Los demás roles
// usan Metabase cuando hay embed_url; si no, un estado "no disponible"
// (nunca cifras simuladas).
function KPIScreen({ sw: propSw, sh: propSh }) {
  if (isBrandLightSession(getSession())) {
    return <PanelKpisSupervisor />;
  }
  return <KPIScreenLegacy sw={propSw} sh={propSh} />;
}

function KPIScreenLegacy({ sw: propSw, sh: propSh }) {
  const [winW, setWinW] = useState(window.innerWidth);
  const [winH, setWinH] = useState(window.innerHeight);
  useEffect(() => {
    const handler = () => { setWinW(window.innerWidth); setWinH(window.innerHeight); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const sw = propSw || winW;
  const sh = propSh || winH;
  const isFullscreen = !propSw;

  const [period, setPeriod] = useState("hoy");
  const [refreshKey, setRefreshKey] = useState(0);
  const session = getSession();
  const jobKey = session.job_key || "VENDEDOR";
  const jobTitle = session.job_title || "Grupo Frío";
  const typo = getTypo(sw);

  const handleRetry = () => setRefreshKey(k => k + 1);

  const navH       = sw < 340 ? 58 : 64;
  const navBot     = 10;
  const scrollBottom = navBot + navH + 6;
  const topPad     = sw < 340 ? 36 : 44;
  const sidePad    = sw < 340 ? 14 : 18;

  // Altura disponible para el embed dentro del scroll
  // header ~80px + period selector ~44px + gaps ~32px = ~156px de UI fija
  const embedHeight = Math.max(320, sh - scrollBottom - topPad - 156);

  return (
    <div style={{ position:"relative", width: isFullscreen ? '100%' : sw, height: isFullscreen ? '100dvh' : sh, overflow:"hidden", background:"radial-gradient(circle at 50% 0%, rgba(43,143,224,0.14) 0%, transparent 34%), linear-gradient(160deg, #f8fbff 0%, #eef4fb 45%, #e6eef8 100%)", fontFamily:"'DM Sans',system-ui,sans-serif", overscrollBehaviorY:"none", paddingTop:"env(safe-area-inset-top)", paddingBottom:"env(safe-area-inset-bottom)" }}>
      <IceParticles/>
      <div style={{ position:"absolute", inset:0, opacity:0.032, backgroundImage:"linear-gradient(rgba(43,143,224,.45) 1px,transparent 1px),linear-gradient(90deg,rgba(43,143,224,.45) 1px,transparent 1px)", backgroundSize:"48px 48px" }}/>

      {/* SCROLL */}
      <div style={{ position:"absolute", top:0, left:0, right:0, bottom:scrollBottom, overflowY:"auto", zIndex:2, padding:`${topPad}px ${sidePad}px 20px`, display:"flex", flexDirection:"column", gap:16 }}>

        {/* HEADER */}
        <FadeIn delay={60}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ ...typo.overline, color:TOKENS.colors.blue2, marginBottom:6 }}>MIS KPIS</div>
              <div style={{ ...typo.h1, color:TOKENS.colors.text, lineHeight:1.05 }}>Dashboard</div>
              <div style={{ ...typo.caption, color:TOKENS.colors.blue2, marginTop:4, fontWeight:600 }}>{jobTitle}</div>
            </div>
            {/* Botón refresh */}
            <button style={{ width:38, height:38, borderRadius:12, background:"rgba(43,143,224,0.06)", border:`1px solid ${TOKENS.colors.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}
              onClick={handleRetry}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TOKENS.colors.blue3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
              </svg>
            </button>
          </div>
        </FadeIn>

        {/* PERIOD SELECTOR */}
        <FadeIn delay={120}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <PeriodSelector value={period} onChange={setPeriod} sw={sw}/>
            {/* Timestamp */}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:TOKENS.colors.success, boxShadow:"0 0 8px #22c55e" }}/>
              <span style={{ fontSize:9, color:TOKENS.colors.textLow, fontWeight:600 }}>En vivo</span>
            </div>
          </div>
        </FadeIn>

        {/* METABASE EMBED FRAME */}
        <FadeIn delay={200}>
          <MetabaseFrame period={period} sw={sw} sh={sh} embedHeight={embedHeight} jobKey={jobKey} refreshKey={refreshKey}/>
        </FadeIn>

        <div style={{ height:4 }}/>
      </div>

    </div>
  );
}

/* ============================================================================
   PHONE FRAME
============================================================================ */
function PhoneFrame({ sw, sh, label, note, children }) {
  const borderR = Math.min(46, sw * 0.12);
  const notchW  = Math.min(120, sw * 0.33);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:TOKENS.colors.textMuted, letterSpacing:"0.06em", textAlign:"center" }}>{label}</div>
      <div style={{ position:"relative", borderRadius:borderR+4, border:"2px solid rgba(43,143,224,0.18)", boxShadow:"0 0 0 1px rgba(255,255,255,0.9), 0 28px 70px rgba(21,73,155,0.10), 0 0 30px rgba(43,143,224,0.08)", overflow:"hidden", background:"#f8fbff", flexShrink:0 }}>
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:notchW, height:22, background:"#eff5fb", borderRadius:"0 0 14px 14px", zIndex:50 }}/>
        <div style={{ position:"absolute", left:-3, top:80,  width:3, height:32, borderRadius:2, background:"rgba(43,143,224,0.18)" }}/>
        <div style={{ position:"absolute", left:-3, top:120, width:3, height:52, borderRadius:2, background:"rgba(43,143,224,0.18)" }}/>
        <div style={{ position:"absolute", right:-3, top:116, width:3, height:62, borderRadius:2, background:"rgba(43,143,224,0.18)" }}/>
        <KPIScreen sw={sw} sh={sh}/>
      </div>
      <div style={{ fontSize:10, color:TOKENS.colors.textMuted, textAlign:"center", lineHeight:1.5 }}>{sw}×{sh}px · {note}</div>
    </div>
  );
}

/* ============================================================================
   DEVICES
============================================================================ */
const DEVICES = [
  { label:"iPhone SE 3",         sw:320, sh:568, note:"pantalla pequeña" },
  { label:"iPhone 14 / 15",      sw:375, sh:812, note:"tamaño base" },
  { label:"iPhone 14 Pro Max",   sw:430, sh:932, note:"pantalla grande" },
];

/* ============================================================================
   ROOT
============================================================================ */
export function MultiDeviceKPIPreview() {
  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(circle at center, #f8fbff 0%, #eef4fb 35%, #e6eef8 75%, #dde8f4 100%)", padding:"36px 20px 60px", fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes float { from{transform:translateY(0)scale(1)} to{transform:translateY(-16px)scale(1.3)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing:border-box }
        ::-webkit-scrollbar { width:0 }
        button { font-family:inherit }
      `}</style>

      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:10, fontWeight:700, color:TOKENS.colors.blue2, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>PWA Trabajadores · Grupo Frío</div>
        <div style={{ fontSize:20, fontWeight:700, color:TOKENS.colors.text, letterSpacing:"-0.02em" }}>Pantalla 3 — Mis KPIs</div>
        <div style={{ fontSize:12, color:TOKENS.colors.textMuted, marginTop:8 }}>
          Embed Metabase · Selector hoy/semana/mes · Nav activa en KPIs
        </div>
      </div>

      <div style={{ display:"flex", gap:28, alignItems:"flex-end", justifyContent:"center", flexWrap:"wrap" }}>
        {DEVICES.map(d => (
          <PhoneFrame key={d.label} sw={d.sw} sh={d.sh} label={d.label} note={d.note}/>
        ))}
      </div>
    </div>
  );
}

export default KPIScreen;
