#!/usr/bin/env node
// E1-B — guard de assets públicos tower.status (Blocker 4 Codex + minimización de roles gated).
// READ-ONLY: solo lee. Falla (exit!=0) si:
//   - un sample público no valida el contrato,
//   - un rol GATED expone módulos en el asset público (debe ir minimizado: modules == []),
//   - un rol NO-gated no trae módulos,
//   - (si KOLD_OS_E1_OUT apunta a kold-os/e1/out) hay DRIFT: no-gated debe ser igual al output de
//     E1-A; gated debe ser la proyección minimizada (mismo doc con modules:[]).
// Uso:
//   node scripts/check_public_e1.mjs
//   KOLD_OS_E1_OUT=/ruta/a/kold-os/e1/out node scripts/check_public_e1.mjs   # + drift real
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { validateTowerStatus } from "../src/modules/torre/e1/loadTowerStatus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, "..", "public", "e1");
const read = (p) => JSON.parse(readFileSync(p, "utf-8"));
const errors = [];

const files = readdirSync(PUB).filter((f) => /^tower\.status\.[a-z0-9_]+\.json$/.test(f));
if (files.length === 0) errors.push("no hay samples en public/e1");

for (const f of files) {
  const role = f.replace(/^tower\.status\.|\.json$/g, "");
  let doc;
  try {
    doc = validateTowerStatus(read(join(PUB, f)));
  } catch (e) {
    errors.push(`${f}: no valida el contrato — ${e.message}`);
    continue;
  }
  const gated = doc.role_gate?.is_gated === true;
  if (gated && doc.modules.length !== 0) {
    errors.push(`${f}: rol GATED (${doc.role_gate.gate}) expone ${doc.modules.length} módulos en el asset público — DEBE ir minimizado (modules: [])`);
  }
  if (!gated && doc.modules.length === 0) {
    errors.push(`${f}: rol no-gated sin módulos (¿fixture incompleto?)`);
  }
}

// Drift opcional vs el output canónico de E1-A (kold-os/e1/out).
const OUT = process.env.KOLD_OS_E1_OUT;
if (OUT && existsSync(OUT)) {
  for (const f of files) {
    const pub = read(join(PUB, f));
    const srcPath = join(OUT, f);
    if (!existsSync(srcPath)) { errors.push(`drift: ${f} no existe en E1-A (${OUT})`); continue; }
    const src = read(srcPath);
    const expected = pub.role_gate?.is_gated ? { ...src, modules: [] } : src;
    if (JSON.stringify(pub) !== JSON.stringify(expected)) {
      errors.push(`drift: ${f} difiere del ${pub.role_gate?.is_gated ? "output minimizado" : "output"} de E1-A`);
    }
  }
  console.log(`Drift check vs ${OUT}: ejecutado.`);
} else {
  console.log("Drift check vs E1-A: OMITIDO (definí KOLD_OS_E1_OUT para compararlo). Invariante de minimización SÍ verificada.");
}

if (errors.length) {
  console.error(`check_public_e1: ${errors.length} problema(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`check_public_e1 OK: ${files.length} assets públicos (gated minimizados, no-gated con módulos).`);
