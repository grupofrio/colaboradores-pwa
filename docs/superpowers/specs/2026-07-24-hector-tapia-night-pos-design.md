# POS nocturno para Héctor Tapia

**Fecha:** 2026-07-24  
**Estado:** Diseño aprobado por el usuario  
**Alcance:** PWA Colaboradores

## Objetivo

Dar a Héctor Tapia un acceso independiente al POS para la venta nocturna de
Iguala. El flujo debe reutilizar el POS y el controlador que usa Angélica, sin
concederle acceso a las demás funciones de Admin Sucursal.

El cliente seleccionado inicialmente debe ser:

`Venta Publico Iguala Noche`

## Decisiones aprobadas

- El acceso será nominal para Héctor Tapia.
- Héctor conservará sus permisos actuales.
- No se le asignará el rol completo `auxiliar_admin`.
- El POS nocturno reutilizará el catálogo, precios, carrito, cobro, creación de
  la venta, ticket e impresión del POS existente.
- La venta se seguirá creando mediante `POST /pwa-admin/sale-create`.
- El cliente nocturno será el predeterminado, no un cliente bloqueado: Héctor
  podrá elegir otro cliente explícitamente con el selector existente.
- Angélica y los demás usuarios conservarán `VENTA PUBLICO IGUALA` como cliente
  predeterminado.

## Arquitectura

### 1. Identidad y política de acceso

Se agregará un helper puro para reconocer la sesión de Héctor Tapia. El helper:

- leerá las variantes de nombre ya presentes en la sesión (`name`,
  `display_name` y `employee.name`);
- normalizará mayúsculas, espacios y acentos;
- requerirá los tokens completos `hector` y `tapia`;
- rechazará sesiones inválidas, nombres parciales y otros empleados llamados
  Héctor.

La política se usará en tres lugares:

1. visibilidad de la tarjeta o entrada `POS nocturno`;
2. decisión de navegación;
3. guard de las rutas, incluida la URL directa del ticket.

La tarjeta será un módulo independiente del registry. No se añadirá
`almacenista_entregas`, `auxiliar_admin` ni otro rol a la allowlist del módulo.

### 2. Rutas

Se crearán rutas independientes:

- `/pos-nocturno`
- `/pos-nocturno/ticket/:orderId`

Ambas estarán detrás de un guard nominal que:

- redirige a `/login` cuando no hay sesión válida;
- redirige a `/` cuando la sesión válida no corresponde a Héctor Tapia;
- monta el POS o el ticket solamente después de validar el acceso.

Las rutas actuales `/admin/pos` y `/admin/ticket/:orderId` no cambiarán.

La navegación global se ocultará durante el cobro y el ticket nocturno, igual
que en las rutas del POS administrativo, para evitar salidas accidentales.

### 3. Reutilización de pantallas

`ScreenPOS` y `ScreenTicket` aceptarán configuración de navegación con valores
predeterminados que preserven el flujo administrativo actual:

- ruta de regreso;
- prefijo de la ruta de ticket;
- ruta para iniciar una venta nueva;
- título o etiqueta del flujo cuando sea necesario.

El POS nocturno proporcionará las rutas `/pos-nocturno*`. El POS administrativo
seguirá usando `/admin*`.

No se duplicará la lógica del carrito, catálogo, lista de precios, cobro,
creación de ventas ni renderizado del ticket.

En escritorio, el POS nocturno se mostrará como una superficie independiente,
sin exponer la navegación lateral de Admin Sucursal. En móvil conservará la
misma experiencia responsive del POS actual.

### 4. Cliente predeterminado

El resolvedor local de `/pwa-admin/default-customer` elegirá el nombre objetivo
según la sesión:

- Héctor Tapia: `VENTA PUBLICO IGUALA NOCHE`;
- cualquier otro usuario: `VENTA PUBLICO IGUALA`.

La búsqueda seguirá respetando:

- compañía de la sesión;
- unidad analítica de Iguala;
- cliente activo;
- comparación exacta sin distinguir mayúsculas.

Para el flujo nocturno no se aplicará el fallback genérico `PUBLICO`, `PUBLIC` o
`MOSTRADOR`. Si el cliente nocturno no existe o está inactivo, el resolvedor
arrojará un `ApiError` con:

- estado HTTP semántico `404`;
- código `night_pos_default_customer_missing`;
- mensaje `No se encontró el cliente Venta Publico Iguala Noche.`

Así se evita seleccionar accidentalmente el cliente diurno y ambos formularios
pueden manejar el mismo contrato de error.

### 5. Estado de carga y cobro seguro

Tanto el formulario móvil como el de escritorio impedirán confirmar una venta
mientras no exista un `partner_id` válido.

Si falla la carga del cliente nocturno:

- se mostrará un mensaje claro;
- el carrito y el catálogo podrán seguir cargando;
- el botón de cobro permanecerá bloqueado hasta que se resuelva un cliente;
- Héctor podrá seleccionar manualmente un cliente válido mediante el buscador.

