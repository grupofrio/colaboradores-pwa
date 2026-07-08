// E1-B — loader READ-ONLY del contrato tower.status (producido por E1-A en grupofrio/kold-os).
// NO usa el api operativo; hace fetch de un asset ESTÁTICO. No escribe, no llama endpoints nuevos.
// Los JSON bajo /e1/ son FIXTURES de preview (copias del output de E1-A); la entrega real del
// artefacto E1-A -> PWA es un paso de build/CI de E1-C (no hand-copy).

const ROLE_ID_RE = /^[a-z0-9_]+$/; // mismo candado que el generador E1-A
const BADGES = new Set(["operativo", "piloto", "parcial", "pc", "bloqueado", "estado_admin"]);
const FORBIDDEN_KEYS = new Set(["evidence_internal", "risk_internal", "secret", "token", "raw_tracker"]);

function assertNoForbiddenKeys(node, path = "") {
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertNoForbiddenKeys(v, `${path}[${i}]`));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.has(k)) {
        throw new Error(`tower.status contiene clave prohibida: ${path}.${k}`);
      }
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

// base configurable; por defecto asset estático servido por el propio PWA (sin endpoint nuevo).
export function towerStatusUrl(role, base = "/e1") {
  if (!ROLE_ID_RE.test(role)) throw new Error(`role id inseguro: ${role}`);
  return `${base}/tower.status.${role}.json`;
}

export async function fetchTowerStatus(role, { base = "/e1", fetchImpl = fetch } = {}) {
  const res = await fetchImpl(towerStatusUrl(role, base), { method: "GET" });
  if (!res.ok) throw new Error(`tower.status ${role}: HTTP ${res.status}`);
  return validateTowerStatus(await res.json());
}
