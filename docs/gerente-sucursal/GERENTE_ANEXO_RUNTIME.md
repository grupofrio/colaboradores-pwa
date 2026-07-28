# Anexo RUNTIME — auditoría Gerente

> **ESTADO: DRAFT — diseño técnico CERRADO documentalmente. Pendientes trasladados a QA/preflight.**
> Documento de auditoría. **No es una especificación aprobada ni autoriza implementación.**
>
> **Ramas auditadas:** frontend `origin/main` **`674f6646`** · backend `GrupoVeniu/GrupoFrio` **`0a1b80ba`**
> (SHA de referencia del diseno). Punta backend al escribir: `7989492d` — ver §1.3.
>
> **Clasificación de evidencia** — cada afirmación de estos documentos es una de:
> **[E]** verificado estáticamente en código de la rama vigente ·
> **[R]** verificado en runtime con sesión autenticada ·
> **[I]** inferido (razonamiento, no observación directa) ·
> **[N]** no ejecutado / no obtenido.
>
> **Identificadores:** sanitizados por alias. Personas `<E1>` · compañías `<CO-EN>`/`<CO-PT>` ·
> almacén `<WH-SUC>` · cuenta analítica `<AN-SUC>` · sucursal `<SUC-A>`. Ningún ID productivo aparece en claro.
**2026-07-26 · sesión autenticada real · solo lecturas · sin writes**
Complementa `AUDITORIA_GERENTE_SUCURSAL.md`, `GERENTE_DISENO_OBJETIVO_Y_PLAN.md`, `GERENTE_CIERRE_TECNICO.md`.

## §1 · SHAs auditados y DELTA BACKEND DEFINITIVO

| Repo | Rama | SHA | Papel |
|---|---|---|---|
| `grupofrio/colaboradores-pwa` | `origin/main` | **`674f6646`** | punta al cierre |
| `GrupoVeniu/GrupoFrio` | `origin/GrupoFrio` | **`0a1b80ba`** | **SHA de referencia del diseño técnico** |
| `GrupoVeniu/GrupoFrio` | `origin/GrupoFrio` | `7989492d` | punta al momento de escribir (ver §1.3) |

### §1.1 · Delta auditado `158d302a → 0a1b80ba` [E]

**19 commits · 30 archivos · +6.253 / −28.**

| Módulo | Archivos |
|---|---|
| `gf_hr_ops` | **26** |
| `gf_pwa_admin` | 2 |
| `gf_production_ops` | 2 |

### §1.2 · Qué NO cambió — verificado explícitamente

Ningún cambio en:

| Área | Consecuencia |
|---|---|
| `os_api` | El fallback de api-key y el ORM genérico siguen exactamente como se auditaron |
| `gf_saleops` | Las 31 escrituras censadas siguen vigentes sin modificación |
| `os_customer_zones` | El registro canónico de roles no se tocó |
| **Resolvedor compartido de roles** | La precedencia de 4 niveles (§4) sigue intacta |
| **`gf.ops.branch_config`** | El modelo de autoridad no cambió |
| **`generic_model_policies`** | Las políticas genéricas no se tocaron |
| **ORM genérico** | `/get_records_sorted` y `/api/create_update` sin cambios |
| **KOLD M1–M7** | La tabla única de disposición sigue vigente |

⇒ **Todas las conclusiones estructurales del paquete sobreviven al delta.** Lo que el delta añade es una
**superficie nueva** (Asistencias) y dos correcciones de alcance, no un cambio de arquitectura.

### §1.3 · ✅ Tercer delta `0a1b80ba → 7989492d` — RE-AUDITADO

Al verificar las puntas para esta ronda, `origin/GrupoFrio` **ya no está en `0a1b80ba`**: está en **`7989492d`**,
con **70 commits · 56 archivos · +20.919 / −660** por delante. **No es menor y toca áreas de esta auditoría.**

Lo que se observa en ese rango (verificado por nombre de archivo y volumen, **no** auditado en profundidad):

