# Auditoría PWA — rol `gerente_sucursal`

> **ESTADO: DRAFT PARA REVISIÓN TÉCNICA — dos bloqueos pendientes.**
> Documento de auditoría. **No es una especificación aprobada ni autoriza implementación.**
>
> **Ramas auditadas:** frontend `origin/main` `71e00e9fdfd2d7498e8983dd14eb7078c1c1534b` ·
> backend `GrupoVeniu/GrupoFrio` `origin/GrupoFrio` `781aef65d0a1d0a041403a2cbea56ce6226a163a`.
>
> **Clasificación de evidencia** — cada afirmación de estos documentos es una de:
> **[E]** verificado estáticamente en código de la rama vigente ·
> **[R]** verificado en runtime con sesión autenticada ·
> **[I]** inferido (razonamiento, no observación directa) ·
> **[N]** no ejecutado / no obtenido.
>
> **Identificadores:** los IDs de persona están sanitizados (`<E1>`). Se conservan IDs de
> configuración organizacional (company, warehouse, analytic) por ser necesarios técnicamente.
**Fecha:** 2026-07-26 · **Modo:** read-only (sin writes, sin merge, sin deploy, sin flags)

## Resumen ejecutivo

Auditoria del rol `gerente_sucursal` en la PWA de colaboradores: estado actual, capacidades reutilizables,
diseno objetivo y plan por sprints. **Cero codigo, cero writes, cero cambios de flags o datos.**

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | **Autoridad canonica propuesta: `gf.ops.branch_config` identificada por `analytic_account_id`.** Es la unica entidad con unicidad de negocio (`unique(analytic_account_id)`) y la unica que ya agrega todo el scope operativo. Los otros tres candidatos (warehouse, company, plant) **convergen a ella**: la duplicacion no es de modelo, es de resolvedor (3 implementaciones del mismo recorrido). | [E] |
| 2 | **`x_analytic_account_id` YA EXISTE en el empleado y el login lo descarta.** El backend lo emite dos veces; `buildSessionEmployee` conserva solo `{id, tower_status}`. Por eso `sessionAnalyticAccountId()` siempre falla y obliga a un round-trip extra. **La relacion ya esta en Odoo: no hay que crear datos, solo propagarlos.** | [R] |
| 3 | **Incompatibilidad de cuatro fuentes de rol.** `gf_saleops` exige `gerente_unidad` (15 guards; `gerente_sucursal` no aparece en ninguno) - `gf_pwa_admin` y produccion leen el booleano `is_gerente_sucursal` (que **no viaja al login**) - el frontend lee el job key `gerente_sucursal` - y `x_gf_role_key` es un campo Studio **no declarado en el repo** que **tiene prioridad sobre todo** y es invisible para login y FE. | [E] + [R] |
| 4 | **Sprint 0 de seguridad, bloqueante.** Los 4 endpoints `/pwa-gerente/*` **no existen en el backend**: viven en el cliente con ORM generico y `sudo`. El critico explotable HOY es `liquidaciones/validate` (cierra rutas de cualquier sucursal; resuelve `employee` y nunca lo usa). `forecast-unlock` esta **roto por un `ReferenceError`**: latente, no explotable. `requisition approve/reject` anulan su check de auto-aprobacion omitiendo un header. Existe un **kill switch de 0 lineas** (retirar 3 modelos de `os_api.generic_model_policies`). | [E] |
| 5 | **M6 y M7 tienen "scope fantasma".** `branch_ids` entra por config, **altera el `scope_key`** y **nunca llega al SQL**. Dos corridas con distinta sucursal producen scopes distintos con **cifras identicas globales**. El test de M7 **excluye `branch_ids` deliberadamente** de las dimensiones que cambian el fingerprint. **No usar hasta corregir.** | [E] |
| 6 | **M2 es reutilizable con cambio minimo.** Su motor **ya filtra por sucursal en 7 queries**; lo bloquea una politica de produccion de una linea. Caveat: 3 queries siguen siendo company-only y devolverian cifras globales bajo un scope que dice "sucursal". | [E] |
| 7 | **Supervisor V2 es reutilizable y su alcance ya es de sucursal, no de equipo.** `day-control`, `radar` y `route_stops` filtran por `effective_branch_config_id` **sin ningun termino por vendedor**. El copy no dice "mi equipo" en ninguna parte. El bloqueo es de autorizacion: **4 puntos coordinados**, incluido el gate de rollout que apagaria el flag aunque se abrieran las rutas. | [E] |
| 8 | **Contrato de inventario ambiguo: responde `status: ok` con TODO vacio.** Verificado en vivo: sin `products`, sin `location_ids`, sin productos, porque `sale_product_ids` esta vacio para la sucursal. Indistinguible de "no hay stock". Ademas emite **dos shapes distintos** para el mismo endpoint. | [R] |
| 9 | **El dashboard Metabase esta roto.** `/gerente/dashboard` es un iframe a la **raiz** de `bi.grupofrio.mx`, sin parametros, sin JWT, sin `sandbox` y sin CSP `frame-src`. En runtime **no carga**: Metabase rehusa ser enmarcado. No hay fuga cross-branch porque no muestra nada. Es peso muerto verificado. | [R] |
| 10 | **Pendientes runtime (dos bloqueos).** (a) La auditoria visual cubrio **1 de 4 viewports**: faltan **390x844**, **768x1024** y **1366x768** (`resize_window` reporta exito pero el viewport real no cambia). (b) **Planta, timezone y ubicaciones MP/PT/envases no son obtenibles desde el navegador** (`gf.ops.branch_config` responde `model_not_allowed`); requieren odoo-shell o un endpoint guardado. | [N] |

