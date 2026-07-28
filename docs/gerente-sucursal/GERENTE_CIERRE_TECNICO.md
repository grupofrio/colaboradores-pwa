# Gerente de Sucursal — cierre técnico (A–N)

> **ESTADO: DRAFT PARA REVISIÓN TÉCNICA — dos bloqueos pendientes.**
> Documento de auditoría. **No es una especificación aprobada ni autoriza implementación.**
>
> **Ramas auditadas (actualizado tras la revision de Sebastian):** frontend `origin/main` **`b47f329d`** ·
> backend `GrupoVeniu/GrupoFrio` **`158d302a`** (delta revisado) · rama vigente al cierre **`244dbfd9`**.
>
> **Clasificación de evidencia** — cada afirmación de estos documentos es una de:
> **[E]** verificado estáticamente en código de la rama vigente ·
> **[R]** verificado en runtime con sesión autenticada ·
> **[I]** inferido (razonamiento, no observación directa) ·
> **[N]** no ejecutado / no obtenido.
>
> **Identificadores:** sanitizados por alias. Personas `<E1>` · companias `<CO-EN>`/`<CO-PT>` ·
> almacen `<WH-SUC>` · cuenta analitica `<AN-SUC>` · sucursal `<SUC-A>`. Ningun ID productivo en claro.
**2026-07-26 · READ-ONLY** · amplía `AUDITORIA_GERENTE_SUCURSAL.md` y `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` sin borrar evidencia.
Ramas: FE `origin/main` (`b47f329d`) · BE `origin/GrupoFrio` (`158d302a`; vigente `244dbfd9`).

> ## ⛔ VEREDICTO: **INCOMPLETO** — 2 bloqueos externos abiertos
> Ver `GERENTE_ANEXO_RUNTIME.md` para la evidencia runtime y `GERENTE_MATRIZ_ESCRITURAS.md` para el censo.
> **Cumplido:** delta backend auditado · censo de ~100 escrituras · identidad y cardinalidad canonizadas ·
> autoridad redefinida como cadena · M1–M7 en tabla única · producción/inventarios mapeados · iframe cerrado.
> **Bloqueo 1 (externo, ABIERTO):** la **auditoría visual solo cubrió 1 de 4 viewports**. `resize_window`
> reporta éxito pero el viewport real no cambia. Faltan **390×844, 768×1024 y 1366×768**.
> **Bloqueo 2 (externo, ABIERTO):** planta, timezone y ubicaciones MP/PT/envases **no son obtenibles desde el
> navegador** (`gf.ops.branch_config` → `model_not_allowed`); requieren odoo-shell o un endpoint guardado.
> Ninguno se cierra hasta que **Yamil confirme "listo"**.
>
> ### Dictamen de Sebastián — incorporado en esta revisión
> | # | Corrección recibida | Dónde se aplicó |
> |---|---|---|
> | 1 | Auditar el delta backend `781aef65 → 158d302a` y validar qué sobrevive | `ANEXO_RUNTIME` §1 |
> | 2 | Censo exhaustivo de **todas** las escrituras (Gerente · Admin · Producción) en **una** matriz | `GERENTE_MATRIZ_ESCRITURAS.md` |
> | 3 | Sprint 0 mal dimensionado: separar **0A/0B/0C** + cutover con preflight/rollback | `DISENO_OBJETIVO_Y_PLAN` §3 |
> | 4 | Canonizar `gerente_sucursal`; alias por **un solo resolvedor**; `x_gf_role_key` **no** es autoridad absoluta | §4, aquí |
> | 5 | Documentar cardinalidad 1:1 vs 1:N y pedir decisión de Yamil | §5, aquí |
> | 6 | Autoridad = **cadena** token→employee→membresía→config, nunca IDs del cliente | §6, aquí |
> | 7 | Una sola tabla M1–M7, sin "pendientes" genéricos | §7, aquí |
> | 8 | Ampliar el inventario reusable de Producción y declarar la relación que falta | §8, aquí |
> | 9 | Eliminar la clasificación de phishing del dashboard | `ANEXO_RUNTIME` R5/R6 |
> | 10 | Limpiar tablas superadas, IDs productivos y el plan viejo | todo el paquete |
>
> ### Correcciones runtime a esta misma auditoría
> - 🟢 **El empleado SÍ tiene `x_analytic_account_id`** (`<AN-SUC>`, sucursal `<SUC-A>`) y su `branch_config`
>   resuelve. La autoridad canónica **no requiere crear datos**: solo propagarlos y consumirlos correctamente.
> - 🔴 **El desajuste de rol quedó PROBADO en vivo**: `alerts/today` → `FORBIDDEN` con la sesión real del Gerente,
>   mientras `inventory/summary` (sin rol requerido) respondió OK.
> - 🔴 **`inventory/summary` devuelve `ok` con TODO vacío** (sin `products`, sin locations, sin productos):
>   los dos bugs de contrato, confirmados en vivo.
> - 🟡 **Corrijo dos afirmaciones propias:** (a) el iframe BI **no** constituye un patrón de phishing —esa
>   clasificación queda eliminada del paquete—; `/gerente/dashboard` simplemente **no carga** y es peso muerto
>   verificado. (b) `forecast-unlock` **no es un crítico activo sino latente**: no ejecuta por un `ReferenceError`.

