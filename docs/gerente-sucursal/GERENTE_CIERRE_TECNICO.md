# Gerente de Sucursal — cierre técnico (A–N)

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
**2026-07-26 · READ-ONLY** · amplía `AUDITORIA_GERENTE_SUCURSAL.md` y `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` sin borrar evidencia.
Ramas: FE `origin/main` (`71e00e9`) · BE `origin/GrupoFrio` (`781aef65`).

> ## ⛔ VEREDICTO: **INCOMPLETO** — 1 bloqueo concreto
> Ver `GERENTE_ANEXO_RUNTIME.md` para la evidencia runtime.
> **Cumplido:** ramas vigentes verificadas (SHAs sin cambios) · Sprint 0 trazado · M1–M7 clasificados ·
> producción/inventarios mapeados · iframe auditado en runtime · mapping live **parcialmente** cerrado.
> **Bloqueo único:** la **auditoría visual solo cubrió 1 de 4 viewports**. `resize_window` reporta éxito pero el
> viewport real no cambia (pedí 390×844, quedó en 1536). Falta 390×844, 768×1024 y 1366×768.
> **Bloqueo secundario:** planta, timezone y ubicaciones MP/PT/envases **no son obtenibles desde el navegador**
> (`gf.ops.branch_config` = `model_not_allowed`); requieren odoo-shell o un endpoint guardado.
>
> ### Correcciones runtime a esta misma auditoría
> - 🟢 **El empleado SÍ tiene `x_analytic_account_id`** (820, sucursal IGU) y su `branch_config` resuelve.
>   La autoridad canónica **no requiere crear datos**: solo propagarlos y consumirlos.
> - 🔴 **El desajuste de rol quedó PROBADO en vivo**: `alerts/today` → `FORBIDDEN` con la sesión real del Gerente,
>   mientras `inventory/summary` (sin rol requerido) respondió OK.
> - 🔴 **`inventory/summary` devuelve `ok` con TODO vacío** (sin `products`, sin locations, sin productos):
>   los dos bugs de contrato, confirmados en vivo.
> - 🟡 **Refuto mi propia afirmación** sobre el iframe: Metabase **rehúsa ser enmarcado**, así que el login de
>   terceros **nunca se renderiza** dentro de la PWA. No hay patrón de phishing. Pero `/gerente/dashboard`
>   **está roto**: no muestra nada. Es peso muerto verificado.

## Salvedad de método (declarada, no oculta)
El worktree local `dev/GrupoFrio` está en una rama **obsoleta** (`feat/kold-os-m5-...`, −67,890 líneas vs `origin/GrupoFrio`).
Verifiqué personalmente que **las definiciones de campo de `gf_ops_branch_config.py` son idénticas** en ambas ramas
(analytic :32, pt :100, entregas :107, merma :114, móviles :131), pero **la sección de constraints se desplazó**
(`uniq_branch_by_analytic` = :277 en origin vs :209 en el worktree). Las citas de campo son fiables; cualquier cita
de constraint del worktree debe releerse contra `origin/GrupoFrio` antes de implementar.

---

# A. Autoridad canónica propuesta

**`gf.ops.branch_config`, identificada por `analytic_account_id`, resuelta 100 % server-side desde el token.**

Razones verificadas, no preferencias:
1. Es la **única** entidad con unicidad de negocio: `unique(analytic_account_id)` (`gf_ops_branch_config.py:277`).
   `hr.employee.warehouse_id` no tiene índice ni unicidad; `company_id` es 1→N sucursales por diseño
   (par PT/EN, `:77-89`); `plant_warehouse_id` **no tiene arista desde `hr.employee`**.
2. Es la única que **ya agrega todo el scope operativo** en un registro: ubicaciones PT/entregas/merma/móviles
   (`:100-147`), picking types (`:150-199`), par intercompany, umbrales y flags por sucursal (`:231-260`).
