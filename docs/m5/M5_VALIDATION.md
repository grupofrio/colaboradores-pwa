# M5 — Validacion

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

**Evidencia: XML-RPC read-only contra produccion, ventana `[2026-04-16, 2026-07-15)`.
Auditor que midio: `aa589965` (= `run.auditor_build_sha`, con test que lo compara).
NO es corrida odoo-shell formal.**

## Gates

| Gate | Resultado |
|---|---|
| `npm test` | **727/727** |
| `npm run lint` | 0 |
| `npm run build` | OK |
| `check_public_e1` | OK (public/ sin fixtures servibles) |
| CI `build` | SUCCESS |
| Vercel Preview | SUCCESS |

## Smoke (`/inventario-flujo?demo=1`)

| Verificacion | Esperado |
|---|---|
| Linaje visible | `midio: aa589965…` |
| Tiles por veredicto | **0/9/8/7/14** · total **8,802** |
| Open vs final | conciliaciones finales **90** y abiertas **266**, en tiles SEPARADOS |
| Senal por producto | **3 de 261** lineas finales con difference |
| Capabilities false | tiles en **"—"** con razon, ningun 0 |
| Ausencia de conclusion | **cero** apariciones de "NO CUADRA" |
| Ausencia de claim refutado | **cero** apariciones de "UOM heterogeneas" |
| Ausencia de residuos M4 | cero "ventas"/"clientes"/"canales"/"recurrencia" visibles |
| Exports | titulos de inventario/flujo; "Diferencias REPORTADAS en conciliacion" |
| Filtros | categoria real del catalogo M5; `rejected_params` visible si los hay |
| Banners | DEMO + EVIDENCIA NO FORMAL |

## Backend

Tests puros del backend: ver PR del backend. TransactionCase/HttpCase quedan
**preparados y NO ejecutados** (Track A odoo-shell bloqueado) ⇒ **el backend NO
se declara GREEN formal**.
