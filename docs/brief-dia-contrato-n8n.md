# Mi Brief del día — contrato PWA ⇄ n8n

Estado: **Fase B (PWA) construida.** Fase A (candado en n8n) la implementa el
equipo de n8n. Este documento es lo que la PWA **ya manda hoy** en esta rama.

---

## 1. La petición

```http
GET /api-n8n/brief-aida
X-GF-Employee-Token: <token>
Accept: text/html
```

- `/api-n8n/*` es un rewrite de Vercel hacia `https://n8n.grupofrio.mx/webhook/*`
  (ver `vercel.json`). En dev, el proxy de `vite.config.js` hace lo mismo.
  Desde el navegador el destino real es `https://n8n.grupofrio.mx/webhook/brief-aida`.
- `cache: 'no-store'`, `credentials: 'omit'`. **Sin cookies.**
- **No lleva body, ni query params, ni `Authorization`.**

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
- **sucursal** → `gf.ops.branch_config` con `employee_ids in [emp.id]`
  (mismo patrón que `gf_saleops/services/guard.py`, que además impone que la
  identidad del token gana siempre sobre cualquier `employee_id` del payload).
  Esto es lo que reemplaza el `BR=29` hardcodeado del nodo `Generar Datos`.

## 2. Las respuestas que la PWA sabe manejar

| Respuesta | Qué hace la PWA |
|---|---|
| `200` + `Content-Type: text/html` | Monta el HTML |
| `401` | "Tu sesión venció" → volver a entrar |
| `403` | "Este brief no es para tu puesto" |
| otro status / red caída | "No pudimos cargar tu brief" + Reintentar |
| `200` con `Content-Type` que no sea `text/html` | Se trata como fallo (`bad_content_type`) |
| `200` con cuerpo vacío o > 2 MB | Se trata como fallo |

**Acordado:** el candado responde **status real 401/403 con cuerpo no-HTML**, nunca
un `200` con envelope JSON. Empata con la verificación de `Content-Type` de la PWA:
un error disfrazado de 200 se rechaza en vez de montarse.

El `Content-Security-Policy: sandbox …` que n8n ya manda hoy en la respuesta no
estorba: el HTML se monta por `srcdoc`, así que las cabeceras de la respuesta no
aplican al documento embebido. El aislamiento lo pone la PWA con
`sandbox="allow-scripts"` (sin `allow-same-origin`).

## 3. Allowlist acordada

| | Ve la pestaña en la PWA | Puede pedir el dato |
|---|---|---|
| `supervisor_ventas` (Aida, emp **718**) | ✅ | ✅ |
| `direccion_general` (Yamil, emp **1**) | ❌ a propósito | ✅ para revisión del piloto |
| cualquier otro | ❌ | ❌ → **403** |

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

## 5. Cerrar la liga pública

Al poner el candado, `GET https://n8n.grupofrio.mx/webhook/brief-aida` sin header
debe pasar de `200` a `401`. Hoy responde **200 con 32,339 bytes de HTML a
cualquiera** (medido el 2026-07-31), leyendo Odoo con credenciales admin
(`$env.ODOO_USER/ODOO_PASSWORD`) y alcance fijo a la sucursal 29.

**Sincronización acordada:** el candado y el cierre de la liga pública caen **junto
con el merge de este PR**, no antes — así el acceso de revisión de dirección no se
corta mientras tanto.

## 6. Qué falta para cerrar Fase C

Requiere el candado puesto (Fase A); hoy el endpoint es público, así que el 403 aún
no existe y no hay nada que probar:

- [ ] `jefe_ruta` con token válido → el endpoint responde **403**.
- [ ] Yamil con login real de dirección → **200** (scope 29 por default de piloto).
- [ ] `curl` sin header → **401**.

Lo verificado hasta ahora (runtime, no aserción): Aida entra con 0000/0000, la
petición sale a `/api-n8n/brief-aida`, responde 200 y el brief se pinta dentro del
iframe aislado (31,956 caracteres); `iframe.contentDocument` es `null` desde la
app, o sea el brief no alcanza el `localStorage` de la PWA.
