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

El manifest de `gf_hr_ops` declarará dependencia explícita de
`gf_logistics_ops`, que es el módulo propietario de
`gf.employee.mobile.session`. La autenticación no dependerá de que ese modelo
esté instalado accidentalmente por otro módulo.

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
usarán un helper puro en `src/modules/asistencias/access.js`. El helper leerá
la allowlist de IDs desde `VITE_ATTENDANCE_MANAGER_EMPLOYEE_IDS`; producción la
configurará con `717`, la identidad productiva verificada de Angélica. No se
usará nombre ni rol para conceder visibilidad.

Este gate cliente solo mejora la experiencia. El backend seguirá siendo la
única autoridad de lectura y escritura. La pantalla consultará además un
endpoint de capacidades al montar; una discrepancia entre el gate local y la
configuración server-side mostrará acceso denegado y nunca datos parciales.
La configuración de despliegue actualizará conjuntamente la variable de la
PWA y `gf_hr_ops.pwa_attendance_manager_employee_ids`; una prueba de smoke
comparará el resultado del helper con `capabilities.allowed` para detectar
drift sin convertir el gate local en autoridad.

### 3. Fuentes de datos

El tablero combinará:

- empleados activos en `IGU` e `IGU34`;
- registros `hr.attendance` que intersecten el rango solicitado;
- registros `x_kold.hr.falta` del mismo rango;
- calendario laboral de cada empleado para determinar si era un día esperado.

La unidad canónica del tablero será un **empleado-día**. Un empleado-día puede
contener cero, uno o varios tramos `hr.attendance` no traslapados. Esto permite
representar salidas a comida y reingresos sin perder registros.

`Sin registro` será un indicador operativo, no una falta creada
automáticamente. Solo se mostrará cuando el calendario del empleado indique
que debía laborar y no exista asistencia ni falta. Angélica deberá confirmar
explícitamente `Registrar falta`. Si el empleado no tiene calendario laboral
utilizable, la PWA no inferirá una falta.