## Salvedad de método (declarada, no oculta)
El worktree local `dev/GrupoFrio` está en una rama **obsoleta** (`feat/kold-os-m5-...`, −67,890 líneas vs `origin/GrupoFrio`).
Verifiqué personalmente que **las definiciones de campo de `gf_ops_branch_config.py` son idénticas** en ambas ramas
(analytic :32, pt :100, entregas :107, merma :114, móviles :131), pero **la sección de constraints se desplazó**
(`uniq_branch_by_analytic` = :277 en origin vs :209 en el worktree). Las citas de campo son fiables; cualquier cita
de constraint del worktree debe releerse contra `origin/GrupoFrio` antes de implementar.

---

# A / §6. AUTORIDAD CANÓNICA — definición corregida tras la revisión

> **Corrección de la revisión.** La formulación anterior ("`gf.ops.branch_config` es la autoridad canónica")
> era **incompleta**: nombraba el destino sin nombrar el camino. Un `branch_config` alcanzado por una vía
> equivocada no es autoridad, es un dato bonito. La formulación vigente es la siguiente.

## `gf.ops.branch_config` es autoridad canónica ÚNICAMENTE al final de esta cadena

```
  token  →  employee  →  membresía autorizada  →  config activa
```

| Paso | Qué significa | Fail-closed si… |
|---|---|---|
| 1 · **token** | identidad exclusivamente por `X-GF-Employee-Token` verificado server-side | no hay token, expiró, o el empleado/usuario está inactivo ⇒ `UNAUTHORIZED` |
| 2 · **employee** | el empleado se deriva del token, **nunca** de un campo del payload | el token no resuelve a un empleado ⇒ `UNAUTHORIZED` |
| 3 · **membresía autorizada** | la relación empleado↔sucursal se lee server-side y debe ser **explícita y única** | 0 membresías ⇒ `NO_BRANCH_SCOPE` · >1 sin elección válida ⇒ `BRANCH_REQUIRED` · analítica≠membresía ⇒ `BRANCH_SCOPE_AMBIGUOUS` |
| 4 · **config activa** | `active = True` **y** `state = 'active'` **y** completa | inactiva/incompleta ⇒ `BRANCH_CONFIG_INCOMPLETE` |

**Solo si los cuatro pasos pasan**, el `branch_config` resultante define el scope: company, par intercompany,
ubicaciones, picking types, flags y umbrales.

## Regla negativa — no negociable

> **NUNCA se acepta como autoridad un `analytic_account_id`, `company_id`, `warehouse_id` ni `branch_id`
> enviado por el cliente.**

Esto aplica **aunque el valor sea correcto**. El cliente puede enviarlos como *sugerencia* (p. ej. para elegir
entre las sucursales que el servidor ya determinó que le corresponden), y en ese caso el servidor **valida la
sugerencia contra el conjunto que él mismo calculó** y falla si no pertenece. Nunca la usa como origen.

