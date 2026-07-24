# M2 — Validación (evidencia de la entrega v2)

Fecha: 2026-07-14 · frontend `feat/kold-os-m2-planning-readiness` (PR #68, base main
`3ed6fb8`) · backend `feat/kold-os-m2-observability-api` (GrupoVeniu/GrupoFrio PR #201,
base `GrupoFrio` @ `fb03840`).

## 1. Gates

| Gate | Frontend | Backend |
|---|---|---|
| Tests | **593/593** (node:test; 5 suites m2: contrato/api/acceso-filtros-export/superficie + resto de la app) | **30/30 puros locales** (`python gf_kold_os_m2/tests/test_kold_os_m2_core.py`) + TransactionCase para Odoo.sh CI (compilados: `py_compile` OK) |
| Lint | 0 warnings (max-warnings 0) | n/a (estilo espejo de gf_tower_m1/gf_route_compliance) |
| Build | vite OK (chunk M2 lazy) | n/a |
| Blindajes | check_public_e1 OK · public/ sin JSON m2 (test) | manifiesto SQL del auditor intacto (no se toca) |
| CI/Preview | GitHub Actions build + Vercel Preview del PR | Odoo.sh CI al abrir en revisión (Sebas) |

## 2. Cadena de contrato validada con CÓDIGO REAL (Track C)

1. `contract_fixture_report.json` = salida del **core real del auditor**
   (`kold_tower_m2_audit_core` @ `fb03840`) ejecutado offline con cursor scriptado que
   devuelve los agregados REPORTADOS del run de producción 2026-07-14.
   **Prueba independiente:** su `manifest_sha256` = `0fb967bd06eb…9204c`, idéntico al
   reportado en producción (el manifiesto es propiedad determinista del código).
2. `apiLatestFixture.js` = ese reporte pasado por el **core real del backend**
   (`kold_os_m2_core.py`: derivación, lifecycle, capabilities, sanitización).
3. El frontend valida ese envelope con su contrato (`validateM2Latest`) y los tests
   asertan las cifras exactas — **contract test punta a punta contra output real
   sanitizado**, sin reconstrucción manual.
4. El fixture declara procedencia y NUNCA porta el `evidence_sha256` productivo (test).

No se consultó producción desde esta sesión (mínimo privilegio): el contrato quedó probado
por el run real del auditor + la cadena de código real anterior.

## 3. Cifras reales asertadas (ambos lados)

293/484=60.54% · 424/484=87.60% · 144/484=29.75% · 133/484=27.48% · 30 · 29 · 37/39=94.87%
· 46 · 21 · 48 · 10 · 56.82% · 0.6667 · 2 202 · 192 · 7 026/42 421=16.56% · 42 372/92 días
/ 41 372 finales · **summary: 13 RED · 3 AMBER · 3 NOT_EVALUABLE · 39 004 incidencias ·
unique_records_available=false**.

## 4. Hallazgos Codex v1 → estado v2

| # | Hallazgo | Estado |
|---|---|---|
| 1-4 | sin fuente productiva/endpoint | ✅ backend PR #201 (API autenticada GET) |
| 2-3 | UNAVAILABLE/dep. demo | ✅ estados honestos + demo gateado DEV/Preview |
| 5 | sin historial | ✅ datastore observatorio + ingesta idempotente |
| 6 | sin detalle por dimensión | ✅ contrato granularity + capabilities (datos = v1.1 auditor, declarado) |
| 7 | permisos tarjeta≠ruta | ✅ accessPolicy 'm2' + una autoridad (5 casos test) |
| 8 | "registros" engañoso | ✅ "Incidencias detectadas" + unique_records_available:false + test 5-reglas-1-plan |
| 9 | "drill-down" agregado | ✅ "Detalle de regla" + badges AGREGADO/SUCURSAL/REGISTRO |
| 10 | lifecycle sintético | ✅ backend real al ingerir; UI gatea con ≥2 corridas |
| 11 | CSV injection | ✅ neutralización `'` pre-escape + suite (=,+,-,@,tab,CRLF,comillas,unicode) |
| 12 | demo en bundle prod | ✅ isM2DemoAllowed (DEV/VITE_ENABLE_M2_DEMO) + test prod-niega |
| 13 | contrato rígido/sin versión | ✅ schema_version explícito + futura controlada + capabilities + scope flexible |
| 14 | rebase tras #67 | ⏳ pendiente por ORDEN (no se rebasa sobre rama no mergeada); plan en Track F |

## 5. Smoke local (dev server, sesiones sintéticas locales)

Guard sin sesión → /login · gerente → rebote a home sin tarjeta · dirección → tarjeta
"Planeación" + `/planeacion` en estado honesto (sin backend: unavailable/error de red) ·
`?demo=1` (DEV) → superficie completa con el envelope real-code + banner DEMO · consola
sin errores. Ver bitácora del PR.

## 6. Pendiente de validación humana

Sebastián: revisión de ambos PRs + CI Odoo.sh del backend. Post-deploy: smoke autenticado
real (dirección) contra `/pwa-kold-os/m2/latest` con flag ON y un run ingerido.
