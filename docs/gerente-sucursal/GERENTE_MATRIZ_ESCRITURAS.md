# Matriz autoritativa de ESCRITURAS — Gerente · Admin · Producción

**ESTADO: DRAFT PARA REVISIÓN TÉCNICA — dos bloqueos pendientes**
SHAs auditados: PWA `b47f329d` (`origin/main`) · Odoo `158d302a` (delta revisado por Sebastián).
Rama Odoo vigente al cierre: **`244dbfd9`** (18 commits por delante de `158d302a`) — ver `GERENTE_ANEXO_RUNTIME.md` §1.
Leyenda de evidencia: **[E]** estático · **[R]** runtime · **[I]** inferido · **[N]** no ejecutado.

> Este documento **sustituye** las tablas de writes previas de `AUDITORIA_GERENTE_SUCURSAL.md` (§D/E) y
> `GERENTE_CIERRE_TECNICO.md` (§D). Aquellas quedan marcadas como **SUPERADAS**. Ésta es la única matriz vigente.

---

## Cómo leer la matriz

| Columna | Valores |
|---|---|
| **Identidad** | `TOKEN` = `X-GF-Employee-Token` verificado server-side · `PAYLOAD` = el `employee_id` lo elige el cliente · `NINGUNA` = no se resuelve empleado · `API-KEY` = solo la llave de aplicación |
| **Rol** | rol exigido server-side, o `—` si no se exige ninguno |
| **Scope del cliente** | **SÍ** = la sucursal/almacén/ubicación viene del payload · **NO** = se deriva server-side · **parcial** = se deriva pero el cliente puede influir |
| **Payload confiado** | campos que llegan a `create`/`write`/`unlink`/`action_*`/`button_validate` sin validación de autoridad |
| **Consumidor** | pantalla de la PWA que la dispara; `—` = sin consumidor conocido (superficie muerta) |
| **Riesgo** | 🔴 crítico · 🟠 alto · 🟡 medio · 🟢 aceptable |

### Tres hechos estructurales que gobiernan toda la matriz [E]

**AK-1 · `auth="api_key"` no autentica por defecto.** `os_api/controllers/ir_http.py:21-25` sustituye el método
`api_key` de Odoo. Si falta la cabecera **o la llave es incorrecta**, y `os_api.allow_legacy_api_key_fallback`
está activo, la petición se resuelve como el usuario público de consulta:

```python
val = request.env["ir.config_parameter"].sudo().get_param(
    "os_api.allow_legacy_api_key_fallback", "1"          # ← default "1"
)
```

**El default es `"1"` y ningún XML/CSV del repositorio lo apaga** (búsqueda ejecutada: 0 resultados en `--include=*.xml --include=*.csv`).
Su valor real en producción **no es verificable desde el repositorio** — es un `ir.config_parameter`. **[E] + pendiente de verificación en prod.**

**AK-2 · La identidad del actor es un entero del cuerpo JSON.** `gf_pwa_admin/controllers/pwa_admin_api.py:368-374`
y `gf_production_ops/controllers/gf_production_api.py:162-173` resuelven el empleado desde `data["employee_id"]`
cuando no hay cabecera de token. Todo chequeo de rol posterior (`is_gerente_sucursal`, `is_auxiliar_admin`,
`has_group(...)`) se evalúa **sobre el empleado que eligió el cliente**.

**AK-3 · `guard_request` es fail-open en identidad.** `gf_saleops/services/guard.py:337`:
```python
require_token = self._param_bool("gf_salesops.require_employee_token", default=False)
```
Con el flag apagado (default), quien posea el secreto HMAC puede declarar ser cualquier `employee_id`
y hereda su rol **y su sucursal**. Los 4 controllers V2 (token-only) son la excepción, no la regla.

---

## MATRIZ

### Dominio GERENTE — lo que el rol dispara desde su propia superficie

