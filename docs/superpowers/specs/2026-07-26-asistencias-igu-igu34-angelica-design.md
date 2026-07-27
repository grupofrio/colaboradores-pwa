# Administración de asistencias de Iguala para Angélica

**Fecha:** 2026-07-26  
**Estado:** Diseño aprobado por el usuario  
**Alcance:** PWA Colaboradores y backend Odoo `gf_hr_ops`

## Objetivo

Agregar a la PWA una superficie para que Angélica Jaimes Domínguez administre
las asistencias del equipo de Iguala. El alcance debe incluir exclusivamente a
empleados activos cuya cuenta `hr.employee.x_analytic_account_id` tenga código
`IGU` o `IGU34`.

Desde esta superficie Angélica podrá:

- consultar asistencias por día, semana o rango personalizado;
- registrar entradas y salidas;
- corregir horarios y cerrar registros incompletos;
- registrar y justificar faltas;
- consultar la trazabilidad de los cambios;
- exportar el rango filtrado a un libro Excel `.xlsx`.

## Decisiones aprobadas

- La funcionalidad vivirá en un módulo independiente llamado `Asistencias`.
- La PWA se limitará a Angélica y Odoo revalidará cada petición mediante el
  `X-GF-Employee-Token`.
- La autorización no dependerá del nombre, rol o `employee_id` enviado por el
  navegador.
- El alcance se resolverá por los códigos analíticos `IGU` e `IGU34`, no por
  IDs de cuentas codificados en el cliente.
- Se reutilizará `hr.attendance` para entradas y salidas.
- Se reutilizará `x_kold.hr.falta` de `gf_hr_ops` para faltas, justificaciones
  y su acumulado de 30 días.
- Toda escritura conservará auditoría de actor, fecha, motivo y valores antes
  y después.
- La PWA no expondrá borrados irreversibles.
- Las horas se mostrarán en `America/Mexico_City` y se almacenarán en UTC, de
  acuerdo con el contrato de Odoo.
- El Excel se generará como `.xlsx` real y contendrá `Resumen`, `Asistencias`
  y `Faltas`.

## Evidencia del sistema actual

- La PWA no tiene rutas, pantallas ni servicios de asistencias.
- El login ya persiste `gf_employee_token` y el cliente lo envía como
  `X-GF-Employee-Token`.
- `gf_hr_ops` ya depende de `hr_attendance` y define
  `x_kold.hr.falta` con motivo, estado, justificación, comprobante, notas y
  `rolling_count_30d`.
- `x_kold.hr.falta` ya impide dos faltas para el mismo empleado y fecha.
- `hr.employee` ya tiene el campo `x_analytic_account_id` consumido por otros
  flujos de la PWA.
- La identidad productiva observada de Angélica es `hr.employee(717)`, pero el
  backend no dependerá de este valor como constante interna: se configurará en
  Odoo mediante una allowlist explícita.

## Arquitectura

### 1. Backend autoritativo en `gf_hr_ops`

`gf_hr_ops` incorporará un controlador PWA y un servicio de dominio. El
controlador solo traducirá HTTP/JSON; la autenticación, alcance, validaciones,
serialización y auditoría vivirán en helpers o servicios testeables.

Cada endpoint seguirá esta secuencia:

1. leer la presencia de `X-GF-Employee-Token`;
2. autenticar el token contra la sesión móvil de Odoo;
3. obtener el `hr.employee` actor desde el token;
4. verificar que su ID pertenezca a la allowlist
   `gf_hr_ops.pwa_attendance_manager_employee_ids`;
5. resolver las cuentas `account.analytic.account` cuyos códigos sean
   exactamente `IGU` o `IGU34`;
6. limitar empleados objetivo a activos con
   `x_analytic_account_id in <cuentas resueltas>`;
7. ejecutar la operación y registrar auditoría cuando sea una escritura.

La allowlist se sembrará con Angélica en producción y será configurable por
ambiente. Un token ausente, vacío, inválido, vencido o perteneciente a otro
empleado fallará cerrado. Ningún `employee_id`, código analítico, compañía o
rol enviado por el navegador podrá ampliar el alcance.

Si falta cualquiera de las dos cuentas configuradas, el backend devolverá un
error explícito y no degradará a una búsqueda por nombre. Esto evita entregar
un subconjunto silencioso o incluir otra cuenta de Iguala por coincidencia
parcial.

### 2. Política de acceso en la PWA

El registry declarará `Asistencias` como módulo con una política nominal
propia. La visibilidad, la decisión de navegación y el guard de `/asistencias`
usarán el `employee_id` de sesión autorizado para evitar mostrar la superficie
a otros gerentes.