Hoy esta regla se viola en la mayoría de la matriz de escrituras (`GERENTE_MATRIZ_ESCRITURAS.md`): `company_id`
y `warehouse_id` del navegador son la autoridad efectiva de `gf_pwa_admin`, y `shift_id`/`warehouse_id` la de
producción. **Ese es el contenido real del Sprint 0.**

## Por qué `branch_config` es el destino correcto (evidencia, no preferencia)
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

## §4 · CANONIZACIÓN DOCUMENTAL DE LA IDENTIDAD (corregido)

### Decisión documental

| Artefacto | Estatus canónico |
|---|---|
| **`gerente_sucursal`** | **ROL CANÓNICO.** Única denominación válida en documentación, contratos y código nuevo |
| **`gerente_unidad`** | **ALIAS TEMPORAL**, resuelto por **un único resolvedor central**. No es un segundo rol: es un nombre heredado del mismo concepto |
| **`is_gerente_sucursal`** | **COMPATIBILIDAD DERIVADA.** Deja de ser fuente y pasa a ser un booleano *derivado* del rol canónico. No debe consultarse en código nuevo |

### Precedencia real del rol (verificada en `guard.py:61-96`) — cuatro niveles, no uno

```python
for fname in ("x_gf_role_key", "x_role_key"):            # 1. overrides (campos Studio/BD)
    if fname in emp._fields: ...
primary = resolve_employee_pwa_job_key(emp)              # 2. hr.job.x_job_key  ← rol principal canónico
keys.extend(resolve_employee_pwa_additional_job_keys(emp))  # 3. pwa_extra_*   ← roles adicionales, ADITIVOS
if not keys:
    legacy = self._legacy_job_name_role_key(emp)         # 4. fallback por NOMBRE de puesto
```

| # | Artefacto | ¿Existe en el repo? | Papel real |
|---|---|---|---|
| 1 | `x_gf_role_key`, `x_role_key` | **NO están definidos en el repositorio.** Se leen defensivamente solo si el registro los tiene en `_fields` (campos Studio/BD, no versionados) | **Override condicional de máxima precedencia.** ⚠️ **No son "la autoridad absoluta": pueden no existir en la instancia, y de hecho no existen en el código.** Son un riesgo de gobernanza (conceden rol sin pasar por revisión), no la fuente de verdad |
| 2 | **`hr.job.x_job_key`** | **SÍ** (`models_hr.py:617-624`, espejo related en `hr.employee` `:374-380`) | **Rol principal canónico.** Es lo que viaja en la sesión |
| 3 | **`pwa_extra_*`** → `PWA_ADDITIONAL_ROLE_SPECS` | **SÍ**, 14 pares (`pwa_job_key.py:4-19`) | **Roles adicionales, aditivos** (no reemplazan al principal; se descarta el duplicado). **Incluye `pwa_extra_gerente_sucursal`** (`models_hr.py:354`) |
| 4 | **Fallback por nombre de puesto** | **SÍ** (`guard.py:35-59`) | Solo si no hubo nada arriba. *Substring match* case-insensitive sobre `job_id.name`. **`gerente_sucursal` NO está en ese mapa**; `"gerente de unidad"` sí |

**El delta backend confirma que la vía 3 es la viva:** `158d302a` añadió `pos_diurno` exactamente así.

### El acceso pasa si CUALQUIER rol efectivo está en la allowlist
```python
# guard.py:364
if allowed_roles and not (set(role_keys) & set(allowed_roles)):
    return {"ok": False, "code": "FORBIDDEN", ...}
```
⇒ El alias es viable **sin tocar ninguna allowlist**: basta con que el resolvedor central emita ambas claves.

### Semántica REAL de `guard_request` (`guard.py:283-384`) — corregida

**Lo que SÍ valida:** si hay token, obliga a que `meta.employee_id` coincida (`FORBIDDEN/employee_identity_mismatch`)
y borra `employee_ref`/`wa_phone`; resuelve company y analítica; interseca rol contra la allowlist.
Fail-closed en: sin rol + allowlist ⇒ `SERVER_MISCONFIG` · rol fuera ⇒ `FORBIDDEN` · company distinta ⇒ `FORBIDDEN`
· >1 sucursal sin analítica explícita ⇒ `VALIDATION_ERROR`.