3. Los otros tres candidatos **ya convergen a ella**: warehouse→`lot_stock_id.x_analytic_account_id`→branch
   (`branch_config_service.py:88-111`), analytic→branch (`:27-76`), y `gf_route_compliance` hace el mismo recorrido
   (`pwa_route_suggestions.py:265-318`). **La duplicación no es de modelo, es de resolvedor: hay 3 implementaciones
   del mismo camino.**
4. `company_id` del payload es la **única autoridad forjable** y hoy se acepta sin validar contra el empleado
   (`pwa_admin_api.py:563-570`, `_require_company` solo comprueba `.exists()`), en contraste con el guard que sí la
   rechaza (`guard.py:438-446`).

**Contrato mínimo a emitir** (todo existe server-side, solo falta publicarlo):
`branch_config_id · analytic_account_id · company_id · company_pt_id · company_en_id · tz + tz_source · branch_scope[]`.

## Hallazgos que obligan a decidir antes de construir
- **`plaza` NO existe server-side.** Los únicos `plaza_id` del backend son `Char` de logs de voz. La plaza del Gerente
  se **fabrica en el cliente** con un diccionario hardcodeado warehouse→plaza (`roleContext.js:15-41`); si se da de
  alta un almacén, devuelve `null` en silencio (`:40`).
- **`branch.tz` NO existe como campo.** El resolvedor ya lo prefiere y lo comprueba defensivamente
  (`gf_saleops_day_control_service.py:157-158`), pero hoy siempre cae a `company.partner_id.tz` y luego a
  `America/Mexico_City`. **Es tz por compañía, no por sucursal**: dos sucursales de la misma compañía en husos
  distintos son indistinguibles. Añadir `tz` a `branch_config` es 1 línea de modelo y 0 cambios de resolvedor.
- **Se puede crear la ambigüedad por datos.** `_check_employee_scope_overlap` (`:336-351`) solo mira `employee_ids`,
  **no** `x_analytic_account_id`. Un empleado con analítica de A y membresía en B produce dos candidatas ⇒
  `MULTI_BRANCH` garantizado en runtime. La base permite crear ese dato.
- **Fractura MP vs PT**: MP cuelga de `stock.warehouse` (`gf_mp_source_location_id`); PT/entregas/merma/móviles
  cuelgan de `branch_config`. **No hay ningún campo que una ambos dueños.**

## Migración de sesiones (sin romper)
1. **Aditivo puro en el login**: bloque `branch{}` resuelto por el mismo resolvedor del guard. Precedente: ya se
   inyecta `branch{supervisor_v2_enabled}` (`employee_login.py:111-118`). Hay test de contrato que vigila la forma
   de `employee{}` — no tocarlo.
2. **Dejar de tirar lo que ya se emite.** El backend **ya manda** `x_analytic_account_id` (top-level `:321` y dentro
   de `employee` `:251-255`), pero `buildSessionEmployee` conserva solo `{id, tower_status}`. Por eso
   `sessionAnalyticAccountId()` (`api.js:989-997`) **siempre falla** y obliga a un round-trip extra
   (`readEmployeeAnalyticAccountId`, `:999-1011`). Llenarlo solo **elimina** llamadas.
3. **Las sesiones viejas siguen válidas**: el servidor nunca debe confiar en el campo del cliente; la autorización se
   recalcula siempre desde el token. El campo nuevo es UX/telemetría. No hace falta invalidar tokens.
4. **Unificar los 3 resolvedores** detrás del bloque `guard.py:448-482` extraído.
5. **Cerrar `_require_company`** intersectando contra `_employee_allowed_company_ids` (ya existe, `:311-317`).