Este gate cliente solo mejora la experiencia. El backend seguirá siendo la
única autoridad de lectura y escritura. La pantalla consultará además un
endpoint de capacidades al montar; una discrepancia entre el gate local y la
configuración server-side mostrará acceso denegado y nunca datos parciales.

### 3. Fuentes de datos

El tablero combinará:

- empleados activos en `IGU` e `IGU34`;
- registros `hr.attendance` que intersecten el rango solicitado;
- registros `x_kold.hr.falta` del mismo rango;
- calendario laboral de cada empleado para determinar si era un día esperado.

`Sin registro` será un indicador operativo, no una falta creada
automáticamente. Solo se mostrará cuando el calendario del empleado indique
que debía laborar y no exista asistencia ni falta. Angélica deberá confirmar
explícitamente `Registrar falta`. Si el empleado no tiene calendario laboral
utilizable, la PWA no inferirá una falta.

## Contrato de endpoints

Los nombres finales pueden ajustarse al prefijo vigente del controlador, pero
el contrato funcional será:

### `GET /pwa-hr/attendance/capabilities`

Devuelve únicamente después de autenticar el token:

```json
{
  "allowed": true,
  "timezone": "America/Mexico_City",
  "analytic_accounts": [
    { "id": 820, "code": "IGU", "name": "Iguala" },
    { "id": 931, "code": "IGU34", "name": "Iguala Glaciem" }
  ],
  "features": {
    "write_attendance": true,
    "manage_absences": true,
    "export_xlsx": true,
    "audit_history": true
  }
}
```

Los IDs del ejemplo son informativos; el servidor siempre resuelve por código.

### `GET /pwa-hr/attendance`

Parámetros:

- `date_from=YYYY-MM-DD`;
- `date_to=YYYY-MM-DD`;
- `analytic_code=IGU|IGU34` opcional;
- `employee_id` opcional;
- `status` opcional.

El rango se limitará a un máximo definido server-side, inicialmente 93 días.
El `employee_id` y `analytic_code` solo reducen la allowlist fija; nunca la
amplían.

Respuesta normalizada:

```json
{
  "summary": {
    "expected": 48,
    "present": 42,
    "absent": 3,
    "incomplete": 2,
    "worked_hours": 331.5
  },
  "rows": [
    {
      "employee": {
        "id": 100,
        "number": "EMP-100",
        "name": "Empleado",
        "job": "Puesto",
        "analytic_code": "IGU"
      },
      "date": "2026-07-26",
      "expected_workday": true,
      "attendance": {
        "id": 500,
        "check_in": "2026-07-26T08:03:00-06:00",
        "check_out": "2026-07-26T17:02:00-06:00",
        "worked_hours": 8.98
      },
      "absence": null,
      "status": "complete",
      "notes": ""
    }
  ]
}
```

Estados mínimos:

- `complete`;
- `open`;
- `absence_pending`;
- `absence_justified`;
- `absence_processed`;
- `missing_expected`;
- `not_scheduled`.

### `POST /pwa-hr/attendance`

Crea una asistencia con:

- `employee_id`;
- `check_in` local ISO;
- `check_out` local ISO opcional;
- `reason` obligatorio como motivo administrativo de la creación.

### `PATCH /pwa-hr/attendance/<attendance_id>`

Permite corregir `check_in`, `check_out` y registrar `reason` obligatorio. No
permite cambiar el empleado propietario. Cerrar un registro abierto utiliza el
mismo endpoint enviando `check_out`.

### `POST /pwa-hr/faltas`

Crea una falta para un empleado y fecha con:

- `reason`: `retardo_bloqueado`, `no_show` u `otro`;
- `notes` opcionales;
- motivo administrativo de la captura.

Respeta la unicidad existente por empleado y fecha.

### `POST /pwa-hr/faltas/<falta_id>/justify`

Justifica una falta usando la lógica de negocio existente. Acepta tipo de
justificación, notas y comprobante opcional con nombre, MIME y contenido
base64. El backend validará límite de tamaño y tipos permitidos.

### `GET /pwa-hr/audit`

Devuelve el historial paginado de un `hr.attendance` o `x_kold.hr.falta`
autorizado. No acepta IDs fuera de `IGU`/`IGU34`.

### `GET /pwa-hr/attendance/export.xlsx`

