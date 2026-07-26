# Assignable Day POS Role Design

**Fecha:** 2026-07-26
**Estado:** Diseño aprobado por el usuario

## Objetivo

Crear un permiso reutilizable de `POS diurno` que pueda asignarse a cualquier
perfil individual, inicialmente pensado para cubrir la operación de Ruth cuando
Angy no esté, sin depender del nombre de la persona ni compartir credenciales.

Quien tenga el permiso podrá crear ventas de día con el mismo controlador del
POS existente, imprimir sus tickets, consultar exclusivamente sus propias ventas
del día actual y cancelar una venta elegible seleccionando una razón cerrada.

## Requisitos aprobados

- El acceso se concede mediante un permiso asignable por perfil, no mediante un
  nombre hardcodeado.
- No se creará una cuenta genérica ni se compartirán credenciales.
- El módulo será independiente de `Admin Sucursal` y no otorgará acceso a sus
  demás funciones.
- El cliente predeterminado será exactamente `VENTA PUBLICO IGUALA`.
- Cada venta se atribuirá al empleado autenticado que la creó.
- El historial solo mostrará ventas propias del día actual en horario de México.
- Las ventas canceladas permanecerán visibles para conservar la trazabilidad.
- La impresión utilizará el flujo de ticket ya existente.
- La cancelación solo permitirá estas razones:
  - `Duplicidad`;
  - `Error`;
  - `Canceló`;
  - `Falta de stock`.
- No habrá texto libre en la cancelación del POS diurno.
- Las ventas iguales o superiores al umbral gerencial vigente, actualmente
  $5,000, no podrán cancelarse desde el perfil operativo.
- Angy conservará su POS administrativo y Héctor conservará su POS nocturno sin
  cambios funcionales.

## Estado actual

La PWA ya contiene dos flujos compartidos sobre las mismas pantallas:

- `ADMIN_POS_FLOW`, para Angy y los perfiles administrativos;
- `NIGHT_POS_FLOW`, para el POS nocturno de Héctor.

`ScreenPOS` recibe la configuración del flujo, `ScreenTicket` comparte la
presentación e impresión, y el POS nocturno ya incluye historial propio del día
y cancelación con razones cerradas.

En Odoo, `/pwa-admin/sale-create` resuelve la identidad desde
`X-GF-Employee-Token` y guarda la atribución en `x_pwa_employee_id`. Los
controladores de historial, detalle y cancelación ya contienen la política
restringida de Héctor y la política administrativa existente.

Los roles de la PWA se obtienen del `x_job_key` del puesto y de casillas
adicionales `pwa_extra_*` en `hr.employee`. El login entrega esos roles
adicionales a la sesión. Este mecanismo permite añadir `pos_diurno` sin ligar el
permiso a una persona concreta.

## Enfoques considerados

### 1. Crear el rol adicional `pos_diurno`

Es el enfoque elegido. Se añade una casilla `POS diurno` al perfil del empleado,
se publica el rol canónico `pos_diurno` en su sesión y se valida el mismo rol en
Odoo a partir del empleado autenticado. Mantiene la identidad individual y
permite asignar o retirar el módulo sin cambiar código.

### 2. Reutilizar el rol `auxiliar_admin`

Se descarta porque abriría `Admin Sucursal` y otras capacidades que no forman
parte del POS diurno. También mezclaría la política restringida de ventas propias
con la política administrativa de Angy.

### 3. Crear un usuario genérico compartido

Se descarta porque todas las ventas y cancelaciones quedarían atribuidas a una
sola cuenta, no a la persona que operó el POS. Esto impediría cumplir el
requisito de mostrar “solo mis ventas” y reduciría la trazabilidad de auditoría.

## Modelo de permiso

### Configuración en Odoo

`os_customer_zones` ampliará el catálogo canónico de roles adicionales con:

```text
pwa_extra_pos_diurno -> pos_diurno
```

`hr.employee` tendrá una casilla visible `POS diurno` en la sección de roles
adicionales. `get_pwa_additional_job_keys()` incluirá el rol cuando la casilla
esté marcada y el endpoint de login lo entregará mediante
`additional_job_keys` sin introducir un contrato nuevo.

También se reconocerá `pos_diurno` como `hr.job.x_job_key` primario para que el
rol siga siendo coherente con el modelo general de puestos, aunque la operación
prevista sea asignarlo como permiso adicional.