**Lo que NO valida — fail-open estructural:**
```python
# guard.py:337
require_token = self._param_bool("gf_salesops.require_employee_token", default=False)
```
**Sin token, la identidad sale del payload** (`_get_employee` busca por `meta.employee_id`/`employee_ref`/`wa_phone`,
y `_envelope` promueve `data.employee_id → meta.employee_id`). Está documentado como "canal de servicio n8n".
⇒ **`guard_request` NO es equivalente a `resolve_authenticated_supervisor`.** El primero es fail-open en identidad
por defecto; el segundo es token-only fail-closed. **No los trates como intercambiables en el diseño.**

### `is_gerente_sucursal`: por qué deja de ser fuente
```python
# os_customer_zones/models/models_hr.py:312
is_gerente_sucursal = fields.Boolean(string="Es gerente de sucursal", default=False)
```
**Almacenado, sin compute, sin related, default `False`** — se marca a mano. Convive en paralelo con
`pwa_extra_gerente_sucursal`, y **solo este último alimenta la autoridad canónica de rol**. Son dos campos
distintos para el mismo concepto, y hoy `gf_pwa_admin` y producción leen **el que no manda** (6 sitios + 1).
Por eso pasa a compatibilidad derivada: se conserva para no romper, deja de consultarse en código nuevo.

### El alias, con un único resolvedor central (diseño anti-escalada)
Un solo punto (`_employee_role_keys`, tras el paso 3), tabla de un par `{gerente_sucursal → gerente_unidad}`,
**unidireccional** (invertirlo daría POS/gastos/materiales a los "puro-nombre"), **aditivo** (`keys[0]` intacto),
**sin tocar ninguna allowlist**, **excluyendo los overrides Studio**, bajo `ir.config_parameter` apagable sin
deploy, y **registrado** para poder retirarlo.

**Prueba de fondo:** matriz cartesiana (roles canónicos + gerente legacy) × (endpoints con `gerente_unidad`)
capturando el veredicto de `guard_request` con alias OFF y ON; el diff debe ser **exactamente** las celdas de
`gerente_sucursal`. Eso demuestra "no abre puertas" en vez de sugerirlo.

**Confirmado:** `gerente_sucursal` tiene **0 ocurrencias en todo `gf_saleops`**; `gerente_unidad` **no existe**
en `PWA_ADDITIONAL_ROLE_SPECS` (solo se obtiene por `x_job_key`, por campo Studio, o accidentalmente por
substring del nombre del puesto). **Son universos disjuntos.**

---

## §5 · CARDINALIDAD empleado ↔ sucursal — DECISIÓN REQUERIDA DE YAMIL

### Estado real: la mono-sucursal es una invariante de *runtime*, no del *modelo de datos*

**Existen 4 vías empleado↔sucursal, con cardinalidades distintas:**

| Vía | Archivo:línea | Cardinalidad | ¿Unicidad? |
|---|---|---|---|
| `hr.employee.x_analytic_account_id` (M2O) | `model_hr_employee_analytic.py:7-12` | 1 → 1 | implícita; **nada valida que coincida con la membresía** |
| `gf.ops.branch_config.employee_ids` (M2M) | `gf_ops_branch_config.py:56-63` | **N:M en el esquema** | constraint Python `_check_employee_scope_overlap` (`:336-351`) |
| `hr.employee.warehouse_id` | `models_hr.py:76,105` | 1 → 1 | constraint contra la analítica del empleado |
| `res.users.x_gf_allowed_analytic_account_ids` (M2M **computado**) | `res_users_saleops.py:8-26` | **1 → N** | **ninguna** — alimenta las record rules |

**La constraint que lo impide cubre UNA sola de las cuatro vías**, y solo entre configs `active AND state='active'`;
**no se dispara al editar el empleado**. Nada valida la coherencia entre `x_analytic_account_id` y `employee_ids`:
un empleado puede tener analítica de A y membresía en B, y es un estado válido para el ORM.

