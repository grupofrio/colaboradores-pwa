import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../App";
import {
  BRAND_LIGHT as C,
  BRAND_HEADER_GRADIENT,
  BRAND_LOGO,
} from "../theme/brandLight";
import { normalizeSessionRoleContext } from "../lib/roleContext";
import { buildSupervisorV2SessionProjection } from '../modules/supervisor-ventas/v2/sessionProjection.js'
import { buildSessionEmployee } from "../modules/torre/e1/employeeSessionFields";

// ── Login directo a Odoo ──────────────────────────────────────────────────
const ODOO_SIGN_IN_URL = "/api-odoo/employee-sign-in";

async function requestEmployeeSession(pin, barcode) {
  const res = await fetch(ODOO_SIGN_IN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        barcode,
        pin,
        app: "pwa_colaboradores",
        app_ver: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "",
        device_name: navigator.userAgent,
      },
      id: Date.now(),
    }),
  });

  // Si la respuesta no es OK (4xx, 5xx)
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Error ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const text = await res.text().catch(() => "");
  if (!text) throw new Error("Respuesta vacía del servidor");

  try {
    const json = JSON.parse(text);
    return json?.result ?? json;
  } catch {
    throw new Error(text || "Respuesta inválida del servidor");
  }
}

function base64UrlEncode(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

function buildLocalSessionToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.odoo`;
}



function decodeSessionToken(sessionToken, fallback = {}) {
  const payload = { ...fallback };
  try {
    const parts = sessionToken.split(".");
    if (parts.length === 3) {
      return {
        ...payload,
        ...JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))),
        session_token: sessionToken,
      };
    }
  } catch {
    // Si el JWT viene raro, usamos el payload mínimo sin bloquear el acceso.
  }
  return { ...payload, session_token: sessionToken };
}

function inferCompanyId(role) {
  if (!role) return 0;
  if (["operador_barra", "operador_rolito", "auxiliar_produccion", "supervisor_produccion", "almacenista_pt"].includes(role)) {
    return 35;
  }
  if (["jefe_ruta", "auxiliar_ruta", "almacenista_entregas", "supervisor_ventas"].includes(role)) {
    return 34;
  }
  if (["director_ti", "auxiliar_ti", "jefe_legal", "operador_torres"].includes(role)) {
    return 1;
  }
  if (["auxiliar_admin", "gerente_sucursal"].includes(role)) {
    return 34;
  }
  return 0;
}

function inferCompanyLabel(companyId, role) {
  if (companyId === 1) return "CSC GF";
  if (companyId === 35) return "Fabricación de Congelados";
  if (companyId === 34) {
    return ["jefe_ruta", "auxiliar_ruta", "almacenista_entregas", "supervisor_ventas"].includes(role)
      ? "GLACIEM"
      : "Soluciones en Producción GLACIEM";
  }
  if (companyId === 36) return "Vía Ágil";
  return "";
}

function resolveRole(employee, jobTitle) {
  const directRole = employee?.pwa_job_key || employee?.job_key || employee?.x_job_key || "";
  if (directRole) return directRole;

  const normalized = (jobTitle || "").toLowerCase();
  const roleMap = [
    ["dirección general", "direccion_general"],
    ["director de ti", "director_ti"],
    ["jefe de legal", "jefe_legal"],
    ["jefe de mantenimiento", "auxiliar_ti"],
    ["auxiliar de barra", "operador_barra"],
    ["auxiliar de producción", "auxiliar_produccion"],
    ["jefe de líneas", "supervisor_produccion"],
    ["almacenista pt", "almacenista_pt"],
    ["auxiliar de ruta", "auxiliar_ruta"],
    ["almacenista entregas", "almacenista_entregas"],
    ["supervisor ventas", "supervisor_ventas"],
    ["auxiliar administrativa", "auxiliar_admin"],
    ["gerente de sucursal", "gerente_sucursal"],
    ["jefe de ruta", "jefe_ruta"],
    ["operador torres", "operador_torres"],
  ];

  const match = roleMap.find(([needle]) => normalized.includes(needle));
  return match?.[1] || "";
}

function buildSessionFromOdoo(result, cleanPin, cleanBarcode) {
  const employee = result?.employee || {};
  const jobTitle = employee?.job_title || employee?.job_id?.[1] || "";
  const role = resolveRole(employee, jobTitle);
  const additionalJobKeys =
    employee?.additional_job_keys
    || result?.additional_job_keys
    || employee?.additional_roles
    || result?.additional_roles
    || [];
  const userId = result?.user_id || employee?.user_id?.[0] || 0;
  const employeeId = employee?.id || result?.employee_id || 0;
  const companyId = employee?.company_id?.[0] || inferCompanyId(role);
  const company = employee?.company_id?.[1] || inferCompanyLabel(companyId, role);
  const now = Math.floor(Date.now() / 1000);

  const rawWh = employee?.warehouse_id;
  const warehouseId = (Array.isArray(rawWh) ? Number(rawWh[0]) : Number(rawWh))
    || (Array.isArray(employee?.default_source_warehouse_id) ? Number(employee.default_source_warehouse_id[0]) : Number(employee?.default_source_warehouse_id))
    || 0;

  const fallbackPayload = {
    ...buildSupervisorV2SessionProjection(result),
    source: "odoo",
    role,
    job_key: role,
    additional_job_keys: additionalJobKeys,
    module_role_contexts: {},
    job_title: jobTitle,
    employee_id: employeeId,
    // M1-D prereq C.1: el gate /torre lee session.employee.tower_status; el
    // backend YA lo entrega en result.employee y aquí se persiste saneado
    // (fail-closed: no-string/vacío => null; la allowlist vive en el gate).
    employee: buildSessionEmployee(employee, employeeId),
    name: employee?.name || result?.message?.replace(/^Bienvenido,\s*/, "") || "Empleado",
    company_id: companyId,
    company,
    warehouse_id: warehouseId,
    turno: employee?.turno || employee?.x_turno || result?.turno || "",
    api_key: result?.api_key || "",
    odoo_api_key: result?.api_key || "",
    odoo_employee_token: result?.gf_employee_token || "",
    odoo_employee_session_id: result?.gf_employee_session_id || null,
    odoo_employee_session_expires_at: result?.gf_employee_session_expires_at || "",
    employee_has_user: Boolean(result?.employee_has_user),
    user_id: userId,
    exp: now + 86400 * 7,
    iat: now,
  };

  const sessionToken = result?.session_token || buildLocalSessionToken(fallbackPayload);
  const decoded = decodeSessionToken(sessionToken, fallbackPayload);

  return normalizeSessionRoleContext({
    ...decoded,
    ...fallbackPayload,
    session_token: sessionToken,
  });
}

/*
// ── Legacy WhatsApp OTP flow ───────────────────────────────────────────────
// Conservado para reactivarlo después sin reconstruir la integración.

async function requestMagicLink(phone) {
  const res = await fetch(`${WEBHOOK_URL}/pwa-auth-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, app: "pwa_colaboradores" }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Error ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const text = await res.text().catch(() => "");
  if (!text) return { status: "sent" };

  try {
    return JSON.parse(text);
  } catch {
    return { status: "sent", message: text };
  }
}