El código no marcará automáticamente a Ruth ni buscará nombres. Si ninguna ficha
de empleado tiene el permiso, nadie verá ni podrá usar el módulo.

### Autoridad

La sesión permite decidir qué se muestra en la PWA, pero no es la frontera de
seguridad. Cada operación sensible resolverá de nuevo al empleado desde el token
móvil y comprobará su rol primario o adicional en Odoo.

Un `role`, nombre, `employee_id`, compañía o almacén enviado por el cliente no
podrá activar el permiso ni sustituir la identidad del token.

## Navegación y pantallas

### Registro y rutas

El registro de módulos añadirá:

```text
id: pos_diurno
label: POS día
route: /pos-diurno
roles: [pos_diurno]
```

Las rutas serán:

```text
/pos-diurno
/pos-diurno/ventas
/pos-diurno/ticket/:orderId
```

Todas exigirán sesión válida y el rol efectivo `pos_diurno`. Una URL directa de
otro perfil redirigirá a inicio. La autorización del backend seguirá siendo la
defensa final aunque se manipule el bundle o se invoque el endpoint directamente.

### Flujo compartido

Se añadirá `DAY_POS_FLOW` junto a `ADMIN_POS_FLOW` y `NIGHT_POS_FLOW`. Declarará:

- ruta de captura `/pos-diurno`;
- ruta de ventas `/pos-diurno/ventas`;
- ruta base de ticket `/pos-diurno/ticket`;
- cliente predeterminado diurno;
- historial propio del día;
- cancelación cerrada con las cuatro razones aprobadas;
- impresión habilitada mediante el ticket compartido.

`ScreenPOS` y `ScreenTicket` seguirán siendo componentes compartidos. La vista de
ventas se generalizará como una pantalla de ventas restringidas configurable por
flujo, en lugar de copiar toda la implementación nocturna. Se podrán conservar
wrappers pequeños por ruta cuando ayuden a mantener imports claros.

### Captura de venta

El POS cargará catálogo, existencias y precios con el alcance vigente de
compañía, almacén y analítica. El cliente inicial será exactamente
`VENTA PUBLICO IGUALA`.

Si ese cliente no existe o no puede resolverse de forma inequívoca, el flujo
fallará cerrado y pedirá corregir la configuración; no elegirá silenciosamente
otro cliente. El usuario podrá conservar el selector de clientes que ya ofrece
el POS, pero el valor inicial será el cliente público aprobado.

Para `DAY_POS_FLOW`, la resolución considerará únicamente clientes activos cuyo
nombre coincida de forma exacta, sin distinguir mayúsculas y minúsculas, y cuyo
alcance pertenezca a la compañía y unidad analítica autorizadas de la sesión. No
se reutilizará un cliente de otra compañía ni se aplicarán los fallbacks
`PUBLICO`, `PUBLIC` o `MOSTRADOR`. Cero coincidencias devolverá
`day_pos_default_customer_missing`; más de una coincidencia elegible devolverá
`day_pos_default_customer_ambiguous`.

Al confirmar, `/pwa-admin/sale-create` guardará el empleado autenticado en
`x_pwa_employee_id` y en los campos compatibles disponibles. El rol
`pos_diurno` solo añadirá acceso a creación POS; no añadirá permisos
administrativos generales.

La orden creada guardará también `x_analytic_account_id` con la analítica
confiable validada contra el empleado y el almacén. Esta escritura es parte del
contrato, no solo una validación previa: garantiza que una venta recién creada
cumpla inmediatamente el mismo dominio usado por `Ventas de hoy` y por el
detalle del ticket.

En este alcance, “diurno” identifica el cliente, el módulo y el día calendario;
no introduce una ventana horaria para capturar ventas. Un empleado autorizado
puede crear una venta a cualquier hora mientras conserve el rol. Cualquier
restricción por horario requerirá una decisión y un cambio posteriores.

### Ventas de hoy

La pantalla `Ventas de hoy` no tendrá selector de fecha. Mostrará en orden
descendente:

- hora;
- folio;
- cliente;
- total;
- estado `Activa`, `Cerrada` o `Cancelada`.

El periodo será siempre el día actual de `America/Mexico_City`. El backend
forzará ese periodo aunque el cliente intente enviar otra fecha.

Cada fila abrirá el ticket diurno. El detalle volverá a validar propiedad, fecha
y alcance; no confiará en que la navegación haya comenzado en una fila válida.

### Ticket e impresión

El ticket reutilizará el formato, el nombre de cliente, la impresión ESC/POS y
el fallback del navegador existentes. No se creará una segunda implementación
de impresión.