**Esta auditoria NO esta completa.** Ver los dos bloqueos en el punto 10.

### Documentos de este paquete
1. `AUDITORIA_GERENTE_SUCURSAL.md` - estado actual autenticado, mapa de pantallas, riesgos de seguridad y datos.
2. `GERENTE_CIERRE_TECNICO.md` - entregables A-N: autoridad canonica, matriz de rol, Sprint 0, M1-M7, iframe, sprints.
3. `GERENTE_ANEXO_RUNTIME.md` - evidencia runtime con sesion real: mapeo live, pruebas de rol, iframe, accesibilidad.
4. `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` - diseno objetivo, DTOs, capabilities y plan por sprints.

## 0. Alcance y honestidad de la evidencia

| Aspecto | Valor |
|---|---|
| Frontend auditado (runtime) | Vercel **preview** `colaboradores-pwa-git-fix-m4-unavailable-safe-state` |
| Relación con `main` | `origin/main` (`71e00e9`) **+ 3 commits** acotados al estado *unavailable* de M4 (`a13b018`, `f76279a`, `c4c36bb`) + merge de main |
| Representatividad | Alta para Gerente: los 3 commits solo tocan el render de M4, superficie que el Gerente **no** alcanza |
| Backend | `GrupoVeniu/GrupoFrio` @ `origin/GrupoFrio` (`781aef65`) |
| Sesión | Cuenta de Gerente ya autenticada en Chrome (no introduje credenciales; no hay PIN/token en este documento) |
| **NO verificado** | Producción real (`colaboradores.grupofrio.mx` u origen equivalente): la sesión vive en el origen del preview |
| **NO verificado** | Emulación móvil: el `resize` no cambió el viewport (siguió en 1536 px). §14 móvil queda **pendiente** |

**Identidad de la sesión auditada** (campos de scope; credenciales omitidas deliberadamente):

```
role: "gerente_sucursal"   job_key: "gerente_sucursal"
employee_id: <E1>   company_id: 34 (GLACIEM)   warehouse_id: 89   plaza_id: presente
employee.tower_status: null
```

> **Hallazgo estructural de identidad:** la sesión del Gerente **NO** contiene
> `branch_config_id`, `effective_branch_config_id` ni `analytic_account_id` — que son
> las claves con las que Supervisor V2 y M1 resuelven sucursal. El Gerente solo tiene
> `company_id` + `warehouse_id` + `plaza_id`. **No existe hoy una identidad de sucursal
> canónica para este rol.** Todo el diseño objetivo depende de resolver esto primero.

---

## A. Estado actual autenticado — qué ve y qué puede hacer hoy

Módulos visibles en el home y en la navegación: **Mis KPIs · Encuestas · Premios · Admin Sucursal · Gerente**.

### B. Mapa de pantallas (rol Gerente)

| # | Pantalla | URL | Fuente de datos | Estado observado |
|---|---|---|---|---|
| 1 | Gerente (hub) | `/gerente` | `getAlerts()` + `getKpiSummary()` | **"Venta Hoy 0 · Forecast 0 · Disponible 0"** |
| 2 | Dashboard Gerente | `/gerente/dashboard` | **iframe a `bi.grupofrio.mx`** (Metabase) | Iframe embebido (1 iframe detectado) |
| 3 | Alertas del Día | `/gerente/alertas` | `gf.ops.event_log` vía ORM genérico | "Total 0 · Error 0 · OK 0 — **Todo opera con normalidad**" |
| 4 | Desbloquear Forecast | `/gerente/forecast` | `gf.saleops.forecast` vía ORM genérico | Lista 1 forecast: *"Chapalita 2 Load 2026-06-08"*, **Sucursal `-`**, objetivo **07 jun 2026**, botón **Desbloquear** activo |
| 5 | Gastos de Gerencia | `/gerente/gastos` | formulario de alta | **Selector de 3 empresas**: GLACIEM · Fabricación · Vía Ágil |
| 6 | Admin Sucursal | `/admin` | superficie administrativa preexistente | (superficie amplia, heredada) |

