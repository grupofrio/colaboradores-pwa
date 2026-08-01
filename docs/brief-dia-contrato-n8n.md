# Briefs embebidos — contrato PWA ⇄ n8n

Estado: **Fase B (PWA) construida.** Fase A (candado en n8n) la implementa el
equipo de n8n. Este documento es lo que la PWA **ya manda hoy** en esta rama.

Todas las variantes comparten **el mismo componente, el mismo mecanismo de auth y
el mismo aislamiento**. Lo único que cambia por variante está en
`src/modules/brief/briefCatalog.js`.

## 0. Variantes

| brief | endpoint | pestaña (UI) | allowlist del DATO (n8n) | fecha |
|---|---|---|---|---|
| Ventas — "Mi Brief del día" | `/api-n8n/brief-aida` | `supervisor_ventas` (Aida, emp 718) | `supervisor_ventas` + `direccion_general` | no |
| Producción — "Mi Brief de planta" | `/api-n8n/brief-produccion` | `supervisor_produccion` (Miguel Ángel Morales, emp 577) | `supervisor_produccion` + `direccion_general` | `?d=YYYY-MM-DD` |
| Gerencia — "Brief de gerencia" | `/api-n8n/brief-gerencia` | `gerente_sucursal` | `gerente_sucursal` + `direccion_general` | no |

`direccion_general` **puede pedir el dato pero no ve la pestaña** en ninguna de las
tres: es acceso de revisión para dirección durante el piloto. Deliberado — la UI es
comodidad, el candado es el backend.

⚠️ **Pendiente del lado de n8n para la variante de gerencia:** cómo se resuelve el
alcance de `gerente_sucursal` sigue **sin definir** (§4). No sale de
`branch_config.employee_ids` — ese campo solo lista al supervisor de ventas asignado.

**Agregar un brief nuevo** (gerencia, etc.) = una entrada en `briefCatalog.js`, una
en `registry.js` y una `<Route>`. Cero componentes nuevos.

---

## 1. La petición

```http
GET /api-n8n/brief-aida
X-GF-Employee-Token: <token>
Accept: text/html
```

```http
GET /api-n8n/brief-produccion?d=2026-07-29
X-GF-Employee-Token: <token>
Accept: text/html
```

- `/api-n8n/*` es un rewrite de Vercel hacia `https://n8n.grupofrio.mx/webhook/*`
  (ver `vercel.json`). En dev, el proxy de `vite.config.js` hace lo mismo.
- `cache: 'no-store'`, `credentials: 'omit'`. **Sin cookies.**
- **No lleva body ni `Authorization`.**
- El **único** query param es la fecha, y solo donde la variante la declara.

### La fecha (`?d=`) es presentación, nunca autorización

`?d=YYYY-MM-DD` dice **qué día mirar**, no **qué puede ver quien pregunta**. El
alcance lo sigue decidiendo el endpoint a partir del empleado dueño del token. Si el
parámetro falta, el endpoint aplica su default ("ayer").

La PWA valida el formato contra un calendario real antes de armar la URL: `2026-02-31`,
`2026-7-9`, `ayer` o cualquier intento de inyección se **omiten** en vez de viajar
(`isValidBriefDate` + `buildBriefUrl`, con test de basura). Aun así, el endpoint debe
validar por su cuenta: el cliente no es autoridad de nada.

### El token

`X-GF-Employee-Token` es el `gf_employee_token` que Odoo emitió en
`POST /api/employee-sign-in`. Es una fila de `gf.employee.mobile.session`
(`gf_logistics_ops/models/gf_mobile_session.py`):

| campo | valor |
|---|---|
| `token` | `secrets.token_urlsafe(32)` → 43 caracteres (medido en runtime) |
| `active` | debe ser `True` |
| `employee_id.active` | debe ser `True` |
| `expire_at` | 30 días, se renueva al usarse |

El validador canónico es `authenticate_token()` en ese mismo modelo. El dominio
de búsqueda a replicar desde n8n es exactamente:

```python
[("token", "=", token), ("active", "=", True), ("employee_id.active", "=", True),
 "|", ("expire_at", "=", False), ("expire_at", ">", now)]
```

`search_read` con ese dominio (read-only, sin `touch()`) da la identidad. No hace
falta código nuevo en Odoo.

### Lo que la PWA NO manda, y por qué

**No manda `employee_id`, ni el rol, ni la sucursal, ni el `session_token`.**