| Cambio observado | Por qué importa aquí |
|---|---|
| **`gf_pwa_admin/controllers/cash_shift_api.py` — controlador NUEVO (1.089 líneas)** | Superficie de rutas **no censada** en la matriz |
| `gf_pwa_admin/controllers/pwa_admin_api.py` **+1.476** | Es el archivo de 27 escrituras de la matriz |
| Modelos nuevos `gf_pos_cash_shift.py` (3.642), `gf_pos_cash_shift_audit.py` (637), `cash_shift_lock.py` | Dominio de caja/turno nuevo |
| Serie de commits **`fix: … liquidaciones …`** (identidad confiable, serialización, locks, handover) | **Ataca directamente las filas A7–A10 de la matriz** |
| `gf_logistics_ops/models/gf_route_plan.py` **+228** | Es donde vive `action_close_route`, el efecto de `liquidaciones/validate` |
| `os_api/controllers/employee_login.py` +12 · `os_customer_zones/models/models_hr.py` +5 | Eje de identidad |

**RE-AUDITADO en esta ronda.** Los indicios se confirmaron: el delta **corrige 10 de 15 filas** del eje Admin.
Liquidaciones (A7–A10) y caja (A11) quedan **cerradas**; A12/A13 cierran identidad y scope pero **siguen sin
lock**; **requisiciones (A1–A6) y gastos (A14–A15) están byte-idénticos y siguen VIGENTES**.

Aporta además el **patrón canónico completo** —token → scope derivado → lock → revalidar bajo el lock— ya
implementado, desplegado y con tests, en `cash_shift_api.py`. **Detalle en `GERENTE_MATRIZ_ESCRITURAS.md`,
sección «RE-AUDITORÍA contra la punta `7989492d`».**

⚠️ **Lo que NO cambió:** `ir_http.py`, las políticas genéricas de `os_api` y `gf_saleops` **no están en el
diffstat** ⇒ la conclusión de seguridad de §9–§10 queda **intacta**.

Origen runtime de la evidencia de sesión: preview `fix/m4-unavailable-safe-state` (= `main` + 3 commits de M4).


## §2 · Mapeo LIVE del gerente (sanitizado, sin PII)

| Dato | Valor real | Cómo se obtuvo |
|---|---|---|
| `employee_id` | `<E1>` (sanitizado) | sesión |
| `role` / `job_key` | `gerente_sucursal` (ambos) | sesión |
| `company_id` | `<CO-EN>` | sesión |
| `warehouse_id` | `<WH-SUC>` | sesión |
| `user_id` (Odoo) | **`false`** — el empleado **no tiene usuario Odoo vinculado** | lectura ORM |
| **`x_analytic_account_id`** | **`<AN-SUC>` — sucursal `<SUC-A>`** | lectura ORM |
| `company_pt_id` de la sucursal | **`<CO-PT>`** | resuelto por `inventory/summary` |
| `company_en_id` de la sucursal | **`<CO-EN>`** | resuelto por `inventory/summary` |
| `gf.ops.branch_config` activo | **EXISTE y resuelve** para `<AN-SUC>` | `get_for(<AN-SUC>)` devolvió OK |
| Ubicaciones PT/entregas/vans | **NO OBTENIBLES por esta vía** (ver hallazgo R3) | — |
| `plant_warehouse_id`, tz, ubicaciones MP/envases | **NO OBTENIDOS** — modelo no expuesto | ver R2 |

### 🟢 R1 — Corrección de peso a favor: **el dato canónico SÍ existe**
El empleado **tiene `x_analytic_account_id` poblado** (`<AN-SUC>` = sucursal `<SUC-A>`) y el `branch_config` de esa analítica
**existe y resuelve correctamente**. La autoridad canónica propuesta en (A) **no requiere crear datos**: la relación
ya está en Odoo. Lo que falla es exclusivamente la **propagación** (el login lo tira) y el **consumo**
(los `/pwa-gerente/*` usan `company_id` del navegador en su lugar).

### R2 — `gf.ops.branch_config` NO es legible por el ORM genérico
Respuesta: `model_not_allowed`. También `hr.employee` está restringido: `fields='all'` → `fields_all_forbidden`,
y un juego de campos amplio → `field_not_allowed`. Solo funciona el juego exacto que ya usa la app
(`id, name, user_id, x_analytic_account_id`).
⇒ **La política genérica es más estrecha de lo que suponía la auditoría estática** para *estos* modelos.
⚠️ Pero §10 muestra que el JSON productivo habilita **54 modelos, 23 con escritura o funciones**: la estrechez
observada aquí es **local, no global**. No debe leerse como contención general ni justificar un corte de golpe;
el cutover va modelo por modelo (ver `GERENTE_DISENO_OBJETIVO_Y_PLAN.md` §3).
⇒ **Consecuencia de método:** el mapeo completo (planta, tz, ubicaciones MP/envases) **no es obtenible desde el
navegador**; requiere odoo-shell o un endpoint guardado. Queda **declarado como no obtenido**, no inferido.