## Casos fail-closed
Heredados (ya implementados): `UNAUTHORIZED` (sin token / empleado o usuario inactivo) · `FORBIDDEN`
(identidad, rol, company, `branch_company_mismatch`) · `VALIDATION_ERROR` (IDs no enteros) · `SERVER_MISCONFIG`
(sin rol / sin company) · `NO_BRANCH_SCOPE` · `MULTI_BRANCH`.
Del servicio de branch config, que **el guard hoy no invoca**: `BRANCH_CONFIG_INCOMPLETE`,
`BRANCH_CONFIG_INVALID_COMPANY_PAIR`, `WAREHOUSE_WITHOUT_ANALYTIC` (`branch_config_service.py:10-17,37-102`).
**Nuevos que hacen falta**: `BRANCH_SCOPE_AMBIGUOUS` (analítica≠membresía, hoy indistinguible de multi-sucursal
legítima) · `BRANCH_NOT_IN_SCOPE` (patrón ya existe en `pwa_route_suggestions.py:405-429`) · `BRANCH_REQUIRED`
(N sucursales sin elegir: fallar, no elegir la primera) · `TZ_UNRESOLVED` (hoy nunca falla) · `LOCATION_SCOPE_INCOMPLETE`.

---

# C. Matriz rol / alias

**Rol canónico: `gerente_sucursal`.** Es el único con definición declarativa versionada
(`pwa_job_key.py:15`), campo persistente y vista de administración; es el único que **viaja en la sesión**
(`employee_login.py:255-257`) — `gerente_unidad` tiene **0 ocurrencias** en todo `origin/main`.

**Desalineación de TRES fuentes, no de dos:**
| Fuente | Qué lee | Sitios |
|---|---|---|
| Backend `gf_saleops` | `gerente_unidad` (fósil) | **15 guards**, ninguno con `gerente_sucursal` |
| Backend `gf_pwa_admin` / producción | booleano `is_gerente_sucursal` | 6 sitios que **solo** leen el flag legacy |
| Frontend completo | job key `gerente_sucursal` | registry, AdminShell, pantallas |

`is_gerente_sucursal` **no viaja al login**; `pwa_extra_gerente_sucursal` sí. Solo 2 sitios aceptan ambos mundos.

**Divergencias reales:** el gerente canónico es **rechazado por los 15 endpoints** `gerente_unidad`; el gerente
"puro-nombre" pasa esos 15 pero **no ve ningún módulo en la PWA**; ve el botón de aprobar gastos y recibe error
(menú por job key, backend por booleano); y `x_gf_role_key` es un **campo Studio no declarado en el repo** que
**tiene prioridad sobre todo** y es invisible para login, FE y `gf_pwa_admin`.

**Alias temporal (diseño anti-escalada):** un solo punto (`_employee_role_keys`, tras el paso 3), tabla de un par
`{gerente_sucursal → gerente_unidad}`, **unidireccional** (invertirlo daría POS/gastos/materiales a los
"puro-nombre"), **aditivo** (`keys[0]` intacto), **sin tocar ninguna allowlist**, **excluyendo el override Studio**,
bajo `ir.config_parameter` apagable sin deploy, y **registrado** para poder retirarlo.

**Prueba de fondo:** matriz cartesiana (roles canónicos + gerente legacy) × (15 endpoints) capturando el veredicto
de `guard_request` con alias OFF y con ON; el diff debe ser **exactamente** las 15 celdas de `gerente_sucursal`.
Eso demuestra "no abre puertas", en vez de sugerirlo.

**Dato que puede cambiar la estrategia:** de los 15 endpoints, **solo 5 tienen caller en la PWA**. Si el censo
confirma 0 tráfico en los otros 10 (incluido `forecast/unlock`), la conversación deja de ser "cómo aliasar 15"
y pasa a ser "cuáles de estos 10 se retiran" — bastante más barato.

---

# D. Sprint 0 — seguridad (ordenado por riesgo REAL)

**Corrección importante a mi propio informe anterior:** `/pwa-gerente/forecast-unlock` **está roto hoy**.
`routeDirect` pasa 3 argumentos (`api.js:9660`) pero `directGerente` declara 2 (`:1578`) y luego lee `body`
(`:1656`) ⇒ `ReferenceError` en strict mode. **La vulnerabilidad es latente, no explotable hoy** — pero está
a una palabra (`, body`) de activarse y no hay ningún test que lo cubra. Lo reporto como latente, no como activo.