Recibe los mismos filtros de lectura, vuelve a aplicar autenticación y alcance,
y responde `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
con `Content-Disposition: attachment`.

El libro se generará en Odoo para que las mismas reglas y el mismo snapshot de
datos alimenten la pantalla y la descarga. La PWA no reconstruirá el archivo a
partir de estado posiblemente desactualizado.

## Validaciones de negocio

### Asistencias

- El empleado objetivo debe pertenecer al alcance autorizado al momento de la
  escritura.
- `check_out`, cuando exista, debe ser posterior a `check_in`.
- No se permiten asistencias traslapadas del mismo empleado.
- Un registro abierto posterior del mismo empleado bloquea una nueva creación.
- Los datetimes deben incluir fecha y hora válidas; el backend normaliza desde
  `America/Mexico_City` a UTC.
- Los cambios administrativos exigen motivo no vacío.
- Las restricciones nativas de `hr.attendance` siguen vigentes; el controlador
  no usa escritura SQL directa.

### Faltas

- Solo se permite una falta por empleado y fecha.
- Registrar una falta cuando existe asistencia del mismo día exige una
  confirmación explícita y queda marcado como conflicto en auditoría.
- Justificar reutiliza el wizard o servicio de `gf_hr_ops` para conservar
  estado, usuario, fecha y recomputación de `rolling_count_30d`.
- Una falta procesada no puede editarse desde la PWA; requiere un nuevo evento
  administrativo o intervención de RRHH.

### Concurrencia

La respuesta de lectura incluirá `write_date` o un `version` equivalente. Los
PATCH exigirán esa versión. Si otro usuario o proceso cambió el registro, Odoo
responderá `409 stale_record` y la PWA recargará antes de permitir reintento.

## Auditoría

Se agregará un modelo dedicado, por ejemplo
`x_kold.hr.attendance.audit`, con:

- actor `hr.employee` resuelto desde el token;
- registro y modelo afectados;
- empleado objetivo;
- acción (`create`, `update`, `close`, `absence_create`,
  `absence_justify`);
- motivo administrativo;
- snapshot JSON anterior y posterior;
- fecha UTC;
- IP y agente de usuario cuando estén disponibles.

La auditoría será inmutable desde la PWA y de solo lectura para Angélica. Los
snapshots no almacenarán el binario del comprobante; solo metadatos seguros.
Una falla al registrar auditoría impedirá confirmar la escritura para evitar
cambios sin trazabilidad.

## Experiencia de usuario

### Encabezado y filtros

La ruta `/asistencias` abrirá en el día actual con:

- selector `Día`, `Semana` o `Rango`;
- fechas inicial y final;
- filtro `Todas`, `IGU`, `IGU34`;
- buscador por nombre o número de empleado;
- filtro por estado;
- botón `Exportar Excel`.

El encabezado mostrará tarjetas con empleados esperados, presentes, faltas,
registros incompletos y horas trabajadas.

### Lista

En escritorio se usará una tabla compacta. En móvil se usarán tarjetas. Cada
fila mostrará:

- número, nombre y puesto;
- cuenta analítica;
- fecha;
- entrada y salida;
- horas trabajadas;
- estado;
- acciones contextuales.

Acciones:

- `Registrar asistencia` para un día sin registro;
- `Corregir horario` para un registro existente;
- `Registrar salida` para un registro abierto;
- `Registrar falta` para un día esperado sin asistencia;
- `Justificar falta` cuando esté pendiente;
- `Ver historial` cuando exista auditoría.

Los formularios confirmarán el empleado y la fecha antes de guardar, exigirán
motivo administrativo y deshabilitarán el CTA durante la petición para impedir
doble envío.

## Formato Excel

El archivo se llamará:

`asistencias_IGU_IGU34_<fecha-inicial>_<fecha-final>.xlsx`

### Hoja `Resumen`

Encabezado con periodo, zona horaria, cuentas incluidas, fecha de generación y
actor que exportó. Tabla por empleado con:

- número;
- nombre;
- puesto;
- cuenta analítica;
- días esperados;
- días con asistencia;
- faltas;
- faltas justificadas;
- registros incompletos;
- horas trabajadas.

### Hoja `Asistencias`

Una fila por registro con:

- número de empleado;
- empleado;
- puesto;
- código y nombre de cuenta analítica;
- fecha local;
- entrada local;
- salida local;
- horas trabajadas;
- estado;
- observaciones;
- última modificación;
- responsable de la última modificación.

### Hoja `Faltas`

Una fila por falta con:

- número de empleado;
- empleado;
- cuenta analítica;
- fecha;
- motivo;
- estado;
- justificada `Sí/No`;
- notas;
- faltas acumuladas en 30 días;
- fecha y responsable de la justificación.

Las tres hojas tendrán encabezados fijos, autofiltro, anchos legibles, tipos
nativos de fecha/hora/número y estilos discretos. Las faltas y registros
incompletos se resaltarán sin depender solo del color. Los textos que comiencen
con `=`, `+`, `-` o `@` se neutralizarán para prevenir formula injection. No se
incluirán comprobantes ni imágenes biométricas.

## Manejo de errores

- `401 invalid_employee_token`: limpiar o renovar sesión según el flujo actual.
- `403 attendance_access_denied`: mostrar acceso denegado sin montar datos.
- `404 analytic_scope_not_configured`: indicar qué código falta en Odoo.
- `403 employee_out_of_scope`: recargar listado; el empleado cambió de cuenta.
- `409 attendance_overlap`: mostrar el registro en conflicto.
- `409 stale_record`: recargar antes de reintentar.
- `422 invalid_datetime_range`: mantener formulario y marcar campos.
- `409 absence_already_exists`: abrir la falta existente.
- error de exportación: conservar filtros y permitir reintento sin descargar un
  archivo parcial.

Las respuestas no expondrán trazas Python, tokens, snapshots de auditoría no
solicitados ni información de empleados fuera del alcance.

## Pruebas

### Backend Odoo

- token válido de Angélica accede; otro empleado recibe 403;
- header presente pero vacío o inválido falla cerrado;
- un `employee_id` de payload no cambia la identidad del actor;
- el alcance incluye empleados activos de `IGU` e `IGU34`;
- excluye empleados inactivos y cualquier otra cuenta;
- falla explícitamente si falta alguno de los códigos analíticos;
- crea y corrige `hr.attendance` con conversión local/UTC;
- rechaza salida anterior, traslape y registro abierto conflictivo;
- crea una falta única y reutiliza la lógica de justificación;
- recomputa `rolling_count_30d` al justificar;
- rechaza escrituras fuera de alcance aunque el ID exista;
- detecta versión obsoleta con 409;
- toda escritura crea auditoría atómica;
- el Excel contiene tres hojas, columnas acordadas y únicamente empleados
  autorizados.

### PWA

- solo la sesión de Angélica muestra y abre `Asistencias`;
- una sesión inválida u otro empleado no monta la ruta;
- el fallo de capacidades niega la superficie;
- los filtros generan los parámetros correctos;
- los estados se normalizan y resumen correctamente;
- formularios validan campos y bloquean doble envío;
- crear, corregir, cerrar, registrar falta y justificar refrescan la fila;
- `Exportar Excel` conserva filtros y descarga el nombre esperado;
- 401, 403, 409 y 422 muestran mensajes accionables sin perder filtros;
- tabla de escritorio y tarjetas móviles conservan las mismas acciones.

### Verificación integral

- pruebas unitarias y HTTP de `gf_hr_ops`;
- suite completa de Node de la PWA;
- lint y build de producción;
- abrir el `.xlsx` generado y verificar hojas, celdas, filtros, fechas y estilos;
- prueba manual con Angélica, un empleado `IGU`, uno `IGU34` y un empleado fuera
  del alcance;
- verificar que una corrección sea visible en Odoo y en su auditoría.

## Despliegue

1. Publicar y actualizar `gf_hr_ops` con modelos, seguridad, endpoints y
   allowlist de Angélica.
2. Verificar endpoints en producción con token autorizado y uno no autorizado.
3. Desplegar la PWA con el módulo y la ruta todavía protegidos por el backend.
4. Ejecutar smoke test de lectura y exportación.
5. Habilitar escrituras y comprobar una corrección controlada con auditoría.

El despliegue a Odoo y Vercel requerirá autorización separada. La
implementación local no modificará datos de producción.

## Fuera de alcance

- Cambiar el kiosco o el reconocimiento facial.
- Registrar automáticamente una falta por ausencia de check-in.
- Administrar empleados fuera de `IGU` o `IGU34`.
- Gestionar nómina, descuentos o sanciones.
- Modificar calendarios laborales desde esta pantalla.
- Exportar comprobantes o fotografías biométricas.
- Dar acceso a todos los gerentes de sucursal.
- Borrar permanentemente asistencias, faltas o auditoría desde la PWA.

## Criterios de aceptación

1. Solo Angélica autenticada puede consultar o modificar la superficie.
2. Cada lectura y escritura se limita server-side a empleados activos de
   `IGU` e `IGU34`.
3. Angélica puede registrar, corregir y cerrar asistencias válidas.
4. Angélica puede registrar y justificar faltas usando `x_kold.hr.falta`.
5. Traslapes, rangos inválidos, duplicados y conflictos de concurrencia se
   rechazan con mensajes accionables.
6. Cada escritura conserva auditoría atómica con actor y snapshots.
7. El tablero funciona en móvil y escritorio con filtros de fecha, cuenta,
   empleado y estado.
8. La descarga produce un `.xlsx` con `Resumen`, `Asistencias` y `Faltas`, sin
   incluir empleados fuera del alcance.
9. Las fechas se muestran en `America/Mexico_City` y se almacenan en UTC.
10. Las pruebas, lint y build no presentan regresiones.
