# M2 — Permisos y acceso (v2)

**Una sola función canónica por lado, mismo contrato conceptual:**
frontend `readM2Access(session)` (`src/modules/planeacion/m2/access.js`) · backend
`_access_for(employee)` (`gf_kold_os_m2`). Fail-closed en ambos.

## Decisión A4 (documentada, base factual)

Server-side **`admin_plataforma` ES la proyección de `direccion_general`**
(`PWA_TOWER_ROLE_STATUS_MAP` en `os_customer_zones`): no existe como puesto separado. Por
eso el backend evalúa la **fuente primaria** (job keys efectivos incluyen
`direccion_general` ⇒ GLOBAL) y el frontend acepta **ambas proyecciones de esa misma
verdad** (x_job_key `direccion_general` O `session.employee.tower_status ===
'admin_plataforma'`). Registrar `admin_plataforma` como "rol transversal KOLD OS" formal =
ratificación S/N; mientras tanto esta equivalencia factual está documentada aquí y en el
docstring del backend. **supervisor_ventas NO hereda de Tower** (test en ambos lados).

## Matriz v1

| Principal | Acceso |
|---|---|
| `direccion_general` (job key efectivo, primario o adicional) | **GLOBAL** |
| `admin_plataforma` (tower_status = proyección de direccion_general) | **GLOBAL** |
| `supervisor_ventas` (con o sin tower_status) | none |
| gerente/ruta/almacén/torres/desconocidos | none |
| sesión inválida/expirada | none (→ /login) |
| "responsables de planeación / operativos" | none — **sin fuente autoritativa de rol**; alta = S/N + una línea en AMBAS allowlists |

## B3: la MISMA autoridad en toda la superficie

El módulo `planeacion` declara **`accessPolicy: 'm2'`** en el registry (patrón equivalente
a towerGated; `roles` queda solo como documentación y `isModuleVisibleForRoles` EXCLUYE
módulos con política). Consumen `readM2Access`:

1. **Tarjeta home** — `getVisibleModulesForSession` (ScreenHome).
2. **Nav móvil / Más / rail desktop** — `getNavModules` → `isModuleVisibleForSession`.
3. **Clic desde home** — `getModuleEntryDecisionForSession`.
4. **Route guard** — `M2PlaneacionRoute` (App.jsx): sesión inválida → /login; sin acceso → /.
5. **Carga del endpoint** — el backend revalida flag+token+acceso server-side (la UI nunca
   es la última línea).

Blocker Codex #7 resuelto: `admin_plataforma` ve tarjeta/nav Y entra (test "CLAVE").

## Niveles global/company/branch

El contrato contempla niveles company/branch pero **v1 solo emite global**: el contrato de
datos es agregado, y un nivel "sucursal" sin datos por sucursal sería teatro. Se activan
con la extensión v1.1 + S/N. `scopeFindingsForAccess` ya garantiza cero fuga con acceso
`none` (test).

## Cobertura de tests

Frontend (`m2AccessFilters` + `m2Surface`): matriz completa (incluye sesiones forjadas,
strict-case, proyección admin_plataforma, política desconocida ⇒ fail-closed, 5 casos B3,
URL directa por text-scan del guard). Backend (`test_kold_os_m2_service`): flag OFF 503,
401 (faltante/inválido/expirado), 403 fail-closed, global para dirección, granularidad sin
IDs, no cross-scope (scope global único v1), endpoints sin writes.