| # | Ruta / operación | Archivo:línea | Identidad | Rol | Scope del cliente | sudo | Payload confiado | Consumidor | Riesgo | Sustituto propuesto |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | `POST /pwa-gerente/forecast-unlock` → **ORM genérico** `gf.saleops.forecast.action_reset_to_draft` | `src/lib/api.js:1655` | NINGUNA (ORM con `sudo:1`) | — | SÍ (`ids` del cliente) | **sí (`sudo:1` desde el navegador)** | `forecast_id` | `/gerente/forecast` | 🔴 **latente — hoy no ejecuta** (ver N1) | `POST /gf/salesops/forecast/unlock` con rol y scope server-side |
| G2 | `POST /pwa-gerente/alerts` (lectura) + 3 rutas `/pwa-gerente/*` | `src/lib/api.js:1578-1670` | — | — | SÍ (`company_id` del navegador) | sí | domain completo | `/gerente` | 🟠 lectura company-wide elegida por el cliente | DTO `gf.branch.manager.*` scoped |
| G3 | `POST /pwa-admin/expense-create` → **ORM genérico** `hr.expense.create` | `src/lib/api.js:1852` · caller `GastosScreenBase.jsx:60` | PAYLOAD | — | **SÍ — `company_id` en un desplegable** | **sí (`sudo:1`)** | `total_amount`, `date`, `payment_mode`, `description`, `product_id` | `/gerente/gastos`, `/admin/gastos` | 🔴 | endpoint guardado con company derivada del `branch_config` |

**N1 — Corrección sustantiva sobre `forecast-unlock` [E, verificado].**
`directGerente` es el **único** de los 18 handlers `direct*` de `api.js` que **referencia `body` sin declararlo**:

```js
async function directGerente(method, path) {        // ← firma sin `body`
  …
  if (path === '/pwa-gerente/forecast-unlock' && method === 'POST') {
    const forecastId = Number(body?.forecast_id || 0)   // ← ReferenceError en modo estricto
```

`api.js` es un módulo ES ⇒ modo estricto ⇒ `body` es un `ReferenceError`. **La escritura no llega nunca al ORM.**
Esto **corrige a la baja** la severidad declarada en la primera ronda de auditoría (donde figuraba como crítico
activo): es un **crítico latente**, no explotado. La consecuencia operativa es la contraria a la tranquilidad:
**arreglar el bug sin migrar primero al endpoint guardado convierte el defecto en la vulnerabilidad.**
No existe ningún test del módulo `gerente`.

---

### Dominio ADMIN — alcanzable por `gerente_sucursal` vía la tarjeta "Admin Sucursal" de `/gerente`

`ScreenGerente.jsx:63` enlaza `/admin`. `registry.js:160` concede al rol los módulos `gerente` **y** `admin_sucursal`.

