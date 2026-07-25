# Identidad autenticada en validación de liquidaciones

## Objetivo

Permitir que Angélica valide una liquidación de ruta desde la PWA cuando la
petición ya contiene un `X-GF-Employee-Token` válido, sin confiar en un
`employee_id` enviado por el cliente como fuente de autorización.

El incidente observado afecta:

- `POST /pwa-admin/liquidaciones/validate`
- plan de ruta `6766`
- respuesta funcional `ok: false` con el mensaje
  `No se pudo identificar al empleado autenticado.`

## Evidencia y causa raíz

El bundle publicado en `https://colaboradores.grupofrio.mx`:

1. envía `plan_id` en el cuerpo del POST;
2. agrega `X-GF-Employee-Token` desde la sesión móvil;
3. no envía `employee_id` para validar la liquidación.

El controlador
`gf_pwa_admin/controllers/pwa_admin_api.py::api_liquidaciones_validate`
llama a `_resolve_employee(data)`. Ese helper actualmente intenta:

1. encontrar un `hr.employee` ligado al usuario dueño del API key compartido;
2. usar `employee_id` del payload como fallback.

La cuenta de servicio del API key no tiene un empleado ligado y el payload de
liquidaciones no contiene `employee_id`. El helper no consulta el token móvil
que sí llegó en el header, por lo que falla antes de inspeccionar el plan, su
estado o el empleado Ricardo.

El `200 OK` solo indica que Odoo atendió la petición HTTP. El error funcional
se transporta dentro de `result.ok: false`.

## Decisión aprobada

Modificar el resolver común de identidad de `gf_pwa_admin` para usar esta
precedencia:

1. Si existe `X-GF-Employee-Token`, autenticarlo mediante
   `gf.employee.mobile.session.authenticate_token()` y devolver su
   `employee_id`.
2. Si no existe el header, conservar la resolución por `user_id` del usuario
   autenticado con API key.
3. Si tampoco existe un empleado ligado al usuario, conservar
   `employee_id` del payload únicamente como compatibilidad legacy.

Un token enviado pero inválido o expirado debe fallar de forma cerrada. No
puede caer al usuario del API key ni al `employee_id` del payload. Si el token
y el payload identifican empleados distintos, prevalece siempre el token.

Esta regla alinea `gf_pwa_admin` con el contrato documentado en `CODE_MANUAL.md`:
`X-GF-Employee-Token` es la fuente de verdad para la identidad del empleado.

## Alcance

### Backend

Cambiar:

- `GrupoFrio/gf_pwa_admin/controllers/pwa_admin_api.py`
- pruebas de `GrupoFrio/gf_pwa_admin/tests/`

La implementación reutilizará `_resolve_employee_from_token_header()`; no
duplicará la autenticación del token.

### Frontend

No se requiere cambio de producción en `gf-pwa-colaboradores`. El bundle
publicado ya:

- agrega `X-GF-Employee-Token`;
- llama al endpoint correcto;
- envía el identificador del plan.

Se puede agregar una prueba contractual del request solo si la cobertura
existente no demuestra esos tres puntos, sin alterar el comportamiento.

## Flujo resultante

1. Angélica inicia sesión y recibe un token móvil opaco.
2. La PWA envía la validación del plan con ese token en el header.
3. Odoo valida el token y obtiene el `hr.employee` real de Angélica.
4. El endpoint continúa con las reglas actuales de liquidación.
5. Si las precondiciones del plan se cumplen, la conciliación se marca como
   terminada y el plan registra el corte validado.
6. Si el token no es válido, no se modifica la liquidación.

## Compatibilidad y seguridad

- Los clientes legacy sin header conservan el comportamiento existente.
- Los clientes modernos no dependen de un ID manipulable en el cuerpo.
- Un header inválido no puede ser rescatado mediante un payload válido.
- No se cambia el contrato de `plan_id`.
- No se cambia la envoltura JSON de éxito o error.
- No se cambian en este trabajo las reglas funcionales ni los roles que pueden
  validar liquidaciones.
- No se modifica el plan de Ricardo ni ningún dato de producción durante las
  pruebas automatizadas.

## Pruebas

La regresión backend debe cubrir:

1. API key de cuenta de servicio sin `hr.employee`, header móvil válido y
   payload sin `employee_id`: se resuelve al empleado del token.
2. Header válido y `employee_id` distinto en payload: prevalece el empleado
   del token.
3. Header inválido y `employee_id` válido: la petición se rechaza.
4. Sin header y usuario del API key ligado a un empleado: se conserva el
   comportamiento actual.
5. Sin header, cuenta de servicio y `employee_id` legacy válido: se conserva
   el fallback actual.
6. `POST /pwa-admin/liquidaciones/validate` con token válido y solo `plan_id`
   deja de responder el error de identificación.

La prueba de regresión debe observarse fallando antes de la corrección y
pasando después. Después se ejecutará la suite completa relevante de
`gf_pwa_admin`.

## Despliegue y verificación operativa

La implementación local y sus pruebas no despliegan automáticamente a Odoo.
La publicación del módulo backend requerirá autorización separada.

Después del despliegue:

1. Angélica vuelve a intentar validar el plan.
2. La petición debe conservar `X-GF-Employee-Token`.
3. La respuesta ya no debe contener el error de identificación.
4. Se confirma el resultado funcional real del plan `6766`; cualquier error
   posterior será una precondición de la liquidación distinta de este bug.

## Fuera de alcance

- Cambiar la asignación o los datos de Ricardo.
- Relacionar permanentemente la cuenta compartida del API key con Angélica.
- Eliminar en este cambio la compatibilidad legacy por payload.
- Rediseñar estados, conciliaciones o permisos de liquidaciones.
- Reanudar, promover o desplegar una versión de Vercel.