### 🔴 R3 — `inventory/summary` responde OK con TODO vacío (confirmado en vivo)
Llamada real con `analytic_account_id=<AN-SUC>`:
```
status: ok · "Inventory summary listo"
claves: [product_ids, pt, entregas, vans, total_by_product]   ← FALTA "products"
pt:       company_id <CO-PT>, location_ids [], by_product {}
entregas: company_id <CO-EN>, location_ids [], by_product {}
vans:     company_id <CO-EN>, location_ids [], by_product {}, by_mobile []
```
**Confirma en vivo los dos bugs de contrato** que la auditoría estática predijo:
1. **Dos shapes para el mismo endpoint**: falta la clave `products` (rama de early-return).
2. **Ceros silenciosos**: devuelve `ok` con todo vacío porque `cfg.sale_product_ids` está vacío para esta sucursal
   — indistinguible de "no hay stock". Un tile de Gerente construido sobre esto mostraría **0 sin saber que es "sin
   configurar"**.

### 🔴 R4 — El desajuste de rol, PROBADO EN VIVO
`POST /gf/salesops/alerts/today` (roles `supervisor_ventas · gerente_unidad · administrativo`) con la sesión real
del Gerente:
```
status: error · code: FORBIDDEN · "No tienes permisos para esta acción."
```
⇒ **`gerente_sucursal` NO satisface `gerente_unidad`.** Ya no es una inferencia de código: es un rechazo observado.
Y en el mismo barrido, `inventory/summary` (`required_role=None`) **sí respondió OK** — lo que aísla la causa en el
rol, no en el token, el canal ni el scope.

---

## §7 · Iframe BI — runtime (**corrige mi evaluación anterior**)

| Aspecto | Observado |
|---|---|
| `src` final | `https://bi.grupofrio.mx/` — **la raíz del sitio**, sin dashboard, sin query, sin `#params`, sin JWT |
| `sandbox` | **ausente** (confirmado en runtime) |
| `allow` | `fullscreen` |
| `referrerPolicy` / `loading` | ausentes |
| CSP `<meta>` en el documento | **ausente** |
| **Render del iframe** | **FALLA** — icono de documento roto; no muestra nada |
| URL abierta directamente | `bi.grupofrio.mx` → redirige a `/auth/login?redirect=%2F` → **formulario de login de Metabase** |
| Sesión Metabase en este navegador | **ninguna** |

### R5/R6 — VEREDICTO FINAL del dashboard BI (cierra el tema) [R]

**La clasificación de "phishing" queda ELIMINADA del paquete.** No fue un matiz: fue una afirmación mía
incorrecta. Metabase **rehúsa ser enmarcado**, de modo que el formulario de login de terceros **nunca se
renderiza dentro de la PWA**. No hay patrón de phishing, ni potencial ni real. No debe figurar en ninguna
tabla de riesgos de este paquete.

**Resultado final, verificado en runtime:**

| Aspecto | Resultado |
|---|---|
| Render del iframe | **ROTO — no carga** (icono de documento roto; el frame es bloqueado antes de la petición) |
| Fuga de datos observada | **NINGUNA** — no hay fuga cross-branch porque no se carga nada |
| Riesgo activo | **NINGUNO** |
| Naturaleza real | **Peso muerto verificado**: una ruta y una tarjeta que hoy no entregan valor alguno |
| `src` | raíz del sitio BI, sin dashboard, sin query, sin `#params`, sin JWT |
| `sandbox` | ausente — irrelevante, dado que no carga |

**Acción recomendada, en dos tiempos:**
1. **Ahora** — retirar la **ruta** y la **tarjeta** del dashboard. Coste ≈0, sin pérdida funcional, elimina una
   superficie rota de cara al usuario. No requiere Sprint 0.
2. **Después** — sustituirla por la pantalla **"Hoy" nativa**, con scope de sucursal server-side, cuando exista
   la autoridad canónica (§6). El BI embebido no vuelve.

Esta recomendación **no depende** de ningún bloqueo pendiente y puede ejecutarse por separado del resto del plan.

---

