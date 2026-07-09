// E1-B — loader READ-ONLY del contrato tower.status (producido por E1-A en grupofrio/kold-os).
// NO usa el api operativo; hace fetch de un asset ESTÁTICO local. No escribe, no llama endpoints.
// Los JSON bajo /e1/ son FIXTURES de preview; para roles GATED van minimizados (sin módulos).
// La entrega real del artefacto E1-A -> PWA es un paso de build/CI de E1-C (no hand-copy).

const ROLE_ID_RE = /^[a-z0-9_]+$/; // mismo candado que el generador E1-A
const BADGES = new Set(["operativo", "piloto", "parcial", "pc", "bloqueado", "estado_admin"]);
const FORBIDDEN_KEYS = new Set(["evidence_internal", "risk_internal", "secret", "token", "raw_tracker"]);

// Blocker 1 (Codex): en producción E1-B SOLO consume el asset estático "/e1".
export const ALLOWED_PROD_BASE = "/e1";
// URL absoluta, protocolo, traversal, doble-slash, o bases de endpoint operativo => prohibido.
const DANGEROUS_BASE_RE = /(^https?:)|(:\/\/)|(\.\.)|(^\/\/)|(^\/(api|rpc|odoo|n8n|webhook|graphql|xmlrpc|jsonrpc)(\/|$))/i;

// allowCustom = true SOLO en test/dev (cuando se inyecta fetchImpl). En prod queda false.
export function assertSafeBase(base, { allowCustom = false } = {}) {
  if (typeof base !== "string" || !base) throw new Error("base inválido");
  if (base === ALLOWED_PROD_BASE) return base;
  if (!allowCustom) {
    throw new Error(
      `base '${base}' no permitido: E1-B solo consume asset estático '${ALLOWED_PROD_BASE}' en prod`
    );
  }
  if (DANGEROUS_BASE_RE.test(base)) {
    throw new Error(`base '${base}' peligroso (URL absoluta / traversal / endpoint operativo) — prohibido`);
  }
  return base;
}

function assertNoForbiddenKeys(node, path = "") {
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertNoForbiddenKeys(v, `${path}[${i}]`));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.has(k)) throw new Error(`tower.status contiene clave prohibida: ${path}.${k}`);
      assertNoForbiddenKeys(v, `${path}.${k}`);
    }
  }
}

// Valida la forma mínima del contrato (defensa en profundidad; E1-A ya valida al generar).
export function validateTowerStatus(doc) {
  if (!doc || typeof doc !== "object") throw new Error("tower.status vacío o no-objeto");
  if (doc.read_only !== true) throw new Error("tower.status.read_only debe ser true");
  if (!doc.version || !doc.generated_for_role || !doc.data_as_of) {
    throw new Error("tower.status sin version/generated_for_role/data_as_of");
  }
  if (!doc.role_gate || typeof doc.role_gate.is_gated !== "boolean") {
    throw new Error("tower.status sin role_gate.is_gated");
  }
  if (!Array.isArray(doc.modules)) throw new Error("tower.status.modules no es lista");
  for (const m of doc.modules) {
    if (!BADGES.has(m.badge)) throw new Error(`badge inválido: ${m.id} => ${m.badge}`);
  }
  assertNoForbiddenKeys(doc);
  return doc;
}

export function towerStatusUrl(role, base = ALLOWED_PROD_BASE, { allowCustom = false } = {}) {
  if (!ROLE_ID_RE.test(role)) throw new Error(`role id inseguro: ${role}`);
  assertSafeBase(base, { allowCustom });
  return `${base}/tower.status.${role}.json`;
}

export async function fetchTowerStatus(role, { base = ALLOWED_PROD_BASE, fetchImpl } = {}) {
  // Sólo se permite base custom cuando hay fetchImpl inyectado (test/dev). En prod: "/e1".
  const allowCustom = Boolean(fetchImpl);
  const url = towerStatusUrl(role, base, { allowCustom });
  const impl = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!impl) throw new Error("fetch no disponible");
  const res = await impl(url, { method: "GET" });
  if (!res.ok) throw new Error(`tower.status ${role}: HTTP ${res.status}`);
  return validateTowerStatus(await res.json());
}

// Blocker 2 (Codex): decisión de render PURA y testeable. Default seguro: gated = BLOQUEADO.
// Si el rol está gated y no hay preview explícito de test/dev, NO se devuelven módulos.
export function resolveBoardView(doc, { allowGatedPreview = false } = {}) {
  const gate = doc?.role_gate || { is_gated: false, gate: null, reason: null };
  if (gate.is_gated && !allowGatedPreview) {
    return { blocked: true, gate, modules: [] };
  }
  return { blocked: false, gate, modules: Array.isArray(doc?.modules) ? doc.modules : [] };
}

// ── E1-C.2 — rol AUTORITATIVO entregado por Odoo (la PWA NO decide el rol) ──────
// Odoo lo resuelve server-side (rol principal + adicionales) y lo pone en
// response["employee"]["tower_status"]; la PWA lo recibe en el login y lo guarda como
// session.employee.tower_status (ver src/lib/api.js / App.jsx). La PWA OBEDECE ese valor.
// NO deriva el rol de job keys del cliente (resolveTowerRole.js = LEGACY, no autoriza).
// Allowlist DURA (Opción A v1): SOLO estos dos. Cualquier otro valor => null (sin superficie).
export const ALLOWED_TOWER_STATUS = new Set(["admin_plataforma", "supervisor_ventas"]);

export function readAuthoritativeTowerStatus(session) {
  const raw = session?.employee?.tower_status;
  if (typeof raw !== "string") return null;            // null/undefined/número/objeto/array => null
  const val = raw.trim().toLowerCase();
  return ALLOWED_TOWER_STATUS.has(val) ? val : null;   // valor fuera de la allowlist => null (rechazado)
}
