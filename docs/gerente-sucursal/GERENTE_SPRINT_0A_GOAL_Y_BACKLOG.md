# Sprint 0A — GOAL y backlog ejecutable

> **ESTADO: DRAFT — propuesta de backlog.** No autoriza implementación. Requiere S/N de Yamil.
> **Ramas de referencia:** PWA `674f6646` · Odoo `0a1b80ba` (punta al escribir: `7989492d`).
> Evidencia: **[E]** estático · **[R]** runtime · **[I]** inferido · **[N]** no ejecutado.

---

## GOAL

> **Reducir la exposición de escritura del ecosistema sin romper un solo consumidor.**

Dos mitades, ambas obligatorias. Un sprint que reduzca exposición y rompa la operación ha fallado; uno que no
rompa nada y no reduzca exposición, también.

**Formulado como resultado observable:** al cerrar 0A, ninguna escritura crítica acepta identidad, rol ni
alcance enviados por el cliente; y el inventario que lo demuestra **se genera solo** y falla en CI si alguien
abre una puerta nueva.

### Por qué 0A antes que cualquier otra cosa

La cadena está confirmada por código y por configuración efectiva medida [R]: una llave ausente o incorrecta
puede aceptarse, la petición puede resolverse con el usuario de fallback, `/get_records*` tiene un fallback
público **independiente**, las políticas genéricas permiten `sudo` sobre 54 modelos —23 con escritura o
funciones— y `require_employee_token` está apagado por default.

**Mientras la puerta de autenticación siga abierta, endurecer lo de dentro no reduce exposición.** Por eso 0A
precede a 0B y 0C, y por eso su primer épico no es un endpoint: es la llave.

---

## ALCANCE

| # | Incluido |
|---|---|
| 1 | Instrumentación de tráfico y consumidores reales (**medir antes de tocar**) |
| 2 | Inventario **automático** de rutas de escritura + control de drift en CI |
| 3 | Cierre de la cadena de autenticación: fallback de api-key, fallback público de `/get_records*`, `require_employee_token` |
| 4 | Identidad por token en las escrituras que hoy la toman del payload |
| 5 | Rol server-side en las escrituras que hoy no exigen ninguno |
| 6 | Alcance derivado server-side (dejar de aceptar `company_id`/`warehouse_id`/`shift_id` del cliente) |
| 7 | Integridad de campos que hoy el cliente puede falsear |
| 8 | Separación `report` / `validate` en settlement de materiales |
| 9 | Retiro de superficies muertas |
| 10 | Reducción incremental de `generic_model_policies` |

## NO-ALCANCE

| # | Excluido | Por qué |
|---|---|---|
| 1 | **Pantallas nuevas de Gerente** | No se construye UI sobre autoridad que aún no existe |
| 2 | **Canonización de rol, membresía y `BranchSelector`** | Es **0B** |
| 3 | **Retiro del ORM genérico del navegador y `sudo:1`** | Es **0C** (depende de que existan los sustitutos) |
| 4 | **Migración de las 4 rutas de Asistencias** | Son seguras hoy; migran en 0B al resolvedor canónico |
| 5 | **M1–M7** | Disposición ya cerrada; no se toca en 0A |
| 6 | **Auditoría visual responsive** | QA previo a construcción / QA Sprint 1 |
| 7 | **Rotación de credenciales** | Riesgo operacional separado, requiere autorización propia |
| 8 | **Cualquier cambio de producción sin S/N** | — |

---

## ÉPICAS

| Épica | Nombre | Depende de |
|---|---|---|
| **E0** | Preflight: medir antes de tocar | — |
| **E1** | Cerrar la cadena de autenticación | E0 |
| **E2** | Identidad por token en escrituras | E1 |
| **E3** | Rol y alcance server-side | E2 |
| **E4** | Integridad de campos falseables | E2 |
| **E5** | Separación report/validate en settlement | E2 |
| **E6** | Retiro de superficies muertas | — (independiente) |
| **E7** | Reducción de `generic_model_policies` | E1, E2, E3 |