| # | Camino | Riesgo | Endpoint seguro | Tamaño | Toca |
|---|---|---|---|---|---|
| 1 | **`liquidaciones/validate`** | **Crítico, explotable HOY** — cierra rutas y marca conciliaciones `done` de cualquier sucursal por `plan_id`. `employee` se resuelve (`:2898`) y **nunca se usa**: variable muerta | No existe; patrón correcto en el endpoint hermano `:2962-2985` | ~20-25 | Backend |
| 2 | **`forecast-unlock`** | **Crítico latente** | **Sí existe**: `main.py:878` con rol, scope, strict ID, estado `confirmed` y auditoría | ~45 | Frontend |
| 3 | **`requisition-approve/reject`** | **Alto** — `sudo` sobre `purchase.order`, sin rol/sucursal/company; **el check de auto-aprobación se anula omitiendo el header** `X-GF-Employee-Token` (`:252-264`) | No existe | ~30 | Ambos |
| 4 | `forecasts-locked` | Alto — fuga de forecasts de todas las sucursales | **No existe**: hay que crearlo | ~75 | Ambos |
| 5 | `alerts` | Medio | **Sí**: `main.py:2364` | ~25 | Frontend |
| 6 | `kpi-summary` | Medio | **Sí**: `main.py:2535` | ~25 | Frontend |
| 7 | **Retirar los 3 modelos de `os_api.generic_model_policies`** | **Kill switch** — cierra 4 caminos de golpe (`model_not_allowed` / `sudo_forbidden`) | — | **0 líneas** | Config |
| 8 | Activar `gf_salesops.require_employee_token` | Endurecimiento (default `False`) | — | **0 líneas** | Config |

**Hallazgo sistémico que excede al Gerente:** `sudo:1` es el **valor por defecto** de `readModel`/`readModelSorted`
(`api.js:634`, `:661`). Hay **220** ocurrencias de `sudo: 1` y **47** `createUpdate`. Las tres peores escriben
`hr.employee` (teléfono e imagen, con `employee_id` de localStorage), `stock.picking` y `gf.route.plan`.
**La superficie real de escritura del grupo está definida por una fila de `ir.config_parameter` que no está en el
repo, no tiene tests y no pasa por revisión de código.**

---

# F. Inventarios

**El único endpoint con aislamiento correcto por analítica es `/gf/salesops/inventory/summary`** — y la PWA de
Gerente no lo usa. Qué mide exactamente: 3 buckets (PT, entregas, vans + desglose por van),
`available = quantity − reserved`.

**Lo que NO incluye (verificado):** merma (`merma_location_id` y `van_merma_map_ids` están **configurados y nunca
se leen**), tránsito (no existe), MP, envases, lotes, y **ninguna UOM**.

**Dos bugs de contrato:** (1) el early-return sin productos **omite la clave `products`** que sí emite el return
normal — dos shapes para el mismo endpoint; (2) si no mandas `product_ids` y `cfg.sale_product_ids` está vacío,
**responde ceros en silencio**, indistinguible de "no hay stock".

**Tres semánticas distintas conviviendo:** `inventory_service` filtra con `location_id in [...]` (**no cuenta
ubicaciones hijas**), mientras `pwa_admin_api.py:2750` y `api.js:8035` usan `child_of`.

**MP tiene dos implementaciones con el mismo path y la del backend está muerta**: el BFF cliente
(`api.js:2526`) intercepta antes de llegar a Odoo y filtra MP por **heurística sobre el nombre de la ubicación**
(`includes('MP')||includes('MATERIA')||includes('PRIMA')`), pierde la UOM que el backend sí emite, y no conoce la
sucursal. Una tercera fuente está **hardcodeada** (`IGUALA_MP_LOCATION_ID = 1172`).