async function verifyMagicToken(token, phone) {
  const res = await fetch(`${WEBHOOK_URL}/pwa-auth-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, phone, app: "pwa_colaboradores" }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Error ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const text = await res.text().catch(() => "");
  if (!text) throw new Error("Respuesta vacía del servidor");
  return JSON.parse(text);
}
*/

// ── Design tokens ────────────────────────────────────────────────────────
// IDENTIDAD CLARA GRUPO FRÍO EN EL LOGIN, PARA TODOS LOS ROLES.
// Decisión de dirección: al autenticar todavía no se conoce el rol, así que no
// hay dónde ramificar por tema. En vez de dejar la puerta con la piel vieja, se
// rebrandea completa. El tema oscuro global (`src/tokens.js`) NO se toca: cada
// rol sigue entrando a su propia superficie.
//
// Los colores salen de `theme/brandLight` (fuente de verdad), no se redefinen
// aquí: si la paleta cambia, esta pantalla cambia con ella.
const UI = {
  colors: {
    // Superficie clara
    bg: C.bg,
    surface: C.surface,
    border: C.border,
    // Texto — AA sobre #F0F9FF: #0F2A3D da ~12.9:1 y #5B7285 ~4.9:1
    text: C.text,
    textMuted: C.textMuted,
    // Institucionales
    primary: C.primary,
    ice: C.ice,
    danger: C.error,
    warning: C.warning,
  },
  radius: {
    lg: 18,
    xl: 22,
    full: 999,
  },
  shadow: {
    // Sombras suaves: sobre fondo claro las sombras negras duras ensucian.
    card: "0 10px 30px rgba(15,42,61,0.10), 0 1px 2px rgba(15,42,61,0.06)",
    button: "0 10px 24px rgba(0,90,141,0.24)",
  },
};

// ── Partículas ───────────────────────────────────────────────────────────
function IceParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 6,
        duration: Math.random() * 8 + 6,
        opacity: Math.random() * 0.18 + 0.04,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            // Sobre fondo claro el azul del tema oscuro desaparecía: se usa el
            // "ice" institucional, que sí se lee como textura sin competir.
            background: C.ice,
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: Math.min(0.5, p.opacity + 0.16),
            animation: `float ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ── Bypass admin — empleados registrados en Odoo (x_job_key) ─────────────
// Actualizado: 2026-04-02 desde hr.employee con x_job_key != false
const ADMIN_EMPLOYEES = [
  // ── Dirección / TI ─────────────────────────────────────────────────────
  { id: 1,   name: 'Yamil Esteban Higareda',               role: 'direccion_general',     company: 'CSC GF',                             job: 'Dirección General' },
  { id: 673, name: 'Sebastian Cervera Maltos',              role: 'director_ti',           company: 'CSC GF',                             job: 'Director de TI' },
  { id: 706, name: 'Carlos Alexander Valencia Tapia',       role: 'auxiliar_ti',           company: 'CSC GF',                             job: 'Jefe de mantenimiento' },
  { id: 693, name: 'Javier Alejandro Cedillo Villalpando',  role: 'jefe_legal',            company: 'CSC GF',                             job: 'Jefe de legal' },
  // ── Producción — Fabricación de Congelados ─────────────────────────────
  { id: 714, name: 'José Manuel Ávila',                     role: 'operador_barra',        company: 'Fabricación de Congelados',           job: 'Auxiliar de barra' },
  { id: 691, name: 'Julio Raul de la Cruz González',        role: 'auxiliar_produccion',    company: 'Fabricación de Congelados',           job: 'Auxiliar de producción' },
  { id: 690, name: 'Arturo Narciso',                        role: 'supervisor_produccion',  company: 'Fabricación de Congelados',           job: 'Jefe de líneas' },
  // ── Administración ─────────────────────────────────────────────────────
  { id: 692, name: 'Claudia Martinez Balcazar',             role: 'auxiliar_admin',         company: 'Soluciones en Producción GLACIEM',    job: 'Auxiliar Administrativa' },
  { id: 699, name: 'Dirección Grupo Frío',                  role: 'gerente_sucursal',       company: 'Soluciones en Producción GLACIEM',    job: 'Gerente de Sucursal' },
  // ── Logística / Ventas — Jefes de Ruta ─────────────────────────────────
  { id: 698, name: 'Alfredo Isaac Reyes Pérez',             role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 710, name: 'Angel Danael Pérez Vera',               role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 679, name: 'Esteban Aleman Serrado',                role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 684, name: 'Estevan Valerio Guzmán',                role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 681, name: 'Jhony Irvin Marquina Rodríguez',        role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 686, name: 'Luis Molina Cholula',                   role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 682, name: 'Manuel Cruz Armenta',                   role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 683, name: 'Orlando Tlatempa Rodríguez',            role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
  { id: 711, name: 'Sebastian Tadeo Amado Sánchez',         role: 'jefe_ruta',             company: 'Soluciones en Producción GLACIEM',    job: 'Jefe de ruta' },
];

// Roles que aún no tienen empleados asignados en Odoo — se mantienen como genéricos
const ADMIN_EXTRA_ROLES = [
  { role: 'operador_rolito',      label: 'Operador Rolito',        desc: 'Producción — Congelados (sin empleado asignado)' },
  { role: 'almacenista_pt',       label: 'Almacenista PT',         desc: 'Almacén PT (sin empleado asignado)' },
  { role: 'auxiliar_ruta',        label: 'Auxiliar de Ruta',       desc: 'Logística (sin empleado asignado)' },
  { role: 'almacenista_entregas', label: 'Almacenista Entregas',   desc: 'Logística (sin empleado asignado)' },
  { role: 'supervisor_ventas',    label: 'Supervisor Ventas',      desc: 'Ventas (sin empleado asignado)' },
  { role: 'operador_torres',      label: 'Operador Torres',        desc: 'Torres de Control (sin empleado asignado)' },
];

// UTF-8 safe base64 — btoa only handles Latin1, so encode through URI first
function b64utf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function buildMockSession(emp) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: emp.role,
    name: emp.name || emp.label || 'Admin',
    employee_id: emp.id || 0,
    company: emp.company || emp.desc || '',
    company_id: 0,
    exp: now + 86400 * 7,
    iat: now,
    _bypass: true,
  };
  const header = b64utf8(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = b64utf8(JSON.stringify(payload));
  const session_token = `${header}.${body}.bypass`;
  return { ...payload, session_token };
}

// ── Componente principal ────────────────────────────────────────────────
export default function LoginScreen() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [barcode, setBarcode] = useState("");
  const [step, setStep] = useState("input"); // input | loading | admin
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Admin bypass: 5 taps en "COLABORADORES" ─────────────────────────
  const handleAdminTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setStep("admin");
      setTapCount(0);
    }
  };

  const handleBypassLogin = (profile) => {
    const session = buildMockSession(profile);
    login(session);
    navigate("/", { replace: true });
  };

  const handleSubmit = async () => {
    const cleanPin = pin.trim();
    const cleanBarcode = barcode.trim();

    if (!cleanPin || !cleanBarcode) {
      setError("Ingresa tu PIN y barcode");
      return;
    }

    setError("");
    setStep("loading");

    try {
      const result = await requestEmployeeSession(cleanPin, cleanBarcode);
      if (!result || result.status !== 200 || result.case !== 1) {
        throw new Error(
          result?.error ||
          result?.message ||
          "No se pudo validar el PIN y barcode"
        );
      }

      const session = buildSessionFromOdoo(result, cleanPin, cleanBarcode);
      login(session);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e.message || "Error iniciando sesión");
      setStep("input");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div
      data-testid="login-screen"
      data-theme="brand-light"
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: UI.colors.bg,
        color: UI.colors.text,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        overscrollBehaviorY: "none",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
        }

        html, body {
          overscroll-behavior-y: none; /* Evita rubber-banding en iOS Safari */
        }

        @keyframes float {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(-18px) scale(1.3); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.32; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .fade-up-1 { animation: fadeUp 0.6s 0.08s both; }
        .fade-up-2 { animation: fadeUp 0.6s 0.20s both; }
        .fade-up-3 { animation: fadeUp 0.6s 0.34s both; }
        .fade-up-4 { animation: fadeUp 0.6s 0.48s both; }

        .btn-shine {
          background: ${BRAND_HEADER_GRADIENT};
          background-size: 200% auto;
          transition: background-position 0.35s ease, transform 0.1s ease, box-shadow 0.2s ease;
        }

        .btn-shine:hover {
          background-position: right center;
          box-shadow: 0 12px 28px rgba(0,90,141,0.30);
        }

        .btn-shine:active {
          transform: scale(0.98);
        }

        .input-gf {
          background: ${C.surface};
          border: 1.5px solid ${C.border};
          color: ${C.text};
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .input-gf:focus {
          outline: none;
          border-color: ${C.primary};
          box-shadow: 0 0 0 3px rgba(0,119,187,0.14);
        }

        /* AA: el placeholder del tema oscuro quedaba en 0.22 de blanco, que
           sobre fondo claro no se veía. #5B7285 da ~4.9:1 sobre #FFFFFF. */
        .input-gf::placeholder {
          color: ${C.textMuted};
          opacity: 1;
        }
      `}</style>

      <IceParticles />

      {/* Halo institucional de fondo */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
        style={{
          background: `radial-gradient(circle, ${C.ice}22 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Retícula: casi imperceptible, solo para que el fondo no sea plano */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.5,
          backgroundImage:
            `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card principal */}
      <div className="relative w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-7">
        {/* Portada corporativa */}
        <div className={`flex flex-col items-center gap-4 ${mounted ? "fade-up-1" : "opacity-0"}`}>
          {/* Un solo logo: el oficial completo (marca + palabra). */}
          <div
            className="relative w-[228px] px-7 py-7 flex items-center justify-center"
            style={{
              background: UI.colors.surface,
              border: `1px solid ${UI.colors.border}`,
              borderRadius: 32,
              boxShadow: UI.shadow.card,
            }}
          >
            <img
              src={BRAND_LOGO}
              alt="Grupo Frío"
              data-testid="login-logo"
              className="w-[168px] h-auto object-contain"
            />
          </div>

          <span
            className="text-[11px] font-semibold uppercase tracking-[0.42em] cursor-default select-none"
            style={{ color: UI.colors.textMuted }}
            onClick={handleAdminTap}
          >
            COLABORADORES
          </span>
        </div>

        {/* Separador */}
        <div className={`w-full flex items-center gap-3 ${mounted ? "fade-up-2" : "opacity-0"}`}>
          <div className="flex-1 h-px" style={{ background: UI.colors.border }} />
          <span className="text-xs tracking-widest uppercase" style={{ color: UI.colors.textMuted }}>
            Grupo Frío
          </span>
          <div className="flex-1 h-px" style={{ background: UI.colors.border }} />
        </div>

        {/* Formulario */}
        {step === "admin" ? (
          <div className={`w-full flex flex-col gap-3 ${mounted ? "fade-up-3" : "opacity-0"}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: UI.colors.textMuted }}>
                Bypass — Elegir empleado
              </p>
              <button
                onClick={() => { setStep("input"); setTapCount(0); }}
                className="text-xs underline transition-colors" style={{ color: UI.colors.primary }}
              >
                Cancelar
              </button>
            </div>
            <div
              className="w-full rounded-2xl border overflow-hidden"
              style={{
                borderColor: UI.colors.border,
                background: UI.colors.surface,
                maxHeight: "52vh",
                overflowY: "auto",
              }}
            >
              {/* Empleados reales de Odoo */}
              {ADMIN_EMPLOYEES.map((emp) => (
                <button
                  key={`emp-${emp.id}`}
                  onClick={() => handleBypassLogin(emp)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                  style={{ borderBottom: `1px solid ${UI.colors.border}`, minHeight: 44 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: "#E8F6FD",
                      color: UI.colors.primary,
                    }}
                  >
                    {emp.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: UI.colors.text }}>{emp.name}</p>
                    <p className="text-[10px] truncate" style={{ color: UI.colors.textMuted }}>
                      <span style={{ color: UI.colors.primary }}>{emp.role}</span>
                      {' · '}{emp.job} · {emp.company}
                    </p>
                  </div>
                </button>
              ))}

              {/* Separador — roles sin empleado */}
              <div className="px-4 py-2" style={{ background: "#FFF6E5", borderBottom: `1px solid ${UI.colors.border}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: UI.colors.warning }}>
                  Roles sin empleado asignado
                </p>
              </div>
              {ADMIN_EXTRA_ROLES.map((p) => (
                <button
                  key={`role-${p.role}`}
                  onClick={() => handleBypassLogin(p)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: "#FFF0D6",
                      color: UI.colors.warning,
                    }}
                  >
                    {p.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: UI.colors.text }}>{p.label}</p>
                    <p className="text-[10px] truncate" style={{ color: UI.colors.textMuted }}>{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center mt-1" style={{ color: UI.colors.warning }}>
              Sesión de prueba — las llamadas a API no funcionarán sin JWT real
            </p>
          </div>
        ) : (
          <div className={`w-full flex flex-col gap-4 ${mounted ? "fade-up-3" : "opacity-0"}`}>
            <div>
              <label className="block text-xs font-semibold tracking-widest uppercase mb-2.5" style={{ color: UI.colors.textMuted }}>
                PIN de empleado
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ingresa tu PIN"
                  disabled={step === "loading"}
                  className="input-gf w-full rounded-2xl text-base font-medium"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  /* El alto va INLINE, no por `py-4`: esa utilidad la estaba
                     anulando el reset y los campos medían 26px reales — por
                     debajo del mínimo táctil. Medido en el navegador. */
                  style={{ padding: "13px 16px", minHeight: 48 }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-widest uppercase mb-2.5" style={{ color: UI.colors.textMuted }}>
                Barcode
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ingresa o escanea el barcode"
                  disabled={step === "loading"}
                  className="input-gf w-full rounded-2xl text-base font-medium"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  /* El alto va INLINE, no por `py-4`: esa utilidad la estaba
                     anulando el reset y los campos medían 26px reales — por
                     debajo del mínimo táctil. Medido en el navegador. */
                  style={{ padding: "13px 16px", minHeight: 48 }}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs mt-0 flex items-center gap-1.5" style={{ color: UI.colors.danger }}>
                <span>⚠</span> {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={step === "loading"}
              className="btn-shine w-full rounded-2xl text-white font-semibold text-base tracking-wide flex items-center justify-center gap-2.5"
              style={{
                minHeight: 52,            /* Touch target ≥44px — estándar Apple HIG */
                padding: "14px 24px",
                boxShadow: UI.shadow.button,
              }}
            >
              {step === "loading" ? (
                <>
                  <div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  <span>Validando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>

            <p className="text-xs text-center leading-relaxed" style={{ color: UI.colors.textMuted }}>
              Ingresa tu PIN y barcode para obtener tu clave de PWA.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className={`${mounted ? "fade-up-4" : "opacity-0"}`}>
          <p className="text-[10px] text-center tracking-wider" style={{ color: UI.colors.textMuted }}>
            © 2026 Grupo Frío · Todos los derechos reservados
          </p>
        </div>
      </div>

      {/* Línea inferior */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${C.ice}, transparent)` }}
      />
    </div>
  );
}
