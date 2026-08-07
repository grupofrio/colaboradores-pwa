# Héctor Tapia Night POS Cancellation and Today-Sales Design

**Fecha:** 2026-07-25
**Estado:** Diseño aprobado por el usuario

## Objetivo

Permitir que Héctor Tapia consulte exclusivamente sus ventas del día actual y
cancele una venta propia desde el POS nocturno seleccionando una razón cerrada,
sin darle acceso a Admin Sucursal ni debilitar las reglas de autorización del
backend.

## Requisitos aprobados

- Héctor solo ve ventas creadas por él mismo.
- El historial nocturno solo muestra el día actual en horario de México.
- Las ventas canceladas permanecen visibles con estado `Cancelada`.
- Una venta cancelada no puede cancelarse nuevamente.
- Héctor solo puede cancelar ventas propias creadas durante el día actual.
- El motivo es obligatorio y debe ser exactamente uno de:
  - `Duplicidad`;
  - `Error`;
  - `Canceló`;
  - `Falta de stock`.
- No existe texto libre para Héctor.
- Héctor no puede cancelar ventas iguales o superiores al umbral gerencial
  vigente, actualmente $5,000.
- El flujo administrativo de Angélica conserva sus permisos y su comportamiento
  actual.

## Estado actual

La PWA ya comparte `ScreenPOS` y `ScreenTicket` mediante `ADMIN_POS_FLOW` y
`NIGHT_POS_FLOW`. El flujo nocturno tiene `allowSaleCancellation: false`, por lo
que el ticket de Héctor no muestra la acción de cancelación.

El controlador `/pwa-admin/today-sales` ya resuelve al empleado desde
`X-GF-Employee-Token`, limita las órdenes con el dominio del empleado y permite
consultar una fecha individual. Actualmente excluye órdenes en estado
`cancel`.

El controlador `/pwa-admin/sale-cancel` exige `allow_cancel_sales`, acepta un
motivo de texto libre y resuelve al empleado desde datos compatibles con el
flujo administrativo existente. Ese contrato no basta para Héctor: habilitar
solo el botón produciría un rechazo o, si se ampliara el permiso sin más
controles, podría permitir cancelar una orden ajena.

## Enfoques considerados

### 1. Extender los controladores compartidos con una política nocturna

Es el enfoque elegido. Conserva los endpoints existentes, añade una rama de
autorización explícita para Héctor y mantiene el comportamiento administrativo
actual. Evita duplicar lógica de ventas, cancelación e inventario.

### 2. Crear endpoints exclusivos para el POS nocturno

Separaría los contratos visualmente, pero duplicaría búsquedas, serialización,
cancelación, reversión de inventario y mensajes de error. También contradice el
objetivo previo de compartir el controlador POS.

### 3. Filtrar y validar únicamente en la PWA

Se descarta porque el cliente no es una frontera de seguridad. Un usuario
podría invocar el endpoint directamente con otro `order_id` o un motivo no
permitido.

## Diseño de navegación y pantallas

### Entrada al historial

El POS nocturno mostrará una acción secundaria `Ventas de hoy` tanto en móvil
como en escritorio. La acción navegará a:

```text
/pos-nocturno/ventas
```

La ruta estará dentro de `NightPosRoute`, por lo que exigirá una sesión válida y
la identidad autoritativa de Héctor Tapia. No se añadirá acceso a rutas bajo
`/admin`.

### Lista de ventas

La pantalla mostrará las ventas en orden descendente por hora. Cada fila
incluirá:

- hora;
- folio;
- cliente;
- total;
- estado `Activa`, `Cerrada` o `Cancelada`.

La pantalla tendrá estados explícitos de carga, lista vacía y error. No tendrá
selector de fecha ni aceptará un rango: su periodo es siempre el día actual.
Una fila abrirá el ticket nocturno existente en
`/pos-nocturno/ticket/:orderId`. Esa URL no confiará en que la fila provino del
historial: el controlador de detalle aplicará nuevamente propiedad estricta y
fecha de hoy antes de devolver datos a Héctor.

### Cancelación desde el ticket nocturno

`NIGHT_POS_FLOW` habilitará cancelación y declarará las cuatro razones
permitidas. `ScreenTicket` conservará el textarea actual para el flujo
administrativo, pero en el flujo nocturno mostrará un selector de una sola
opción con los cuatro motivos aprobados.