El `session_token` que vive en `localStorage.gf_session` es un JWT con
`alg: "none"` fabricado **en el navegador** (`ScreenLogin.buildLocalSessionToken`),
porque el controlador de Odoo no emite ninguno. Verificado en runtime: la sesión
real de Aida termina en `.odoo`. Su payload lleva `role` y `employee_id`, pero es
una auto-declaración: cualquiera abre la consola y se fabrica uno con
`role: "direccion_general"`.

Por eso el endpoint debe derivar **todo** del empleado dueño del token:

- **rol** → `hr.job.x_job_key` vía `resolve_employee_pwa_job_key`
  (`os_customer_zones/models/pwa_job_key.py`).
- **alcance** → depende del rol (ver §4). Para `supervisor_ventas`,
  `gf.ops.branch_config` con `employee_ids in [emp.id]` — mismo patrón que
  `gf_saleops/services/guard.py`, que además impone que la identidad del token gana
  siempre sobre cualquier `employee_id` del payload. Esto reemplaza el `BR=29`
  hardcodeado del nodo `Generar Datos`. Para producción, el alcance es Planta Iguala.

## 2. Las respuestas que la PWA sabe manejar

| Respuesta | Qué hace la PWA |
|---|---|
| `200` + `Content-Type: text/html` | Monta el HTML |
| `401` | "Tu sesión venció" → volver a entrar. **Una petición, sin reintento** |
| `403` | "No tienes acceso a este brief". **Una petición, sin reintento** |
| otro status / red caída | "No pudimos cargar tu brief" + Reintentar |
| `200` con `Content-Type` que no sea `text/html` | Se trata como fallo (`bad_content_type`) |
| `200` con cuerpo vacío o > 2 MB | Se trata como fallo |

**Acordado:** el candado responde **status real 401/403 con cuerpo no-HTML**, nunca
un `200` con envelope JSON. Empata con la verificación de `Content-Type` de la PWA:
un error disfrazado de 200 se rechaza en vez de montarse.

**401 y 403 no se colapsan en un solo mensaje** aunque los dos sean un "no": el 401
se arregla volviendo a entrar, el 403 no se arregla con nada que la persona pueda
hacer. Decirle "no tienes acceso" a quien solo se le venció la sesión la manda a
pedir permisos que ya tiene. El botón de reintentar existe **solo** para fallos de
red/5xx; ningún rechazo de autorización se reintenta.

El `Content-Security-Policy: sandbox …` que n8n ya manda hoy en la respuesta no
estorba: el HTML se monta por `srcdoc`, así que las cabeceras de la respuesta no
aplican al documento embebido. El aislamiento lo pone la PWA con
`sandbox="allow-scripts"` (sin `allow-same-origin`).

## 3. Allowlist acordada

**`/api-n8n/brief-aida`** (ventas):

| | Ve la pestaña | Puede pedir el dato |
|---|---|---|
| `supervisor_ventas` (Aida, emp **718**) | ✅ | ✅ |
| `direccion_general` (Yamil, emp **1**) | ❌ a propósito | ✅ revisión del piloto |
| cualquier otro | ❌ | ❌ → **403** |

**`/api-n8n/brief-produccion`** (planta):

| | Ve la pestaña | Puede pedir el dato |
|---|---|---|
| `supervisor_produccion` (Miguel Ángel Morales, emp **577**) | ✅ | ✅ |
| `direccion_general` (Yamil, emp **1**) | ❌ a propósito | ✅ revisión del piloto |
| cualquier otro | ❌ | ❌ → **403** |

**`/api-n8n/brief-gerencia`** (gerencia):

| | Ve la pestaña | Puede pedir el dato |
|---|---|---|
| `gerente_sucursal` | ✅ | ✅ |
| `direccion_general` (Yamil, emp **1**) | ❌ a propósito | ✅ revisión del piloto |
| cualquier otro | ❌ | ❌ → **403** |

Cruzado también: ningún rol debe poder pedir el brief de otro. Verificado del lado de
la PWA (la ruta cruzada redirige a `/` y la tarjeta no aparece); del lado del dato lo
tiene que imponer el candado.

### ⚠️ Cómo entra Yamil — hay una trampa

Yamil es `direccion_general`, empleado **id 1**, y su acceso real está **confirmado
activo**: entra con su PIN y barcode.

Ese es el único camino: **no sirve el acceso rápido / bypass admin**. El bypass
(`buildMockSession`) fabrica la sesión enteramente en el cliente, no llama a Odoo y
por lo tanto **no tiene `gf_employee_token`**. Con esa sesión la PWA ni siquiera
intenta la petición: muestra "Entra con tu PIN para ver el brief".