**Envases: no existe categoría canónica.** Cinco mecanismos incompatibles; `x_procurement_class` **no tiene valor
"envase"**; `gf.bag.custody` es responsabilidad por turno (Integers, sin `product_id` ni `uom_id`), no inventario.
**Ningún endpoint puede responder "cuántas bolsas hay en esta sucursal".**

**UOM — 10 estructuras sin unidad** (no sumables), incluidas `gf.dispatch.reconciliation(.line)`,
`gf.saleops.kpi.snapshot` y el propio payload de `summary_for_branch`. El BFF de PT deriva kg de un **regex sobre
el nombre del producto** con fallback 1.
**El único punto de todo el sistema que consulta UOM** es la validación de devoluciones, y solo para redondeo.

**Bug de procedencia en UI de ruta:** si la conciliación viene vacía, cae a líneas de carga (donde
`delivered/returned/scrap = 0`) **reportando `source:'reconciliation'`** — afirma un cuadre que no midió.

**Cobertura:** `coverage_min_pct` existe como umbral almacenado y validado, y se ecoa al supervisor, pero
**ningún código calcula cobertura contra él**. Umbral huérfano.

---

# H. Supervisor reusable — confirmado

**Los tres contratos son sólidos y su alcance ya es de sucursal, no de equipo.** Verificación exhaustiva:
`_plans_for_day` filtra por `effective_branch_config_id` **sin ningún término por vendedor/chofer/empleado**.
Las dos únicas apariciones de `seller_ids`/`salesperson_employee_id` en el backend son: la lista de claves
**anti-forja** que se ignoran, y la lista de campos **a mostrar**. Ninguna es un filtro.
El frontend V2 tampoco envía identificadores de vendedor (grep exhaustivo: sin coincidencias).

**Flags (doble candado, ambos OFF por default):** day-control y route_stops comparten
`gf_salesops.supervisor_day_control.enabled` + `supervisor_day_control_enabled`; radar tiene los suyos.
**`route_stops` no tiene flags propios: reutiliza los de day-control.**

**Capabilities:** day-control 11 (3 son `false` fijas por contrato: `incidents_lifecycle_available`,
`route_return_receipt_available`, `low_execution`), radar 4 (`history_available` y `realtime` **siempre false**),
route_stops 1 (`result_status_available`).

**Copy: mejor de lo que esperaba.** No hay "mi equipo", "mis vendedores" ni "supervisora" en texto visible; el copy
está en clave ruta/jornada/sucursal. Solo ~7 retoques: 2 `aria-label="Supervisor"`, el texto de ruta excluida
("experiencia nueva del supervisor"), 2 descripciones con "el equipo" en Más, y el **namespace `/equipo/*`** con
`label: 'Equipo'`.

**El bloqueo real no es semántico sino de autorización: CUATRO puntos coordinados** —
`required_role` en los 2 controllers, `required_role` en `hr_employee_supervisor_v2.py:15` (el gate de rollout, que
**apagaría el flag V2 para un Gerente aunque se abrieran las rutas**), y `roles` en `registry.js:133`.
Más `MULTI_BRANCH` si el gerente pudiera tener más de una sucursal.

---

# I. Iframe BI — **AISLAR ya; RETIRAR si no se cierra G001**

- **URL fija sin parámetros**: `src={import.meta.env.VITE_METABASE_URL}`. Sin query, sin `#params`, sin JWT.
  `session` se desestructura y **nunca se usa** — variable muerta. Ni siquiera lee la sucursal del gerente.
- **G001 confirmado en su efecto, refutado en su premisa**: la doc dice que `gf_metabase_embed` "existe pero es
  stub"; **en el repo backend no existe en absoluto** — `git log --all` sobre `*metabase*` está **vacío**.