El endpoint de detalle devolverá datos únicamente cuando la orden pertenezca al
empleado autenticado, sea del día actual y coincida con su compañía, almacén y
analítica autorizados.

## Contrato de cancelación

La PWA enviará un código canónico:

| Código | Etiqueta visible |
|---|---|
| `duplicate` | `Duplicidad` |
| `error` | `Error` |
| `customer_cancelled` | `Canceló` |
| `out_of_stock` | `Falta de stock` |

El backend será dueño de la allowlist y convertirá el código en la etiqueta
guardada en el chatter. Para el POS diurno se rechazará `reason` de texto libre,
un código vacío o cualquier valor fuera del catálogo.

Una venta solo será cancelable cuando:

1. pertenezca al empleado autenticado mediante `x_pwa_employee_id`;
2. pertenezca al día actual de México;
3. coincida con la compañía, almacén y analítica del empleado;
4. esté exactamente en estado `sale`;
5. sea menor al umbral gerencial configurado;
6. incluya un `reason_code` permitido.

Una venta `done` requerirá reversión manual. Una venta ya cancelada no podrá
cancelarse de nuevo. Las ventas iguales o superiores a $5,000 mostrarán que debe
intervenir un gerente; este diseño no introduce un flujo nuevo de aprobación
remota.

Si `gf_pwa_admin.cancel_manager_threshold` no está configurado, se conservará
el valor predeterminado de $5,000. Si el parámetro existe pero es negativo, no
numérico o no finito, la cancelación se bloqueará de forma segura.

La cancelación conservará el bloqueo transaccional y las revalidaciones
inmediatamente anteriores a `action_cancel()` para impedir dobles cancelaciones
concurrentes. Después del éxito se registrarán en chatter el empleado y la razón
canónica, se recargará el ticket y la venta seguirá visible como `Cancelada`.

## Política compartida del backend

Los helpers nocturnos específicos se generalizarán donde exista comportamiento
idéntico en ambos POS restringidos:

- resolución de alcance confiable de compañía, almacén y analítica;
- dominio de ventas propias del día;
- decisión `can_cancel` y `cancel_block_code`;
- allowlist de motivos y mensajes seguros;
- límites de estado e importe.

La condición de entrada seguirá siendo distinta:

- Héctor conserva su autorización nocturna compatible;
- el POS diurno exige el rol autoritativo `pos_diurno`.

Los requests del nuevo flujo incluirán una intención de POS diurno. Esa
intención nunca concederá acceso por sí sola: solo seleccionará la política
restringida después de validar el rol del empleado autenticado.

Un empleado que posea únicamente `pos_diurno` siempre quedará bajo el alcance
restringido, incluso si omite o altera la intención del request. Si una persona
también posee un rol administrativo real, sus capacidades administrativas
seguirán regidas por ese rol; al entrar por `/pos-diurno`, la UI utilizará el
flujo propio del día.

### Contrato y precedencia de la intención diurna

La intención canónica será `pos_scope=day`:

- `/pwa-admin/today-sales` la recibirá como query string;
- `/pwa-admin/sale-detail` la recibirá como query string junto a `order_id`;
- `/pwa-admin/sale-cancel` la recibirá en el cuerpo JSON junto a `order_id` y
  `reason_code`.

`DAY_POS_FLOW` declarará `posScope: 'day'`. Los wrappers PWA aceptarán el flujo
o el alcance explícito y el proxy enviará únicamente el valor allowlisted
`day`. Un valor desconocido nunca se eliminará silenciosamente para caer al
contrato administrativo: se rechazará antes del transporte o en Odoo.

La selección autoritativa de política será:

| Identidad/roles del token | Intención | Política |
|---|---|---|
| Solo `pos_diurno` | `day` | POS diurno restringido |
| Solo `pos_diurno` | omitida | POS diurno restringido; omitir no amplía acceso |
| Solo `pos_diurno` | inválida/manipulada | rechazo dentro de la política restringida; nunca admin |
| Sin `pos_diurno` | `day` | denegado |
| `pos_diurno` + rol administrativo | `day` | POS diurno restringido |
| `pos_diurno` + rol administrativo | omitida | contrato administrativo existente |
| Rol administrativo sin `pos_diurno` | omitida | contrato administrativo existente |
| Héctor | omitida o intención nocturna existente | política nocturna existente |
| Héctor | `day` sin rol diurno | denegado |
| Héctor + `pos_diurno` | `day` | POS diurno restringido |
| Héctor + `pos_diurno` | omitida o intención nocturna existente | política nocturna existente |