### Aislamiento por URL — **resultado positivo**
Navegación directa a rutas de otros roles → **redirigidas a `/`** (el guard de rol del frontend bloquea):
`/equipo` (Supervisor) · `/ventas-clientes` (M4) · `/torre` (M1) → todas terminan en `/`.

---

## D/E. Matriz de endpoints y writes — módulo Gerente

Los 4 endpoints del rol viven **exclusivamente en el cliente** (`src/lib/api.js`, función `directGerente`,
líneas 1579–1665 de `origin/main`). **No existe ningún controlador `/gf/...` de Gerente en el backend.**

| Endpoint (cliente) | Mecanismo real | Modelo Odoo | Filtro de alcance | R/W | Guard server-side |
|---|---|---|---|---|---|
| `/pwa-gerente/alerts` | `readModelSorted(..., sudo:1)` | `gf.ops.event_log` | `company_id` **únicamente** | R | **ninguno** |
| `/pwa-gerente/kpi-summary` | `readModelSorted(..., sudo:1)`, `limit:1` | `gf.saleops.kpi.snapshot` | `company_id` **únicamente** | R | **ninguno** |
| `/pwa-gerente/forecasts-locked` | `readModelSorted(..., sudo:1)` | `gf.saleops.forecast` | `company_id` **únicamente** | R | **ninguno** |
| `/pwa-gerente/forecast-unlock` | `createUpdate(..., sudo:1, function:'action_reset_to_draft')` | `gf.saleops.forecast` | **ninguno** (id del payload) | **W** | **ninguno** |

---

### C. Matriz de permisos — superficie real del rol

`gerente_sucursal` ve **5 módulos**: 3 universales (`/kpis`, `/surveys`, `/badges`), `/admin` (**15 pantallas**) y
`/gerente` (5 pantallas). Está **correctamente excluido y fail-closed** de M1–M7, `/equipo`, `/torres`,
`/pos-nocturno` y todos los módulos operativos (`registry.js:361` + `App.jsx` → `Navigate to="/"`), lo que
coincide con mi verificación runtime por URL.

**El problema no es la superficie visible, sino la autoridad detrás de ella.**

---

