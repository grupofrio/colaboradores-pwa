# Matriz autoritativa de ESCRITURAS — Gerente · Admin · Producción

**ESTADO: DRAFT — diseño técnico CERRADO documentalmente.** Pendientes trasladados a QA / preflight de 0A.
**Inventario levantado contra:** PWA `674f6646` (`origin/main`) · Odoo **`0a1b80ba`** — *SHA de referencia del diseño*.
✅ **Punta Odoo `7989492d` YA RE-AUDITADA** (+70 commits): corrige **10 de 15** filas del eje Admin.
**Ver «RE-AUDITORÍA contra la punta `7989492d`» más abajo — manda sobre las tablas de arriba.**
**Este inventario es MANUAL.** Sprint 0A entrega un inventario **generado automáticamente** + control de drift en CI.
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

**El default es `"1"` y ningún XML/CSV del repositorio lo apaga** (búsqueda ejecutada: 0 resultados).
✅ **CONFIRMADO EN PRODUCCIÓN [R]:** el parámetro **no está configurado**, por lo que **está activo por default**.
Ya no es una inferencia. Lo mismo para `allow_public_get_records_without_key`, `allow_public_employee_lookup` y
`allow_public_route_lookup` — los cuatro activos. Ver `GERENTE_ANEXO_RUNTIME.md` §9.

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
| P26 | `bar-harvest-scrap` | `:1517` | `operator_id` del payload | — | **parcial** — el **origen ya NO** es del cliente; el **destino SÍ** | sí | `qty_bars`, `kg`, **`location_dest_id`** | planta | 🟠 **endurecimiento PARCIAL** (ver N5) | destino derivado server-side de planta+sucursal+material+operación autorizada |
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

**N5 — `bar-harvest-scrap`: endurecimiento PARCIAL, no cierre [E].**
El endpoint **ya no acepta efectivamente `location_id` como origen**: fuerza `Virtual Locations/Production` y
solo admite origen de tipo `production` o `internal`.

| Riesgo original | Estado |
|---|---|
| Origen arbitrario elegido por el cliente | ✅ **CORREGIDO** |
| **Destino (`location_dest_id`) sustituible desde el navegador** | 🔴 **PERMANECE** |

⇒ **Endurecimiento parcial.** Media puerta cerrada sigue siendo una puerta: un movimiento de merma cuyo destino
lo elige el navegador puede depositar producto en una ubicación que el operador no debería alcanzar.
**Requisito de cierre:** el destino debe derivarse server-side de **planta + sucursal + material + operación
autorizada**. Entra a 0A con el origen ya resuelto, lo que reduce su tamaño.

---

---

### Dominio ASISTENCIAS (`gf_hr_ops`) — superficie NUEVA del delta `158d302a → 0a1b80ba`

**7 URLs únicas · 8 declaraciones de ruta** (`/pwa-hr/attendance` aparece dos veces: `GET` y `POST`).
Todas: `type="http"`, **`auth="public"`**, `csrf=False`. Archivo: `gf_hr_ops/controllers/pwa_attendance.py`.

**Lecturas (4):**

| Ruta | Método |
|---|---|
| `/pwa-hr/attendance/capabilities` | GET |
| `/pwa-hr/attendance` | GET |
| `/pwa-hr/audit` | GET |
| `/pwa-hr/attendance/export.xlsx` | GET |

**Escrituras (4) — clasificadas 🟡 SEGURAS PERO TRANSITORIAS:**

| # | Ruta | Método | Identidad | Rol | Scope | Estado | Sustituto |
|---|---|---|---|---|---|---|---|
| H1 | `/pwa-hr/attendance` | POST | **token de empleado** ✅ | allowlist específica de gerentes | frontera server-side validada ✅, con **códigos analíticos fijos** | 🟡 transitorio | resolvedor canónico (0B) |
| H2 | `/pwa-hr/attendance/<id>` | PATCH | **token** ✅ | idem | idem | 🟡 transitorio | idem |
| H3 | `/pwa-hr/faltas` | POST | **token** ✅ | idem | idem | 🟡 transitorio | idem |
| H4 | `/pwa-hr/faltas/<id>/justify` | POST | **token** ✅ | idem | idem | 🟡 transitorio | idem |