---

## TICKETS VERTICALES PRIORIZADOS

Cada ticket = **un PR vertical** con pruebas y rollback. Prioridad P0 > P1 > P2.

### E0 · Preflight

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-01** | **Re-auditar las filas A7–A13 contra la punta `7989492d`** | **P0** | 🔴 **Primero de todo.** Hay 70 commits de *liquidaciones* y *cash shift* sin auditar, más un controlador nuevo (`cash_shift_api.py`, 1.089 líneas). **Puede que parte del riesgo ya esté mitigado.** Escribir tickets para reparar lo ya reparado sería el error simétrico al que esta auditoría vino a evitar |
| **0A-02** | Instrumentar `/get_records_sorted` y `/api/create_update`: modelo, campos, app, origen | **P0** | Ventana mínima: **un ciclo mensual completo** (para capturar cierres) |
| **0A-03** | Instrumentar el fallback de api-key: cuántas peticiones llegan sin llave o con llave inválida, y de quién | **P0** | Es la medición que dimensiona E1 |
| **0A-04** | **Inventario automático de rutas de escritura** (`@http.route` POST/PUT/PATCH/DELETE + `create/write/unlink/action_*/button_validate`) | **P0** | Sustituye el censo manual |
| **0A-05** | **Control de drift en CI**: falla si aparece una ruta de escritura no registrada o cambia `auth`/`csrf`/rol | **P0** | Sin esto, la matriz se vuelve a desactualizar |
| **0A-06** | Inventario de consumidores por dominio (PWA colaboradores, clientes/B2B, KoldField, n8n, integraciones) | P1 | Cada modelo y campo permitido debe tener **dueño identificado** |

### E1 · Cadena de autenticación

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-07** | Activar `gf_salesops.require_employee_token` | **P0** | Aditivo y reversible ⇒ va **antes** que los cierres de fallback |
| **0A-08** | Desactivar `os_api.allow_legacy_api_key_fallback` | **P0** | Solo tras 0A-03 y con consumidores migrados |
| **0A-09** | Desactivar `os_api.allow_public_get_records_without_key` | **P0** | **Ruta independiente**: no se cierra con 0A-08 |
| **0A-10** | Desactivar `allow_public_employee_lookup` y `allow_public_route_lookup` | P1 | Cuando sus consumidores estén migrados |
| **0A-11** | Retirar el usuario de fallback | P1 | ⚠️ `ir_http.py` comprueba existencia, **no `active=True`** ⇒ **estar inactivo NO lo neutraliza** |

### E2 · Identidad por token

| ID | Ticket | P | Dominio |
|---|---|---|---|
| **0A-12** | Requisiciones: `approve`, `reject`, `cancel`, `torre/confirm`, `receive`, `create` | **P0** | Admin |
| **0A-13** | Liquidaciones: `validate`, `receive-cash`, `authorize-discrepancy` | **P0** | Admin — **sujeto a 0A-01** |
| **0A-14** | Caja: `cash-closing`, `authorize`, `reopen` | **P0** | Admin — **sujeto a 0A-01** |
| **0A-15** | Gastos: `expense-approve`, `expense-reject`, `expense-attach` | **P0** | Admin |
| **0A-16** | Producción · materiales: `settlement/{validate,reject,dispute}`, `issue/{create,validate-receipt,cancel}` | **P0** | Planta |
| **0A-17** | Producción · turno: `shift/{open,start,close,operator-close,bag-reconciliation}` | P1 | Planta |
| **0A-18** | Producción · bolsas: `custody/{issue,declare,validate}` | **P0** | Genera **deuda económica** a un empleado |
| **0A-19** | Producción · resto: `pack`, `energy/read`, `haccp/check`, `cycle/dump`, `ice/*`, `scrap`, `downtime` | P1 | Planta |
| **0A-20** | `POST /api/production/set-pin` | **P0** | Resetea el PIN de **cualquier** empleado, sin identidad |
| **0A-21** | `POST /pwa/evidence/upload` | **P0** | `linked_model`/`linked_id` arbitrarios ⇒ allowlist de modelos |
| **0A-22** | `/pwa-supv/tasks/*` y `/pwa-supv/notes/*` (incl. `author_id` forjable) | P2 | Patrón ya resuelto en `supervisor_tasks_notes.py` |