Un tramo nocturno se asignará al empleado-día de su `check_in` convertido a
`America/Mexico_City`, aunque su `check_out` ocurra al día siguiente. Los
filtros de rango usarán esa fecha local de entrada. El servicio ampliará sus
límites UTC internos para no perder registros que crucen medianoche y después
aplicará la fecha local canónica.

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
    "employees_in_scope": 48,
    "expected": 48,
    "present": 42,
    "unscheduled_present": 1,
    "absent": 3,
    "unscheduled_absent": 1,
    "incomplete": 2,
    "missing_expected": 3,
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
      "attendances": [
        {
          "id": 500,
          "check_in": "2026-07-26T08:03:00-06:00",
          "check_out": "2026-07-26T17:02:00-06:00",
          "worked_hours": 8.98,
          "version": "2026-07-26T23:03:15Z"
        }
      ],
      "worked_hours": 8.98,
      "absence": null,
      "status": "complete",
      "notes": ""
    }
  ]
}
```

Cuando existe una falta, `absence` usa esta forma:

```json
{
  "id": 700,
  "date": "2026-07-26",
  "absence_reason": "no_show",
  "state": "pendiente",
  "justified": false,
  "notes": "",
  "rolling_count_30d": 2,
  "justification_date": null,
  "justified_by": null,
  "version": "2026-07-26T14:05:00Z"
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

Los totales se definen así:

- `employees_in_scope`: empleados distintos incluidos después de filtros;
- `expected`: empleado-días con jornada esperada;
- `present`: empleado-días esperados con al menos un tramo de asistencia;
- `unscheduled_present`: empleado-días no programados con al menos un tramo de
  asistencia;
- `absent`: empleado-días esperados con una falta y sin asistencia;
- `unscheduled_absent`: empleado-días no programados con una falta y sin
  asistencia;
- `missing_expected`: empleado-días esperados sin asistencia ni falta;
- `incomplete`: empleado-días con al menos un tramo abierto; es un subconjunto
  diagnóstico de los días con asistencia y puede coincidir con `present` o
  `unscheduled_present`, por lo que no es una categoría sumable aparte;
- `worked_hours`: suma de horas de tramos cerrados.

Para empleado-días esperados se cumple
`present + absent + missing_expected = expected`. Las asistencias en un día no
programado cuentan en `unscheduled_present`, pero no en `present` ni
`expected`. Las faltas de días no programados cuentan en
`unscheduled_absent`, pero no en `absent` ni `expected`.

La precedencia de estado será:

1. si existe una falta, `absence_pending`, `absence_justified` o
   `absence_processed` según su estado;
2. si no hay falta y algún tramo está abierto, `open`;
3. si no hay falta y hay uno o más tramos cerrados, `complete`;
4. sin registros en jornada esperada, `missing_expected`;
5. sin registros ni jornada esperada, `not_scheduled`.

El backend no permitirá crear una falta para un empleado-día que ya tenga
asistencia, por lo que los casos 1 y 2/3 no coexistirán.

### `POST /pwa-hr/attendance`

Crea una asistencia con:

- `employee_id`;
- `check_in` local ISO;
- `check_out` local ISO opcional;
- `change_reason` obligatorio como motivo administrativo de la creación.

Respuesta:

```json
{
  "ok": true,
  "record": {
    "id": 500,
    "employee_id": 100,
    "check_in": "2026-07-26T08:03:00-06:00",
    "check_out": null,
    "worked_hours": 0,
    "version": "2026-07-26T14:03:15Z"
  },
  "audit_id": 900
}
```

### `PATCH /pwa-hr/attendance/<attendance_id>`

Permite corregir `check_in` y `check_out`. No permite cambiar el empleado
propietario. Cerrar un registro abierto utiliza el mismo endpoint enviando
`check_out`; toda operación exige `change_reason`.

Payload exacto:

```json
{
  "check_in": "2026-07-26T08:03:00-06:00",
  "check_out": "2026-07-26T17:02:00-06:00",
  "version": "2026-07-26T14:03:15Z",
  "change_reason": "Corrección autorizada por supervisión"
}
```

Al menos uno de `check_in` o `check_out` debe estar presente. `version` y
`change_reason` son obligatorios. La respuesta conserva la envoltura de
creación con el registro actualizado, su nueva versión y `audit_id`.

### `POST /pwa-hr/faltas`

Crea una falta para un empleado y fecha con:

- `employee_id`;
- `date=YYYY-MM-DD`;
- `absence_reason`: `retardo_bloqueado`, `no_show` u `otro`;
- `notes` opcionales;
- `confirm_unscheduled` booleano, requerido en `true` solo cuando el calendario
  no marca la fecha como jornada esperada;
- `change_reason` obligatorio como motivo administrativo de la captura.

Respeta la unicidad existente por empleado y fecha. Si ya existe cualquier
tramo de asistencia en ese empleado-día, responde
`409 attendance_exists_for_date`; no existe un flag cliente para sobrepasar
esta regla.

Si el día no es esperado y `confirm_unscheduled` no es `true`, responde
`409 unscheduled_absence_confirmation_required`. El servidor determina el
calendario; el cliente no puede declarar por sí mismo que el día era o no
programado.

La respuesta usa `{ ok, record, audit_id }`, donde `record` tiene la forma de
`absence` documentada por el endpoint de lectura e incluye `version`.

### `POST /pwa-hr/faltas/<falta_id>/justify`

Justifica una falta usando la lógica de negocio existente. Acepta tipo de
justificación, notas y comprobante opcional con nombre, MIME y contenido
base64. El backend validará límite de tamaño y tipos permitidos.

Payload exacto:

```json
{
  "justification_type": "cita_medica",
  "notes": "Consulta médica",
  "document_base64": "<opcional>",
  "document_name": "comprobante.pdf",
  "document_mime": "application/pdf",
  "version": "2026-07-26T14:03:15Z",
  "change_reason": "Comprobante revisado"
}
```

`justification_type` admite `imss`, `funeral`, `cita_medica` u `otro`.
`version` y `change_reason` son obligatorios. Si no se envía documento, los
tres campos de documento se omiten; si se envía, los tres son obligatorios.
La respuesta usa `{ ok, record, audit_id }` e incluye la nueva versión de la
falta.

El comprobante tendrá un máximo de 5 MiB después de decodificar y solo aceptará
`application/pdf`, `image/jpeg` o `image/png`. El backend validará MIME,
extensión y firma del archivo; un base64 inválido o un contenido que no
corresponda a su tipo declarado responderá `422 invalid_attachment`.

### `GET /pwa-hr/audit`

Devuelve el historial paginado de un `hr.attendance` o `x_kold.hr.falta`
autorizado. No acepta IDs fuera de `IGU`/`IGU34`.

Parámetros:

- `model=hr.attendance|x_kold.hr.falta`;
- `record_id=<entero positivo>`;
- `limit`, con valor predeterminado 25 y máximo 100;
- `offset`, con valor predeterminado 0.

Respuesta:

```json
{
  "total": 2,
  "limit": 25,
  "offset": 0,
  "rows": [
    {
      "id": 900,
      "action": "update",
      "actor": { "id": 717, "name": "Angelica Jaimes Dominguez" },
      "target_employee": { "id": 100, "name": "Empleado" },
      "change_reason": "Corrección autorizada por supervisión",
      "before": {
        "check_in": "2026-07-26T08:10:00-06:00",
        "check_out": "2026-07-26T17:02:00-06:00"
      },
      "after": {
        "check_in": "2026-07-26T08:03:00-06:00",
        "check_out": "2026-07-26T17:02:00-06:00"
      },
      "changed_at": "2026-07-26T23:03:15Z"
    }
  ]
}
```

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
- Un registro abierto del mismo empleado bloquea una nueva creación posterior.
- Los datetimes deben incluir fecha y hora válidas; el backend normaliza desde
  `America/Mexico_City` a UTC.
- Los cambios administrativos exigen motivo no vacío.
- Las restricciones nativas de `hr.attendance` siguen vigentes; el controlador
  no usa escritura SQL directa.

### Faltas

- Solo se permite una falta por empleado y fecha.
- Registrar una falta cuando existe asistencia del mismo empleado-día se
  rechaza con `409 attendance_exists_for_date`.
- Justificar reutiliza el wizard o servicio de `gf_hr_ops` para conservar
  estado, usuario, fecha y recomputación de `rolling_count_30d`.
- Una falta procesada no puede editarse desde la PWA; requiere un nuevo evento
  administrativo o intervención de RRHH.

### Concurrencia

La respuesta de lectura incluirá `version`, derivado de `write_date` en UTC,
en cada asistencia y falta. `PATCH` y la acción de justificar exigirán esa
versión. Si otro usuario o proceso cambió el registro, Odoo responderá
`409 stale_record` y la PWA recargará antes de permitir reintento.

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

Los historiales se ordenarán de forma estable por `changed_at desc, id desc`.

## Experiencia de usuario

### Encabezado y filtros

La ruta `/asistencias` abrirá en el día actual con:

- selector `Día`, `Semana` o `Rango`;
- fechas inicial y final;
- filtro `Todas`, `IGU`, `IGU34`;
- buscador por nombre o número de empleado;
- filtro por estado;
- botón `Exportar Excel`.

El encabezado mostrará tarjetas con jornadas esperadas, presentes, faltas,
registros incompletos y horas trabajadas. La tarjeta `Presentes` mostrará
`present + unscheduled_present` y desglosará las no programadas. La tarjeta
`Faltas` mostrará `absent + unscheduled_absent` y desglosará las no
programadas. Así la operación ve el total real sin alterar la ecuación de
jornadas esperadas.

### Lista

En escritorio se usará una tabla compacta. En móvil se usarán tarjetas. Cada
fila representará un empleado-día y mostrará:

- número, nombre y puesto;
- cuenta analítica;
- fecha;
- todos los tramos de entrada y salida de ese día;
- horas trabajadas totales;
- estado;
- acciones contextuales.

Acciones:

- `Registrar asistencia` para un día sin registro;
- `Agregar tramo` para un empleado-día que ya tiene tramos cerrados y no tiene
  una falta ni un tramo abierto;
- `Corregir horario` para un tramo existente;
- `Registrar salida` para el tramo abierto;
- `Registrar falta` para un día sin asistencia; si no era una jornada esperada,
  el formulario advertirá que se contabilizará como falta no programada y
  exigirá confirmación explícita;
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
- asistencias no programadas;
- faltas no programadas;
- faltas justificadas;
- registros incompletos;
- horas trabajadas.

### Hoja `Asistencias`

Una fila por tramo `hr.attendance` con:

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
- `409 attendance_exists_for_date`: no registrar falta; mostrar los tramos
  existentes del empleado-día.
- `409 unscheduled_absence_confirmation_required`: advertir que el día no era
  programado y pedir confirmación antes de reenviar.
- `422 invalid_attachment`: conservar el formulario y pedir un PDF, JPG o PNG
  válido de hasta 5 MiB.
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
- conserva varios tramos no traslapados en un mismo empleado-día;
- asigna un turno nocturno a la fecha local de su entrada;
- rechaza salida anterior, traslape y registro abierto conflictivo;
- crea una falta única y reutiliza la lógica de justificación;
- exige confirmación server-side para una falta no programada;
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
- los totales cuentan empleado-días, separan `unscheduled_present` y
  `unscheduled_absent`, y tratan `incomplete` como diagnóstico no sumable de
  los días con asistencia;
- se puede agregar un segundo tramo no traslapado a un empleado-día existente;
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