**Consecuencia por camino:** token-only ⇒ `MULTI_BRANCH` fail-closed (el empleado queda inutilizable, no escalado).
`guard_request` ⇒ prefiere `x_analytic_account_id` e **ignora las membresías**; si no hay analítica y hay >1 config,
**acepta la que el cliente envíe** ⇒ multi-sucursal efectivo por elección del cliente.
`res.users.x_gf_allowed_...` ⇒ **acumula sin límite** ⇒ a nivel ORM el multi-sucursal ya está soportado.

### Las dos alternativas

| | **Opción 1:1** — un empleado, una sucursal | **Opción 1:N** — un empleado, varias sucursales |
|---|---|---|
| **Modelo** | Constraint dura sobre `hr.employee` + coherencia analítica↔membresía | Membresía explícita como entidad, con rol por sucursal |
| **Coste inicial** | **Bajo** — formaliza lo que el runtime ya asume | **Medio** — nueva entidad + selector + propagación a DTOs |
| **Riesgo** | Bloquea al gerente multi-sucursal el día que exista; migrar después obliga a tocar todos los DTOs | Mayor superficie desde el día 1 |
| **Efecto sobre el gap actual** | No resuelve `res.users.x_gf_allowed_...`, que seguirá siendo 1→N | Lo alinea: una sola fuente para todos los caminos |
| **Reversibilidad** | **Baja** — el scope entra en cada contrato como escalar | **Alta** — 1:1 es el caso particular de 1:N con N=1 |

### 🟠 RECOMENDACIÓN — 1:N en el modelo, 1:1 en la operación inicial

Diseñar **1:N desde el principio** y **operar 1:1** hasta que Yamil decida lo contrario. Dos piezas:

**1 · Membresía explícita.** Una relación empleado↔sucursal declarada, con `active` y (a futuro) rol por sucursal,
como **única** fuente de la relación. Las otras tres vías pasan a derivarse de ella o a validarse contra ella.
Elimina de raíz el estado "analítica de A + membresía en B", que hoy es representable y produce `MULTI_BRANCH`
o —peor— scope silenciosamente equivocado según el camino.

**2 · `BranchSelector` *server-authoritative*.** El servidor devuelve el **conjunto** de sucursales del empleado.
Con N=1 no se renderiza y el scope es implícito: **la operación de hoy no cambia en absoluto**. Con N>1 el usuario
elige, la elección viaja como **sugerencia**, y el servidor la **valida contra el conjunto que él mismo calculó**
(§6). Nunca la acepta como origen. Fail-closed: `BRANCH_REQUIRED` si hay N>1 y no se eligió — **fallar, no elegir
la primera**.

**Por qué esta forma y no la otra:** el coste de diseñar 1:N y operar 1:1 es **una capa de indirección**; el coste
de asumir 1:1 y descubrir después que hay gerentes multi-sucursal es **rehacer todos los contratos**, porque el
scope habrá entrado en cada DTO como escalar. La asimetría es grande y va en una sola dirección.

> **DECISIÓN REQUERIDA DE YAMIL:** ¿algún `gerente_sucursal` debe cubrir **más de una** sucursal —hoy, o en el
> horizonte de 12 meses (suplencias, vacaciones, corporativo, plazas pequeñas compartidas)? De la respuesta
> depende si la membresía se implementa ahora o se difiere. **La recomendación es implementarla ahora aunque
> la respuesta sea "no": el sobrecoste es bajo y la reversión es cara.**

---

# D. Sprint 0 — ⚠️ SECCIÓN SUPERADA

> **Esta sección queda SUPERADA por la revisión.** El Sprint 0 vigente está en
> `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` §3, reestructurado en **0A (seguridad backend completa) · 0B
> (identidad/rol/cardinalidad/resolvedores) · 0C (corte frontend)**, con el **cutover de políticas genéricas
> separado** (preflight → migración → rollback → inventario de consumidores).
>
> **Por qué se supera:** la tabla de abajo ordenaba **8 caminos** del módulo Gerente. El censo posterior
> encontró **~100 escrituras** (`GERENTE_MATRIZ_ESCRITURAS.md`). Un Sprint 0 dimensionado sobre 8 subestima
> el trabajo en un orden de magnitud. Se conserva a continuación **solo como detalle de los caminos del
> Gerente**, no como plan.

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


## §8 · INVENTARIO REUSABLE DE PRODUCCIÓN (añadido por la revisión)

