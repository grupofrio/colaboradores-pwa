# Baja Controlada PWA - Sugey y Angelica

## Objetivo

Agregar en `gf-pwa-colaboradores` las secciones operativas para que Sugey verifique en campo las solicitudes de baja levantadas por choferes y para que Angelica Jaimes otorgue el visto bueno posterior desde su PWA, antes de la verificacion final en Odoo.

La PWA no debe aplicar bajas finales ni borrar clientes. Solo captura verificacion, evidencia y decisiones intermedias. Odoo/GrupoFrio conserva la autoridad del workflow y la aplicacion final.

## Workspace

Repo analizado:

- `/Users/sebis/Documents/odoo/gf-pwa-colaboradores`

Arquitectura relevante:

- React 18 + Vite + React Router.
- Rutas lazy en `src/App.jsx`.
- Modulos por area en `src/modules/*`.
- Modulo comercial existente en `src/modules/supervisor-ventas`.
- Servicios comerciales bajo `src/modules/supervisor-ventas/api.js` y `supvService.js`.
- API central en `src/lib/api.js`, con ruteo directo para `/pwa-supv/*`.
- Sesion con `role`, `additional_job_keys`, `job_id: [id, label]`, `company_id`, `warehouse_id`, `employee_id`.
- UI compartida via `TOKENS`, `ScreenShell`, `Loader`, `EmptyState`, `ErrorState`, `PhotoCapture`.

## Decision De Ubicacion

El flujo vivira dentro de **Supervisor Ventas / Equipo** (`/equipo`) porque:

- ya concentra clientes, recuperacion comercial, tareas, notas y control comercial;
- ya consume endpoints `/pwa-supv/*`;
- evita crear otro modulo y duplicar navegacion;
- permite mostrar contadores en el centro de control comercial.

No se creara un modulo independiente salvo que negocio quiera separar completamente "Bajas" de "Equipo".

## Permisos Por Job ID

Decision aprobada: usar los `job_id` reales que tienen Sugey y Angelica en Odoo.

La PWA debe recibir o resolver:

- `SUGEY_DEACTIVATION_JOB_IDS`: arreglo con los `hr.job` ids autorizados para verificacion de Sugey.
- `ANGELICA_DEACTIVATION_JOB_IDS`: arreglo con los `hr.job` ids autorizados para visto bueno de Angelica.

Regla frontend:

- `session.job_id[0]` habilita la seccion de Sugey si esta en `SUGEY_DEACTIVATION_JOB_IDS`.
- `session.job_id[0]` habilita la seccion de Angelica si esta en `ANGELICA_DEACTIVATION_JOB_IDS`.
- Si Odoo tambien envia `additional_job_ids`, se deben evaluar junto con el `job_id` principal.

Regla backend:

- Los endpoints deben validar el permiso server-side con el `job_id` del empleado autenticado, no solo con la UI.
- El backend debe devolver 403 si el empleado no tiene el `job_id` autorizado.

Nota: el repo tiene una excepcion por nombre para Angelica Jaimes en `src/lib/api.js`, pero este flujo no debe depender del nombre de la persona. El nombre puede servir solo como fallback temporal de desarrollo si Odoo aun no expone los job IDs, pero no como permiso final.

Pendiente antes de implementar:

- Confirmar `job_id` numerico de Sugey en Odoo.
- Confirmar `job_id` numerico de Angelica Jaimes en Odoo.

## Flujo Operativo

1. Chofer/repartidor reporta posible baja desde `app_ventas_v2`.
2. Odoo recibe la solicitud y la deja en `pending_sugey`.
3. Sugey entra a la PWA y ve su cola de solicitudes pendientes.
4. Sugey visita al cliente y captura:
   - GPS obligatorio;
   - foto obligatoria;
   - comentario obligatorio;
   - resultado de verificacion.
5. Odoo registra evidencia, bitacora y cambia el estado segun resultado.
6. Si el caso requiere visto bueno, pasa a `pending_angelica`.
7. Angelica Jaimes entra a la PWA y revisa evidencia del chofer y de Sugey.
8. Angelica decide:
   - dar visto bueno;
   - rechazar;
   - pedir segunda verificacion;
   - mantener activo;
   - enviar a recuperacion comercial.
9. Si Angelica da visto bueno, Odoo deja el caso en `final_odoo_review`.
10. Solo Odoo aplica la baja final (`applied`) despues de la verificacion final interna.