#### Por qué "seguras **pero** transitorias" — las dos mitades importan

**Seguras, y de verdad:** son las **primeras** escrituras del dominio Admin/RR.HH. que exigen **token de empleado
verificado server-side** y **validan una frontera server-side**. Comparadas con las 30 filas de `gf_pwa_admin`
que resuelven identidad por `employee_id` del payload, son un salto real de calidad. No hay que "arreglarlas".

**Transitorias, y por eso entran a 0B:**

1. **Dependen de una allowlist específica de gerentes**, no del resolvedor canónico de roles. Es una lista
   paralela que hay que mantener sincronizada a mano.
2. **Usan códigos analíticos fijos**, no membresía ni `branch_config`. Funciona hoy porque el alcance es
   conocido; no escala a N sucursales ni respeta la cadena de autoridad de §6.
3. **`auth="public"` + `X-GF-Employee-Token` es un mecanismo de autenticación PARALELO.** Convive con
   `auth="api_key"` (con su fallback) y con `guard_request` (fail-open por defecto). **Son tres mecanismos
   distintos para el mismo problema.** El objetivo de 0B es que converjan a uno.

⇒ **Migración en 0B:** resolvedor canónico de roles · membresía explícita · sucursal derivada del `branch_config` ·
capacidades por acción. **No antes:** tocarlas ahora, mientras el resto del sistema sigue con identidad por
payload, cambiaría lo que ya funciona sin reducir exposición.

> **Nota de método:** estas cuatro filas se documentan a partir del delta revisado y de la declaración de
> Sebastián sobre su comportamiento. Las **declaraciones de ruta** (`auth`, `csrf`, métodos, URLs) están
> **verificadas estáticamente [E]** contra el árbol `0a1b80ba`. La **semántica interna** de la frontera y la
> allowlist procede de la revisión, **no de una re-lectura línea a línea** [I].

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

**N4 — El alcance real del ORM genérico: MEDIDO [R].**
`_generic_api_policy()` (`controllers.py:289`) **fusiona** los builtins con el parámetro de BD
`os_api.generic_model_policies`, y para booleanos hace `merged[key] = bool(configured.get(key)) or value`:
**el parámetro de BD solo puede AMPLIAR, nunca restringir.** El alcance de escritura efectivo es un JSON en
`ir.config_parameter` — sin control de versiones, sin CI, sin revisión. ✅ **Ya medido: 54 modelos, 23 con
escritura o funciones, 31 read-only, todos con `allow_sudo` — ver `GERENTE_ANEXO_RUNTIME.md` §10.**
Confirmado también en runtime [R] que
`gf.ops.branch_config` y `hr.employee` con campos amplios **sí** están restringidos hoy
(`model_not_allowed` / `field_not_allowed`), lo que indica que la política productiva es estrecha.
**Esa estrechez es LOCAL, no global:** el JSON productivo habilita 54 modelos. El cutover es viable, pero va
modelo por modelo (paso 9 de la secuencia), no de golpe.

---

---

# 🔄 RE-AUDITORÍA contra la punta `7989492d` — ticket 0A-01 EJECUTADO

> **Delta re-auditado:** `0a1b80ba → 7989492d` · **70 commits · 56 archivos · +20.919 / −660** [E].
> **Resultado: corrige 10 de 15 filas del eje Admin.** Esta sección **sustituye** el estado de esas filas en la
> matriz de arriba. Donde hay conflicto, **manda esta sección**.

## Estado real de las filas A1–A15