Todo verificado estáticamente **[E]** en `158d302a`. Este inventario es de **capacidades existentes**; no implica
que sean seguras hoy (ver `GERENTE_MATRIZ_ESCRITURAS.md`, dominio Producción).

| Artefacto | Modelo / campo exacto | Archivo:línea | Notas de reutilización |
|---|---|---|---|
| **Catálogo de material** | `gf.production.material` | `gf_production_material.py:14` | Capa de configuración sobre `product.product`, **no** un catálogo paralelo. Campos: `product_id`, `uom_id` (related store), `category`, `applies_to_rolito`, `applies_to_barras`, `tolerance_pct`, `tolerance_abs`, `source_location_id`, `tag_ids`, `company_id`. `unique(product_id, company_id)`. `evaluate_tolerance()` usa el límite **más restrictivo** |
| **Tags** | `gf.production.material.tag` (catálogo) + `gf.production.material.issue.tag` (operativos) | `gf_material_tag.py:6` · `gf_material_issue_tag.py:11` | Deliberadamente separados. Reutilizables como taxonomía |
| **Issues** | `gf.production.material.issue` | `gf_material_issue.py:18` | Estados `draft → confirmed → cancelled`. `shift_id`, `line_id`, `material_id`, `qty_issued`, `issued_by`, `received_by`, `stock_move_ids`, `settlement_id` (compute store) |
| **Settlements** | `gf.production.material.settlement` | `gf_material_settlement.py:32` | **7 estados**: `draft, reported, validated, rejected, disputed, force_closed, abandoned`. `unique(shift_id, line_id, material_id)`. `qty_consumed = qty_issued − qty_remaining − qty_damaged`. ⚠️ `_ADMIN_ONLY_FIELDS` protegido en `write()` pero **saltable con `.sudo()`** |
| **Conciliación de producción** | `/api/production/materials/reconcile` y `/api/production/pt/reconcile` | `gf_production_api.py:3390` · `:2463` | **Read-only y sin persistencia**: calculan incidencias en vuelo. Códigos de materiales: `settlement_pending_report/validation`, `settlement_disputed/rejected`, `tolerance_exceeded`. PT: `production_vs_accounted_mismatch`, `packed_vs_pt_received_mismatch`, `line_produced_vs_received_short/over`, `pt_received_without_line`, `pt_received_vs_inventory_mismatch`. **Reutilizables tal cual como señales de Gerente** |
| **Dispatch-config** | *ninguna clase*; se arma en vuelo | `gf_production_api.py:3521` | Lee `stock.location.gf_mp_dispatch_key` (`Selection [rolito, pt]`, `stock_location_ext.py:8-12`) filtrado por `child_of` del almacén. ⚠️ **ROTO** — ver abajo |
| **UOM** | `uom_id = related("product_id.uom_id", store=True)` | `gf_production_material.py:28-33` | ⚠️ **No hay conversión de UoM en ningún punto.** Todos los movimientos usan la UoM del producto. Única entrada de UoM del cliente: `product_uom_id` en `bar-harvest-scrap`, **aceptado sin validar compatibilidad de categoría** |
| `source_location_id` | `Many2one stock.location` (domain internal) | `gf_production_material.py:61-66` | Override por material; **prevalece** sobre el del almacén. Consumido en 3 sitios |
| `gf_mp_source_location_id` | `Many2one stock.location` en `stock.warehouse` | `stock_warehouse_ext.py:20-25` | "Ubicación origen MP (Bodega)". **Consumido en 7 sitios** — es el ancla real de MP |
| `energy_tz` | `Selection` en `stock.warehouse`, default `America/Mexico_City` | `stock_warehouse_ext.py:10-14` | ⚠️ **Definido y NUNCA leído** (0 usos fuera de la definición). Los turnos usan un offset **hardcodeado** `-6h` y la tz del usuario técnico de la API key. **No lo tomes como fuente de zona horaria** |
| `plant_warehouse_id` | `Many2one stock.warehouse`, **required** | `gf_production_shift.py:21` · `gf_production_line.py:24` | **Ancla de scope de planta.** `company_id` es related suyo. Variante `x_plant_warehouse_id` en 3 modelos más |
| **Plant config** | **`gf.plant.config`** | `gf_plant_config/models/gf_plant_config.py:5` | `x_plant_warehouse_id` (required, restrict) + capacidades (barras/rolito/congelados), alberca, evaporadores, compresores, condensadores, nominales (`x_nominal_bars_day`, `x_nominal_rollito_kg_day`, `x_installed_kw_total`). ⚠️ **Solo descriptivo — ningún endpoint lo lee hoy.** Es el mejor candidato para colgar la relación que falta |
| Extensión de equipos | `gf.production.machine` ← `kold_equipment_code` | `gf_production_machine_ext.py:20-49` | Mapeo canónico hacia KoldPlant |
| Política de bolsas | `stock.warehouse.gf_bag_product_id`, `gf_bag_unit_cost`, `gf_auto_create_bag_debt` | `stock_warehouse_ext.py:28-41` | + `gf.bag.custody` (5 estados) y `gf.employee.bag.debt` |
| Feature flags | `gf_production_ops.material_stock_enabled` (default `"0"`) | `gf_material_issue.py:133-136` | ⚠️ Con el flag apagado los issues/settlements **no** mueven inventario, **pero `dispatch-transfer`, `issue/validate-receipt`, `bar-harvest-scrap` y `traspaso-mp` crean movimientos ignorando el flag** |