## Estados

Estados esperados desde Odoo:

- `reported`
- `pending_sugey`
- `sugey_verified`
- `pending_angelica`
- `angelica_approved`
- `final_odoo_review`
- `rejected`
- `second_visit_required`
- `commercial_recovery`
- `applied`

Transiciones relevantes para PWA:

- Sugey:
  - `pending_sugey -> sugey_verified`
  - `pending_sugey -> pending_angelica`
  - `pending_sugey -> second_visit_required`
  - `pending_sugey -> rejected`
  - `pending_sugey -> commercial_recovery`
- Angelica:
  - `pending_angelica -> angelica_approved`
  - `pending_angelica -> final_odoo_review`
  - `pending_angelica -> rejected`
  - `pending_angelica -> second_visit_required`
  - `pending_angelica -> commercial_recovery`

Odoo define exactamente si `sugey_verified` es estado visible o si la verificacion de Sugey pasa directo a `pending_angelica`.

## Pantallas

### Hub de Bajas

Ruta:

- `/equipo/bajas`

Archivo:

- `src/modules/supervisor-ventas/ScreenBajasHub.jsx`

Contenido:

- resumen de casos abiertos;
- contador de pendientes de Sugey;
- contador de pendientes de Angelica;
- contador de segunda visita;
- contador de recuperacion comercial;
- accesos a colas segun permisos por `job_id`.

### Cola Sugey

Ruta:

- `/equipo/bajas/sugey`

Archivo:

- `src/modules/supervisor-ventas/ScreenBajasSugey.jsx`

Contenido:

- lista de solicitudes `pending_sugey`;
- filtro por ruta, motivo y antiguedad;
- tarjeta por solicitud con cliente, ruta, chofer, motivo, fecha, estado y evidencia inicial;
- CTA para abrir detalle.

### Detalle Sugey

Ruta:

- `/equipo/bajas/sugey/:requestId`

Archivo:

- `src/modules/supervisor-ventas/ScreenBajasSugeyDetail.jsx`

Contenido:

- datos del cliente;
- motivo y comentario del chofer;
- foto/evidencia del chofer;
- GPS inicial;
- contacto/persona consultada;
- formulario de verificacion:
  - resultado;
  - comentario;
  - foto;
  - GPS;
  - boton enviar.

Resultados:

- `confirmed_not_exists`
- `confirmed_does_not_want_buy`
- `confirmed_moved`
- `not_confirmed`
- `second_visit_required`
- `keep_active`
- `commercial_recovery`

### Cola Angelica

Ruta:

- `/equipo/bajas/angelica`

Archivo:

- `src/modules/supervisor-ventas/ScreenBajasAngelica.jsx`

Contenido:

- lista de casos `pending_angelica`;
- tarjetas con cliente, motivo, resultado de Sugey, evidencia disponible y antiguedad;
- CTA para revisar.

### Detalle Angelica

Ruta:

- `/equipo/bajas/angelica/:requestId`

Archivo:

- `src/modules/supervisor-ventas/ScreenBajasAngelicaDetail.jsx`

Contenido:

- evidencia del chofer;
- evidencia de Sugey;
- bitacora de estados;
- decision de Angelica;
- comentario obligatorio para rechazar, segunda verificacion, mantener activo o recuperacion.

Decisiones:

- `approve`
- `reject`
- `request_second_verification`
- `keep_active`
- `commercial_recovery`

## Servicios Frontend

Crear:

- `src/modules/supervisor-ventas/customerDeactivationService.js`
- `src/modules/supervisor-ventas/customerDeactivationState.js`

Funciones API:

- `getCustomerDeactivationSummary()`
- `getSugeyDeactivationQueue(params)`
- `getAngelicaDeactivationQueue(params)`
- `getCustomerDeactivationDetail(requestId)`
- `verifyCustomerDeactivationAsSugey(requestId, payload)`
- `decideCustomerDeactivationAsAngelica(requestId, payload)`

Funciones de estado/normalizacion:

- `normalizeDeactivationRequest(row)`
- `normalizeDeactivationEvidence(row)`
- `canAccessSugeyDeactivation(session, config)`
- `canAccessAngelicaDeactivation(session, config)`
- `validateSugeyVerificationForm(form)`
- `validateAngelicaDecisionForm(form)`
- `buildSugeyVerificationPayload(form, gps)`
- `buildAngelicaDecisionPayload(form)`