- **El alcance lo decide Metabase, exclusivamente.** La PWA no aplica ni puede aplicar filtro de sucursal.
- **Sin `sandbox`** y **sin CSP `frame-src`**. Ojo con el malentendido: `X-Frame-Options: DENY` impide que **la PWA
  sea enmarcada**; no restringe **qué enmarca la PWA**.
- **Cookie de tercera parte**: la PWA se sirve desde `*.vercel.app` y BI desde `grupofrio.mx` ⇒ sitios distintos.
  Si el dashboard carga con datos hoy, la cookie de Metabase es `SameSite=None`. Y **el logout de la PWA no revoca
  el acceso a BI**: un empleado dado de baja sigue viendo el dashboard.
- **Patrón de phishing por diseño**: sin sesión, el gerente ve un login de terceros **dentro** de la PWA corporativa.
- **Contraste**: la otra superficie Metabase (`ScreenDashboardVentas`) sí pide token y degrada a un resumen nativo
  con datos reales. `/gerente/dashboard` es la excepción sin gobernanza. **Retirarla cuesta ≈ 0.**

---

# G. M1–M7 — ¿el CORE sabe calcular por sucursal?

Pregunta distinta a "¿el rol está permitido?". Respuesta: **el motor sabe calcular por sucursal en 2 de 7**.

| Módulo | ¿Core acepta scope? | ¿El SQL lleva la dimensión? | `branch_dimension` | Clase |
|---|---|---|---|---|
| **M1** `gf_tower_m1` | Sí (vivo, por request) | Sí — `branch_id in [...]`, **ya acepta lista** | no declara capability; dimensión **real** | **A** (tope: 1 sucursal) |
| **M2** | Sí (auditor externo) | Sí — **7 queries** con `effective_branch_config_id = ANY(%s)` | `False` | **B** |
| **M3** | No | Sí, **1 query** (`GROUP BY`, sin filtro) | `True` (1 sola regla) | **A** solo M3-A-07 |
| **M4** | No | No (la columna existe y se cuenta, nunca se agrupa) | `False` | **D** (vía **C** viable) |
| **M5** | No | No | `False` + `warehouse_dimension False` | **D** |
| **M6** | **Acepta pero INERTE** | No | `False` | **D + defecto** |
| **M7** | **Acepta pero INERTE** | No | `False` | **D + defecto** |

## 🔴 Defecto nuevo: "scope fantasma" en M6 y M7
`branch_ids` entra por config, se emite en el `scope` del reporte y **altera el `scope_key`** — pero es **imposible de
enlazar al SQL**: `_parameter_value` lanza excepción si se pide (`kold_os_m6_audit_core.py:506-517`,
`kold_os_m7_audit_core.py:757-766`) y ninguna query lo declara.

**Consecuencia:** fijar `KOLD_OS_M6_BRANCH_IDS=7` produce un `scope_key` **distinto** con métricas **idénticas** a la
corrida global. El datastore las guardaría como scopes separados: dos "sucursales" con cifras globales cada una y un
lifecycle que no cruza. **Ningún test cubre un valor no vacío.** Es peor que no tener el parámetro.

**Prueba de que los autores lo sabían:** el test de M7 enumera las dimensiones que deben cambiar el fingerprint y
**excluye `branch_ids` deliberadamente** (`test_kold_os_m7_core.py:237-248`: 8 campos variables, 7 variantes).

**Además, en M6 la ironía es exacta:** `branch_close_metrics` lee `gf_branch_daily_close` — la tabla **de cierre por
sucursal** — y la colapsa entera por compañía. Cero `GROUP BY` en todo el manifiesto.

## 🟢 M2 es la ganancia más barata del conjunto (capacidad real oculta)
El motor **ya filtra por sucursal** en 7 queries, pero el consumidor declara `branch_dimension: False` y
**producción rechaza cualquier `branch_ids` por una política de una línea**
(`kold_tower_m2_audit_core.py:150-153`). Es política, no modelado.
**Caveat honesto:** 3 queries siguen siendo `scope_policy="company"` (forecast, history, snapshot) ⇒ una corrida por
sucursal devolvería números **globales** para esas tres bajo un `scope_key` que dice "sucursal X". Hay que
scopearlas o marcarlas como no-atribuibles antes de exponerlas.