### ⚠️ `dispatch-config` y `dispatch-transfer` están ROTOS — no los cuentes como capacidad
Ambos leen `wh.gf_mp_dispatch_location_rolito_id` / `_pt_id`. **Esos campos no existen en el repositorio**
(`grep -rn "gf_mp_dispatch_location"` → solo las 2 líneas del controlador, ninguna definición).
Resultado: `AttributeError`/500 en un caso, y **409 `DISPATCH_CONFIG_MISSING` permanente** en el otro.
El único marcador de destino que **sí** existe es `stock.location.gf_mp_dispatch_key`.

### 🔴 FALTA LA RELACIÓN CANÓNICA `branch_config` → `plant_warehouse` — declarado explícitamente

**No existe ninguna relación, ni directa ni indirecta, entre `gf.ops.branch_config` y la planta.**

Evidencia de búsqueda ejecutada:
1. `grep -rn "plant_warehouse_id = fields"` → **5 definiciones**, todas en modelos de producción/planta,
   **ninguna en un modelo de sucursal**.
2. Lectura íntegra de `gf_ops_branch_config.py` (383 líneas) → **ningún campo** apunta a planta,
   `gf.production.*` ni `plant_warehouse_id`. Su scope es **analítico + intercompany**, con ubicaciones de
   **sucursal** (PT, entregas, merma, móviles). Cero `stock.warehouse` en el modelo base.
3. `_inherit = "gf.ops.branch_config"` → **2 extensiones**, ambas de **rutas** (`route_warehouse_ids` = almacén
   de *despacho de ruta*, no planta).
4. Cruce archivo-a-archivo (≈35 archivos que mencionan `gf.ops.branch_config` **y** `warehouse`): **ningún**
   hit referencia `plant_warehouse_id` ni `gf.production.*`.
5. Camino inverso: `gf_production_ops` **no depende de `gf_saleops`** en su manifiesto, y tiene **0 ocurrencias**
   de `branch_config`.

**Implicación:** no existe ninguna autoridad server-side capaz de responder *"¿este empleado o esta sucursal
puede tocar esta planta?"*. El único puente teórico —`plant_warehouse_id.lot_stock_id.x_analytic_account_id`
→ `branch_config.analytic_account_id`— **no está implementado en ninguna parte**; `x_analytic_account_id` solo
se lee para **distribución analítica de costos**, nunca para autorización.

⇒ **Cualquier guardia de scope planta↔sucursal hay que construirla desde cero.** Es una dependencia dura para
todo lo que el Gerente quiera ver o hacer sobre producción, y una **decisión de modelado pendiente** (el
candidato natural es colgarla de `gf.plant.config`, que hoy está infrautilizado).


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

# I. Iframe BI — **RETIRAR AHORA** (ruta + tarjeta)