### E3 · Rol y alcance server-side

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-23** | `POST /gf/salesops/pt/transfer/orchestrate` | **P0** | **`required_role=None`** y crea transfer intercompany con `sudo` |
| **0A-24** | Derivar alcance server-side en `gf_pwa_admin` (dejar de aceptar `company_id`/`warehouse_id`) | **P0** | Regla §6 |
| **0A-25** | Derivar alcance server-side en `gf_production_ops` (planta desde el turno, no del payload) | **P0** | Bloqueado por el **modelo puente N:M sucursal–planta** (0B) |
| **0A-26** | `sale-cancel` rama admin: aplicar `_sale_order_in_employee_scope` (ya existe, se usa en lectura) | P1 | Corrección de una línea, alto valor |
| **0A-27** | `liquidaciones/detail`: separar lectura de recomputo (hoy **escribe en un GET** con `csrf=False`) | P1 | **Sujeto a 0A-01** |
| **0A-28** | Separación de funciones: que el Gerente no apruebe lo que él mismo captura (gastos, requisiciones) | **P0** | Control interno, no solo técnico |

### E4 · Integridad de campos falseables

| ID | Ticket | P | Campo |
|---|---|---|---|
| **0A-29** | `qty_received` deja de sobrescribir `qty_issued` en `issue/validate-receipt` | **P0** | El receptor reescribe lo entregado |
| **0A-30** | `closed_at` derivado server-side en `shift/operator-close` | **P0** | Timestamp de cierre falsificable |
| **0A-31** | `bag_unit_cost` derivado del almacén, no del cliente | **P0** | El cliente fija el costo de la deuda |
| **0A-32** | `manager_approved` derivado de una aprobación server-side en `sale-create` | **P0** | Bandera del cliente que salta el umbral de gerente |
| **0A-33** | `supervisor_employee_id` / `override_reason` en `cycle/dump`: autorización server-side | P1 | El cliente declara quién autorizó |
| **0A-34** | `bar-harvest-scrap`: **destino** derivado server-side (planta+sucursal+material+operación) | P1 | Origen ya corregido ⇒ ticket reducido |
| **0A-35** | `energy/read`: idempotencia (hoy sobrescribe `energy_start_id`/`energy_end_id`) | P1 | Falsea kWh/kg y desbloquea el cierre |
| **0A-36** | `ice/tank/incident`: escapar HTML del chatter | P2 | XSS almacenado |

### E5 · Settlement

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-37** | Separar `report` de `validate`: operador `draft→reported` **sin movimientos**; gerente/admin `reported\|disputed→validated` **con movimientos** | **P0** | `material_stock_enabled=1` **activo** ⇒ hoy `report` mueve stock real |
| **0A-38** | Validación **atómica e idempotente** + locks (el módulo hoy no tiene **ninguno**) | **P0** | — |
| **0A-39** | Migración de datos: registros en estado inconsistente por el comportamiento híbrido | P1 | Requiere censo previo |

### E6 · Superficies muertas (independiente, puede ir primero)

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-40** | Retirar ruta y tarjeta de `/gerente/dashboard` | P1 | Coste ≈0, no depende de nada, hoy no entrega valor |
| **0A-41** | Retirar `dispatch-transfer` legacy y **corregir** `dispatch-config` con planta canónica + `gf_mp_dispatch_key` | P1 | Hoy: 409 permanente por campos inexistentes |
| **0A-42** | Retirar `/api/partner` | P2 | Usa `request.jsonrequest`, eliminado en Odoo 17+ |

### E7 · Políticas genéricas