## M1: qué falta exactamente para N sucursales
El dominio **ya no requiere cambio** (`branch_id in [...]`, y las filas traen `branch_name`). Solo hay que quitar el
fail-closed v1 (`gf_tower_m1_service.py:148-150`) y añadir el rol. **Pero el bloqueador real está aguas arriba:**
`gf_ops_branch_config.py:337-351` prohíbe que un empleado esté activo en más de una sucursal — hoy **N sucursales
ni siquiera es expresable en datos**.

## M7 sin COGS / M5 sin conciliación física
- **M7: el ingreso NO es scopeable hoy.** `invoice_revenue_by_currency` filtra por company y agrupa por moneda; no
  hay columna de sucursal ni en la query ni en su `required_schema`. Scoparlo exige **modificar el manifiesto**
  (cambio de core), no correr scoped. Y hay una **capability que sobre-promete**: `branch_cost_observable` se deriva
  de "existe alguna línea de gasto contabilizada", mientras `branch_dimension: False` — el nombre promete una lectura
  por sucursal que el módulo no puede producir.
- **M5: `physical_reconciliation=False` es un veredicto de disponibilidad de dato, no de scope** — poner scope por
  almacén **no lo desbloquea**. Lo que sí sería atribuible (la llave de join ya existe y está declarada en esquema):
  refill por almacén de origen, cargas/pickings/movimientos por sucursal vía `gf_route_plan`, devoluciones y carga
  suplementaria, y la señal cruda **siempre etiquetada como señal, nunca como cuadre**. Es **D y no B** porque exige
  tocar el manifiesto sellado.

## Discrepancias doc↔código a corregir
1. **M6/M7 scope fantasma** (arriba): eliminar el parámetro, rechazarlo si viene no vacío, o implementar la dimensión.
2. **M7 `branch_cost_observable`** afirma observabilidad de costo por sucursal sin dimensión de sucursal.
3. **M3 doc sobredimensiona**: el contrato dice "reglas A" (plural); el código emite por sucursal **solo M3-A-07**.
4. **M2 capacidad oculta**: el motor puede, el consumidor lo niega y producción lo bloquea.

---

# L. Plan de sprints actualizado + orden de PRs

**Cambio principal frente al plan anterior:** M1 y M2 pasan de "no disponible" a **habilitables**, y aparece un
defecto nuevo (scope fantasma M6/M7) que hay que **cerrar o declarar** antes de prometer nada por sucursal.

| Sprint | Contenido | Precondición |
|---|---|---|
| **0 — Contención + identidad** | Los 6 caminos de (D) por riesgo + kill switch de `generic_model_policies` + `require_employee_token` + decisión de rol/alias + **D1 identidad canónica** + `tz` en branch_config + cerrar `_require_company` + tapar el hueco de doble-scope | **Bloqueante de todo** |
| **1 — Hoy · Operación · Alertas** | Reutiliza day-control/radar/route_stops (4 puntos de allowlist) + los ~7 retoques de copy | Sprint 0 |
| **2 — Ventas · Inventarios · Producción** | `kpi/daily` (1 línea) · DTO de inventario con `uom_id`+`reserved`+merma · agregado de planta + `data_as_of` | Sprint 0; decisión de ubicaciones MP/envases |
| **3 — M1/M2 por sucursal** | M1: quitar fail-closed + rol (barato). M2: habilitar `branch_ids` en producción y scopear las 3 queries `company` | Relajar el constraint mono-sucursal si aplica |
| **4 — Caja · Rentabilidad** | **Primero cerrar el scope fantasma M6/M7.** Rentabilidad se presenta como **"No evaluable"** con lista de costos faltantes | Construir la dimensión de sucursal |

