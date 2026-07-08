#!/usr/bin/env node
// E1-B — guard de assets/fixtures tower.status (Codex Blocker 4 + minimización + BLINDAJE de public/).
// READ-ONLY: solo lee. Falla (exit!=0) si:
//   - [BLINDAJE] aparece cualquier tower.status.* dentro de public/ (los fixtures NO deben servirse
//     sin auth; viven en src/modules/torre/e1/fixtures/ y no se empaquetan al no ser importados),
//   - un fixture no valida el contrato,
//   - un rol GATED expone módulos (debe ir minimizado: modules == []),
//   - un rol NO-gated no trae módulos,
//   - (si KOLD_OS_E1_OUT apunta a kold-os/e1/out) hay DRIFT: no-gated = igual a E1-A; gated = proyección minimizada.
// Uso:
//   node scripts/check_public_e1.mjs
//   KOLD_OS_E1_OUT=/ruta/a/kold-os/e1/out node scripts/check_public_e1.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { validateTowerStatus } from "../src/modules/torre/e1/loadTowerStatus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FIX = join(ROOT, "src", "modules", "torre", "e1", "fixtures");
const PUBLIC = join(ROOT, "public");
const read = (p) => JSON.parse(readFileSync(p, "utf-8"));
const errors = [];

// [BLINDAJE] ningún tower.status.* servido desde public/ (recursivo).
function walkFind(dir, re, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkFind(p, re, acc);
    else if (re.test(name.name)) acc.push(p);
  }
  return acc;
}
const leaked = walkFind(PUBLIC, /^tower\.status\..*\.json$/);
for (const p of leaked) errors.push(`BLINDAJE: fixture servible en public/: ${p} (mover a src/.../fixtures)`);

// Validación de fixtures + minimización de roles gated.
const files = existsSync(FIX) ? readdirSync(FIX).filter((f) => /^tower\.status\.[a-z0-9_]+\.json$/.test(f)) : [];
if (files.length === 0) errors.push("no hay fixtures en src/modules/torre/e1/fixtures");

for (const f of files) {
  let doc;
  try { doc = validateTowerStatus(read(join(FIX, f))); }
  catch (e) { errors.push(`${f}: no valida el contrato — ${e.message}`); continue; }
  const gated = doc.role_gate?.is_gated === true;
  if (gated && doc.modules.length !== 0) {
    errors.push(`${f}: rol GATED (${doc.role_gate.gate}) expone ${doc.modules.length} módulos — DEBE ir minimizado (modules: [])`);
  }
  if (!gated && doc.modules.length === 0) errors.push(`${f}: rol no-gated sin módulos (¿fixture incompleto?)`);
}

// Drift opcional vs el output canónico de E1-A (kold-os/e1/out).
const OUT = process.env.KOLD_OS_E1_OUT;
if (OUT && existsSync(OUT)) {
  for (const f of files) {
    const fx = read(join(FIX, f));
    const srcPath = join(OUT, f);
    if (!existsSync(srcPath)) { errors.push(`drift: ${f} no existe en E1-A (${OUT})`); continue; }
    const src = read(srcPath);
    const expected = fx.role_gate?.is_gated ? { ...src, modules: [] } : src;
    if (JSON.stringify(fx) !== JSON.stringify(expected)) {
      errors.push(`drift: ${f} difiere del ${fx.role_gate?.is_gated ? "output minimizado" : "output"} de E1-A`);
    }
  }
  console.log(`Drift check vs ${OUT}: ejecutado.`);
} else {
  console.log("Drift check vs E1-A: OMITIDO (definí KOLD_OS_E1_OUT). Invariante de minimización + blindaje SÍ verificados.");
}

if (errors.length) {
  console.error(`check_public_e1: ${errors.length} problema(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`check_public_e1 OK: public/ sin fixtures servibles + ${files.length} fixtures (gated minimizados, no-gated con módulos).`);
