# Gerente de Sucursal — capacidades reutilizables, diseño objetivo y plan

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

# R/V. Plan de sprints

## Sprint 0 — Contención + identidad (BLOQUEANTE, ~1 sprint)
1. **Neutralizar los 4 críticos** del módulo Gerente: retirar `forecast-unlock` client-side y cablear el endpoint
   seguro `/gf/salesops/forecast/unlock` (**ya existe**); cerrar `session.sucursal` vacío para que el
   `CompanySelector` deje de ofrecer 3 empresas; eliminar `sudo` desde el navegador en las 4 rutas.
2. **Decidir el vocabulario de rol**: `gerente_sucursal` (PWA) ↔ `gerente_unidad` (`gf_saleops`) hoy son
   incompatibles. Sin esta decisión, nada de `gf_saleops` se puede reutilizar.
3. **D1 · identidad de sucursal** server-side, con soporte multi-sucursal.
4. Corregir `null→0`, la suma de UOM incompatibles y el "Todo opera con normalidad" sin datos.
5. Cerrar `requisition-approve/reject` y `liquidaciones/validate` (hoy **sin verificación de rol** en servidor).

**Aceptación:** ninguna llamada del rol usa ORM genérico ni `sudo`; el alcance no es seleccionable por el usuario;
todo write pasa por endpoint con guard; los ceros falsos desaparecen.

## Sprint 1 — Hoy · Operación · Alertas (~1–1.5 sprints)
D2, D3, D7. Ampliar los 4 puntos de allowlist. Rutas, mapa, posición, cierres, pendientes. **Solo lectura.**
**Aceptación:** las 6 superficies leen DTOs versionados con `data_as_of`; radar declarado "no es tiempo real";
sin acciones de escritura todavía.

## Sprint 2 — Ventas · Inventarios · Producción (~1.5–2 sprints)
D4 (1 línea), D5 (`inventory/summary` + reserved + UOM + merma), D6 (agregado de planta + `data_as_of` +
mapeo sucursal→planta). Corregir el BFF de PT.
**Aceptación:** nunca se suman UOM incompatibles; "disponible" es disponible, no on-hand; producción se muestra
con etiqueta de confianza y sin los indicadores prohibidos.

## Sprint 3 — Caja · Rentabilidad · Planeación de mañana (~2 sprints, con dependencias externas)
Requiere **construir la dimensión de sucursal en M6 y M7** (hoy `branch_dimension:false` en ambos).
**Rentabilidad se presenta como "No evaluable"** con la lista de costos faltantes: M7 está en
`L1_observable_revenue`, sin COGS ni margen, y con 0 tasas FX en la ventana.
Planeación reutiliza M2 + `route_plan/*`, distinguiendo propuesta · borrador · publicada · ejecutable.
**Nunca publicar automáticamente.**

---

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

# U. Orden de PRs sugerido
1. PR-A backend: guard/rol + identidad de sucursal (D1) + cierre de writes sin rol.
2. PR-B frontend: retiro de `sudo`/ORM del módulo Gerente + cableado al endpoint seguro de unlock.
3. PR-C backend: allowlists day-control/radar/route_stops + `supervisor_v2_status`.
4. PR-D frontend: shell de Gerente + Hoy + Operación + Alertas.
5. PR-E backend: D5 inventario (reserved + UOM + merma) · PR-F frontend Inventarios.
6. PR-G backend: D6 producción + mapeo planta · PR-H frontend Producción.
7. PR-I/J: caja y rentabilidad (tras dimensión de sucursal en M6/M7).

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