| # | Ruta / operación | Archivo:línea (backend) | Identidad | Rol | Scope del cliente | sudo | Payload confiado | Consumidor | Riesgo | Sustituto |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `POST /pwa-admin/requisition-approve` | `pwa_admin_api.py:2473` | PAYLOAD | — (solo "solicitante ≠ aprobador") | NO filtra compañía ni sucursal | sí | `id` | `/admin/requisiciones` | 🔴 | rol + scope server-side; separación de funciones |
| A2 | `POST /pwa-admin/requisition-reject` | `:2514` | PAYLOAD | — | NO filtra | sí | `id`, `reason` | `/admin/requisiciones` | 🔴 | idem |
| A3 | `POST /pwa-admin/requisition-cancel` → `purchase.order.button_cancel()` | `:2446` | **NINGUNA** | — | **ninguno** (cualquier compañía) | sí | `id` | modal `/admin/requisiciones` | 🔴 | idem |
| A4 | `POST /pwa-admin/torre/requisition-confirm` → `button_confirm()` | `:2600` | **NINGUNA** | — | **cross-company declarado intencional en el docstring** | sí | `id` | Torre | 🔴 | rol explícito; el cross-company debe ser una capability, no un default |
| A5 | `POST /pwa-admin/requisition-receive` → `button_validate` parcial | `:2686` | PAYLOAD (solo para el chatter) | — | ninguno | sí | **`lines` completo sin validar** | modal recepción | 🔴 | validar líneas contra la orden y el almacén del scope |
| A6 | `POST /pwa-admin/requisition-create` | `:2718` | PAYLOAD | — | **SÍ** (`company_id`, `warehouse_id`, `plaza_analytic_account_id`) | sí | `plaza_id`/`bu_id` sin verificar existencia ni compañía, `lines`, `partner_id` | `/admin/requisiciones` | 🔴 | company/warehouse derivados del `branch_config` |
| A7 | `POST /pwa-admin/liquidaciones/validate` → `action_close_route()` | `:3522` | PAYLOAD | — | **no valida plaza** (a diferencia de `receive-cash`) | sí | `plan_id`, `action` | `/admin/liquidaciones` | 🔴 | rol + scope de plaza server-side |
| A8 | `POST /pwa-admin/liquidaciones/receive-cash` | `:3582` | PAYLOAD | — | tenancy `emp.x_analytic == plan.analytic`, **sobre la identidad elegida por el cliente** | sí | `received_amount`, `denominations` | `/admin/liquidaciones` | 🟠 | identidad por token |
| A9 | `POST /pwa-admin/liquidaciones/authorize-discrepancy` | `:3841` | PAYLOAD | `group_gf_logistics_admin` (grupo real, pero sobre identidad del payload) | ninguno sobre `plan_id` | sí | `plan_id`, `notes` | `/admin/liquidaciones` | 🔴 | identidad por token + scope del plan |
| A10 | `GET+POST /pwa-admin/liquidaciones/detail` → `_ensure_reconciliation(recompute=True)` | `:3441` | NINGUNA | — | ninguno | sí (`create`+`write`) | `plan_id` | `/admin/liquidaciones` | 🟠 **escribe en un GET con `csrf=False`** | separar lectura de recomputo |
| A11 | `POST /pwa-admin/cash-closing` | `:3093` | PAYLOAD | — | **SÍ** (`company_id`, `warehouse_id`, `date`) | sí | `opening_fund`, `denominations`, `close`; el cliente declara esperado **y** real | `/admin/cierre` | 🔴 | esperado derivado server-side |
| A12 | `POST /pwa-admin/cash-closing/authorize` | `:4582` | PAYLOAD | `allow_authorize_cash_closing`/`is_direccion_general` sobre identidad del payload | ninguno sobre `closing_id` | sí | `closing_id`, `auth_level` | `/admin/cierre` | 🔴 | identidad por token + scope |
| A13 | `POST /pwa-admin/cash-closing/reopen` | `:4622` | PAYLOAD | idem | ninguno | sí | `closing_id`, `reason` | `/admin/cierre` | 🔴 | idem |
| A14 | `POST /pwa-admin/expense-approve` | `:1570` | PAYLOAD | `is_gerente_sucursal`/`is_direccion_general` sobre identidad del payload | ninguno sobre `expense_id` | sí | `expense_id` | `/admin/gastos/aprobar` | 🔴 | identidad por token; **separación de funciones** (hoy el gerente aprueba lo que él captura) |
| A15 | `POST /pwa-admin/expense-reject` | `:1601` | PAYLOAD | idem | ninguno | sí | `expense_id`, `reason` | `/admin/gastos/aprobar` | 🔴 | idem |
| A16 | `POST /pwa-admin/expense-attach` | `:4665` | **NINGUNA** | — | ninguno (cualquier `hr.expense`) | sí | `filename`, `base64`, `mime` | `/admin/gastos` | 🔴 | scope sobre el gasto destino |
| A17 | `POST /pwa/evidence/upload` | `:5753` | `_employee()` decorativa | — | ninguno | sí | **`linked_model` + `linked_id` arbitrarios** | varias | 🔴 | allowlist de modelos + scope |
| A18 | `POST /pwa-admin/sale-cancel` (**rama admin**) | `:4735` | **TOKEN** | `allow_cancel_sales` | **rama admin: sin scope sobre `order_id`** (las ramas POS sí revalidan bajo lock) | sí | `order_id`, `reason` | `/admin/ticket/:id` | 🟠 | aplicar `_sale_order_in_employee_scope`, que ya existe y se usa en lectura |
| A19 | `POST /pwa-admin/sale-create` | `:5828` | **TOKEN** | `_require_pos_sale_create_access` | POS: server-side. Admin: `company_id`/`warehouse_id` del payload validados contra el scope | sí | **`manager_approved`** (bandera del cliente que salta el umbral de gerente), `price_unit` por línea | `/admin/pos` | 🟡 | `manager_approved` debe derivarse de una aprobación server-side |
| A20 | `POST /pwa-admin/traspaso-mp/iguala-transfer` | `:4042` | PAYLOAD (`issued_by` gana sobre el autenticado) | — | hardcodes de almacén y línea | sí (`stock.move._action_done()`) | `issued_by`, `qty` **sin cota** | `/admin/traspaso-materia-prima` | 🔴 | ver P-todo: identidad por token + planta derivada |
| A21 | `POST /pwa-supv/tasks/create · update · complete` | `:5391 · :5425 · :5447` | `_employee()` o **NINGUNA** | — | `company_id` del cliente | sí | `assignee_id`, `partner_id`, `patch` (allowlist correcta en `update`) | Supervisión | 🟡 | migrar al patrón V2 token-only |
| A22 | `POST /pwa-supv/notes/create · delete` | `:5503 · :5542` | **`author_id` del payload** (atribución forjable) | — | `company_id` del cliente | sí | `subject_id` sin verificar, `body` | Supervisión | 🟡 | `author_id` del token, como ya hace `supervisor_tasks_notes.py:188` |