**Orden de PRs:** (1) BE seguridad crítica `liquidaciones/validate` + `requisition-*` → (2) FE retiro de `sudo`/ORM y
cableado a endpoints seguros → (3) config: kill switch + token obligatorio → (4) BE identidad canónica + `tz` →
(5) BE alias de rol + matriz de no-escalada → (6) BE allowlists Supervisor + `hr_employee_supervisor_v2` →
(7) FE shell Gerente (Hoy/Operación/Alertas) → (8) BE DTO inventario → (9) FE Inventarios → (10) BE agregado planta →
(11) FE Producción → (12) M1 rol+multi-branch → (13) M2 corrida scoped → (14) M6/M7 dimensión o declaración.

---

# K. Decisiones que requiere Yamil

1. **Rol canónico y alias** — ¿`gerente_sucursal` como canónico con alias unidireccional temporal? Bloquea todo `gf_saleops`.
2. **¿Multi-sucursal?** Si un Gerente puede tener N plazas, hay que reemplazar el bloque mono-sucursal del guard;
   si es 1:1, `MULTI_BRANCH` se queda como está y es mucho más barato.
3. **`plaza`** — ¿se promueve a campo server-side o se elimina del modelo de sesión? Hoy es un diccionario en el cliente.
4. **Iframe BI** — aislar ahora y cerrar G001, o retirar la ruta.
5. **Kill switch de `generic_model_policies`** — retirar los 3 modelos cierra 4 agujeros con 0 líneas, pero deja
   el módulo Gerente inoperante hasta migrar (a)(b)(c): ¿se hace en el mismo despliegue?
6. **Los 10 endpoints `gerente_unidad` sin caller** — ¿aliasar o retirar?
7. **Ubicaciones MP/envases en `branch_config`** — sin ese campo, MP nunca se podrá aislar por sucursal.
8. **Alcance comprometido**: confirmo que **rentabilidad y cuadre físico quedan fuera** (M7 sin COGS, M5 sin
   conciliación física).

---

# M. Criterios de aceptación
- Cero ORM genérico y cero `sudo` desde el navegador en cualquier camino del rol.
- El alcance **no** es seleccionable por el usuario: ningún `company_id`/`branch_id` del cliente decide qué se lee.
- Todo write: token-only → rol → sucursal → company → fecha/jornada → estado → strict IDs → savepoint → **resultado real**.
- `null` nunca se muestra como 0; parcial se rotula parcial; sin datos ≠ "todo bien".
- Ningún total mezcla monedas ni UOM; toda línea de inventario lleva `uom_id` + `uom_name`.
- Los 9 estados (loading/empty/partial/unavailable/stale/forbidden/feature_disabled/session_expired/error) + retry.
- La matriz de no-escalada del alias pasa con diff exactamente igual al conjunto esperado.

# N. Riesgos y límites
1. **§9 (runtime en 4 viewports) NO EJECUTADO** — la sesión fue eliminada al cierre de la ronda anterior, por
   instrucción; no puedo introducir credenciales. Pendiente del aviso de Yamil.
2. **§1-live NO EJECUTADO** — el mapeo con valores reales (branch_config, analítica, ubicaciones, tz del empleado)
   requiere la misma sesión. Lo entregado en (A) es **estructural**, verificado en código.
3. **Worktree obsoleto**: citas de constraints del backend deben releerse contra `origin/GrupoFrio` (ver salvedad).
4. **`os_api.generic_model_policies` no es auditable desde el repo**: el alcance real de lectura/escritura del grupo
   depende de una fila de configuración sin versionar ni tests.
5. **No probé ningún write** (prohibido y correcto): el riesgo de `forecast-unlock` queda **no refutado**, con la
   lectura confirmada abierta y el `ReferenceError` como única barrera accidental.
6. **§6 (M1–M7 scope en el core) pendiente** de su agente; se anexará como entregable G.