## Endpoints Odoo

Contratos esperados:

```txt
GET  /pwa-supv/customer-deactivation/summary
GET  /pwa-supv/customer-deactivation/sugey
GET  /pwa-supv/customer-deactivation/angelica
GET  /pwa-supv/customer-deactivation/<id>
POST /pwa-supv/customer-deactivation/<id>/sugey-verify
POST /pwa-supv/customer-deactivation/<id>/angelica-decide
```

`GET /summary`:

```json
{
  "pending_sugey": 3,
  "pending_angelica": 2,
  "second_visit_required": 1,
  "commercial_recovery": 4
}
```

`GET /sugey` y `GET /angelica` deben responder lista normalizada:

```json
{
  "ok": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "name": "BCL/2026/00123",
        "state": "pending_sugey",
        "partner_id": 456,
        "partner_name": "Abarrotes Centro",
        "route_name": "Ruta Norte",
        "driver_name": "Chofer",
        "reason": "not_exists",
        "request_comment": "Vecinos indican cierre",
        "request_contact_person": "Vecino local contiguo",
        "request_latitude": 19.4,
        "request_longitude": -99.1,
        "request_photo_url": "/web/content/...",
        "requested_at": "2026-07-01T10:00:00-06:00",
        "age_hours": 6
      }
    ],
    "total": 1
  }
}
```

Payload Sugey:

```json
{
  "result": "confirmed_not_exists",
  "comment": "Confirmado en sitio",
  "latitude": 19.4,
  "longitude": -99.1,
  "accuracy": 15,
  "photo_base64": "...",
  "photo_mime": "image/jpeg",
  "verified_at": "2026-07-01T12:00:00-06:00"
}
```

Payload Angelica:

```json
{
  "decision": "approve",
  "comment": "Evidencia suficiente",
  "decided_at": "2026-07-01T14:00:00-06:00"
}
```

## Reglas UX

- UI densa y operativa, consistente con `ScreenControlComercial`.
- No usar landing ni explicaciones largas.
- Mostrar evidencias en tarjetas compactas.
- Botones claros por accion.
- Confirmacion antes de enviar decisiones irreversibles.
- Si GPS falla en Sugey, mostrar reintento y no permitir enviar.
- Si foto falta en Sugey, bloquear envio.
- Si comentario falta, bloquear envio.
- Angélica debe ver la evidencia completa antes de decidir.
- Las acciones peligrosas (`reject`, `keep_active`, `commercial_recovery`) deben pedir comentario.

## Offline

La PWA actual trabaja principalmente online. Para este flujo:

- Sugey y Angelica deben trabajar online en primera version.
- Si se requiere offline despues, agregar cola local separada con persistencia, similar a `app_ventas_v2`, pero no mezclarlo en esta fase.
- La UI debe mostrar error claro si no hay conexion al enviar evidencia.

## Pruebas

Unitarias:

- normalizacion de solicitudes;
- validacion de formulario Sugey;
- validacion de decision Angelica;
- permisos por `job_id`;
- payloads de Sugey y Angelica.

Wiring/static:

- rutas nuevas en `App.jsx`;
- acciones visibles en `ScreenControlComercial`;
- endpoints registrados en `customerDeactivationService.js`;
- no depender del nombre de Angelica/Sugey para permisos.

Manual QA:

1. usuario con `job_id` de Sugey ve cola Sugey y no ve acciones de Angelica.
2. usuario con `job_id` de Angelica ve cola Angelica y no captura verificacion de campo.
3. Sugey no puede enviar sin GPS/foto/comentario.
4. Angelica no puede rechazar sin comentario.
5. segunda verificacion vuelve a cola Sugey.
6. visto bueno de Angelica no aplica baja final.
7. Odoo conserva evidencia y bitacora.

## Pendientes Para Implementacion

- Obtener `job_id` numerico de Sugey.
- Obtener `job_id` numerico de Angelica Jaimes.
- Confirmar si Odoo enviara `additional_job_ids` ademas de `additional_job_keys`.
- Implementar endpoints Odoo antes o en paralelo con PWA.
- Definir si el hub `/equipo/bajas` sera visible para supervisor ventas general o solo para Sugey/Angelica.
