# Diseño: cierre de turno móvil sin usuario interno ni fotografía

Fecha: 2026-07-29

## Contexto

El primer turno operativo de CEDIS Iguala quedó activo correctamente y Angélica
Jaimes Domínguez administra los cortes mediante un token de empleado. Al intentar
cerrar el turno, la PWA cargó la fotografía y envió un `evidence_token`, pero el
backend rechazó la operación con `El responsable del corte no tiene usuario
interno asociado.`

La identidad autenticada y autorizada del flujo PWA es `hr.employee`. Angélica
no tiene ni necesita un `res.users`. El modelo de versión de corte, sin embargo,
declaró `closed_by_user_id` como obligatorio y el servicio de cierre exigió
`employee.user_id`. Las pruebas originales crearon siempre a la gerente con un
usuario interno, por lo que no representaron el perfil móvil de producción.

El intento fallido no creó versión, sucesor ni operación idempotente persistida;
el turno Día 29 permaneció abierto.

## Objetivos

- Permitir cierre y recierre a un empleado móvil autorizado aunque no tenga
  usuario interno.
- Mantener al empleado del token como identidad humana autoritativa del corte.
- Eliminar la fotografía del formulario y de los requisitos para cierre y
  recierre de turnos POS.
- Mantener nota obligatoria cuando exista cualquier diferencia y conservar los
  umbrales y autorizaciones actuales.
- Preservar la lectura e impresión de fotografías históricas ya guardadas.
- Permitir que el turno activo de producción pueda cerrarse después del upgrade
  sin intervención manual sobre sus datos.

## Fuera de alcance

- No crear un usuario interno para Angélica ni para otros empleados móviles.
- No atribuir el cierre al usuario técnico de la API.
- No borrar adjuntos, evidencias o versiones históricas.
- No cambiar fotografías/comprobantes de gastos.
- No cambiar el cierre diario Legacy ni su formulario existente.
- No modificar los umbrales de autorización ni las reglas del arqueo por
  denominaciones.

## Identidad y auditoría

`closed_by_employee_id` seguirá siendo obligatorio e inmutable. El actor se
resolverá exclusivamente desde el token del empleado; nunca desde un ID enviado
por el cliente.

`closed_by_user_id` pasará a ser opcional:

- si el empleado tiene `user_id`, se conserva exactamente ese usuario;
- si el empleado no tiene `user_id`, se guarda `False`;
- el servicio interno rechazará un `closed_by_user_id` que no coincida con el
  usuario del empleado, incluida la presencia de un usuario cuando el empleado
  no tiene uno.

El DTO seguirá entregando las cuatro claves de `responsible`. Para un empleado
móvil sin usuario, `user_id` será `false` y `user_name` será `""`; nombre e ID
del empleado seguirán completos. La PWA y la impresión usarán primero la
identidad del empleado.

## Cierre sin fotografía

La PWA eliminará del cierre y recierre:

- selector de archivo;
- validación de MIME/tamaño;
- subida previa de evidencia;
- estado, expiración y reintentos de `evidence_token`;
- mensajes que pidan volver a subir una fotografía.

Cuando la diferencia sea distinta de cero, la nota continuará siendo
obligatoria. Los flags `needs_manager_auth` y `needs_director_auth` y el flujo
`pending_auth` no cambian.

El backend dejará de exigir evidencia para una diferencia. Durante la transición
seguirá aceptando opcionalmente un `evidence_token` válido enviado por una PWA
anterior: si llega, se validará, consumirá y conservará con las reglas actuales.
Así el despliegue backend-first no rompe clientes almacenados en caché. La PWA
nueva omitirá `evidence_token` y no llamará al upload de evidencia del corte.

Los modelos y endpoints de evidencia no se eliminan porque sostienen datos
históricos y compatibilidad de despliegue. Las nuevas versiones normalmente
tendrán `evidence_attachment_id=False`.

## Historial e impresión

Una versión cerrada seguirá siendo imprimible aunque no tenga fotografía. Los
reportes mostrarán al empleado responsable y, cuando corresponda, indicarán
simplemente que no existe evidencia adjunta. Se reemplazarán textos que usan
“fotografía” como sinónimo de versión o snapshot por “corte” o “versión de
corte”.

Las versiones históricas con evidencia conservarán nombre, MIME, tamaño, digest
y referencia. No se alterará ni eliminará ningún adjunto existente.

## Contratos y migración de Odoo

`gf.pos.cash.shift.version.closed_by_user_id` cambiará de requerido a opcional.
El upgrade de `gf_pwa_admin` actualizará la columna para aceptar `NULL`; los
registros existentes conservarán su usuario. Se incrementará la versión del
módulo y el checker fijará esa nueva versión para impedir que código y esquema
queden desalineados.

El contrato de cierre conservará temporalmente `evidence_token` como campo
opcional de compatibilidad. La ausencia de ese campo será la ruta normal.

## Pruebas

Backend Odoo:

- un gerente móvil autorizado sin `user_id` cierra y recierra;
- la versión conserva `closed_by_employee_id` y deja
  `closed_by_user_id=False`;
- un empleado con usuario conserva su usuario exacto;
- el servicio rechaza cualquier usuario que no corresponda al empleado;
- una diferencia con nota y sin foto puede cerrarse;
- una diferencia sin nota continúa fallando antes de crear snapshots;
- autorizaciones, idempotencia, concurrencia, sucesor e inmutabilidad no cambian;
- un token de evidencia opcional antiguo todavía se valida y consume.

PWA:

- no renderiza `evidencePhoto` ni llama al endpoint de upload al cerrar;
- una diferencia exige nota, pero no fotografía;
- recuperación, reintento y cambio de versión conservan el arqueo sin estados de
  evidencia;
- normaliza e imprime responsables con `user_id=false`;
- historial antiguo con evidencia y nuevo sin evidencia funcionan juntos.

## Despliegue y recuperación del turno activo

1. Desplegar backend en `GrupoFrio`.
2. Actualizar `gf_pwa_admin` en Odoo.
3. Ejecutar el checker en modo normal, sin
   `GF_CASH_SHIFT_REQUIRE_INACTIVE=1`, porque la configuración ya está activa.
4. Validar por lectura que continúa exactamente un turno abierto y que no hay
   movimientos elegibles huérfanos.
5. Liberar la PWA.
6. Pedir a Angélica cerrar sesión, recargar la aplicación e iniciar sesión de
   nuevo antes de reintentar el cierre.

El reintento puede usar una clave idempotente nueva; el intento observado no
persistió una operación. No se cerrará ni modificará manualmente el turno en
producción durante el despliegue.
