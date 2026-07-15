# M2 — Permisos y acceso (v1)

Contrato ejecutable: `src/modules/planeacion/m2/access.js` + guard `M2PlaneacionRoute` (App.jsx).
**Fail-closed**: todo lo no listado = sin acceso.

## Matriz v1

| Principal | Fuente de verdad | Acceso |
|---|---|---|
| `direccion_general` | x_job_key efectivo (role + additional_job_keys) | **GLOBAL** (ejecutivo + drill-down + export) |
| `admin_plataforma` | `session.employee.tower_status` (rol AUTORITATIVO servido por Odoo, strict-case) | **GLOBAL** |
| `supervisor_ventas` con tower_status | — | **SIN ACCESO** (deliberado: NO se copian reglas de Tower; Tower autoriza su módulo, no M2) |
| gerente_sucursal, jefes de ruta, auxiliares, operadores, roles desconocidos | — | **SIN ACCESO** |
| Sesión inválida/expirada | `isValidAuthenticatedSession` | **SIN ACCESO** (→ /login) |

## Capas de defensa

1. **Tarjeta/nav**: módulo `planeacion` en registry con `roles: ['direccion_general']` → solo
   dirección ve la entrada. (Nota: un `admin_plataforma` puro sin ese x_job_key no ve tarjeta pero
   SÍ puede entrar por URL — asimetría v1 documentada; la visibilidad session-aware para
   tower_status llega con la mecánica del PR #67 y puede unificarse en un PR posterior.)
2. **Ruta**: `M2PlaneacionRoute` — sesión inválida → `/login`; `readM2Access(session).level !==
   'global'` → `/`. Gate PROPIO: no reutiliza TowerRoute ni ModuleRoleRoute.
3. **Datos**: `scopeFindingsForAccess` — acceso ≠ global ⇒ **cero** hallazgos (sin fuga
   cross-company). El run además viene con scope de producción validado (1/34/35/36 exacto).

## Niveles diferenciados (vista global vs sucursal)

El contrato de acceso contempla `level: 'global' | 'none'` hoy. El nivel **por
compañía/sucursal** queda especificado pero NO emitido en v1 porque el contrato de datos es
agregado (darle a un gerente una "vista de su sucursal" sería teatro sin datos por sucursal). Se
activa junto con la extensión v1.1 del contrato (M2_DATA_CONTRACT §5.1) y su propia decisión S/N.

## Responsables de planeación / operativos autorizados

Solicitados como audiencia mínima, pero HOY no existe fuente autoritativa de ese rol
(ni x_job_key ni tower_status). **No se inventa**: agregar `planeacion_*` como job key o un rol
autoritativo nuevo = decisión de dirección + cambio versionado en `access.js` (una línea en la
allowlist) con S/N. Mientras tanto los hallazgos llevan `responsible_area` y
`owner_status=unassigned`.

## Tests que cubren esta matriz (tests/m2AccessFilters.test.mjs + m2Surface.test.mjs)

global autorizado (x_job_key y tower_status) · sucursal autorizada (n/a v1, scope global) ·
usuario sin permisos · sesión inválida (incluye payloads forjados con rol privilegiado) ·
scope de compañía (scopeFindingsForAccess) · URL directa (guard en App.jsx, text-scan) ·
strict-case del tower_status · no-copia de reglas Tower.