En `today-sales`, la coexistencia de `pos_scope=day` con `night_pos` se
rechazará. En detalle y cancelación, Héctor con `pos_scope=day` solo usará la
política diurna cuando también posea el rol `pos_diurno`; sin ese rol se
rechazará. Cualquier combinación incoherente de alcances también se rechazará.
Ningún conflicto escogerá la política más permisiva.

La compatibilidad de Héctor con `night_pos=1` se conserva. La nueva intención no
se utilizará para reconocer a Héctor ni sustituirá su política actual.

## Flujo de datos

### Creación e impresión

1. El empleado con `pos_diurno` inicia sesión con su perfil personal.
2. La PWA muestra `POS día` por su rol efectivo.
3. El POS carga `VENTA PUBLICO IGUALA` y el catálogo de su alcance.
4. La PWA envía la venta con el token de la sesión.
5. Odoo valida el rol y el alcance, crea la orden y la atribuye al empleado.
6. La PWA abre el ticket compartido y permite imprimirlo.

### Consulta

1. El empleado abre `Ventas de hoy`.
2. La PWA envía la intención diurna y el token.
3. Odoo fuerza el día actual de México y filtra por empleado, compañía,
   almacén y analítica.
4. La PWA presenta únicamente las filas devueltas, incluidas las canceladas.

### Cancelación

1. El empleado abre una venta activa propia desde el historial.
2. Selecciona una de las cuatro razones.
3. La PWA envía `order_id`, `reason_code` e intención diurna.
4. Odoo valida token, rol, propiedad, fecha, alcance, estado, importe y motivo.
5. Odoo bloquea y revalida la orden, ejecuta `action_cancel()` y registra la
   auditoría.
6. La PWA recarga el ticket y refleja el estado cancelado.

## Manejo de errores

- Sesión inválida: redirección a `/login`.
- Perfil sin `pos_diurno`: módulo oculto, ruta directa bloqueada y backend
  denegado.
- Permiso retirado con una sesión PWA todavía abierta: la tarjeta puede quedar
  visible hasta refrescar la sesión, pero Odoo rechaza inmediatamente los
  endpoints protegidos del POS diurno porque vuelve a consultar el rol del
  empleado.
- Cliente público ausente o ambiguo: captura bloqueada con mensaje de
  configuración.
- Empleado sin compañía, almacén o analítica coherentes: acceso operativo
  bloqueado.
- Venta ajena, anterior o legacy sin `x_pwa_employee_id`: respuesta genérica de
  fuera de alcance, sin confirmar si la orden existe.
- Venta cancelada: no se ofrece otra cancelación.
- Venta `done`: se informa que requiere reversión manual.
- Venta en o sobre el umbral: se informa que requiere gerente.
- Motivo ausente o inválido: rechazo previo a cualquier modificación.
- Dos cancelaciones concurrentes: solo una puede confirmar; la otra recibe el
  estado final seguro.
- Error de impresión: se conserva el fallback actual sin duplicar la venta.

## Pruebas

### PWA

- `pos_diurno` aparece como módulo únicamente para el rol primario o adicional;
- una sesión válida sin el rol no ve ni abre las rutas diurnas;
- `DAY_POS_FLOW` usa cliente, rutas, historial, razones e impresión aprobados;
- el POS diurno resuelve exactamente `VENTA PUBLICO IGUALA` y falla cerrado si
  falta, está duplicado, inactivo o fuera de alcance;
- los wrappers y el proxy conservan `pos_scope=day` en historial, detalle y
  cancelación, y rechazan valores desconocidos;
- `Ventas de hoy` no muestra selector de fecha;
- la pantalla usa el flujo diurno y abre su ruta de ticket;
- el ticket exige un motivo cerrado y no envía texto libre;
- `can_cancel` y `cancel_block_code` provienen del backend;
- una venta cancelada o `done` no muestra acción de cancelación;
- una sesión cuya casilla fue retirada muestra un error seguro aunque conserve
  temporalmente la tarjeta por caché;
- las regresiones de Angy y Héctor permanecen verdes;
- lint, pruebas completas y build terminan correctamente.

### Odoo