El botón de confirmación estará deshabilitado hasta seleccionar una opción. La
PWA mostrará la acción solo cuando el detalle devuelto por Odoo incluya
`can_cancel: true`; no duplicará en JavaScript el umbral configurable ni las
reglas de estado. Para una venta no elegible, Odoo devolverá también un
`cancel_block_code` estable que la PWA traducirá a un mensaje seguro.

Una venta cancelada o cerrada mostrará su estado y no ofrecerá la acción.
Después de una cancelación exitosa, el ticket se recargará y el historial
mostrará la venta como `Cancelada` en su siguiente carga.

## Contrato de razones

La PWA enviará un código canónico, no el texto libre:

| Código | Etiqueta visible |
|---|---|
| `duplicate` | `Duplicidad` |
| `error` | `Error` |
| `customer_cancelled` | `Canceló` |
| `out_of_stock` | `Falta de stock` |

Odoo mantendrá la allowlist y traducirá el código a la etiqueta que se guarda
en el chatter. Un código desconocido, vacío, repetido como texto arbitrario o
enviado por un empleado nocturno no autorizado será rechazado.

El flujo administrativo existente podrá continuar enviando su campo `reason`
de texto libre. La política cerrada solo se aplica a la autorización nocturna
de Héctor.

## Autorización y alcance del backend

### Historial de hoy

`/pwa-admin/today-sales` seguirá resolviendo al empleado desde
`X-GF-Employee-Token`. Para la consulta nocturna:

1. el servidor reconocerá a Héctor mediante el nombre autoritativo del registro
   de empleado;
2. el día efectivo será forzado al día actual de `America/Mexico_City`;
3. el dominio exigirá `x_pwa_employee_id = employee.id`;
4. se conservarán compañía, almacén y canales POS permitidos;
5. se incluirán estados `sale`, `done` y `cancel` para que las canceladas sigan
   visibles.

La PWA no podrá solicitar días anteriores cambiando parámetros. El contrato
administrativo actual de `/today-sales` conservará la consulta por fecha y su
scope vigente.

### Detalle de venta nocturna

`/pwa-admin/sale-detail` ya resuelve al empleado desde el token. Cuando el
empleado autoritativo sea Héctor, el controlador exigirá además:

1. `x_pwa_employee_id` presente e igual a `employee.id`;
2. `date_order` dentro del día actual de México;
3. compañía, almacén y analítica dentro del alcance del empleado.

Una orden ajena, anterior o legacy se responderá como fuera de alcance, sin
revelar si existe. El detalle incluirá `can_cancel` y `cancel_block_code`,
calculados con el mismo helper de decisión que revalidará `/sale-cancel`. De
esta forma, una URL directa no amplía lo que muestra el historial y la PWA no
fija el umbral de $5,000 en el bundle.

### Cancelación

`/pwa-admin/sale-cancel` aplicará esta precedencia de identidad:

1. si existe un `X-GF-Employee-Token` válido, el empleado del token es la única
   identidad autoritativa y se ignora cualquier identidad del payload;
2. la autorización especial nocturna solo existe cuando ese token resuelve a
   Héctor Tapia;
3. si no existe token, se conserva la resolución legacy exclusivamente para el
   contrato administrativo existente; esa ruta nunca puede activar la
   autorización especial de Héctor mediante `employee_id`, nombre o rol del
   payload.

Para otros empleados que sí presenten token, el empleado del token se evalúa
con la política administrativa existente de `allow_cancel_sales`.

Para Héctor, el servidor comprobará antes de `action_cancel()`:

1. identidad exacta de Héctor Tapia;
2. orden existente;
3. `x_pwa_employee_id` presente e igual al empleado autenticado;
4. compañía, almacén y analítica dentro de su alcance;
5. `date_order` dentro del día actual de México;
6. estado exactamente `sale`; la única transición nocturna admitida es
   `sale → cancel`;
7. importe menor al umbral configurado de cancelación gerencial;
8. `reason_code` dentro de la allowlist nocturna.

Las órdenes legacy sin `x_pwa_employee_id` no se consideran propias de Héctor y
se rechazan. Las ventas iguales o superiores al umbral conservan el mensaje de
que debe intervenir un gerente.

Para otros empleados, se conserva la política actual basada en
`allow_cancel_sales`, motivo obligatorio y validación gerencial por importe.
La decisión nocturna `can_cancel` será una función compartida y pura respecto a
empleado, orden, fecha actual y configuración; `/sale-detail` la expone y
`/sale-cancel` la vuelve a ejecutar inmediatamente antes de modificar la orden.