| Fila | Endpoint | ¿Cambió? | Estado ahora | Veredicto |
|---|---|---|---|---|
| **A1–A6** | `requisition-*`, `torre/requisition-confirm` | **NO — cuerpos byte-idénticos** | identidad por `employee_id` del payload · sin scope de plaza · sin lock | 🔴 **VIGENTE** |
| **A7** | `liquidaciones/validate` | **SÍ** | identidad confiable · rol POS-admin **o** `group_gf_logistics_admin` · scope company+warehouse+**analítica** derivado y contrastado contra el plan · `FOR UPDATE` plan→reconciliación · early-return idempotente | 🟢 **CORREGIDA** |
| **A8** | `liquidaciones/receive-cash` | **SÍ** | igual que A7 + `_lock_liquidaciones_cash_plan` + savepoint | 🟢 **CORREGIDA** |
| **A9** | `liquidaciones/authorize-discrepancy` | **SÍ** | identidad confiable + rol + **scope sobre `plan_id`** (antes ausente) + lock de fila | 🟢 **CORREGIDA** |
| **A10** | `liquidaciones/detail` | **SÍ** | **el write desapareció**: `_ensure_reconciliation(recompute=True)` ya no se invoca desde el controlador (2 → 0 ocurrencias). Lectura pura con identidad y scope | 🟢 **CORREGIDA** — residual cosmético: sigue `methods=["GET","POST"]`, `csrf=False` |
| **A11** | `cash-closing` | **SÍ** | **token obligatorio sin fallback** · rol `allow_manage_pos_cash_shifts` · company/warehouse/analítica derivados y **los del cliente rechazados si difieren** · `lock_branch` + `FOR UPDATE` | 🟢 **CORREGIDA** — residual: el cliente sigue declarando `opening_fund`, `other_income`, `other_expense`, `denominations`, `date` (pero `sales_total`/`expenses_total` **sí** son server-side) |
| **A12** | `cash-closing/authorize` | **SÍ** | `_trusted_legacy_cash_scope` · `browse(id)` → `search([id, company_id, warehouse_id])`. **Sin lock, sin idempotencia** | 🟡 **PARCIAL** — identidad y scope corregidos, **lock VIGENTE** |
| **A13** | `cash-closing/reopen` | **SÍ** | idéntico patrón a A12 | 🟡 **PARCIAL** — **lock VIGENTE** |
| **A14** | `expense-approve` | **NO — cuerpo idéntico** | `_resolve_employee(data)` · `browse(expense_id)` **sin filtro de company/warehouse/plaza** | 🔴 **VIGENTE** |
| **A15** | `expense-reject` | **NO — cuerpo idéntico** | igual que A14 | 🔴 **VIGENTE** |

**Lo que esto significa:** el endurecimiento fue **quirúrgico sobre el frente de caja y liquidaciones**, y
**no tocó requisiciones ni gastos**. Cuatro afirmaciones de la matriz quedan **invalidadas** y se retiran:
(a) "las liquidaciones aceptan identidad por payload" · (b) "`liquidaciones/detail` escribe en un GET" ·
(c) "`cash-closing` acepta company/warehouse del cliente" · (d) "no hay locks en las transiciones de efectivo".

⚠️ **Residual de A7–A10:** `_resolve_liquidaciones_employee` **no exige** el token cuando el header está ausente —
cae a `self._employee()` (el empleado ligado al usuario de la api-key). Falla cerrado **solo porque** el scope
exige rol + almacén + plaza coincidentes. Es una superficie más estrecha que A11–A13, que **sí** exigen token
siempre. **Alinearla con A11 es un ticket pequeño, no un rediseño.**

## Superficie NUEVA: `cash_shift_api.py` — 9 rutas (4 escrituras)

`GFPWACashShiftAPI(GFPWAAdminAPI)` · 1.089 líneas · todas `auth="api_key"`, `csrf=False`.

**Lecturas (5):** `active` · `preview` · `history` · `detail` · `operations/status`.
⚠️ `preview` **no escribe**, pero **toma `FOR UPDATE`** sobre la sucursal y la fila del turno: es un GET que
bloquea filas. **Vector de contención, no de escritura** — anotarlo, no ignorarlo.

**Escrituras (4) — 🟢 el estándar más alto del repositorio:**

