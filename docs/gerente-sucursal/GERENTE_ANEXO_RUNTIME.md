# Anexo RUNTIME — auditoría Gerente

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
**2026-07-26 · sesión autenticada real · solo lecturas · sin writes**
Complementa `AUDITORIA_GERENTE_SUCURSAL.md`, `GERENTE_DISENO_OBJETIVO_Y_PLAN.md`, `GERENTE_CIERRE_TECNICO.md`.

## SHAs auditados (§1)
| Repo | Rama | SHA | ¿Cambió desde la ronda estática? |
|---|---|---|---|
| `grupofrio/colaboradores-pwa` | `origin/main` | `71e00e9fdfd2d7498e8983dd14eb7078c1c1534b` | **No** |
| `GrupoVeniu/GrupoFrio` | `origin/GrupoFrio` | `781aef65d0a1d0a041403a2cbea56ce6226a163a` | **No** |

⇒ **Toda la evidencia estática de `GERENTE_CIERRE_TECNICO.md` sigue vigente contra las ramas actuales.**
Origen runtime: preview `fix/m4-unavailable-safe-state` (= `main` + 3 commits acotados a M4).

---

## §2 · Mapeo LIVE del gerente (sanitizado, sin PII)

| Dato | Valor real | Cómo se obtuvo |
|---|---|---|
| `employee_id` | `<E1>` (sanitizado) | sesión |
| `role` / `job_key` | `gerente_sucursal` (ambos) | sesión |
| `company_id` | `34` | sesión |
| `warehouse_id` | `89` | sesión |
| `user_id` (Odoo) | **`false`** — el empleado **no tiene usuario Odoo vinculado** | lectura ORM |
| **`x_analytic_account_id`** | **`820` — sucursal `[IGU]`** | lectura ORM |
| `company_pt_id` de la sucursal | **`35`** | resuelto por `inventory/summary` |
| `company_en_id` de la sucursal | **`34`** | resuelto por `inventory/summary` |
| `gf.ops.branch_config` activo | **EXISTE y resuelve** para analytic 820 | `get_for(820)` devolvió OK |
| Ubicaciones PT/entregas/vans | **NO OBTENIBLES por esta vía** (ver hallazgo R3) | — |
| `plant_warehouse_id`, tz, ubicaciones MP/envases | **NO OBTENIDOS** — modelo no expuesto | ver R2 |

### 🟢 R1 — Corrección de peso a favor: **el dato canónico SÍ existe**
El empleado **tiene `x_analytic_account_id` poblado** (820 = sucursal IGU) y el `branch_config` de esa analítica
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
Llamada real con `analytic_account_id=820`:
```
status: ok · "Inventory summary listo"
claves: [product_ids, pt, entregas, vans, total_by_product]   ← FALTA "products"
pt:       company_id 35, location_ids [], by_product {}
entregas: company_id 34, location_ids [], by_product {}
vans:     company_id 34, location_ids [], by_product {}, by_mobile []
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

### 🟡 R5 — Corrección a mi propio informe
Afirmé antes que el gerente vería *"un formulario de login de terceros dentro de la PWA"* (patrón de phishing).
**Eso NO ocurre**: Metabase **rehúsa ser enmarcado**, así que el login nunca se renderiza dentro de la PWA.
El riesgo de phishing por iframe queda **refutado en la práctica**.

### 🔴 R6 — Pero el hallazgo real es peor en otro sentido
`/gerente/dashboard` **no muestra absolutamente nada hoy**: es una pantalla rota en producción.
No hay fuga cross-branch **porque no carga nada**. La superficie es **peso muerto verificado**, no un riesgo activo.
⇒ Refuerza la recomendación de **retirar** (no solo aislar): cuesta ≈0 y hoy no entrega valor alguno.

---

## §8 · Auditoría visual — **PARCIAL (1 de 4 viewports)**

### 🔴 Bloqueo declarado
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