## 4. Paso 0 — RESUELTO (verificado por el equipo de n8n, 2026-07-31)

```python
search_read('gf.ops.branch_config', [[('employee_ids', 'in', [718])]], ...)
# → branch_config 29 · [IGU34] Iguala Glaciem · analytic 931
```

Aida (emp 718, `supervisor_ventas`, job 152) **sí** resuelve a la sucursal 29. Para
ella se deriva la sucursal del empleado, sin fallback.

### El scope NO se deriva igual para todos los roles

Hallazgo del mismo chequeo: **`branch_config(29).employee_ids == [718]` y nada más.**
Ese campo es "el supervisor de ventas asignado", **no un roster de la sucursal**. Ni
la gerente, ni supervisión de producción, ni Yamil (emp 1) aparecen ahí.

Consecuencia para el nodo de scope: la identidad sale SIEMPRE del token, pero la
**rama que resuelve el alcance depende del rol**:

| rol | cómo se resuelve el scope |
|---|---|
| `supervisor_ventas` | `gf.ops.branch_config.employee_ids` (el camino de arriba) |
| `direccion_general` | **NO usar `employee_ids`: devolvería vacío.** Todas las sucursales, o sucursal explícita — para el piloto, default a 29 / Iguala |
| `gerente_sucursal` | sin definir; se resolverá al conectarla (probablemente por empresa/departamento del `hr.employee`, no por `employee_ids`) |

Esto no cambia nada en la PWA: el cliente no manda ni sucursal ni rol, así que toda
esta lógica vive del lado del endpoint.

## 5. Cerrar las ligas públicas

**Las dos** son públicas hoy. Al poner el candado, un `GET` sin header debe pasar de
`200` a `401`:

| endpoint | hoy (medido) |
|---|---|
| `webhook/brief-aida` | 200 · 32,339 bytes de HTML a cualquiera (2026-07-31) |
| `webhook/brief-produccion` | 200 · HTML a cualquiera (2026-07-31) |
| `webhook/brief-gerencia` | 200 · 23,255 bytes de HTML a cualquiera (2026-07-31) |

Ambas leen Odoo con credenciales admin (`$env.ODOO_USER/ODOO_PASSWORD`).

**Sincronización acordada:** candado y cierre caen **junto con el merge del PR
correspondiente**, no antes — así el acceso de revisión de dirección no se corta
mientras tanto.

## 6. Qué falta para cerrar Fase C

Requiere el candado puesto (Fase A); hoy los endpoints son públicos, así que el 403
aún no existe y no hay nada que probar:

- [ ] `jefe_ruta` con token válido → **403** en las dos rutas.
- [ ] `supervisor_ventas` → 200 en `brief-aida`, **403** en `brief-produccion`.
- [ ] `supervisor_produccion` → 200 en `brief-produccion`, **403** en `brief-aida`.
- [ ] Yamil con login real de dirección → **200** en ambas.
- [ ] `curl` sin header → **401** en ambas.

### Lo verificado del lado de la PWA (runtime, no aserción)

Con la sesión real de Aida (emp 718, token de empleado de 43 caracteres):

| | ventas | producción | gerencia |
|---|---|---|---|
| petición | `brief-aida` → 200 | `brief-produccion` → 200 | `brief-gerencia` → 200 |
| HTML montado | 31,957 car. | 9,504 car. | 23,255 car. |
| `?d=2026-07-29` | n/a | → 200, contenido distinto (13,467 car.) | n/a |
| `sandbox` | `allow-scripts` | `allow-scripts` | `allow-scripts` |
| `contentDocument` desde la app | `null` | `null` | `null` |
| ruta cruzada | — | con rol `supervisor_ventas` redirige a `/` | con rol `jefe_ruta` redirige a `/` |

**403 forzado en gerencia** (interceptando el fetch): sale "No tienes acceso a este
brief", sin iframe y **sin ningún botón** — y el contador se quedó en 2 peticiones a
los 15 segundos (las 2 son el doble-efecto de StrictMode en dev, una de ellas
abortada). No hay bucle de reintento.

La variante de producción se ejercitó con el token real de Aida y el rol cambiado a
`supervisor_produccion` en la sesión local: alcanza para probar el embed, el
parámetro de fecha y el aislamiento. **No prueba el candado** — eso solo se puede
verificar con Fase A puesta y la sesión real de Miguel.
