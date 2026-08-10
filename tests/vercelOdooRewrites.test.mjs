import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Cutover 2026-08: los rewrites de vercel.json son LA autoridad de a qué
// instancia de Odoo pega la PWA en producción (Vercel no interpola env en
// destination). Un typo aquí pasa CI verde y solo se ve en prod — este test
// ancla el host esperado.
const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const dests = cfg.rewrites.map((r) => r.destination).join('\n');
assert.match(dests, /https:\/\/grupofrio-gf\.odoo\.com\/api\/:path\*/, '/api-odoo debe apuntar a la instancia nueva');
assert.match(dests, /https:\/\/grupofrio-gf\.odoo\.com\/:path\*/, '/odoo-api debe apuntar a la instancia nueva');
assert.doesNotMatch(dests, /grupofrio\.odoo\.com/, 'ningún rewrite debe apuntar a la instancia vieja');
console.log('vercel odoo rewrites tests: ok');