## K. Riesgos de SEGURIDAD (verificados en código + runtime)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| **K1** | 🔴 Crítico | **Write sin guard, con `sudo`, sobre id arbitrario.** `forecast-unlock` ejecuta `action_reset_to_draft` sobre el `forecast_id` que mande el cliente, con `sudo:1`, sin validar rol, sucursal, company, jornada ni estado. | `src/lib/api.js:1655-1666` |
| **K2** | 🔴 Crítico | **Éxito falso.** El mismo write devuelve `{success:true}` **incondicionalmente**, sin inspeccionar el resultado. | `src/lib/api.js:1664` |
| **K3** | 🔴 Crítico | **Alcance company-wide, no por sucursal.** Los 4 endpoints filtran solo por `company_id`. Un Gerente de una sucursal recibe datos de **todas** las sucursales de su company. En runtime: forecast con **Sucursal `-`** y nombre de otra plaza. | `api.js:1580-1585`, `:1604-1611`, `:1631-1636` |
| **K4** | 🔴 Crítico | **ORM genérico + `sudo` desde el navegador** en las 4 rutas (`get_records_sorted` observado en red). Viola "cero ORM genérico" y "cero sudo antes del scope". | red runtime + `api.js` (4 llamadas con `sudo:1`) |
| **K5** | 🟠 Alto | **Credenciales de larga vida en `localStorage`**: `api_key` (64 ch) y `odoo_api_key` (64 ch) junto al token de empleado. | inspección de sesión |
| **K6** | 🟠 Alto | **Sin gate de jornada**: el forecast ofrecido para desbloquear tiene fecha objetivo del **07-jun-2026** (~7 semanas atrás). | runtime `/gerente/forecast` |
| **K7** | 🟠 Alto | **Dashboard fuera del modelo de seguridad**: iframe a `bi.grupofrio.mx`; su alcance lo decide Metabase, no la sesión. La PWA no puede atestiguar qué sucursal muestra. | `ScreenDashboardGerente.jsx:55-64` + runtime |
| **K8** | 🔴 Crítico | **El alcance lo elige el propio usuario.** `session.sucursal` **nunca se emite** en el login, así que `getCompaniesForSucursal('')` devuelve **las 3 compañías** (34/35/36) y el `CompanySelector` del top bar de Admin las ofrece todas; al elegir una, persiste en `session.company_id` → `localStorage` → headers de todas las llamadas. Esto explica el selector de 3 empresas que observé en `/gerente/gastos`. | `tokens.js:134-137`, `AdminContext.jsx:34,76`, `CompanySelector.jsx:1-4`, `api.js:177-180` + runtime |
| **K9** | 🔴 Crítico | **Existe un endpoint seguro y la PWA no lo usa.** `POST /gf/salesops/forecast/unlock` está protegido con `guard_request(required_role="gerente_unidad")` y scope server-side por `analytic_account_id`. La PWA lo esquiva llamando `action_reset_to_draft` con `sudo:1`. | `gf_saleops/controllers/main.py:882-905`; `services/guard.py:183,211-253` |
| **K10** | 🔴 Crítico | **Doc ≠ código en 3 acciones "de gerente".** `requisition-approve`, `requisition-reject` (`pwa_admin_api.py:1837-1875`) y `liquidaciones/validate` (`:2882-2937`) **no verifican rol en el servidor**; la restricción es solo de UI. La documentación afirma lo contrario (`CODE_MANUAL.md:634,636`). | citado |
| **K11** | 🟠 Alto | **Vocabulario de rol incompatible.** El backend `gf_saleops` llama al rol **`gerente_unidad`**; la PWA emite `gerente_sucursal`. Un empleado con `x_job_key = gerente_sucursal` **NO** satisface `required_role="gerente_unidad"`. Bloquea cualquier reutilización directa de `gf_saleops`. | `gf_saleops/services/guard.py:48,61-97`; `pwa_job_key.py:15` |
| **K12** | 🟠 Alto | **`expense-approve/-reject` solo miran `is_gerente_sucursal`** e ignoran `pwa_extra_gerente_sucursal`: un gerente por rol adicional ve el menú y la pantalla, pero falla al aprobar. | `pwa_admin_api.py:1013-1019,1048-1054` |
| **K13** | 🟠 Alto | **Scope inventado en el cliente**: `inferCompanyId` asigna company 34 a todo `gerente_sucursal` si Odoo no devuelve compañía. | `ScreenLogin.jsx:82-97` |
| **K14** | 🟡 Medio | **`/admin/bolsas/validar` sin allowlist de rol** en cliente (sus dos hermanas `materiales/*` sí la tienen). | `AdminShell.jsx:42-45` |
| **K15** | 🟡 Medio | **Umbrales de cierre de caja solo en cliente**; la PWA nunca invoca `/pwa-admin/cash-closing/authorize` ni `/reopen` (gap G018). | `AdminCierreForm.jsx:585`; `GAPS_BACKLOG.md:47,81` |

### Cruce runtime ↔ estático sobre la contención genérica

El análisis estático dejó abierto si `/get_records_sorted` y `/api/create_update` (allowlist por el parámetro de BD
`os_api.generic_model_policies`) permiten realmente estos modelos — no es deducible del código.
**Mi evidencia runtime lo resuelve para las lecturas:** `/gerente/forecast` **listó un forecast real**, luego
`get_records_sorted` sobre `gf.saleops.forecast` con `sudo:1` **está permitido en el entorno auditado**.

**La escritura (`create_update` → `action_reset_to_draft`) NO fue probada deliberadamente**: comprobarla exigiría
ejecutar un write real sobre datos productivos. Queda como riesgo **no refutado**, con la lectura ya confirmada
abierta y sin ninguna barrera de rol/scope en el camino del cliente.

## L. Riesgos de DATOS