| Ruta | Identidad | Rol | Scope | Idempotencia / locks |
|---|---|---|---|---|
| `POST /pwa-admin/cash-shifts/open` | **token obligatorio, sin fallback** | `allow_manage_pos_cash_shifts`, **revalidado bajo lock** | 100% server-side; campos de scope del cliente ⇒ `AccessError`; allowlist estricta de claves | **`idempotency_key` obligatoria** + fingerprint SHA-256 del payload + lock de sucursal + revalidación |
| `POST /cash-shifts/close` | idem | idem | idem + `_scoped_shift` | `idempotency_key` + **`expected_version`** (optimistic locking) + `FOR UPDATE` turno/empleado/config |
| `POST /cash-shifts/reopen` | idem | idem | idem | `idempotency_key` + `expected_version ≥ 1` + lock |
| `POST /cash-shifts/authorize` | idem | **doble check**: controlador + dentro del guard bajo lock | idem + `version_id` validado | `idempotency_key` + lock |

**Idempotencia real:** fila `gf.pos.cash.shift.operation` por `(actor, operation, company, warehouse,
idempotency_key)`; misma clave con distinto fingerprint ⇒ conflicto; estado `processing` ⇒ error;
`completed` ⇒ **replay de la respuesta guardada**. Es la **única** familia de endpoints del módulo con
idempotencia auténtica.

## 🟢 EL PATRÓN CANÓNICO A PROPAGAR — ya existe, en producción, con tests

```
  1. token  →  2. scope derivado del empleado  →  3. lock  →  4. revalidar rol y scope BAJO el lock
```

| Helper | Archivo:línea | Cobertura |
|---|---|---|
| `_trusted_scope(employee)` | `models/gf_pos_cash_shift.py:1068` | núcleo: `(employee, company, warehouse, analytic)` derivados |
| `_trusted_cash_scope` | `controllers/cash_shift_api.py:186` | las 9 rutas `cash-shifts/*` — **implementa los 4 pasos** |
| `_trusted_legacy_cash_scope` | `controllers/pwa_admin_api.py:3462` | `cash-closing/*` — llega al paso 2 |
| `_liquidaciones_employee_scope` | `controllers/pwa_admin_api.py:978` | `liquidaciones/*` — 4 pasos sin el paso 1 estricto |
| `_reject_payload_scope` | `controllers/cash_shift_api.py:177` | convierte `company_id`/`warehouse_id`/`analytic_account_id` del cliente en `AccessError` |
| `_lock_and_revalidate_initial_scope` | `models/gf_pos_cash_shift.py:1106` | revalidación **después** del lock |

> **Esto confirma —y refuerza— la tesis del paquete: la brecha es de propagación, no de diseño.**
> El patrón de §6 (autoridad como cadena, nunca IDs del cliente) **ya está implementado y desplegado**.
> Sprint 0A deja de ser "diseñar seguridad" y pasa a ser **"extender un patrón que ya funciona"**.

## Lo que NO cambió en este delta — verificado explícitamente

| Área | Evidencia |
|---|---|
| **`os_api/controllers/ir_http.py`** | **No está en el diffstat.** El fallback de api-key sigue con default `"1"`, igual que los otros tres |
| **Políticas genéricas** | `os_api/controllers/controllers.py` **no está en el diffstat**. Cero cambios en `generic_model_policies`, `/get_records_sorted`, `/api/create_update` |
| **`gf_saleops`** | `git diff --stat` vacío. Las 31 escrituras siguen igual |
| **Rutas de `pwa_admin_api.py`** | **63 en la base, 63 en la punta, diferencia simétrica vacía.** Las +1.476 líneas son endurecimiento y helpers, **no rutas nuevas** |
| **Registro de roles** | Sin rol nuevo en `PWA_ADDITIONAL_ROLE_SPECS`. Se añadió un **permiso**, no un rol: `hr.employee.allow_manage_pos_cash_shifts` (`models_hr.py:312`) |
| **`employee_login.py` (+12)** | Solo el **DTO de respuesta**: añade 3 booleanos de permiso y los normaliza a `bool()`. No toca emisión de token, rate-limit ni api-key compartida |