## Flujo de datos

### Consulta

1. Héctor abre `Ventas de hoy`.
2. La PWA llama al controlador compartido con la intención nocturna y el token
   de sesión.
3. Odoo fuerza la fecha de hoy y limita por empleado, compañía y almacén.
4. La PWA presenta ventas `Activa`, `Cerrada` y `Cancelada` sin permitir escoger
   otra fecha.

### Cancelación

1. Héctor abre una venta activa propia.
2. Selecciona una de las cuatro razones.
3. La PWA envía `order_id` y `reason_code` al controlador compartido.
4. Odoo valida identidad, propiedad, día, alcance, importe, estado y razón.
5. Odoo ejecuta `action_cancel()`, verifica el estado resultante y registra en
   chatter la etiqueta del motivo y el empleado autenticado.
6. La PWA recarga el ticket y refleja la venta como cancelada.

## Manejo de errores

- Sesión inválida: redirección a `/login`.
- Empleado distinto de Héctor en rutas nocturnas: redirección a `/`.
- Venta ajena o sin atribución PWA: rechazo sin revelar detalles de la orden.
- Venta de otro día: rechazo; el historial no ofrece acceso a días anteriores.
- URL directa a ticket ajeno, anterior o legacy: respuesta genérica de fuera de
  alcance.
- Venta ya cancelada: mensaje `La orden ya está cancelada` y sin segundo intento.
- Venta `done`: requiere reversión manual.
- Venta en o sobre el umbral: mensaje de autorización gerencial.
- Motivo ausente o fuera de allowlist: rechazo antes de modificar la orden.
- Fallo al revertir inventario: se conserva el manejo actual y se muestra el
  mensaje seguro del backend.

## Pruebas

### PWA

- `NIGHT_POS_FLOW` habilita cancelación y expone exactamente cuatro razones.
- `ADMIN_POS_FLOW` conserva su cancelación de texto libre.
- la ruta `/pos-nocturno/ventas` está protegida por `NightPosRoute`;
- el historial no contiene controles de fecha y solicita solo ventas de hoy;
- solo se muestran ventas devueltas por el endpoint y se conservan canceladas;
- una fila abre el ticket nocturno correcto;
- el ticket nocturno exige un motivo cerrado y nunca envía texto libre;
- el ticket usa `can_cancel` del backend y no fija el umbral en la PWA;
- una venta cancelada o `done` no muestra acción de cancelación y `done` se
  etiqueta `Cerrada`;
- regresiones de navegación, POS, ticket y Angélica siguen verdes.

### Backend

- Héctor obtiene solo sus ventas de hoy;
- una fecha manipulada no expone ventas anteriores;
- las canceladas se incluyen y conservan estado;
- `sale-detail` rechaza URL directa a venta ajena, anterior o legacy;
- `sale-detail` expone `can_cancel` y `cancel_block_code` desde la misma decisión
  que usa la mutación;
- una venta propia activa y menor al umbral se cancela con cada código válido;
- venta ajena, legacy sin atribución, día anterior, razón inválida, `done`,
  cancelada y venta en/sobre el umbral se rechazan;
- el payload no puede suplantar la identidad del empleado;
- la resolución legacy administrativa no puede activar el permiso nocturno de
  Héctor;
- los empleados administrativos conservan el contrato actual;
- la cancelación registra empleado y etiqueta canónica en chatter.

## Criterios de aceptación

1. Héctor abre `Ventas de hoy` desde su POS nocturno.
2. Solo ve ventas atribuidas a él y pertenecientes al día actual de México.
3. Las ventas canceladas siguen visibles con estado `Cancelada`.
4. Solo una venta en estado `sale`, propia, de hoy y menor al umbral devuelve
   `can_cancel: true` y ofrece cancelación.
5. La cancelación exige una de las cuatro razones y no permite texto libre.
6. Odoo rechaza venta ajena, otro día, razón inválida o importe restringido.
7. Héctor no obtiene acceso a Admin Sucursal.
8. Angélica y los administradores conservan el comportamiento existente.
9. Las pruebas de PWA, backend disponible, lint y build pasan sin regresiones.

## Fuera de alcance

- Consultar días anteriores o rangos de fecha.
- Cancelar ventas de otros empleados.
- Cancelar ventas iguales o superiores al umbral sin gerente.
- Editar una razón o agregar texto libre para Héctor.
- Modificar el cliente nocturno o el flujo de cobro.
- Crear un controlador POS nocturno separado.
