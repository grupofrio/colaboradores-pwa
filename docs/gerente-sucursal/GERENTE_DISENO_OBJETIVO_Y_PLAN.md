# Gerente de Sucursal — capacidades reutilizables, diseño objetivo y plan

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
**Complemento de** `AUDITORIA_GERENTE_SUCURSAL.md` · 2026-07-26 · read-only

## Cambio de estado verificado hoy
`#223`, `#81` y `#83` fueron **MERGEADOS** por Sebastián el 2026-07-26 (19:25 / 19:40 / 19:44Z; merge de #83 = `23adf65`).
**Supervisor V2 ya está en `main`.** Esto convierte a V2 de "candidato futuro" en **plataforma disponible hoy**, y es
el hecho que más abarata el plan.

---

# F. Supervisor V2 — la única base madura y con alcance por sucursal

| Capacidad | Endpoint | Scope server-side | R/W | ¿Sirve a Gerente? |
|---|---|---|---|---|
| **Day Control** | `/v2/day-control` | ✅ `effective_branch_config_id` — **toda la sucursal**, no "su equipo" | R | **Sí, tal cual** |
| **Radar** | `/v2/radar` | ✅ sucursal | R | Sí (exige S/N de privacidad propio) |
| **Route stops** | `/v2/route_stops` | ✅ sucursal + jornada fail-closed | R | **Sí, tal cual** |
| Pendientes / cierres | derivado de day-control (sin endpoint propio) | ✅ hereda | R | **Sí** |
| Forecast read | `/v2/forecast/get` | ✅ company + analytic + jornada | R | Sí |
| Forecast write | `/v2/forecast/update_lines` | ✅ analytic + advisory lock + `expected_write_date` | W | Sí |
| Publicar plan | `/v2/route_plan/publish` | ✅ sucursal + jornada + lock | W | Sí |
| Alta de cliente en plan | `/v2/route_plan/add_customer` | ✅ sucursal + jornada | W | Sí |
| Rutas día/semana (legacy) | `/v2/routes/{day,week}` | ⚠️ por vendedor ∈ `cfg.employee_ids` (**equipo**) | R | **No** — requiere agregación de sucursal |
| Búsqueda de clientes | `/v2/customers/search` | ❌ **sin filtro de sucursal** | R | Hallazgo a corregir |
| Forecast confirm/cancel/delete | guard legacy | ⚠️ | W | **No** — capabilities `false` a propósito |
| **Asignar chofer/vehículo** | `/pwa-supv/route-suggestions/confirm` (**otro módulo**) | grupos **Odoo**, no roles PWA | W | **No hereda** — permisos separados |

**El descubrimiento clave:** day-control **no es "la vista de la supervisora": es la vista de la sucursal**.
Filtra por `effective_branch_config_id`, sin filtrar por vendedor. Un Gerente vería exactamente lo mismo.

**Bloqueo en cascada (4 puntos, no 1):** aunque se amplíe el guard de un endpoint,
`get_pwa_supervisor_v2_status()` exige `supervisor_ventas` → el login no proyecta `capabilities.supervisorV2` →
el flag del cliente es fail-closed → el shell V2 no monta.

**Riesgo estructural:** `resolve_authenticated_supervisor` es **mono-sucursal fail-closed** (`MULTI_BRANCH`).
Un Gerente con más de una plaza quedaría **bloqueado**, no degradado.

---

# G. Producción — qué se reutiliza

`gerente_sucursal` **no aparece en ningún módulo, grupo ni `ir.rule` de producción**.

**Listo hoy (read-only):** turno activo (`/api/production/shift/current`) · kg producidos/empacados/merma, yield y
energía (`/api/production/dashboard`, requiere `shift_id`) · **blockers/warnings de cierre**
(`/api/production/shift/close-check` — el mejor contrato del dominio) · producido vs recibido en PT por línea
(`/api/production/pt/{reception/pending,reconcile}`) · catálogo de líneas y máquinas.

**Falta exponer:** agregado **planta+fecha** (no existe: hoy es por `shift_id`) · Pareto de paros por causa ·
desglose de merma por razón · **estado operativo por línea** (no existe en ningún lado) · y sobre todo
**frescura**: `data_as_of` tiene **0 ocurrencias** en todo el dominio de producción.

**No interpretar todavía:** `x_compliance_score` (contaminado por `out_of_sequence` con ~100% falsos positivos) ·
`quality_score` de KoldPlant (lección I-11: sensor muerto = 0 legítimo) · telemetría de compresores (campos en 0,
PSI vs bar) · `productivity_kg_hour` (12 h hardcodeadas) · `%vs plan` cuando la meta es 0 · **cualquier costo o P&L**.

**Seguridad:** `.sudo()` sistemático; `/api/production/dashboard` **ni siquiera acepta `warehouse_id`**; el frontend
cae a `DEFAULT_SUPERVISION_WAREHOUSE_ID = 76`. Y **no existe mapeo sucursal→planta**.

---

# H. Inventarios — cuatro subsistemas desconectados

| Subsistema | Verdad que produce | ¿Aísla por sucursal? |
|---|---|---|
| `gf_saleops` `inventory_service` | PT + Entregas + Vans, **disponible real** (`quantity − reserved`) | ✅ **correcto** |
| BFF frontend `/pwa-pt/*` | on-hand por familia | ❌ ORM genérico con `sudo` |
| `gf_pwa_admin` MP/materiales | on-hand + arqueo por turno | ❌ `company_id` del payload |
| `gf_kold_os_m5` | hallazgos, **cero cantidades** | ❌ global |

**La joya desaprovechada:** `GET /gf/salesops/inventory/summary` ya tiene `required_role=None` y **guard de
analítica enforced**. Es el **único** endpoint de stock con aislamiento correcto por sucursal — y la PWA de
Gerente **no lo usa**.

**Defectos a corregir antes de construir encima:**
1. El BFF de PT pide `reserved_quantity` y **la ignora** ⇒ muestra más stock del vendible.
2. Deriva kg con un **regex sobre el nombre del producto** (fallback 1 kg).
3. `gf.dispatch.reconciliation.line` **no declara UOM** (Floats desnudos).
4. `pt_available_qty` suma barras (piezas) + rolito (bolsas) sin normalizar.

**Gaps reales (no existen):** cobertura/días de inventario · mínimos y punto de reorden · caducidad/FEFO ·
stock en tránsito · cuadre físico integral · inventario por vehículo como modelo · categorización fina de
envases · valorización expuesta.

**"Cargado en ruta" tiene 3 representaciones no reconciliadas** (ubicación móvil · pickings de carga · balance de
conciliación), y **39.8% de planes publicados no tiene carga vinculada**.

---

# I/J. El gap que ordena todo el plan

**Existen CUATRO autoridades incompatibles de "sucursal":**

| # | Autoridad | La usa |
|---|---|---|
| 1 | `analytic_account_id` + `branch_config.employee_ids` | `gf_saleops` (Supervisor V2, inventory_summary) |
| 2 | `warehouse → locations → branch_config` | `gf_route_compliance` (chofer/vehículo) |
| 3 | `plant_warehouse_id` | producción |
| 4 | `company_id` **del payload/navegador** | `gf_pwa_admin` y `/pwa-gerente/*` |

La #4 no es una autoridad: es una preferencia del navegador. **Y es la única que usa el Gerente hoy.**

> **G-0 · Gap raíz: el Gerente no tiene identidad de sucursal.** Todo lo demás se deriva de esto.
> Construir pantallas antes de resolverlo replica la fuga en cada vista nueva.

---

# M/N. Arquitectura objetivo

**Principio rector:** el Gerente **no es un Supervisor con más botones**. El Supervisor opera *su equipo*; el
Gerente decide sobre *la sucursal completa*. Como day-control ya es de sucursal, la **superficie de datos** se
reutiliza casi entera; lo que cambia es la **composición** y las **acciones**.

**Regla de oro:** ninguna vista de Gerente lee ORM genérico. Todo pasa por DTO versionado con scope server-side.

- **Móvil:** `Hoy · Operación · Ventas · Inventarios · Más` + bandeja de Alertas persistente.
- **Desktop:** menú lateral con las mismas áreas + acceso rápido a alertas.

Cada tarjeta lleva: **valor · comparación · fuente · `data_as_of` · alcance · estado · drill-down**.
Sin consolidar datos incompatibles, sin sumar monedas ni UOM distintas, sin total si la información es parcial.

---

# O. DTOs propuestos (`gf.branch.manager.*/1`)

| DTO | Endpoint | Reutiliza | Trabajo nuevo |
|---|---|---|---|
| **D1 · Identidad** | resolución en login | `resolve_authenticated_supervisor` | proyectar `branch_config_id` + `analytic_account_id` a la sesión; **soportar N sucursales** (hoy es mono-branch fail-closed) |
| **D2 · Hoy** | `/v2/manager/today` | day-control + `inventory/summary` | composición + `data_as_of` por bloque + `capabilities` |
| **D3 · Operación** | reusa `/v2/day-control`, `/v2/radar`, `/v2/route_stops` | **100%** | solo ampliar allowlist de rol (4 puntos) |
| **D4 · Ventas** | `kpi/daily` | ya scopeado por analítica | añadir `gerente_sucursal` al `required_role` (**1 línea**) |
| **D5 · Inventarios** | `/v2/manager/inventory` | `inventory_service` | **emitir `reserved`** (hoy se descarta), añadir `uom_id/uom_name`, incluir merma |
| **D6 · Producción** | `/api/production/plant/summary` | `close-check`, `pt/reception/pending` | agregado planta+fecha + `data_as_of` + **mapeo sucursal→planta** |
| **D7 · Alertas** | `/v2/manager/alerts` | `priorities[]` de day-control | unificación multi-fuente con dedup y agrupación |

Todos con `contract_version`, `data_as_of`, `capabilities`, `capability_reasons`, `scope{}` y los estados
`loading · empty · partial · unavailable · stale · forbidden · feature_disabled · session_expired · error` + retry manual.

---

# P. Capabilities propuestas (por acción, derivadas server-side)

```
can_view_routes · can_view_radar · can_view_sales · can_view_inventory
can_view_production · can_view_cash · can_view_profitability
can_reassign_resources · can_authorize_exception · can_unlock_forecast
can_approve_expense · can_validate_settlement · can_authorize_cash_closing
```

**Regla:** una capability es `true` **solo** si existe un endpoint seguro que la respalde. Si no,
`false` + `capability_reasons: NO_SECURE_ENDPOINT` + **sin botón y sin handler alcanzable** (no basta ocultar en UI).

---

# Q. Wireframe textual — "Hoy"

```
┌─ Hoy · <Sucursal>            [fecha operativa · tz sucursal] ─┐
│ VENTA        $X / meta $Y (Z%)   ▸ proyección    fuente·hh:mm │
│ RUTAS        12 · 3 sin salir · 7 en curso · 2 cerradas       │
│ CLIENTES     140 prog · 96 visitados · 71 con venta           │
│ PRODUCCIÓN   real vs programa            [capturado, sin validar] │
│ INVENTARIO   PT disponible · MP/envases críticos              │
│ CAJA         pendiente de conciliar · cortes                  │
│ ── ALERTAS PRIORITARIAS (3) ─────────────────────────────────  │
│ 🔴 Ruta 4 sin salida registrada        09:40  ▸ ver           │
│ 🟠 GPS sin señal (2 unidades)          ·      ▸ ver           │
└───────────────────────────────────────────────────────────────┘
```
Cada tile muestra su propio estado. Si un bloque no es evaluable, **lo dice**: no pinta 0 ni "todo bien".

---

# R/V. §3 · SPRINT 0 — REESTRUCTURADO TRAS LA REVISIÓN

> **El plan anterior de cuatro sprints (0·1·2·3) queda ELIMINADO.** Estaba dimensionado sobre los 8 caminos del
> módulo Gerente; el censo posterior encontró **~100 escrituras** (`GERENTE_MATRIZ_ESCRITURAS.md`). Un plan que
> subestima el trabajo en un orden de magnitud no es un plan conservador: es un plan equivocado.
>
> **Sprint 0 es ahora lo único planificado.** Los sprints de producto se replanifican **después** de 0, cuando
> el tamaño real de 0A esté medido y no estimado. No publico un calendario de producto que no puedo sostener.

Sprint 0 se divide en **tres bloques secuenciales** más un **cutover independiente**.

---

## 0A · Seguridad backend COMPLETA

**Alcance:** las ~100 escrituras de la matriz, no solo las del Gerente. Es el bloque grande y el que manda.

| Frente | Contenido | Nº aprox. |
|---|---|---|
| **Identidad** | Migrar a `X-GF-Employee-Token` obligatorio toda escritura que hoy resuelve el actor por `employee_id` del payload | ~60 |
| **Rol** | Exigir rol server-side donde hoy no se exige ninguno (incluye `requisition-*`, `liquidaciones/validate`, `pt/transfer/orchestrate`) | ~40 |
| **Scope** | Derivar sucursal/almacén/planta server-side; dejar de aceptar `company_id`/`warehouse_id`/`shift_id` del cliente como autoridad (§6) | ~50 |
| **Integridad** | Cerrar `qty_received` reescribiendo `qty_issued`, `closed_at` del cliente, `bag_unit_cost` del cliente, `manager_approved` del cliente, `supervisor_employee_id` autodeclarado | 6 puntos |
| **Superficies muertas** | Retirar `dispatch-transfer`, `dispatch-config`, `/api/partner` y la ruta/tarjeta del dashboard BI | 4 |
| **Separación de funciones** | Que el Gerente no apruebe lo que él mismo captura (gastos, requisiciones) | 2 flujos |

**Precondición innegociable:** resolver **AK-1** — `auth="api_key"` degrada a usuario público por defecto
(`os_api.allow_legacy_api_key_fallback` = `"1"`). Mientras eso siga así, endurecer rol y scope es cosmético,
porque la llave no autentica. **Primero se mide su valor real en producción; después se apaga con ventana de
rollback.** Es el primer ticket de 0A, no un detalle de configuración.

**El patrón a extender ya existe en el repositorio** — `supervisor_secure_writes.py` (token-only, doble flag,
scope canónico, advisory lock, checker AST de dominancia) y `pwa_route_suggestions.py:875`. El delta
`781aef65 → 158d302a` lo aplicó dos veces más (`sale-create`, `sale-cancel`) con `SELECT … FOR UPDATE` y
revalidación post-lock. **0A es propagación, no invención.** Eso es lo que lo hace grande pero acotado.

**Criterio de salida:** cero escrituras con identidad por payload · cero escrituras con scope del cliente ·
checker AST extendido a `gf_pwa_admin` y `gf_production_ops` · tests que muerdan (mutación) en cada guard.

---

## 0B · Identidad / rol / cardinalidad / resolvedores

Depende de 0A solo parcialmente; puede correr en paralelo en su mayor parte.

1. **Canonizar `gerente_sucursal`** (§4). `gerente_unidad` pasa a alias resuelto por **un único resolvedor
   central**, unidireccional, aditivo, sin tocar allowlists, apagable por `ir.config_parameter`, con la matriz
   cartesiana de prueba (el diff debe ser exactamente las celdas de `gerente_sucursal`).
2. **`is_gerente_sucursal` → compatibilidad derivada.** Deja de ser fuente; se conserva para no romper los 7
   sitios que lo leen; se prohíbe en código nuevo.
3. **Unificar los 3 resolvedores** de sucursal que hoy recorren el mismo camino (`branch_config_service`,
   `guard`, `pwa_route_suggestions`) detrás de uno solo.
4. **Cardinalidad (§5):** implementar **membresía explícita** y `BranchSelector` *server-authoritative*.
   Diseño 1:N, operación 1:1. **Requiere la decisión de Yamil**, pero la recomendación es implementarla aunque
   la respuesta sea "una sola sucursal".
5. **Propagar el bloque `branch{}` en el login** — aditivo puro. El backend **ya emite**
   `x_analytic_account_id` y la sesión lo descarta; llenarlo **elimina** un round-trip existente.
6. **Nuevos códigos fail-closed:** `BRANCH_SCOPE_AMBIGUOUS`, `BRANCH_NOT_IN_SCOPE`, `BRANCH_REQUIRED`,
   `TZ_UNRESOLVED`, `LOCATION_SCOPE_INCOMPLETE`.
7. **Decidir el modelado de `branch_config` → planta** (§8): hoy **no existe** ninguna relación. Candidato
   natural: colgarla de `gf.plant.config`.

---

## 0C · Corte frontend

Depende de 0A: no se puede cortar el cliente antes de que exista el sustituto server-side.

1. **Migrar los callers a los endpoints guardados.** Empezando por `forecast-unlock` → `/gf/salesops/forecast/unlock`.
   ⚠️ **`forecast-unlock` no se "arregla": se sustituye.** Corregir el `ReferenceError` sin migrar primero
   convierte un defecto latente en una vulnerabilidad activa.
2. **Eliminar `sudo:1` del navegador.** Hoy hay **220 ocurrencias** en `src/lib/api.js` y `sudo:1` es el
   **valor por defecto** de `readModel`/`readModelSorted`. Las 19 rutas `/pwa-prod/*` y `/pwa-sup/*` escriben
   por ORM genérico desde el cliente.
3. **Dejar de declarar éxito sin leer la respuesta** (4 pantallas). `odooJson`/`odooHttp` no lanzan ante
   `{ok:false}` con HTTP 200. Patrón correcto ya implementado en `ScreenGastosAprobar.jsx:91`.
4. **Retirar la ruta y la tarjeta del dashboard BI** (independiente; puede ir antes que todo lo demás).
5. **Corregir la a11y de las pantallas de escritura**: `/gerente/gastos` tiene 4 de 4 inputs sin etiqueta
   accesible y 4 controles bajo el mínimo táctil; ninguna pantalla del rol tiene `<h1>`.

---

## CUTOVER de políticas genéricas — proceso SEPARADO, no un ticket de 0A

> **No se recomienda retirar las políticas genéricas de inmediato.** La recomendación anterior ("kill switch,
> 0 líneas, cierra 4 caminos de golpe") era **imprudente**: `os_api.generic_model_policies` gobierna
> `/get_records_sorted` y `/api/create_update` **para toda la instancia**, no solo para el Gerente. Retirarlo sin
> inventario de consumidores rompe superficies que nadie ha enumerado.

El cutover es un proceso propio, con cuatro fases y su propia ventana:

| Fase | Contenido | Criterio de avance |
|---|---|---|
| **1 · Preflight** | Leer el valor **real** del parámetro en producción (no está en el repo, no tiene CI). Instrumentar `/get_records_sorted` y `/api/create_update` para registrar modelo, campos, app y origen durante una ventana representativa (mínimo un ciclo mensual completo, para capturar cierres). | Log con cobertura suficiente y **ningún consumidor desconocido** apareciendo al final de la ventana |
| **2 · Inventario de consumidores** | Cruzar el log con los callers conocidos: PWA colaboradores, PWA clientes/B2B, KoldField, n8n, integraciones. **Cada modelo y campo permitido debe tener dueño identificado.** | Inventario cerrado y revisado por Sebastián |
| **3 · Migración** | Sustituir consumidor por consumidor por endpoints guardados. **Estrechar la política de forma incremental**, un modelo a la vez, verificando tras cada paso. | Cero tráfico genérico para el modelo retirado durante una ventana de observación |
| **4 · Rollback** | Cada estrechamiento debe poder revertirse **sin deploy** (es un `ir.config_parameter`). Definir de antemano la señal de rollback (errores `model_not_allowed`/`field_not_allowed` en superficies vivas) y quién la vigila. | Procedimiento escrito y probado al menos una vez |

**Dato que favorece el cutover:** en runtime se confirmó **[R]** que la política productiva **ya es estrecha** —
`gf.ops.branch_config` responde `model_not_allowed` y `hr.employee` con campos amplios responde
`field_not_allowed`. Es una contención real y hace el cutover más viable de lo que parecía.

**Dato que obliga a la prudencia:** `_generic_api_policy()` **fusiona** builtins con el parámetro de BD usando
`merged[key] = bool(configured.get(key)) or value` ⇒ **el parámetro solo puede AMPLIAR, nunca restringir**.
Estrechar exige tocar los builtins en código, no solo la configuración. Eso es un deploy, con su propia ventana.

---

## Orden y dependencias

```
  AK-1 (llave que no autentica)  ──►  0A  ──►  0C
                                       │
                       0B ─────────────┤  (paralelo en su mayor parte)
                                       │
        CUTOVER (preflight → inventario → migración → rollback)  ──► corre en paralelo, ventana propia
```

**Los sprints de producto (Hoy, Operación, Ventas, Inventarios, Caja, Rentabilidad) se replanifican al cerrar
0A**, con el tamaño medido. No se publican fechas antes.


# S. Criterios de aceptación transversales
- Cero ORM genérico y cero `sudo` antes del scope en cualquier vista del rol.
- Todo write con capability específica server-side + savepoint + fail-closed.
- `null` nunca se muestra como 0; parcial se rotula parcial; sin datos ≠ "todo bien".
- Ningún total mezcla monedas ni unidades incompatibles.
- Cada vista implementa los 9 estados + retry manual.
- Ninguna vista consume un dato de la lista "no interpretar todavía".

# T. Dependencias
1. **S/N de Yamil** sobre el vocabulario de rol (bloquea todo `gf_saleops`).
2. **Sebastián** para los módulos Odoo (frontera de propiedad).
3. Flags de sucursal (`supervisor_day_control_enabled`, etc.) deben existir para la sucursal piloto.
4. M6/M7 requieren dimensión de sucursal antes de Sprint 3.
5. Mapeo sucursal→planta (hoy inexistente) antes de exponer producción.

# U. Orden de PRs — realineado con 0A/0B/0C

> El orden anterior (PR-A…PR-J) mapeaba a los sprints eliminados y queda **SUPERADO**.
> Solo se enumeran los PRs de Sprint 0. Los de producto se definen al cerrar 0A.

| # | PR | Bloque | Depende de |
|---|---|---|---|
| 1 | **AK-1**: medir y cerrar el fallback de `auth="api_key"` | 0A | — (primero de todo) |
| 2 | Backend: identidad por token en las escrituras de `gf_pwa_admin` | 0A | 1 |
| 3 | Backend: identidad por token + rol en `gf_production_ops` | 0A | 1 |
| 4 | Backend: scope server-side (dejar de aceptar IDs del cliente) | 0A | 2, 3 |
| 5 | Backend: integridad (qty, timestamps, costos, `manager_approved`) + retiro de superficies muertas | 0A | 4 |
| 6 | Backend: resolvedor central de rol + alias `gerente_unidad` + matriz de prueba | 0B | — (paralelo) |
| 7 | Backend: membresía explícita + `branch{}` en login + códigos fail-closed | 0B | 6 · **decisión de Yamil (§5)** |
| 8 | Frontend: migrar callers a endpoints guardados; `forecast-unlock` **se sustituye, no se arregla** | 0C | 2, 4 |
| 9 | Frontend: eliminar `sudo:1` del navegador (220 ocurrencias) | 0C | 8 |
| 10 | Frontend: dejar de declarar éxito sin leer respuesta (4 pantallas) + a11y de escritura | 0C | — (paralelo) |
| 11 | **Retirar ruta y tarjeta del dashboard BI** | 0C | — **(independiente, puede ir primero)** |
| — | **Cutover de políticas genéricas** | proceso propio | ventana propia, 4 fases |

# W. Recomendación S/N

**SÍ al Sprint 0, de inmediato y por separado.** Los 4 hallazgos críticos están en producción y no dependen del
rediseño: son deuda de seguridad activa.

**SÍ al plan completo, condicionado a G-0.** Es viable y sorprendentemente barato **porque Supervisor V2 ya
aterrizó en `main` y su alcance ya es de sucursal**. Pero **no debe construirse ni una pantalla nueva de Gerente
antes de resolver la identidad de sucursal**: cualquier vista montada sobre el `company_id` del navegador nacería
con la misma fuga que hoy estamos reportando.

**NO recomiendo** incluir rentabilidad ni cuadre físico de inventario en el alcance comprometido: M7 no observa
costos y M5 declara `physical_reconciliation:false`. Prometerlos sería vender un número que el sistema no puede
sostener.

---

## Actualizacion documental tras el cierre tecnico y el runtime

Este documento se escribio **antes** de `GERENTE_CIERRE_TECNICO.md` y del anexo runtime. Se conserva integro como
registro, con estas correcciones. **En caso de conflicto, mandan el cierre tecnico y el anexo runtime.**

| # | Lo que decia aqui | Correccion verificada |
|---|---|---|
| 1 | G-0 planteado como "falta identidad de sucursal" | **[R]** El empleado **si tiene `x_analytic_account_id`** y su `branch_config` resuelve. No hay que crear datos: falta **propagarlos** (el login los descarta) y **consumirlos** (los `/pwa-gerente/*` usan el `company_id` del navegador). |
| 2 | `forecast-unlock` descrito como critico activo | **[E]** Esta **roto hoy** por un `ReferenceError` (el handler declara 2 parametros y lee un tercero). Es **latente**, no explotable. El critico **explotable hoy** es `liquidaciones/validate`. |
| 3 | Rentabilidad/M7 y M5 marcados fuera de alcance | Se mantiene, y se **agrava**: M6 y M7 tienen **scope fantasma** (`branch_ids` altera el `scope_key` sin llegar al SQL). No deben usarse por sucursal hasta corregir su manifiesto. |
| 4 | M1-M7 clasificados como "solo M1 viable" | **[E]** Matiz: **M2 tambien es viable** con cambio minimo (su motor ya filtra por sucursal en 7 queries). Ver entregable G del cierre tecnico. |
| 5 | Iframe BI: "aislar o retirar"; se afirmaba riesgo de phishing por login de terceros embebido | **[R]** **Refutado**: Metabase rehusa ser enmarcado, el login **nunca se renderiza** dentro de la PWA. Pero el iframe **no carga nada**: la pantalla esta rota. Refuerza **retirar**. |
| 6 | Plan de sprints 0-3 | Sustituido por el plan de 5 sprints del entregable **L** del cierre tecnico, que incorpora M1/M2 y el cierre del scope fantasma. |

**Pendientes que afectan a este plan:** los dos bloqueos del resumen ejecutivo (viewports 390x844 / 768x1024 /
1366x768, y lectura server-side de planta, timezone y ubicaciones MP/PT/envases).