| ID | Ticket | P | Notas |
|---|---|---|---|
| **0A-43** | Reducir `generic_model_policies` **modelo por modelo y operación por operación** | P1 | ⚠️ El JSON productivo **solo puede AMPLIAR** (fusión con `or`) ⇒ estrechar exige tocar builtins y desplegar |
| **0A-44** | Prioridad dentro de E7: los 5 modelos con **funciones** (`action_reset_to_draft`, `button_confirm`, `button_cancel`, `action_complete`, `action_cosechar`) | P1 | Son los que explican la superficie de escritura del cliente |

---

## DEPENDENCIAS CON 0B

| 0A necesita de 0B | Impacto |
|---|---|
| **Modelo puente N:M sucursal–planta** | **Bloquea 0A-25.** Sin él no hay autoridad para responder *"¿esta sucursal puede tocar esta planta?"* |
| **Resolvedor canónico de rol** | 0A puede exigir *un* rol; la **canonización** (`gerente_sucursal` + alias) es 0B |
| **Membresía explícita** | 0A deriva alcance de lo que hoy existe; la fuente única es 0B |

| 0B necesita de 0A | Impacto |
|---|---|
| Identidad por token generalizada | Sin ella, canonizar el rol no cambia quién puede actuar |
| Inventario automático | 0B debe saber qué migra |

> **Regla de secuencia:** 0A **no espera** a 0B salvo en 0A-25. Ambos avanzan en paralelo y se encuentran en 0C.

---

## CRITERIOS DE ACEPTACIÓN

| # | Criterio | Verificable por |
|---|---|---|
| 1 | **Cero** escrituras críticas resuelven identidad desde el payload | inventario automático + checker AST |
| 2 | **Cero** escrituras críticas aceptan `company_id`/`warehouse_id`/`shift_id`/`analytic_account_id` del cliente como autoridad | checker + tests |
| 3 | Toda escritura crítica exige rol server-side | checker |
| 4 | El inventario de rutas **se genera solo** y el drift **rompe el build** | CI |
| 5 | `require_employee_token` activo; fallbacks de api-key y `/get_records*` cerrados | configuración + telemetría |
| 6 | `report` no produce movimientos de inventario | test de integración |
| 7 | Validación de settlement atómica e idempotente | test de concurrencia |
| 8 | **Ningún consumidor conocido roto** | telemetría de errores + inventario de consumidores |
| 9 | Superficies muertas retiradas | inventario |

---

## PRUEBAS MÍNIMAS

| Tipo | Requisito |
|---|---|
| **Mutación de guard** | Quitar el guard debe **romper** el test. Un test que pasa con y sin guard no prueba nada |
| **Fail-closed** | Sin token, con token de otro empleado, con alcance ajeno ⇒ error explícito, **nunca** degradación silenciosa |
| **Concurrencia** | Doble validación simultánea de settlement y de liquidación no debe duplicar movimientos |
| **Idempotencia** | Reintento de cada escritura crítica no duplica efectos |
| **Contrato** | El envelope de error es estable y el cliente **no** puede confundirlo con éxito (hoy 4 pantallas lo hacen) |
| **Regresión de consumidores** | Smoke por dominio antes y después de cada corte |

**Patrón ya existente a reutilizar:** el checker AST de dominancia de guards de `gf_saleops` — se extiende a
`gf_pwa_admin` y `gf_production_ops` en lugar de escribir uno nuevo.

---

## TELEMETRÍA

| Señal | Para qué |
|---|---|
| Peticiones **sin llave** o con **llave inválida** aceptadas por el fallback | dimensiona 0A-08; debe llegar a **0** antes del corte |
| Peticiones a `/get_records*` **sin llave** | dimensiona 0A-09 |
| Uso de `generic_model_policies` por **modelo y operación** | dimensiona E7; identifica políticas muertas |
| Escrituras con `employee_id` de payload divergente del token | mide el avance de E2 |
| Errores `model_not_allowed` / `field_not_allowed` en superficies vivas | **señal de rollback** |
| Errores 4xx/5xx por dominio, antes/después de cada corte | detecta consumidores rotos |

---

