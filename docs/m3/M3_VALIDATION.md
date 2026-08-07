# M3 — Validación (frontend)

Fecha: 2026-07-15 · rama `feat/kold-os-m3-route-execution` (base main `7bc89ea`)
· backend par: GrupoVeniu/GrupoFrio PR #202 (`eee896f`).

## Gates EJECUTADOS
| Gate | Resultado |
|---|---|
| `npm test` | **586/586** (main 524 → **+62 tests M3** en 4 suites) |
| `npm run lint` | 0 warnings (max-warnings 0) |
| `npm run build` | OK (chunk M3 lazy) |
| `node scripts/check_public_e1.mjs` | OK (blindaje E1 intacto) |
| Blindaje M3 | `public/` sin JSON m3 (test) |
| Smoke visual local (dev server) | ver bitácora del PR |

## Preparado para CI (no ejecutable localmente)
GitHub Actions `build` + Vercel Preview del PR (mismos comandos que los gates
locales). El TransactionCase del backend corre en Odoo.sh CI (repo GrupoFrio).

## Cadena de contrato con CÓDIGO REAL (sin reconstrucción manual)
1. Agregados REALES medidos en producción (XML-RPC read-only 2026-07-15).
2. Reporte del auditor EMITIDO por `kold_os_m3_audit_core` real (cursor
   scriptado, env dev, clock fijo) — manifest `4c14a73c…` = el del código.
3. Envelope construido por `kold_os_m3_core.py` real.
4. `validateM3Latest` del frontend lo valida y los tests asertan cada cifra.

## Cobertura de tests (+62)
- `m3Contract` — envelope válido; procedencia honesta; TODAS las cifras reales
  (arranque/paradas/comercial/cierre/plan-vs-real); summary 20🔴/7🟠/22,030;
  KPIs (29.35%); granularidad branch real (2/30 y 20/298) y rechazo de
  granularidad mentirosa en ambas direcciones; schema futura controlada;
  campos extra OK; scope flexible; /findings; STALE.
- `m3Api` — rutas y allowlist SIN employee_id; ok/401/403/404/409/503/500/
  timeout/payload-gigante; params que no viajan; /runs; classify+withTimeout;
  text-scan del handler real GET-only sin n8n; cero persistencia.
- `m3AccessFilters` — matriz Fase 10 completa (chofer/jefe_ruta/supervisor/
  gerente = none; proyección admin_plataforma; forjados; strict-case); scope
  sin fuga; demo gate niega en prod; filtros (sucursal/granularidad/búsqueda/
  fechas); paginación; CSV injection (suite completa + payload hostil);
  exportFilename STALE/DEMO; revokeObjectURL; sanitización; resumen y
  plan-vs-real con números reales.
- `m3Surface` — registry/accessPolicy; tarjeta+nav+clic+URL con la MISMA
  autoridad (5 perfiles); política desconocida fail-closed; universales
  intactos; ScreenHome session-aware; guard en App.jsx (text-scan del cableado
  real); Tower intacto; /ejecucion no nav-hidden; demo gateado; labels
  honestos (incidencias/granularidad/columna sucursal/offline "—"); lifecycle
  gateado ≥2 corridas; STALE + export plan-vs-real; read-only duro; blindaje.

## Smoke visual local
Guard sin sesión → /login ✓ · rol sin permiso → rebote a home sin tarjeta ✓ ·
dirección ve tarjeta "Ejecución de rutas" ✓ · `/ejecucion` sin backend ⇒
"Sin fuente de datos disponible" honesto ✓ · `?demo=1` (DEV) ⇒ superficie
completa con números reales, bloques, detalle por sucursal, exports ✓ ·
consola sin errores ✓.

## Pendiente (fuera de esta sesión)
Codex sobre ambos heads · revisión Sebastián · deploy backend + ingesta +
flag (S/N) · smoke autenticado real contra la API · rebase post-#67/#68.