| # | Hallazgo | Evidencia |
|---|---|---|
| **L1** | **`null` presentado como cero.** Sin fila de KPI, `kpi-summary` devuelve `{sales_today:0, forecast:0, available:0}`. Los "0" del hub son indistinguibles de una venta real de 0. | `api.js:1620-1622` |
| **L2** | **Suma de unidades incompatibles.** `available = pt_available_qty + en_available_qty + vans_available_qty` (producto terminado + envases + vans) en un solo número. | `api.js:1626` |
| **L3** | **KPI de sucursal ajena.** `limit:1` sobre snapshots del mes de **toda la company**, ordenado por fecha: el número mostrado puede pertenecer a otra sucursal. | `api.js:1611-1618` |
| **L4** | **Falsa tranquilidad.** Alertas vacías → *"Todo opera con normalidad"*, sin distinguir "sin alertas" de "sin datos / no disponible". | runtime `/gerente/alertas` |
| **L5** | **Sin `data_as_of` ni frescura** en ninguna tarjeta del rol. | `api.js` (los 4 adaptadores) |
| **L6** | **Sin estados diferenciados**: no hay loading/empty/partial/unavailable/stale/forbidden/session_expired distinguibles. | código + runtime |

## Accesibilidad / UX (medido)
- 4 controles con altura **< 44 px** (chips de empresa: 36 px; icono: 38 px).
- **4 de 4 inputs visibles del formulario de gastos SIN etiqueta accesible** (ni `<label>`, ni `aria-label`, ni `aria-labelledby`) — en una pantalla de **escritura**.
- Sin overflow horizontal a 1536 px. **Móvil no verificado** (ver §0).

---

## F. Reutilización KOLD OS M1–M7 (rama vigente `781aef65`)

**Hallazgo central: ninguno de los 7 módulos admite hoy a `gerente_sucursal` — los 7 responden 403.**
El rol existe (`os_customer_zones/models/pwa_job_key.py:15`) pero no está en ninguna allowlist y **no proyecta a
ningún `tower_status`** (`pwa_job_key.py:21-24` solo mapea `supervisor_ventas` y `direccion_general`).
Los 7 flags están en `0` (OFF) por defecto.

**Diferencia arquitectónica decisiva:** M1 es una **API viva** (consulta Odoo en tiempo real y resuelve el scope
por sucursal server-side). M2–M7 son **almacenes de corridas de auditoría** pre-ingeridas manualmente por
odoo-shell (sin cron): su "frescura" es la de la última corrida, no la del dato operativo.

| Módulo | Nombre real | Dimensión sucursal | Veredicto para Gerente | Costo |
|---|---|---|---|---|
| **M1** | `gf_tower_m1` | **Sí — scope server-side real y fail-closed** | **(d) solo permisos nuevos** | **Bajo** |
| M3 | `gf_kold_os_m3` | `branch_dimension:true` pero el filtro **no es límite de autoridad** | (b) DTO de Gerente + (d) | Medio-alto |
| M2 | `gf_kold_os_m2` | `branch_dimension:false`; `applied_scope` global hardcodeado | (e) no utilizable | Alto |
| M4 | `gf_kold_os_m4` | `branch_dimension:false` (el código anota que "antes mentía") | (e) no utilizable | Alto |
| M5 | `gf_kold_os_m5` | branch/warehouse/location/vehicle **todos false**; `physical_reconciliation:false` | (e) no utilizable | Alto |
| M6 | `gf_kold_os_m6` | `branch_dimension:false`; allowlist solo `direccion_general` | (e) no utilizable | Alto |
| M7 | `gf_kold_os_m7` | `draft_port_not_deployed`; solo `L1_observable_revenue` | (e) no utilizable | Alto |

**M1 es el único candidato barato**: el mecanismo de scope por sucursal ya existe, está probado y es fail-closed
(`gf_tower_m1/models/gf_tower_m1_service.py:115-151`); ignora y registra `branch_id`/`company_id` del payload.
Habilitar Gerente = añadir el rol a `ALLOWED_ROLES` **más** darle proyección en `PWA_TOWER_ROLE_STATUS_MAP`.
Limitación: cubre backlog de planes/cierres, **no** ventas ni finanzas. Además **no publica contrato versionado**
(sin `schema_version` ni `capabilities`), lo que fragiliza cualquier consumo nuevo.

### Discrepancias doc↔código detectadas
1. `src/modules/caja-conciliacion/m6/access.js:9-11` afirma que `ALLOWED_TOWER_STATUS` "existe pero nunca se usa";
   **ya fue eliminada** del backend y hay un test que impide su regreso. El comentario induce a subestimar el costo.
2. M3 `capabilities.branch_dimension:true` **sobre-promete**: hay findings con `branch_id`, pero el DTO devuelve
   `applied_scope: global` siempre y el filtro por sucursal es de presentación, no de autoridad.
3. **Corrección a una premisa previa:** el FX de M7 **no está hardcodeado**; se deriva de un conteo medido de tasas
   aplicables, y hay **0 tasas en la ventana**, lo que dispara la regla `M7-H-02`. Es ausencia medida, no constante inventada.