**N2 — Cuatro pantallas declaran éxito sin leer la respuesta [E].**
`AdminRequisicionForm.jsx:128/144`, `RequisitionDetailModal.jsx:62` y `AdminLiquidacionesForm.jsx:109` muestran
"✓ aprobada" / "✓ validada" sin comprobar el envelope. `odooJson`/`odooHttp` **no lanzan** ante `{ok:false}` con
HTTP 200 ⇒ el usuario ve éxito aunque el backend rechace. `ScreenGastosAprobar.jsx:91` es la **única** pantalla
que valida correctamente (`applyResponse()`), y sirve de patrón.

---

### Dominio PRODUCCIÓN — alcanzable por Admin/Gerente (4 pantallas cuelgan de `/admin`) y por los roles de planta

Todo el frente vive en `gf_production_ops/controllers/gf_production_api.py` (57 rutas, ~22 de escritura), todas
`auth="api_key"`, `csrf=False`. **Cero locks** (`FOR UPDATE`) en todo el módulo.

| # | Ruta / operación | Línea | Identidad | Rol | Scope del cliente | sudo | Payload confiado | Consumidor | Riesgo | Sustituto |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | `materials/dispatch-transfer` | `:3568` | **NINGUNA** | — | **SÍ** (`warehouse_id`, `material_id`, `destination_key`) | sí (`_action_done()`) | `qty_issued` → movimiento real | `/admin` (indirecto) | 🔴 **y además ROTO** (ver N3) | endpoint con turno, actor y `issue` obligatorios |
| P2 | `materials/settlement/validate` | `:3095` | PAYLOAD | `_assert_material_admin(data)` sobre el empleado del payload | **SÍ** (`settlement_id` o triple libre) | sí | `qty_remaining`, `qty_damaged`, `damage_reason` | `/admin/materiales/validar` | 🔴 | identidad por token + grupos Odoo reales |
| P3 | `materials/settlement/reject` | `:3112` | PAYLOAD | idem | SÍ | sí | `reason` | `/admin/materiales/validar` | 🔴 | idem |
| P4 | `materials/settlement/dispute` | `:3130` | PAYLOAD | idem | SÍ | sí | `reason` + captura parcial | `/admin/materiales/validar` | 🔴 | idem |
| P5 | `materials/settlement/report` | `:3063` | PAYLOAD (solo rama merma) | **rama normal: ninguno** | SÍ | sí | `qty_damaged` … | planta | 🔴 **"reportar = validar"**: `action_report()` deja el registro en `validated` y genera movimientos | separar reportar de validar |
| P6 | `materials/settlement/resolve_rejected` | `:3149` | `request.env.user` | ✅ **grupos Odoo reales** | SÍ | sí | `qty_returned/damaged/consumed` (suma validada) | `/admin/materiales/resolver-rechazo` | 🟡 | **es el único con rol real: sirve de patrón** |
| P7 | `materials/issue/create` | `:2866` | **NINGUNA** | — | **SÍ** (`shift_id`, `line_id`, `material_id`) | sí | `qty_issued`, **`issued_by` = cualquier empleado** | planta | 🔴 | identidad por token |
| P8 | `materials/issue/validate-receipt` | `:2930` | PAYLOAD | — | ubicaciones server-side ✅ | sí | **`qty_received` sobreescribe `qty_issued`** (`:2984`) | planta | 🔴 | el receptor no debe poder reescribir lo entregado |
| P9 | `materials/issue/cancel` | `:3043` | **NINGUNA** | — | SÍ | sí | `issue_id` | planta | 🟠 | identidad + scope |
| P10 | `bags/custody/validate` → crea `gf.employee.bag.debt` | `:3728` | PAYLOAD | — | SÍ | sí | `bags_validated_by_manager` | **`/admin/bolsas/validar`** | 🔴 **genera deuda económica a un empleado sin gerente verificado** | identidad por token + rol de gerente real |
| P11 | `bags/custody/issue` | `:3663` | **NINGUNA** | — | SÍ | sí | **`bag_unit_cost` del cliente** (override del costo del almacén) | `/admin/bolsas` | 🔴 | costo derivado server-side |
| P12 | `bags/custody/declare` | `:3706` | PAYLOAD | — | SÍ | sí | `bags_declared_by_worker` | planta | 🟠 | identidad por token |
| P13 | `production/set-pin` | `:1010` | **NINGUNA** | — | **SÍ (`employee_id`)** | sí | `pin` | planta | 🔴 **reseteo del PIN de cualquier empleado** | endpoint de credenciales aparte, con rol de RR.HH. |
| P14 | `shift/close` | `:958` | **NINGUNA** | — | SÍ | sí | `shift_id` | planta | 🔴 cierre de turno ajeno + movimientos de devolución | identidad + scope de planta |
| P15 | `shift/open` · `shift/start` | `:772 · :760` | **NINGUNA** | — | SÍ | sí | `leader_id`, `operator_ids` | planta | 🟠 (tiene savepoint + unique ✅) | identidad + scope |
| P16 | `shift/operator-close` | `:970` | PAYLOAD | — | SÍ | sí | **`closed_at` del cliente** → timestamp de cierre falsificable | planta | 🔴 | timestamp server-side |
| P17 | `shift/bag-reconciliation` | `:2154` | **NINGUNA** | — | SÍ | sí | `bags_received`, `bags_remaining` | planta | 🔴 | identidad |
| P18 | `shift/current` (**GET**) | `:1074` | NINGUNA | — | `warehouse_id` | sí | — | planta | 🟠 **GET que escribe** (`action_sync_...` en `try/except: pass`) | separar sincronización |
| P19 | `cycle/dump` | `:1121` | `_employee()` | — | SÍ | sí | **`supervisor_employee_id` + `override_reason`**: el cliente declara quién autorizó | planta | 🔴 | autorización server-side |
| P20 | `production/pack` | `:1164` | `_employee()` | — | SÍ | sí | `qty_bags` → postea consumo de MP real | planta | 🔴 | scope de planta |
| P21 | `energy/read` | `:1669` | `_employee()` | — | SÍ | sí | `kwh_value` **sobreescribe** `energy_start_id`/`energy_end_id` | planta | 🔴 falsea kWh/kg y desbloquea el cierre | idempotencia + rol |
| P22 | `haccp/check` | `:1692` | **NINGUNA** | — | SÍ | sí | `result_bool/numeric/text` → `action_complete()` | planta | 🔴 marca HACCP cumplido sin actor | identidad obligatoria (requisito sanitario) |
| P23 | `ice/slot/harvest` | `:1771` | PAYLOAD | — | SÍ | sí | cadena larga (entry + log + posting) | planta | 🔴 | identidad por token |
| P24 | `ice/slot/fill` | `:1759` | `operario_id` del payload | — | SÍ | sí | kwargs reflexivos vía `inspect.signature` | planta | 🟠 | despacho explícito, no reflexivo |
| P25 | `ice/tank/incident` | `:1909` | **NINGUNA** | — | SÍ | sí | `tipo`, `descripcion` → **HTML interpolado sin escapar** en el chatter | planta | 🟠 XSS almacenado | escapar |
| P26 | `bar-harvest-scrap` | `:1517` | `operator_id` del payload | — | **SÍ** (`location_id`, `location_dest_id`) + fallback hardcodeado | sí | `qty_bars`, `kg` | planta | 🔴 merma con ubicaciones elegidas por el cliente | ubicaciones derivadas |
| P27 | `pt/transformation/create` | `:2034` | PAYLOAD | `recipe.role_scope` sobre el empleado del payload; **rama legacy sin `recipe_code` ignora el rol** | SÍ; si no hay turno **lo autocrea** | sí | `outputs[]` libres + `auto_confirm` en la rama legacy | `/admin`, planta | 🔴 | retirar la rama legacy |
| P28 | `pt/reception/create` · `confirm` | `:1352` | PAYLOAD | — | valida pertenencia entry↔turno↔almacén ✅ | sí | `received_qty` | planta | 🟠 **el mejor validado del conjunto** | identidad por token |
| P29 | `production/scrap` · `downtime/start` · `downtime/end` · `incident/*` · `cycle/start` · `cycle/defrost-start` · `haccp/generate` · `pt/transformation/cancel` | `:1499 · :1470 · :1487 · :1615 · :1094 · :1106 · :1731 · :2137` | `_employee()` o NINGUNA | — | SÍ | sí | varios | planta | 🟠 | identidad por token |
| P30 | **11 rutas `/pwa-prod/*`** (`downtime-create`, `scrap-create`, `cycle-create`, `cycle-update`, `packing-create`, `shift-close`, `harvest`, `harvest-with-pt-reception`, `checklist-complete`…) | `src/lib/api.js:3255-4226` | — | — | **SÍ** (`operator_id`, `line_id` resueltos en el navegador) | **sí — `sudo:1` en todas** | modelo, campos y valores completos | módulo Producción | 🔴 **escritura por ORM genérico desde el navegador** | endpoints guardados |
| P31 | **8 rutas `/pwa-sup/*`** (`shift-create`, `downtime-create`, `scrap-create`, `energy-create`, `maintenance-create`, `brine-reading-create`…) | `src/lib/api.js:2890+` | — | — | SÍ | **sí (`sudo:1`)** | idem | módulo Supervisión | 🔴 | idem |