## PREFLIGHT (antes de cada corte)

1. Telemetría del paso **en cero** durante la ventana de observación.
2. Consumidores del paso **identificados y migrados** (sin "desconocidos" en el log).
3. Rollback **escrito y probado** al menos una vez.
4. Smoke de dominio **verde**.
5. Ventana acordada, con responsable de vigilancia nombrado.

---

## ROLLBACK

| Tipo de cambio | Mecanismo | Sin deploy |
|---|---|---|
| Fallbacks y `require_employee_token` | `ir.config_parameter` | ✅ sí |
| `generic_model_policies` (**ampliar**) | `ir.config_parameter` | ✅ sí |
| `generic_model_policies` (**estrechar**) | requiere tocar builtins | ❌ **no** — deploy |
| Guards en controllers | revert del PR vertical | ❌ deploy |

> ⚠️ **La asimetría importa:** ampliar la política se revierte solo; **estrecharla no**. Por eso E7 va modelo a
> modelo y al final, con ventana propia. Y por eso cada PR es vertical: revertir uno no debe arrastrar a otro.

---

## SECUENCIA DE CUTOVER

La de `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` §3, resumida:

```
1 instrumentar → 2 inventario → 3 endpoints seguros → 4 migrar consumidores
→ 5 require_employee_token → 6 legacy_api_key_fallback → 7 public_get_records
→ 8 public_employee/route_lookup → 9 policies (modelo a modelo) → 10 usuario fallback
→ 11 ORM genérico/sudo/legacy       [ 12 preflight+telemetría+rollback+observación en CADA corte ]
```

---

## RIESGOS

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Romper un consumidor no inventariado** | E0 antes que todo; ventana de observación; rollback sin deploy en los pasos 5–8 |
| 2 | **Trabajar sobre un diagnóstico obsoleto** (70 commits sin auditar) | **0A-01 es el primer ticket** |
| 3 | **Falsa sensación de contención** por cerrar solo un fallback | Los pasos 5–9 se tratan como **un** objetivo, no como cinco opcionales |
| 4 | Estrechar políticas sin rollback rápido | E7 al final, modelo a modelo, con deploy planificado |
| 5 | Un PR monolítico irreversible | PRs verticales obligatorios |
| 6 | Tests que no muerden | Mutación obligatoria en el criterio de aceptación |
| 7 | El inventario vuelve a ser manual | Drift en CI (0A-05) es P0, no mejora opcional |
| 8 | 0A-25 bloqueado por 0B | Se planifica explícitamente; no se descubre a mitad del sprint |

---

## DEFINICIÓN DE TERMINADO

0A está terminado cuando:

1. Los **9 criterios de aceptación** pasan.
2. El inventario automático está en CI y el drift rompe el build.
3. Los pasos 5–9 del cutover están ejecutados **o** explícitamente diferidos con motivo escrito.
4. **Ningún consumidor conocido está roto**, verificado por telemetría, no por ausencia de quejas.
5. Cada PR vertical tiene pruebas que muerden y rollback probado.
6. La matriz de escrituras **se genera sola** y coincide con el código.
7. Lo diferido está **escrito**, no olvidado.

---

## SIN FECHAS — deliberadamente

**No se proponen fechas de entrega.** Se fijan cuando 0A-01…0A-06 hayan medido:

| Qué medir | Por qué condiciona el plan |
|---|---|
| **Tráfico real** | Determina si los fallbacks se pueden cerrar en semanas o en meses |
| **Consumidores efectivos** | Cada consumidor no inventariado es trabajo no estimado |
| **Rutas afectadas** | El censo manual dice `~104`; el automático dará el número real |
| **Políticas efectivamente usadas** | De las 53 utilizables, las muertas se retiran sin migración |
| **Esfuerzo por dominio** | Admin, producción y salesops no tienen el mismo coste por endpoint |

Publicar fechas antes de esa medición sería repetir el error que llevó al plan de cuatro sprints: **estimar
sobre una superficie cuyo tamaño no se conocía.**