## §8 · Auditoría visual — **PARCIAL (1 de 4 viewports)**

### 🟠 TRASLADADO A QA — no bloquea el cierre del diseño técnico
> **No se ejecutó y NO se declara cerrada.** Los tres viewports siguen sin medir; no se inventan resultados.
> **Cambia de categoría, no de estado:** deja de ser bloqueo del diseño (no condiciona autoridad, identidad,
> cardinalidad ni cutover) y pasa a **QA previo a construcción / QA de Sprint 1**, donde sí condiciona la UI.
> Los hallazgos a11y ya medidos @1536 **sí** son evidencia vigente y entran al backlog.
`resize_window` **reporta éxito pero el viewport NO cambia**: pedí 390×844 y `innerWidth` siguió en **1536**
(`outerWidth: 0`, `screen.width: 1536`, `dpr: 1.25`). Se intentó dos veces, en rondas distintas.
**No puedo ejecutar 390×844, 768×1024 ni 1366×768 por esta vía de control.** Lo declaro como **NO EJECUTADO**
en lugar de extrapolar desde el ancho disponible.

### Medido con sesión real @ 1536×695 (≈ desktop ancho)
| Ruta | Overflow horiz. | `<h1>` | Landmarks | Botones | Touch < 44 px | Inputs | Sin label accesible |
|---|---|---|---|---|---|---|---|
| `/gerente` | no | **0** | 1 | 13 | 1 | 0 | 0 |
| `/gerente/gastos` | no | **0** | 1 | 14 | **4** | 4 | **4 de 4** |

**Hallazgos a11y confirmados con sesión real:**
- **Ningún `<h1>`** en las pantallas del rol ⇒ sin encabezado de nivel 1 para lectores de pantalla.
- **1 solo landmark** ⇒ no hay `main` diferenciado de `nav`.
- **El formulario de gastos (pantalla de ESCRITURA) tiene 4 de 4 inputs sin etiqueta accesible** y 4 controles
  por debajo del mínimo táctil de 44 px.

### Consola y red
Sin errores de consola capturados en el barrido. `/gerente/dashboard` no genera petición visible a
`bi.grupofrio.mx` desde el rastreador (el frame es bloqueado antes).

---

## Estado de la sesión
Sesión **eliminada** al cerrar (`localStorage` + `sessionStorage` + cookies del origen).
No se escribieron PIN, tokens ni PII en ningún documento. Sin writes en toda la ronda.


---

## §9 · PARÁMETROS EFECTIVOS DE PRODUCCIÓN — lectura sanitizada [R]

> Lectura realizada por Sebastián y entregada sanitizada. **Cierra el pendiente** que declaraba que estos
> valores "no eran verificables desde el repositorio". Ya no es una inferencia: es configuración efectiva medida.

### Parámetros

| Parámetro | ¿Configurado? | Valor efectivo |
|---|---|---|
| `os_api.allow_legacy_api_key_fallback` | **No** | **Activo por default** |
| `os_api.allow_public_get_records_without_key` | **No** | **Activo por default** |
| `os_api.allow_public_employee_lookup` | **No** | **Activo por default** |
| `os_api.allow_public_route_lookup` | **No** | **Activo por default** |
| `os_api.public_lookup_user_id` | **No** | ID default del código (sanitizado) |
| `os_api.generic_model_policies` | **Sí** | JSON válido — 54 modelos (ver abajo) |
| `gf_salesops.require_employee_token` | **No** | **Desactivado por default** |
| `gf_production_ops.material_stock_enabled` | **Sí** | **Activo** |

**Lectura clave:** los cuatro fallbacks públicos **no están configurados**, y precisamente por eso **están
activos**: su default en código es permisivo. "No configurado" aquí **no** significa "cerrado".

### El usuario de fallback — solo lo verificable, sin datos sensibles

- **Existe.**
- Es **público/compartido**, no nominal.
- Está **inactivo**.
- **No** es administrador.
- Procede del **ID default del código**, no de configuración explícita.
- `ir_http.py` **comprueba existencia, pero NO `active=True`**.

> ⚠️ **Por tanto: no debe asumirse que estar inactivo neutraliza el fallback.** La comprobación que haría de
> `active=False` una contención **no está en el código**. Tratar el estado inactivo como mitigación sería
> exactamente el tipo de suposición que esta auditoría existe para evitar.

