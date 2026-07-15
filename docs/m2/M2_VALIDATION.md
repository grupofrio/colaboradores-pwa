# M2 — Validación (evidencia de esta entrega)

Fecha: 2026-07-14 · rama `feat/kold-os-m2-planning-readiness` (desde main `3ed6fb8`).

## 1. Gates locales

| Gate | Resultado |
|---|---|
| `npm test` | **591/591 PASS** (main tenía 524; +67 tests M2 en 5 archivos) |
| `npm run lint` | 0 errores / 0 warnings (max-warnings 0) |
| `npm run build` | OK (vite; chunk M2 lazy separado) |
| `node scripts/check_public_e1.mjs` | OK (blindaje E1 intacto) |
| Blindaje M2 | test `m2Surface`: `public/` sin `kold.tower.m2.*.json` |

## 2. Contratos validados contra el auditor real

- El validador (`contract.js`) se escribió leyendo el **código fuente del auditor** en el build
  mergeado `fb03840919cf…` (GrupoVeniu/GrupoFrio): 13 query_ids exactos, shape de filas por
  `allowed_result_keys`, claves sensibles prohibidas (espejo del regex del auditor), reglas de
  producción (DB/companies/branch/window/production_contract 3/3).
- El run real de producción 2026-07-14 (13/13, 342 ms, exit 0, contrato 3/3) **prueba el contrato
  en runtime**; NO se consultó producción desde esta sesión (mínimo privilegio — la evidencia del
  auditor basta para validar el contrato v1).

## 3. Cifras reales reproducidas por el fixture (tests `REPORTADO:`)

293/484 = 60.54% · 424/484 = 87.60% · 144/484 = 29.75% · 133/484 = 27.48% · 30 sobrecapacidad ·
37/39 = 94.87% · 46 sin snapshot · 21 sin stops · 48 sin almacén · 10 sin snapshot semanal ·
29 sobrecapacidad semanal · cobertura 56.82% · confianza 0.6667 · 2 202 fallback · 192 warnings ·
7 026/42 421 = 16.56% · 42 372 forecasts / 92 días / 41 372 finales — **cada una con assert exacto**.

## 4. Cobertura de tests (67 asserts nuevos, 5 archivos)

- `m2Contract` — contrato: fixture válido; rechazos (status, guardas, hashes, queries desconocidas/
  duplicadas/incompletas, claves sensibles, no-escalares, scope, producción 3/3); técnico
  PASS/FAIL/STALE/UNAVAILABLE.
- `m2Rules` — catálogo íntegro (códigos únicos, 6 categorías, auto_fix=false); safePct div-cero/
  nulls; TODAS las cifras reportadas; NOT_EVALUABLE honesto (manual, div-cero, métrica ausente);
  summary técnico-vs-operativo (PASS + RED); bloques; findings sin dueño inventado; determinismo.
- `m2Lifecycle` — id estable; matriz new/persistent/corrected/recurrent; orden de corridas
  irrelevante; entradas corruptas fail-safe; integración fixture.
- `m2AccessFilters` — matriz de acceso completa (incluye forjados y strict-case); scope sin fuga;
  filtros (7 dimensiones + fechas + búsqueda); paginación con clamps; CSV/JSON/resumen;
  sanitización de exportación (claves sensibles drop + credenciales [REDACTED]).
- `m2Surface` — registry/tarjeta/nav por rol; `/planeacion` no nav-hidden; guard M2PlaneacionRoute
  (text-scan del cableado real); Tower intacto; loader allowlist + 404/corrupto/roto/ok; read-only
  duro (sin POST/PUT/PATCH/DELETE/execute_kw/setItem en todo el módulo); sin botones de escritura;
  estados honestos en la pantalla; blindaje public/; procedencia del fixture (no suplanta el hash
  real); ScreenHome intacto (cero solape con #67).

## 5. Validación visual (Preview)

- Ruta `/planeacion` detrás del guard (sin sesión → /login).
- `?demo=1` muestra la superficie completa con la reconstrucción: banner DEMO + AUDITOR: PASS +
  DATOS: RED + 6 bloques + drill-down + detalle + exports.
- Sin fuente publicada (default): estado UNAVAILABLE honesto con instrucciones.

## 6. Pendiente de validación humana (post-merge, tras #67)

Login real de dirección en Preview/producción: tarjeta "Planeación" visible, módulos de otros
roles sin cambios, gerente/supervisor NO ven la tarjeta y URL directa los regresa al home.
