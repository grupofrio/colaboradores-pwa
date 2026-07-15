# M4 — Validación ejecutada (frontend, 2026-07-15)

**Base: main `b2b14720` · rama `feat/kold-os-m4-sales-customers` · backend
CONGELADO `978994c4` (intacto, cero commits nuevos durante esta vuelta).**

## Gates ejecutados (cifras de ESTA suite, no de anteriores)
| Gate | Resultado |
|---|---|
| `npm test` (suite completa main+M4) | **697/697** (main 621 + 76 nuevos M4) |
| `npm run lint` (max-warnings 0) | **0 warnings** |
| `npm run build` | OK (chunk `ScreenVentasM4` 113 kB) |
| `check_public_e1` | OK (public/ sin fixtures servibles; sin artefactos M4) |
| Smoke navegador (dev server) | 4 casos abajo, **0 errores de consola** |

## Suites nuevas (76 tests)
- `m4Contract.test.mjs` (17): fixture valida; metadata de evidencia obligatoria;
  linaje; ventana absoluta; scope flexible; invariantes epistémicas; totales =
  suma exacta; PII rechazada; schema versions; STALE recompute; **números NO
  hardcodeados** (otro run coherente valida).
- `m4Api.test.mjs` (11): paths/allowlist sin PII; estados 401/403/404/409/503/
  500/timeout/payload_too_large; query solo del contrato; runs; wiring
  directKoldOsM4 GET-only sin fallback n8n; cero persistencia; cero writes.
- `m4AccessFilters.test.mjs` (15): matriz readM4Access v1 (incluye strict-case y
  sesión inválida con rol privilegiado); scope; demo gate prod-off; filtros
  verdict/classification; paginación; CSV injection; sufijos _DEMO/_STALE/
  _NONFORMAL; sanitize drop+redact; exports de texto con fronteras.
- `m4Surface.test.mjs` (18): registry; visibilidad=clic (sin asimetría);
  URL guard; nav no oculta; demo gate en pantalla; banner por DATO; veredictos +
  copy; KPIs con universo/caveat y **sin números literales**; sin botones de
  acción; sin PII renderizada; estados de error; blindaje public/.
- `koldOsM4Coexistence.test.mjs` (13): matriz A–M — Aida/admin/dirección/gerente/
  inválida/fuga-por-rol/política desconocida/orden Home vs navPriority/M1 y M2
  intactos/orden del dispatch inline/rutas únicas.

## Smoke en runtime (sesión LOCAL de prueba, eliminada al final)
| Caso | Resultado |
|---|---|
| B. `admin_plataforma` | Home muestra Planeación + **Ventas y clientes** + Torre (orden registry); `/ventas-clientes?demo=1` renderiza header con linaje, banners DEMO+NO FORMAL (3 bloqueadores), tiles 1/8/6/9/13, total 14,078 = suma exacta, KPIs con universos, bloques con "umbral no aprobado" |
| A. Aida (`tower_status=supervisor_ventas`) | URL directa `/ventas-clientes` → **expulsada a Home**; ve solo Torre |
| D. `gerente_sucursal` | URL directa → expulsado; sin módulos KOLD OS |
| E. sesión inválida (sin token) | URL directa → **/login** |

## NO ejecutado / pendiente
- **Vercel Preview + CI**: corren al abrir el PR (se reporta el resultado del
  bot en el PR; no se afirma verde antes de tiempo).
- Corrida odoo-shell productiva: BLOQUEADA (backend congelado; gates de
  Sebastián).
- Validación contra la API real desplegada: imposible hasta merge+deploy del
  backend post-auditoría.