**N3 — `dispatch-transfer` y `dispatch-config` están MUERTOS [E].**
Ambos leen `wh.gf_mp_dispatch_location_rolito_id` / `_pt_id`, y **esos campos no existen en el repositorio**
(`grep -rn "gf_mp_dispatch_location"` → solo las 2 líneas del controlador, ninguna definición). `:3564` produce
`AttributeError` → 500; `:3591` usa `getattr(...,False)` ⇒ **409 `DISPATCH_CONFIG_MISSING` permanente.**
El revisor los listó entre los flujos a censar: quedan censados **y declarados no funcionales**. No los cuentes
como capacidad existente ni como riesgo activo: son deuda rota.

---

### Dominio SALESOPS (`gf_saleops`) — el backend que la PWA de Gerente **no** usa

31 escrituras. Dos familias de seguridad conviven en el mismo módulo: los **4 controllers V2** son token-only con
doble candado y scope canónico (verificados por un checker AST de dominancia); las **21 escrituras de
`main.py`/`supervisor.py`** aceptan identidad por payload porque `require_employee_token` es `False` por defecto (AK-3).

| # | Ruta | Archivo:línea | Identidad | Rol | Scope | sudo | Payload confiado | Riesgo | Nota |
|---|---|---|---|---|---|---|---|---|---|
| S1 | `/gf/salesops/pt/transfer/orchestrate` | `main.py:679` | PAYLOAD | **`None`** | analytic del guard; destino por `cedis_id` del payload | sí | `cedis_id`, `destination_warehouse_id`, `suggested_lines` | 🔴 | **única escritura pesada sin ningún rol exigido**; crea transfer intercompany |
| S2 | **`/gf/salesops/forecast/unlock`** | `main.py:878`, guard `:891` | PAYLOAD | **`"gerente_unidad"`** (string único) | analytic del guard + `_scope_employee_allowed` + estado `confirmed` | sí | `forecast_id`, `date_target`, `employee_id` | 🟠 | **es el sustituto correcto de G1** — pero exige el rol que el Gerente no tiene (§4) |
| S3 | `/gf/salesops/approvals/resolve` | `main.py:2474` | PAYLOAD | `gerente_unidad`, `administrativo` | `target.analytic == aa` ✅ | sí | `approval_ref`, `decision` | 🟠 | decide aprobaciones |
| S4 | `/gf/salesops/pt/confirm` | `main.py:652` | PAYLOAD | `supervisor_ventas` | analytic + company ✅ | sí | `lines`, `date_target` | 🟠 | |
| S5 | `/gf/salesops/forecast/draft/upsert` | `main.py:784` | PAYLOAD | `supervisor_ventas` | analytic + allowlist `cfg.sale_product_ids` ✅ | sí | `lines`, `replace` | 🟡 | |
| S6–S13 | `warehouse/load/driver_confirm · receive_pt/accept · admin/unreserve_stale_pt · load/execute · van_load/create_execute · load/reject · load/update_lines · returns/process` | `main.py:975 · 1015 · 1159 · 1245 · 1443 · 1620 · 1677 · 1779` | PAYLOAD | `almacenista_entregas`, `gerente_unidad`, `chofer` (según ruta) | analytic del guard ✅ | sí | líneas, ids | 🟠 | 8 escrituras de almacén |
| S14–S15 | `exchange/create` · `gift/create` | `main.py:1980 · 2238` | PAYLOAD | `chofer`, `almacenista_entregas`, `gerente_unidad` | analytic ✅ | sí | partner, productos, qty | 🟠 | |
| S16 | `kpi/daily` | `main.py:2535` | PAYLOAD | `supervisor_ventas`, `gerente_unidad`, `administrativo` | analytic ✅ | sí | `recompute` | 🟢 | |
| S17–S20 | `supervisor/v2/forecast/{upsert,confirm,cancel,delete}` | `supervisor.py:723 · 794 · 865 · 895` | PAYLOAD | `supervisor_ventas` | `_find_forecast` compara analytic; en `upsert`, **si `employee_ids` está vacío no restringe** (`:742`) | sí | `lines`, `forecast_id` | 🟠 | `confirm` genera pickings de carga |
| S21 | `supervisor/v2/route_plan/ensure` | `supervisor.py:1152` | PAYLOAD | `supervisor_ventas` | `warehouse_id` viene de `meta` | sí | `route_id`, `polygon_id`, `channel_ids` | 🟠 | crea planes |
| S22–S31 | **4 controllers V2**: `customers/update` · `route_plan/publish` · `forecast/update_lines` · `route_plan/add_customer` · `tasks/{create,update,complete}` · `notes/{create,delete}` | `supervisor_secure_writes.py:142 · 195 · 253 · 344` · `supervisor_tasks_notes.py:64 · 127 · 131 · 170 · 198` | **TOKEN** | `supervisor_ventas` | **canónico fail-closed** (`effective_branch_config_id == cfg.id`), jornada operativa server-side, advisory lock | sí, **después** del guard | allowlist estricta; comandos ORM construidos por el servidor | 🟢 | **Éste es el patrón objetivo. Ya existe, funciona y está probado.** |