> **Actualizado por la revision.** La clasificacion de phishing queda ELIMINADA (era una afirmacion mia
> incorrecta: Metabase rehusa ser enmarcado y el login nunca se renderiza). Veredicto final en
> `GERENTE_ANEXO_RUNTIME.md` R5/R6: **iframe roto / no carga, sin fuga observada**. Accion: retirar ruta y
> tarjeta **ahora** (coste ~0, no depende de ningun bloqueo); sustituir **despues** por Hoy nativo con scope
> de sucursal server-side. Lo de abajo se conserva como detalle tecnico del iframe.

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

# G / §7. KOLD OS M1–M7 — TABLA ÚNICA DE DISPOSICIÓN

> **Esta tabla SUSTITUYE todas las clasificaciones M1–M7 anteriores de este paquete.** Las versiones previas
> (semáforos, "candidatos baratos", listas de pendientes) quedan **SUPERADAS**. Ningún módulo queda declarado
> genéricamente "pendiente": cada uno tiene una disposición definitiva y una condición de cambio explícita.

| Módulo | **Disposición** | Qué significa exactamente | Condición para cambiar de estado |
|---|---|---|---|
| **M1** | **REUSABLE** | Único con **scope por sucursal real y fail-closed server-side**. Se consume tal cual, sin corrida nueva. | — (ya cumple) |
| **M2** | **NUEVA CORRIDA SCOPED** | Requiere una corrida nueva con scope de sucursal. **7 de sus queries ya son branch-aware; 3 son company-only.** Esas 3 son el trabajo real, no el módulo entero. | Reescribir las **3 queries company-only** y ejecutar la corrida scoped |
| **M3** | **DTO DE SEÑALES** | No se reutiliza el módulo: se expone un **DTO de señales** derivado, con scope de sucursal server-side. | — (es la forma objetivo, no un déficit) |
| **M4** | **NUEVA DIMENSIÓN + DTO** | Requiere **añadir la dimensión de sucursal** y publicar un DTO propio. Mayor que M2: no basta con reescribir queries. | Implementar la dimensión y el DTO |
| **M5** | **SEÑALES, NO CONCILIACIÓN FÍSICA** | Entrega **señales** de inventario. **No responde "¿cuadra?"** (`physical_reconciliation = false`). Debe consumirse y rotularse como señal, nunca como conciliación. | Que exista conciliación física real — **fuera del alcance de este plan** |
| **M6** | **UNAVAILABLE · y debe RECHAZAR `branch_ids`** | No disponible para Gerente. **Además debe rechazar explícitamente `branch_ids`** en lugar de aceptarlo: hoy el parámetro **altera `scope_key` pero nunca llega al SQL** ⇒ produce un resultado company-wide **etiquetado** como si fuera de sucursal. Aceptarlo en silencio es peor que no soportarlo. | Implementar el scope real en SQL **y** que el rechazo deje de ser necesario |
| **M7** | **UNAVAILABLE** hasta **dimensión + COGS + trazabilidad** | No disponible para Gerente. Requiere las **tres** cosas, no una: dimensión de sucursal, COGS, y trazabilidad del cálculo. | Las tres condiciones cumplidas y verificadas |

## El defecto que obliga al rechazo explícito en M6 (y que afecta a M7)

**"Scope fantasma":** `branch_ids` **modifica `scope_key`** —es decir, cambia la identidad declarada de la
corrida— **pero no participa en el SQL**. El resultado es company-wide y viaja etiquetado como si estuviera
acotado a una sucursal.

Esto es más grave que "no soportado": un consumidor que confíe en `scope_key` creerá que recibió datos de su
sucursal. **Por eso la disposición no es "ignorar `branch_ids`" sino "rechazarlo"** — fail-closed, con un código
de error explícito. Un parámetro que miente sobre el alcance debe fallar, no degradar en silencio.

## Nota de método sobre esta tabla

Las disposiciones de M2 y M4 se apoyan en el conteo de queries branch-aware vs company-only. Ese conteo procede
de la auditoría estática previa **[E]** y **no fue re-verificado contra `244dbfd9`**. Antes de planificar el
trabajo de M2, reconfirmar el reparto 7/3. La disposición cualitativa (M2 más barato que M4) es robusta; el
número exacto de queries no.


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