⇒ **La conclusión de seguridad del paquete (§7) queda intacta:** la cadena de fallbacks públicos y las políticas
genéricas **no se tocaron**. Sigue siendo la prioridad inmediata de 0A.

## Nota sobre `gf_route_plan.py` (+228)

`action_close_route` cambió el gate (exige `corte_validated` y `liquidacion_done_at`) y **eliminó** la llamada
`_try_finalize_reconciliation()`: **cerrar ruta ya no finaliza la conciliación**. Esa transición queda solo en
`action_mark_done()` — lo que dispara `liquidaciones/validate`. **No se añadió identidad ni lock en
`action_close_route`**; los locks viven un nivel abajo, en `gf_dispatch_reconciliation._lock_route_plan_and_reconciliation`
(orden canónico **plan → reconciliación**), que es lo que consume el controlador ya endurecido.

---

## Corrección de alcance en LECTURAS de Admin POS (commit `244dbfd9`) [E]

> **No afecta la matriz de escrituras.** Se registra porque corrige el **diagnóstico de alcance** de tres lecturas.

El commit `244dbfd9` (*restore admin catalog compatibility*) **no agregó rutas**. Modificó tres lecturas:
`GET /pwa-admin/pos-products` · `GET /pwa-admin/customers` · `GET /pwa-admin/default-customer`.

**Qué cambió:** para la política **Admin**, dejó de exigir **coincidencia analítica restringida** y pasó a
resolver por **compañía / almacén**. En consecuencia, **el dominio de clientes queda a nivel compañía.**

**Lectura correcta:** es una **relajación deliberada de alcance** para restaurar compatibilidad del catálogo
Admin, no un defecto. Pero implica que **el alcance efectivo de esas tres lecturas es de compañía, no de
sucursal** ⇒ **no sirven como base para una vista de Gerente con scope de sucursal** sin volver a acotarlas.
Cualquier tile que se apoye en ellas heredaría alcance de compañía.

---

## Síntesis de la matriz

| Métrica | Valor |
|---|---|
| **Fecha / SHA del inventario** | **2026-07-28** · Odoo `0a1b80ba` · PWA `674f6646` · **levantado a mano** |
| Escrituras censadas | **~104** (27 `gf_pwa_admin` · ~38 producción · 31 `gf_saleops` · 4 `os_api` · **4 asistencias**) |
| Con identidad verificada server-side (TOKEN) | **17** — los 4 controllers V2 + `sale-create`/`sale-cancel` + `jr-confirm-handover` + **las 4 de asistencias** |
| Con rol server-side sobre una identidad **no** forjable | **~11** |
| Con scope tomado del payload del cliente | **la mayoría** de `gf_pwa_admin` y `gf_production_ops` |
| Que un `gerente_sucursal` puede disparar hoy desde la interfaz | **18 funcionan · 1 rota** (`forecast-unlock`) |
| **Filas Admin corregidas por el delta `7989492d`** | **10 de 15** — liquidaciones y caja endurecidas; **requisiciones y gastos intactos** |
| Escrituras por ORM genérico con `sudo:1` desde el navegador | **19 rutas** `/pwa-prod/*` + `/pwa-sup/*` + gastos + forecast-unlock; **220 ocurrencias de `sudo: 1`** en `src/lib/api.js` |
| Superficies muertas censadas | `dispatch-transfer`, `dispatch-config`, `/api/partner`, `forecast-unlock` |
| Mecanismos de autenticación **distintos y coexistentes** | **3** — `auth="api_key"` (con fallback público) · `guard_request` (fail-open por default) · `auth="public"` + `X-GF-Employee-Token` |

**No existe BFF.** `vercel.json` es una reescritura transparente a `grupofrio.odoo.com`; `src/lib/api.js`
(9.760 líneas) **es** la lógica de backend ejecutándose en el navegador. Los nombres `/pwa-gerente/*` y
`/pwa-prod/*` son en buena parte **etiquetas del cliente**, no rutas del servidor.

