# M4 — Validación ejecutada (frontend, 2026-07-15)

**Base: main `b2b14720` · rama `feat/kold-os-m4-sales-customers` · backend
GrupoVeniu/GrupoFrio PR #205 (midió `3eeffd88`).**

## Gates ejecutados (cifras de ESTA vuelta, re-corridas tras adaptar el contrato)
| Gate | Resultado |
|---|---|
| `npm test` (suite completa main+M4) | **714/714** (main 621 + 93 M4) |
| `npm run lint` (max-warnings 0) | **0 warnings** |
| `npm run build` | OK (chunk `ScreenVentasM4` 134.43 kB · gzip 31.00 kB) |
| `check_public_e1` | OK (public/ sin fixtures servibles; sin artefactos M4) |
| Smoke navegador (dev server) | 6 casos abajo, **0 errores de consola** |
| Backend (puros, otro repo) | **104/104** = 71 core + 24 universos + 4 scan-M3 + 5 filter-docs |

## Suites M4 (93 tests)
- `m4Contract.test.mjs` (26): fixture valida; metadata de evidencia obligatoria;
  linaje (**`measuring_commit === run.auditor_build_sha`**); ventana absoluta;
  scope flexible; invariantes epistémicas (el incumplimiento se **fabrica**: el
  fixture real tiene cero); totales = suma exacta; PII rechazada; schema
  versions; STALE recompute; **números NO hardcodeados**.
- `m4Api.test.mjs` (14): paths/allowlist sin PII; **allowlist = espejo exacto del
  backend**; **todo filtro de la pantalla sobrevive el viaje**; estados 401/403/
  404/409/503/500/timeout/payload_too_large; wiring directKoldOsM4 GET-only sin
  fallback n8n; cero persistencia; cero writes.
- `m4AccessFilters.test.mjs` (20): matriz readM4Access v1 (incluye strict-case y
  sesión inválida con rol privilegiado); scope; demo gate prod-off; filtros
  verdict/classification; paginación; CSV injection; sufijos _DEMO/_STALE/
  _NONFORMAL; sanitize drop+redact; exports de texto con fronteras.
- `m4Surface.test.mjs` (19): registry; visibilidad=clic (sin asimetría); URL
  guard; nav no oculta; demo gate en pantalla; banner por DATO; veredictos +
  copy; **KPIs leídos de `payload.kpis`** con universo/fuente/cobertura/salvedad/
  corte; **capabilities gobiernan (`NotEvaluableTile`, fronteras M5/M6/M7)**;
  **sin números literales**; sin botones de acción; sin PII renderizada; estados
  de error; blindaje public/.
- `koldOsM4Coexistence.test.mjs` (13): matriz A–M — Aida/admin/dirección/gerente/
  inválida/fuga-por-rol/política desconocida/orden Home vs navPriority/M1 y M2
  intactos/orden del dispatch inline/rutas únicas.

## Smoke en runtime (sesión LOCAL de prueba, eliminada al final)

Ejecutado **de nuevo** sobre el fixture corregido: el smoke anterior quedó
inválido cuando la auditoría cambió la conclusión (registraba tiles 1/8/6/9/13 y
total 14,078, que ya no existen).

| Caso | Resultado |
|---|---|
| B. `admin_plataforma` | `/ventas-clientes?demo=1` renderiza: header con `midió: 3eeffd889b…` · banners DEMO + EVIDENCIA NO FORMAL (3 bloqueadores) · tiles **0 / 9 / 5 / 8 / 15** · total **12,158** = suma exacta · KPIs con universo, cobertura y salvedad visibles · **4 tiles "—"** en "Fuera del contrato v1" (Entregados/Facturados/Cobrados/Margen) · bloques con "umbral no aprobado" · **ninguna aparición de "venta" sin calificar** |
| A. `supervisor_ventas` (Aida) | URL directa `/ventas-clientes` → **expulsada a `/`** |
| D. `gerente_sucursal` | URL directa → **expulsado a `/`** |
| E. sesión inválida (sin token) | URL directa → **`/login`** |
| F. **"solo incumplimientos" con CERO incumplimientos** | Selector `Veredicto=incumplimiento` → encabezado **"Detalle de regla (0)"**, tabla con **"Sin hallazgos con estos filtros"**, **0 filas**, ninguna anomalía colada, ningún `rejected_params` oculto |
| G. **Universo A5 en pantalla** | `midió: 3eeffd889b` · **M4-A-04 muestra "168 de 752 (22.34%)"** (antes 168 de 584) · **cero** apariciones de 1,620 / 2,333 / 69% |
| H. **Detalle de M4-F-01** (filtro categoría=recurrencia → clic en la fila) | **Universo medido**: "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico…" · **Cobertura**: **78 de 584 (13.36%)** · limitaciones sin cifras viejas |
| I. **Export CSV** (blob interceptado) | lleva `universe_id`, **no** lleva `company_id`/`branch_id`, y **cero** cifras del universo viejo — coincide con pantalla y API |

Consola en pestaña limpia: **0 errores**. Las 2 advertencias son *future flags*
de React Router v6→v7, preexistentes en main y ajenas a M4.

## NO ejecutado / pendiente
- **Vercel Preview + CI**: corren al abrir/actualizar el PR (se reporta el
  resultado del bot; no se afirma verde antes de tiempo).
- Corrida odoo-shell productiva: **BLOQUEADA** (sin llave SSH en Odoo.sh, módulo
  sin desplegar). Gates de Sebastián.
- **Validación contra la API real desplegada: imposible** hasta merge+deploy del
  backend. Todo lo verificado aquí es contra el fixture emitido por el core real,
  no contra el servicio corriendo.