- el catálogo de roles publica `pwa_extra_pos_diurno -> pos_diurno`;
- el login entrega el rol cuando proviene de puesto primario o casilla adicional;
- el acceso no depende del nombre del empleado;
- `/sale-create` acepta `pos_diurno` y rechaza perfiles no autorizados;
- la venta creada se atribuye al empleado del token, no al payload;
- compañía, almacén y analítica fuera de alcance se rechazan;
- el historial fuerza hoy y devuelve solo ventas propias, incluidas canceladas;
- parámetros de fecha, empleado, compañía o almacén manipulados no amplían el
  resultado;
- el detalle rechaza una venta ajena, anterior o legacy;
- cada código canónico permitido cancela una venta propia elegible;
- razón libre, código inválido, venta ajena, día anterior, `done`, cancelada y
  venta en/sobre el umbral se rechazan;
- dos perfiles `pos_diurno` no pueden consultar o cancelar ventas entre sí;
- la matriz completa de intención diurna, omisión, manipulación, roles mixtos y
  conflicto con intención nocturna falla cerrada según el contrato;
- una venta recién creada guarda empleado y analítica confiables y aparece en
  historial y detalle sin backfill;
- la cancelación concurrente conserva una sola transición y una sola auditoría;
- el corte de medianoche de México incluye el primer instante del día y excluye
  el primer instante del siguiente;
- exactamente $5,000 requiere gerente y $4,999.99 conserva la decisión normal;
- un umbral ausente conserva $5,000; uno negativo, no numérico o no finito
  bloquea la cancelación;
- retirar `pwa_extra_pos_diurno` revoca inmediatamente el backend aun con una
  sesión cliente abierta;
- Angy conserva el contrato administrativo y Héctor el contrato nocturno.

### Integración de cliente y venta

- la resolución diurna acepta una única coincidencia exacta, activa y dentro del
  alcance autorizado;
- cero coincidencias, dos coincidencias exactas, cliente inactivo o cliente de
  otra compañía/unidad se rechazan sin usar fallbacks;
- una prueba integral crea la venta, confirma `x_pwa_employee_id` y
  `x_analytic_account_id`, la consulta en `Ventas de hoy` y abre su detalle.

## Despliegue y asignación

1. Incrementar la versión de `os_customer_zones` y `gf_pwa_admin` y actualizar
   ambos módulos Odoo para instalar el campo, la vista, el catálogo de roles y
   los controladores.
2. Desplegar la PWA con el nuevo módulo y rutas.
3. Confirmar que existe exactamente el cliente `VENTA PUBLICO IGUALA` en la
   compañía correspondiente.
4. Solo después de actualizar backend y PWA, marcar `POS diurno` en la ficha del
   empleado autorizado, por ejemplo Ruth.
5. Cerrar su sesión anterior e iniciar sesión nuevamente para recibir el rol.
6. Realizar una venta de prueba, imprimir el ticket, consultar `Ventas de hoy` y
   validar una cancelación menor al umbral.

Retirar la casilla elimina inmediatamente la autorización del backend. La PWA
dejará de mostrar el módulo al refrescar o renovar la sesión, sin requerir
cambios de código.

## Criterios de aceptación

1. Un empleado con `pos_diurno` ve y abre `POS día`; otro empleado no.
2. El POS inicia con `VENTA PUBLICO IGUALA` y crea la orden con la identidad del
   token.
3. El ticket puede imprimirse con el mecanismo existente.
4. `Ventas de hoy` solo muestra ventas propias del día actual de México.
5. Las canceladas permanecen visibles con su estado.
6. Solo una venta propia, de hoy, en estado `sale` y menor al umbral ofrece
   cancelación.
7. La cancelación exige exactamente una de las cuatro razones aprobadas.
8. Odoo rechaza suplantación, venta ajena, otro día, razón inválida e importe
   restringido.
9. El permiso no abre `Admin Sucursal` ni depende de un nombre concreto.
10. Angy, Héctor y el resto de módulos conservan su comportamiento actual.

## Fuera de alcance

- Crear o compartir una cuenta genérica de POS.
- Asignar automáticamente el permiso a Ruth desde el código.
- Mostrar ventas de días anteriores o un rango de fechas.
- Restringir la creación de ventas a horas específicas del día.
- Consultar o cancelar ventas de otros empleados.
- Añadir motivos libres o modificar las cuatro razones.
- Crear un flujo de aprobación remota para ventas de $5,000 o más.
- Cambiar el cliente, precios, cobro o formato visual del ticket de Angy.
- Dar acceso a `Admin Sucursal` mediante `pos_diurno`.
