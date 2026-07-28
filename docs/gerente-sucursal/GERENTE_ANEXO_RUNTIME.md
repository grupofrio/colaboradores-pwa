# Anexo RUNTIME — auditoría Gerente

> **ESTADO: DRAFT PARA REVISIÓN TÉCNICA — dos bloqueos pendientes.**
> Documento de auditoría. **No es una especificación aprobada ni autoriza implementación.**
>
> **Ramas auditadas (actualizado tras la revisión de Sebastián):** frontend `origin/main` **`b47f329d`** ·
> backend `GrupoVeniu/GrupoFrio` **`158d302a`** (delta revisado), rama vigente al cierre **`244dbfd9`**.
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

## §1 · SHAs auditados y AUDITORÍA DEL DELTA BACKEND

| Repo | Rama | SHA auditado | SHA anterior | Δ |
|---|---|---|---|---|
| `grupofrio/colaboradores-pwa` | `origin/main` | **`b47f329d`** | `71e00e9f` | **+3 commits** |
| `GrupoVeniu/GrupoFrio` | `origin/GrupoFrio` | **`158d302a`** (delta revisado) | `781aef65` | **+8 commits** |
| `GrupoVeniu/GrupoFrio` | `origin/GrupoFrio` | **`244dbfd9`** ← *vigente al cierre* | `158d302a` | **+18 commits más** |

### 🔴 Salvedad de encuadre — el delta revisado ya no es la punta [E]
La revisión ancla en `158d302a`, pero `origin/GrupoFrio` **ya avanzó 18 commits más** (asistencias de dos sucursales +
`fix(pos): restore admin catalog compatibility`). Auditamos el delta pedido y **declaramos que existe un segundo
delta no auditado**. Ninguna conclusión de este paquete debe darse por vigente contra `244dbfd9` sin re-verificar.

### Delta `781aef65 → 158d302a` — 8 commits, 12 archivos, +6.297/−333 [E]

| Archivo | Δ | Relevancia para Gerente |
|---|---|---|
| `gf_pwa_admin/controllers/pwa_admin_api.py` | **+1.337** | **Alta** — es el archivo donde viven 27 escrituras de Admin |
| `gf_pwa_admin/models/day_pos_configuration_lock.py` | **+230 (nuevo)** | Media — introduce el patrón de bloqueo por rama |
| `gf_pwa_admin/tests/*` (2 archivos) | +4.980 | Alta — evidencia de que el rigor es alcanzable |
| **`os_customer_zones/models/pwa_job_key.py`** | **+1** | **Alta — toca el registro canónico de roles** |
| `os_customer_zones/models/models_hr.py`, `views_hr.xml`, `tests/` | +23 | Alta — mismo eje de identidad |
| `os_api/tests/test_employee_signin_security.py` | +54 | Media |
| 2 `__manifest__.py` | +2 | — |

**Qué cambió exactamente en el registro de roles:**
```python
 PWA_ADDITIONAL_ROLE_SPECS = (
     ("pwa_extra_operador_barra", "operador_barra"),
     ("pwa_extra_operador_rolito", "operador_rolito"),
+    ("pwa_extra_pos_diurno", "pos_diurno"),
```
Se añadió **un rol nuevo (`pos_diurno`)** por la vía canónica `pwa_extra_*`. Esto **confirma empíricamente**
que el mecanismo propuesto en §4 para `gerente_sucursal` es el que el equipo ya usa en producción: no es una
propuesta teórica, es el camino vigente.

### Qué conclusiones SOBREVIVEN al delta

| Conclusión previa | ¿Sobrevive? | Evidencia |
|---|---|---|
| `requisition-approve/reject` sin rol server-side | ✅ **Sobrevive** | 0 ocurrencias de esas rutas en el diff |
| `liquidaciones/validate` sin rol server-side | ✅ **Sobrevive** | 0 ocurrencias en el diff |
| Identidad por `employee_id` del payload | ✅ **Sobrevive** | el delta no tocó `_resolve_employee` |
| `gerente_sucursal` ≠ `gerente_unidad` | ✅ **Sobrevive y se refuerza** | el delta añade un rol por `pwa_extra_*`, sin tocar las allowlists de `gf_saleops` |
| G-0: el Gerente carece de identidad de sucursal | ✅ **Sobrevive** | sin cambios en el eje de sucursal |
| Sprint 0 sigue siendo bloqueante | ✅ **Sobrevive** | ninguna de las ~100 escrituras de la matriz fue cerrada por el delta |

### Qué cambia el delta (y obliga a corregir el documento)

1. **El delta NO añade ni una sola `@http.route`** — es endurecimiento de rutas preexistentes (`sale-create`,
   `sale-cancel`, lectores POS) más un modelo de bloqueo por rama.
2. **`sale-create`/`sale-cancel` pasan a ser las rutas mejor guardadas del módulo**: token de sesión obligatorio,
   política POS derivada server-side, `SELECT … FOR UPDATE` sobre 7 tablas, invalidación de caché y
   **revalidación completa del scope después de adquirir el lock**.
3. **El contraste es el hallazgo, no el elogio:** ese nivel de rigor cubre **2 de ~32** rutas de escritura de
   `gf_pwa_admin`. Las demás siguen con identidad por campo JSON y `sudo()` sin scope. **El endurecimiento del
   POS diurno no tocó requisiciones, gastos, caja ni liquidaciones** — justo las que el Gerente dispara.
4. ⇒ **La brecha es de propagación, no de diseño.** El equipo ya sabe escribir el patrón correcto y lo aplicó
   dos veces en este delta. Sprint 0 consiste en extenderlo, no en inventarlo.

Origen runtime: preview `fix/m4-unavailable-safe-state` (= `main` + 3 commits acotados a M4).

---

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
⇒ **La política genérica es más estrecha de lo que suponía la auditoría estática.** Es una contención real, y
refuerza que el kill switch de `generic_model_policies` es viable.
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

### 🔴 BLOQUEO 1 — PENDIENTE EXTERNO, permanece ABIERTO
> **No se cierra en esta ronda.** Queda abierto hasta que Yamil confirme explícitamente "listo".
> No se extrapola, no se infiere y no se declara cubierto por el viewport disponible.
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