*No se registran ID, login, nombre, correo ni credenciales.*

---

## §10 · `os_api.generic_model_policies` — inventario efectivo [R]

| Métrica | Valor |
|---|---|
| Modelos configurados | **54** |
| Permiten **escritura o funciones** | **23** |
| Read-only | **31** |
| Con `allow_sudo = true` | **54 (todos)** |
| Permiten actualización por dominio | **0** |
| Bloqueados por la denylist sensible | **1** (`ir.model.fields`) |
| **Políticas potencialmente utilizables** | **53** |

### Distinción obligatoria de tres capas

| Capa | Qué es | Dónde vive |
|---|---|---|
| **Builtin** | Políticas en código (`_GENERIC_API_BUILTIN_POLICIES`) | repositorio, versionado |
| **JSON productivo** | El parámetro `os_api.generic_model_policies` | `ir.config_parameter`, **sin versionar, sin CI** |
| **Efectiva** | La **fusión** de ambas | runtime |

⚠️ La fusión usa `merged[key] = bool(configured.get(key)) or value` ⇒ **el JSON productivo solo puede AMPLIAR,
nunca restringir un builtin.** Estrechar exige tocar código y desplegar; no basta con editar el parámetro.
**No confundir las tres capas al planificar el cutover.**

### Los 23 modelos con escritura o funciones

| Modelo | Operaciones |
|---|---|
| `gf.energy.reading` | read, create |
| `gf.evaporator.cycle` | read, create, update |
| `gf.haccp.check` | read, create, update |
| `gf.haccp.checklist` | read, create, update, **function** |
| `gf.production.downtime` | read, create, update |
| `gf.production.machine` | read, update |
| `gf.production.scrap` | read, create |
| `gf.production.shift` | read, update, **function** |
| `gf.route.incident` | read, create, update |
| `gf.route.plan` | read, create |
| `gf.saleops.forecast` | read, update, **function** |
| `gf.transformation.order` | read, create |
| `hr.employee` | read, update |
| `hr.expense` | read, create, update |
| `ir.attachment` | read, create |
| `maintenance.request` | read, create |
| `purchase.order` | read, create, update, **function** |
| `purchase.order.line` | read, update |
| `res.partner` | read, update |
| `sale.order` | read, create, update |
| `stock.picking` | read, update |
| `x_ice.brine.slot` | read, update, **function** |
| `x_kold.workflow.run.log` | read, create |

### Funciones genéricas permitidas

| Modelo | Métodos |
|---|---|
| `gf.haccp.checklist` | `action_complete`, `action_generate_from_template` |
| `gf.production.shift` | `action_start_shift` |
| `gf.saleops.forecast` | **`action_reset_to_draft`** |
| `purchase.order` | **`button_cancel`, `button_confirm`** |
| `x_ice.brine.slot` | `action_cosechar` |

> 🔴 **Estas cinco filas explican la matriz de escrituras del cliente.** `action_reset_to_draft` sobre
> `gf.saleops.forecast` es exactamente lo que invoca el `forecast-unlock` del navegador (fila G1), y
> `button_confirm`/`button_cancel` sobre `purchase.order` son las requisiciones. **La superficie de escritura
> del cliente no es un accidente del frontend: está explícitamente habilitada en la política.**

### Los 31 modelos read-only

`account.account` · `account.analytic.account` · `account.analytic.plan` · `gf.cash.closing` ·
`gf.dispatch.reconciliation` · `gf.dispatch.reconciliation.line` · `gf.haccp.check.template` ·
`gf.haccp.template` · `gf.ops.event_log` · `gf.packing.entry` · `gf.production.downtime.category` ·
`gf.production.material` · `gf.production.material.issue` · `gf.production.material.settlement` ·
`gf.production.scrap.reason` · `gf.pwa.requisition` · `gf.route` · `gf.route.stop` · `gf.route.stop.line` ·
`gf.saleops.forecast.line` · `gf.saleops.kpi.snapshot` · `hr.employee.monthly.target` · **`ir.model.fields`** ·
`product.category` · `product.pricelist` · `product.pricelist.item` · `product.product` · `stock.location` ·
`stock.move` · `stock.quant` · `stock.warehouse`

**`ir.model.fields` aparece configurado pero NO es efectivo**: la denylist de modelos sensibles lo bloquea.
Cuenta como política presente, no como acceso concedido.

