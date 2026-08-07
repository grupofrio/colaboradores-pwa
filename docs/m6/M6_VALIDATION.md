# M6 — Validacion

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

**Evidencia: XML-RPC read-only contra produccion, ventana `[2026-04-16, 2026-07-15)`,
cias 1, 34, 35, 36, monedas 1, 33. Auditor que midio: `fe53d564` (el backend sello `9c23d5d2` tras rebasar: divergencia esperada, ver M6_LINEAGE_GATE.md). NO es corrida formal.**

## Gates

| Gate | Resultado |
|---|---|
| `npm test` | **698/698** |
| `npm run lint` | 0 |
| `npm run build` | OK |
| `check_public_e1` | OK (public/ sin fixtures servibles) |
| CI `build` | ver checks del PR |
| Vercel Preview | ver checks del PR |

## Smoke ejecutado (navegador, `/caja-conciliacion?demo=1`)

| # | Verificacion | Resultado |
|---|---|---|
| 1 | `direccion_general` entra | ✅ |
| 2 | otro rol (chofer) es expulsado a `/` y no ve la tarjeta | ✅ |
| 3 | sin sesion va a `/login` | ✅ |
| 4 | demo funciona en DEV/Preview | ✅ |
| 5 | produccion ignora `?demo=1` | ✅ (test del gate) |
| 6 | monedas separadas (scope declara 1, 33) | ✅ |
| 7 | **NO** hay total consolidado | ✅ banner explicito |
| 8 | filtros mandan request al backend | ✅ (test) |
| 9 | cero filtrado post-pagina | ✅ (no existe `.filter` sobre items) |
| 10 | `rejected_params` visible | ✅ banner rojo |
| 11 | export sin PII | ✅ (test) |
| 12 | cero botones de accion | ✅ |
| 13 | `unavailable` sin backend | ✅ |
| 14 | **cero errores de consola** | ✅ pestaña limpia |

Extra verificado en el smoke: ejes separados visibles · evidencia NO formal
declarada · backend TEMP_PR_OPEN_NOT_DEPLOYED declarado · linaje `fe53d564` visible (divergente del sello del backend `9c23d5d2`: expected_pre_migration_lineage_mismatch, contrato 35/36) ·
cajas abiertas CAVEATED · pagos sin conciliar CAVEATED · aging del snapshot ·
cero residuos de M4/M5.

## Cifras que la pantalla muestra (del fixture real)

Facturas 163 · abiertas 96 · vencidas 94 · pagos
4,378 con 4,289 sin conciliar · cajas de vendedor 205
(205 abiertas, 0 cerradas) · cierres de caja 2
(2 con diferencia) · cierres de sucursal 12 · clientes con
snapshot 202 (175 con atraso > 90d) · apuntes CxC 856 ·
lineas bancarias 0.

## Lo que NO se valido

- **La API real**: no existe endpoint desplegado. El cliente nunca hablo con el
  backend.
- **TransactionCase / HttpCase del backend**: preparados, no ejecutados.
- **El SQL del manifiesto**: nunca ha corrido.