**Patrón transversal más grave para el Gerente:** el rol **aprueba lo que él mismo captura**. Gastos y
requisiciones comparten pantalla y rol, sin separación de funciones, y cuatro de esas pantallas declaran éxito
sin leer la respuesta del servidor.

**Y el patrón correcto ya existe en el repositorio** — `supervisor_secure_writes.py` y
`gf_route_compliance/controllers/pwa_route_suggestions.py:875`. La brecha es de **propagación, no de diseño.**


---

## ⚠️ Este inventario es MANUAL — entregable obligatorio de Sprint 0A

La matriz se levantó **a mano**, leyendo código. Eso tiene dos consecuencias que hay que decir en voz alta:

1. **El conteo es aproximado** (`~104`). No es un número auditado línea a línea: es un censo cuidadoso.
2. **Se desactualiza sola.** Entre `158d302a` y hoy aparecieron **dos deltas** que añaden y modifican rutas.
   Una matriz manual no sobrevive a ese ritmo.

**Entregable de Sprint 0A:**

| Entregable | Qué hace |
|---|---|
| **Inventario generado automáticamente** | Extrae de código todas las `@http.route` con métodos de escritura (POST/PUT/PATCH/DELETE), más `.create/.write/.unlink/action_*/button_validate`, y emite un artefacto versionado |
| **Control de drift en CI** | Falla el build si aparece una ruta de escritura nueva **no registrada** o si cambia `auth`/`csrf`/rol de una existente |

**Por qué es un entregable y no una mejora opcional:** todo el plan de 0A se dimensiona sobre este inventario.
Si el inventario depende de que alguien vuelva a leer 100 endpoints a mano cada vez que la rama avanza, el plan
se vuelve inauditable a las pocas semanas. **La matriz debe dejar de ser un documento y pasar a ser una salida
del build.**

---

## 🔴 CONCLUSIÓN DE SEGURIDAD — prioridad inmediata de Sprint 0A

Con los parámetros efectivos ya medidos [R], la conclusión deja de ser condicional. **Encadenado:**

1. Una llave **ausente o incorrecta** puede ser **aceptada** por `allow_legacy_api_key_fallback`.
2. La solicitud puede **resolverse con el usuario de fallback**.
3. **`/get_records*` mantiene un fallback público independiente** (`allow_public_get_records_without_key`),
   que no se cierra al cerrar el anterior.
4. **`generic_model_policies` permite `sudo` sobre decenas de modelos** — los 54 configurados lo tienen.
5. **23 modelos admiten writes o métodos genéricos**, incluidos `action_reset_to_draft` sobre forecast y
   `button_confirm`/`button_cancel` sobre `purchase.order`.
6. **`gf_salesops.require_employee_token` está apagado por default** ⇒ `guard_request` acepta identidad del payload.

> **Cerrar únicamente `allow_legacy_api_key_fallback` NO resuelve la exposición.** Son rutas independientes que
> se refuerzan entre sí. Un cierre parcial da una falsa sensación de contención — exactamente el patrón que esta
> auditoría existe para evitar.

**Calidad de la evidencia, dicha con precisión:**

| | |
|---|---|
| **No se ejecutaron pruebas ofensivas** | Ninguna. Ni contra producción ni contra ningún entorno |
| **El camino está confirmado por** | **código** (lectura estática de los defaults y de la fusión de políticas) **y configuración efectiva** (lectura sanitizada de producción) |
| **Lo que NO se afirma** | Que exista una explotación demostrada. No se demostró; se documentó la cadena |

Esta distinción no es un matiz defensivo: es la diferencia entre *"esto es explotable"* y *"esto está abierto
por diseño y nadie ha comprobado que no lo sea"*. La segunda basta de sobra para priorizarlo.

**Clasificación: PRIORIDAD INMEDIATA DE SPRINT 0A.** Antes que cualquier endurecimiento de rol o scope, porque
mientras la puerta de autenticación siga abierta, endurecer lo de dentro no reduce exposición.

*No se documentan instrucciones explotables, payloads, credenciales ni pruebas contra producción.*