### Dominio ORM GENÉRICO / API (`os_api`)

| # | Ruta | Archivo:línea | Identidad | Rol | Scope | sudo | Riesgo | Nota |
|---|---|---|---|---|---|---|---|---|
| O1 | `POST /api/create_update` | `controllers.py:1144` | api-key (o usuario público vía AK-1) | allowlist por modelo | lo que declare la policy | **`allow_sudo` opt-in por modelo** | 🟡 | Fail-closed **por defecto**: `delete` bloqueado incondicionalmente; denylist dura (`account.move*`, `res.users`, `ir.rule`, `auth.api.key`…). **Los dos builtins declaran solo `read`** ⇒ hoy la mutación cae en `model_not_allowed` |
| O2 | `POST /get_records_sorted` | `controllers.py:578` | idem | idem | idem | idem | 🟡 | contraparte de lectura |
| O3 | `POST /api/employee-sign-in` | `employee_login.py:147` | barcode + PIN (con rate-limit) | — | — | sí | 🔴 | **raíz de AK-2**: devuelve la api-key compartida del usuario público a todo empleado sin `user_id` |
| O4 | `POST /api/partner` | `controllers.py:1130` | api-key | — | ninguno | sí | 🟡 | probablemente muerto (usa `request.jsonrequest`, eliminado en Odoo 17+) |