Esto evita que una carrera de carga o una configuración faltante produzca una
venta sin cliente o con el cliente público diurno.

### 6. Creación y atribución de la venta

No se creará un controlador nuevo. El flujo enviará al controlador existente:

- `warehouse_id`;
- `company_id`;
- `partner_id`;
- `pricelist_id`;
- forma y referencia de pago;
- líneas del carrito.

`POST /pwa-admin/sale-create` seguirá validando
`X-GF-Employee-Token` y guardando al empleado autenticado en la orden. Por lo
tanto, las ventas nocturnas quedarán atribuidas a Héctor aunque compartan el
mismo controlador con el POS de Angélica.

La implementación vigente del controlador fue verificada en
`gf_pwa_admin/controllers/pwa_admin_api.py`, método `api_sale_create`: resuelve
al empleado mediante `_resolve_employee_from_token_header()` y no aplica una
allowlist de `x_job_key`. Por ello, Héctor no necesita `auxiliar_admin` para
crear la venta. La tabla de roles de `docs/CODE_MANUAL.md` no refleja este
detalle del contrato actual.

La política nominal protege la exposición y las rutas de la PWA. Este cambio no
crea un endpoint nuevo ni amplía los permisos del controlador compartido.

## Flujo de datos

1. Héctor inicia sesión con sus credenciales actuales.
2. El modelo de navegación reconoce la identidad normalizada y muestra
   `POS nocturno`.
3. El guard valida nuevamente la sesión al abrir `/pos-nocturno`.
4. El POS consulta `/pwa-admin/default-customer`.
5. El resolvedor detecta a Héctor y busca exactamente
   `VENTA PUBLICO IGUALA NOCHE`.
6. Con su `partner_id`, el POS carga catálogo y lista de precios.
7. Héctor cobra usando el mismo flujo existente.
8. `/pwa-admin/sale-create` valida el token, crea la orden y la atribuye a
   Héctor.
9. La PWA abre `/pos-nocturno/ticket/:orderId`.

## Manejo de errores

- Sesión ausente o expirada: redirección a `/login`.
- Usuario diferente en una ruta nocturna: redirección a `/`.
- Cliente nocturno ausente o inactivo: `ApiError` con código
  `night_pos_default_customer_missing`, error visible y cobro bloqueado hasta
  seleccionar un cliente válido.
- Almacén ausente: se conserva `SessionErrorState`.
- Error de catálogo, precios o creación de venta: se conserva el manejo actual
  del POS.
- Respuesta de venta sin `order_id`: se conserva el error explícito actual y no
  se intenta navegar al ticket.

## Pruebas

### Acceso nominal

- reconoce `Héctor Tapia`, `HECTOR TAPIA` y variantes con segundo nombre;
- no reconoce `Héctor` sin apellido, `Héctor Pérez` ni `Juan Tapia`;
- no expone el módulo con una sesión inválida;
- muestra el módulo y permite la decisión directa para Héctor;
- niega la URL directa de POS y ticket a otros usuarios.

### Cliente predeterminado

- para Héctor busca exactamente `VENTA PUBLICO IGUALA NOCHE`;
- conserva `VENTA PUBLICO IGUALA` para Angélica y otros usuarios;
- conserva los filtros de compañía y unidad analítica;
- arroja `night_pos_default_customer_missing` y no degrada al cliente diurno
  cuando falta el cliente nocturno;
- normaliza correctamente la respuesta con lista de precios.

### Pantallas y navegación

- la venta nocturna navega al ticket nocturno;
- “Nueva venta” regresa al POS nocturno;
- las rutas administrativas conservan `/admin/pos` y `/admin/ticket`;
- no se muestra la navegación de Admin Sucursal a Héctor;
- el cobro queda deshabilitado sin cliente válido.

### Regresión

- ejecutar las pruebas de POS, clientes, catálogo, precios, navegación y guards;
- ejecutar la suite completa de Node;
- ejecutar lint y build de producción.

## Fuera de alcance

- Crear un segundo controlador POS.
- Crear un catálogo o una lista de precios nocturna adicional.
- Bloquear el selector para que siempre use el cliente nocturno.
- Dar acceso a gastos, requisiciones, cierres o liquidaciones.
- Cambiar permisos de otros empleados.
- Crear o modificar el contacto `Venta Publico Iguala Noche` en Odoo.
- Desplegar o modificar módulos backend de Odoo.

## Criterios de aceptación

1. Solo la sesión de Héctor Tapia ve y abre `POS nocturno`.
2. Héctor no obtiene acceso a Admin Sucursal.
3. El cliente inicial de su POS es `Venta Publico Iguala Noche`.
4. Angélica conserva `VENTA PUBLICO IGUALA`.
5. Héctor puede cambiar el cliente explícitamente.
6. No se puede cobrar sin un cliente válido.
7. La venta usa `/pwa-admin/sale-create` y queda atribuida a Héctor.
8. El ticket y la acción de nueva venta permanecen dentro del flujo nocturno.
9. Las pruebas y el build no presentan regresiones.