**N4 — El alcance real del ORM genérico no es verificable desde el repositorio [E + pendiente].**
`_generic_api_policy()` (`controllers.py:289`) **fusiona** los builtins con el parámetro de BD
`os_api.generic_model_policies`, y para booleanos hace `merged[key] = bool(configured.get(key)) or value`:
**el parámetro de BD solo puede AMPLIAR, nunca restringir.** El alcance de escritura efectivo es un JSON en
`ir.config_parameter` — sin control de versiones, sin CI, sin revisión. Confirmado en runtime [R] que
`gf.ops.branch_config` y `hr.employee` con campos amplios **sí** están restringidos hoy
(`model_not_allowed` / `field_not_allowed`), lo que indica que la política productiva es estrecha.
**Esto es una contención real y refuerza que el cutover es viable — pero debe medirse, no asumirse.**

---

## Síntesis de la matriz

| Métrica | Valor |
|---|---|
| Escrituras censadas | **~100** (27 `gf_pwa_admin` · ~38 producción · 31 `gf_saleops` · 4 `os_api`) |
| Con identidad verificada server-side (TOKEN) | **13** — los 4 controllers V2 + `sale-create`/`sale-cancel` + `jr-confirm-handover` |
| Con rol server-side sobre una identidad **no** forjable | **~11** |
| Con scope tomado del payload del cliente | **la mayoría** de `gf_pwa_admin` y `gf_production_ops` |
| Que un `gerente_sucursal` puede disparar hoy desde la interfaz | **18 funcionan · 1 rota** (`forecast-unlock`) |
| Escrituras por ORM genérico con `sudo:1` desde el navegador | **19 rutas** `/pwa-prod/*` + `/pwa-sup/*` + gastos + forecast-unlock; **220 ocurrencias de `sudo: 1`** en `src/lib/api.js` |
| Superficies muertas censadas | `dispatch-transfer`, `dispatch-config`, `/api/partner`, `forecast-unlock` |

**No existe BFF.** `vercel.json` es una reescritura transparente a `grupofrio.odoo.com`; `src/lib/api.js`
(9.760 líneas) **es** la lógica de backend ejecutándose en el navegador. Los nombres `/pwa-gerente/*` y
`/pwa-prod/*` son en buena parte **etiquetas del cliente**, no rutas del servidor.

**Patrón transversal más grave para el Gerente:** el rol **aprueba lo que él mismo captura**. Gastos y
requisiciones comparten pantalla y rol, sin separación de funciones, y cuatro de esas pantallas declaran éxito
sin leer la respuesta del servidor.

**Y el patrón correcto ya existe en el repositorio** — `supervisor_secure_writes.py` y
`gf_route_compliance/controllers/pwa_route_suggestions.py:875`. La brecha es de **propagación, no de diseño.**
