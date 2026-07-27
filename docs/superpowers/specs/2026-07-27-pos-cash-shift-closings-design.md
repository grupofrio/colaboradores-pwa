# POS Cash Shift Closings Design

**Fecha:** 2026-07-27  
**Estado:** Diseño aprobado por el usuario

## Objetivo

Crear cortes de caja manuales por turno para el POS de la sucursal, con turnos
`Noche` y `Día`, arqueo físico, reporte de ventas por producto y una fecha
operativa que agrupe la noche iniciada el día calendario anterior con el día que
le corresponde.

Angy administrará los cortes. Las ventas capturadas desde cualquiera de los
flujos POS de la PWA —administrativo, diurno restringido o nocturno— pertenecerán
al turno activo de la sucursal, independientemente de quién las capture. Los
usuarios operativos no adquirirán permisos de caja por este cambio.

## Requisitos aprobados

- Los cortes serán manuales; no habrá cierre automático.
- Los horarios normales serán aproximadamente 06:00 y 18:00, en
  `America/Mexico_City`.
- Las 06:00 y 18:00 serán referencias para avisos, no límites automáticos.
- El intervalo real terminará cuando Angy confirme el corte.
- El corte cerrará el turno actual y abrirá el siguiente en el mismo instante.
- La noche que empieza el 26 aproximadamente a las 18:00 será `Noche 27` y será
  el primer turno de la fecha operativa 27.
- Angy capturará manualmente el fondo inicial de cada turno.
- Cada corte tendrá arqueo por denominación y cálculo de diferencia.
- Los gastos PWA del turno se descontarán del efectivo esperado.
- Las ventas con terminal se reportarán, pero no aumentarán el efectivo esperado.
- El reporte incluirá desglose por producto.
- Una venta capturada por Angy durante el turno nocturno pertenecerá al corte
  nocturno; la identidad del vendedor no decide el turno.
- Un corte cerrado será una fotografía auditable e inmutable.
- Para cancelar una venta de un corte cerrado será obligatorio reabrirlo con una
  razón, cancelar y volver a cerrarlo.
- Los cierres diarios históricos existentes se conservarán.

## Estado actual

La PWA comparte `ScreenPOS` y `ScreenTicket` entre tres políticas:

- `ADMIN_POS_FLOW`, usado por los perfiles administrativos;
- `DAY_POS_FLOW`, usado por el permiso asignable `pos_diurno`;
- `NIGHT_POS_FLOW`, usado por el POS nocturno.

Todos crean ventas mediante `/pwa-admin/sale-create`. El backend conserva el
empleado autenticado en `x_pwa_employee_id`, el almacén, la compañía, la cuenta
analítica y el método de pago. La consulta `/pwa-admin/today-sales` ya puede
entregar pedidos y un desglose agregado por producto.

El cierre actual usa `gf.cash.closing` y la unicidad
`company_id + warehouse_id + date`. Sus totales se calculan por día calendario,
no por turno ni por fecha operativa. Además, su total esperado trata las ventas
como un solo importe; por sí solo no representa el nuevo contrato de efectivo
contra terminal. Por ello no se reutilizará este registro como si fuera un turno.

## Enfoques considerados

### 1. Modelo nuevo de corte de turno

Es el enfoque elegido. Mantiene una sesión de caja por turno, liga cada movimiento
PWA al turno activo y persiste una fotografía al cerrarlo. Permite conservar los
cierres diarios históricos y modelar explícitamente la fecha operativa.

### 2. Convertir `gf.cash.closing` en un registro por turno

Se descarta porque cambia el significado de datos históricos, obliga a migrar su
restricción de unicidad y aumenta el riesgo de romper la pantalla y autorizaciones
del cierre diario existente.

### 3. Consultar ventanas horarias sin persistir cortes

Se descarta porque un reporte histórico podría cambiar después de una cancelación,
un gasto tardío o una modificación. Tampoco resolvería de forma segura una venta
concurrente con el momento del corte.

## Terminología

- **Turno activo:** sesión de caja que recibe las nuevas ventas y gastos PWA de
  una sucursal.
- **Fecha operativa:** fecha a la cual pertenecen `Noche` y `Día`, aunque la
  noche haya iniciado en la tarde del día calendario anterior.
- **Corte:** cierre manual y auditable de un turno, con arqueo y fotografía de
  sus movimientos.
- **Consolidado operativo:** suma de `Noche` y `Día` de una fecha operativa. Es
  un reporte, no un tercer arqueo.

## Ciclo de turnos

### Secuencia normal

Por cada combinación de compañía y almacén habrá como máximo un turno abierto.
La secuencia será alternante:

```text
Noche D -> Día D -> Noche D+1 -> Día D+1
```

Ejemplo:

```text
Noche 27: 2026-07-26 18:03 -> 2026-07-27 06:08
Día 27:   2026-07-27 06:08 -> 2026-07-27 18:01
Noche 28: 2026-07-27 18:01 -> ...
```

El instante efectivo será la hora del servidor en la confirmación. Si Angy
corta a las 06:15, los movimientos creados hasta la transición pertenecerán a
`Noche`; no se reasignarán artificialmente a las 06:00.

### Transición atómica

El cierre tomará un bloqueo transaccional por compañía y almacén. En una sola
transacción deberá:

1. bloquear y volver a validar el turno abierto;
2. fijar la hora efectiva de cierre;
3. capturar las ventas y gastos ligados al turno;
4. calcular y persistir la fotografía del corte;
5. aplicar las reglas de diferencia y autorización;
6. crear el turno siguiente con la misma hora de apertura;
7. guardar el fondo inicial del siguiente turno capturado por Angy.

Una venta o un gasto concurrente con el corte deberá serializarse contra el mismo
bloqueo. El movimiento quedará completo en el turno anterior o en el siguiente,
nunca en ambos y nunca sin turno.

El turno siguiente podrá abrir aunque el corte quede `pending_auth`; el dinero
operativo no debe detenerse mientras un gerente o dirección autoriza una
diferencia. El corte pendiente conservará el mismo bloqueo de edición y
cancelación que un corte cerrado.

### Horarios de referencia

Los valores por defecto serán:

- fin esperado de `Noche`: 06:00;
- fin esperado de `Día`: 18:00;
- zona horaria: `America/Mexico_City`.

Serán parámetros configurables del backend. La PWA mostrará recordatorios de
corte y una advertencia cuando el turno exceda su hora esperada, pero no llamará
al endpoint de cierre automáticamente.

### Primera apertura

El despliegue no inventará un turno histórico. Angy verá `Abrir primer turno` y
capturará:

- compañía y almacén provenientes de su alcance confiable;
- tipo de turno;
- fecha operativa;
- inicio efectivo;
- fondo inicial.

Para permitir un arranque a mitad de turno, esta única operación podrá proponer
una hora inicial anterior. Antes de confirmar mostrará las ventas y gastos PWA
elegibles entre ese inicio y el momento actual. El backend rechazará movimientos
ya ligados a otro turno y cualquier intervalo que traslape un corte existente.
Después de la apertura inicial, las horas se derivarán exclusivamente de las
transiciones y no serán editables.

## Modelo de datos

### `gf.pos.cash.shift`

El nuevo modelo será la fuente de verdad de cada turno. Como mínimo contendrá:

- referencia/folio;
- compañía y almacén;
- tipo `night` o `day`;
- fecha operativa;
- estado `open`, `pending_auth`, `closed` o `reopened`;
- apertura y cierre en UTC;
- empleado que abrió, cerró y reabrió;
- fondo inicial;
- otros ingresos y otros egresos;
- ventas en efectivo y terminal;
- gastos;
- efectivo esperado, efectivo físico y diferencia;
- reglas y responsables de autorización;
- razón de reapertura, versión y marcas de auditoría;
- enlace al turno anterior y al siguiente.

Existirá una unicidad por compañía, almacén, fecha operativa y tipo de turno. La
exclusión de dos turnos abiertos se protegerá mediante validación de modelo y
bloqueo transaccional; no dependerá de una consulta de UI.

### Denominaciones y fotografías

Las denominaciones vivirán en líneas propias ligadas al turno y reutilizarán el
catálogo MXN del cierre actual. La fotografía de evidencia se enlazará mediante
`ir.attachment` al nuevo modelo.

Toda diferencia distinta de cero exigirá observación y fotografía. Los umbrales
configurables existentes para autorización de gerente y dirección se
reutilizarán mediante lógica compartida, sin copiar valores en el frontend.

### Enlace de movimientos

Se añadirá una relación de turno de caja a:

- `sale.order`, para ventas creadas por los tres POS de la PWA;
- `hr.expense`, para gastos creados por el flujo administrativo de la PWA.

El enlace se asignará en el backend a partir del turno abierto del alcance
autenticado. El cliente no podrá enviar ni sustituir el ID de turno.

Los pedidos externos, ecommerce y ventas ajenas a los tres flujos POS no se
incorporarán. Los gastos creados después de cerrar un turno pertenecerán al turno
activo, aunque el usuario les asigne una fecha contable anterior. Corregir el
corte anterior requerirá la reapertura explícita.

## Cálculos del corte

### Ventas realizadas

Solo los pedidos del turno en estado `sale` o `done` sumarán a las ventas
realizadas. Los pedidos `cancel` permanecerán visibles en una sección de
cancelaciones, con folio, importe, empleado y razón, pero no sumarán al cobro.

El resumen de pagos separará como mínimo:

- ventas en efectivo;
- ventas con terminal;
- total realizado.

El efectivo esperado será:

```text
fondo inicial
+ ventas en efectivo
+ otros ingresos
- gastos PWA del turno
- otros egresos
= efectivo esperado
```

El físico será la suma de cantidad por valor de denominación. La diferencia será:

```text
efectivo físico - efectivo esperado
```

No se incorporarán las ventas con terminal al efectivo esperado.

### Desglose por producto

El corte guardará por producto:

- ID y SKU;
- nombre mostrado al cerrar;
- cantidad;
- monto con impuestos coherente con el total del pedido;
- peso por unidad configurado;
- kilos totales;
- indicador de peso faltante.

El resumen mostrará totales de unidades, importe, kilos conocidos y número de
productos sin peso. El nombre, SKU, precio y peso serán fotografía del momento
del corte; cambios posteriores en el catálogo no alterarán el reporte histórico.

### Fotografía persistida

Al cerrar se persistirán los totales y desgloses necesarios para imprimir y
auditar el corte. Las vistas de un corte `closed` o `pending_auth` leerán esta
fotografía, no recalcularán resultados dinámicamente.

Cuando un corte se reabra y vuelva a cerrar se creará una nueva versión de la
fotografía. La bitácora conservará el actor, la razón y los totales anteriores.

## Cancelación y reapertura

La política de cancelación verificará el turno relacionado además de las reglas
actuales del POS:

- turno `open`: la venta puede seguir la política de cancelación vigente;
- turno `pending_auth` o `closed`: cancelación bloqueada con código seguro
  `cash_shift_closed`;
- turno `reopened`: Angy puede cancelar después de las validaciones normales.

Para corregir una venta de un corte cerrado Angy deberá:

1. reabrir el corte con razón obligatoria;
2. cancelar la venta con el motivo canónico permitido;
3. revisar los nuevos totales y repetir el arqueo;
4. volver a cerrar el mismo registro.

Reabrir un corte no reabre su ventana temporal, no mueve ventas nuevas hacia él
y no altera el turno actualmente abierto. No se permitirá borrar cortes ni
desligar movimientos mediante el API PWA.

## Permisos y alcance

Se añadirá un permiso explícito y asignable, conceptualmente
`allow_manage_pos_cash_shifts`, al perfil de empleado. Se habilitará para Angy
desde configuración, nunca mediante comparación de nombre.

El permiso permitirá:

- abrir el primer turno;
- ver el turno activo y su vista previa;
- ejecutar un corte;
- consultar detalle e historial;
- reabrir un corte con razón.

Gerencia y dirección conservarán sus permisos configurados para autorizar
diferencias. Héctor y el usuario `pos_diurno` no podrán abrir, cerrar, reabrir ni
consultar cortes administrativos por obtener acceso al POS.

Cada endpoint resolverá al empleado desde `X-GF-Employee-Token` y fijará la
compañía, almacén y analítica desde su alcance confiable. IDs enviados por el
cliente no ampliarán el acceso.

## Contrato API propuesto

El backend expondrá endpoints dedicados al nuevo modelo:

```text
GET  /pwa-admin/cash-shifts/active
GET  /pwa-admin/cash-shifts/preview
POST /pwa-admin/cash-shifts/open
POST /pwa-admin/cash-shifts/close
GET  /pwa-admin/cash-shifts/history
GET  /pwa-admin/cash-shifts/detail
POST /pwa-admin/cash-shifts/reopen
POST /pwa-admin/cash-shifts/authorize
```

`active` devolverá turno, fecha operativa, periodo, horario de referencia y
estado. `preview` devolverá los totales vivos sin crear una fotografía.

`close` recibirá únicamente datos capturados por Angy:

- conteos por denominación;
- otros ingresos y egresos;
- notas y evidencia cuando correspondan;
- fondo inicial del siguiente turno;
- versión esperada del turno para control optimista.

El servidor decidirá el turno siguiente, su fecha operativa, la hora efectiva y
todos los totales de ventas/gastos. El cliente no enviará importes autoritativos.

Los writes usarán una clave de idempotencia para que un reintento por pérdida de
respuesta no cree dos cortes ni dos turnos siguientes. Una versión obsoleta
devolverá conflicto y obligará a recargar.

`history` filtrará por fecha operativa, no por fecha calendario, y devolverá
`Noche`, `Día` y el consolidado cuando existan. `detail` entregará la fotografía
versionada y los datos necesarios para impresión.

Las capacidades publicadas por el backend indicarán disponibilidad de lectura,
escritura, reapertura, autorización e impresión del corte. La PWA fallará cerrada
si el backend aún no soporta la operación.

## Experiencia PWA

El módulo administrativo mostrará `Cortes de caja` con tres áreas.

### Turno activo

Mostrará:

- `Noche` o `Día` y fecha operativa;
- hora real de apertura y duración;
- hora esperada del próximo corte;
- ventas en efectivo, terminal y total;
- gastos y efectivo esperado preliminar;
- aviso por corte próximo o turno vencido.

### Hacer corte

Antes de confirmar, Angy revisará:

- listado y total de tickets;
- desglose por producto;
- pagos por método;
- cancelaciones;
- gastos;
- fondo inicial del turno actual;
- denominaciones contadas;
- otros ingresos/egresos;
- diferencia calculada;
- nota y evidencia cuando apliquen;
- fondo inicial del siguiente turno.

La confirmación final nombrará explícitamente ambos efectos, por ejemplo:
`Cerrar Noche 27 y abrir Día 27`.

### Historial y reporte

La búsqueda usará fecha operativa. La fecha 27 mostrará en orden:

1. `Noche 27`;
2. `Día 27`;
3. consolidado operativo 27.

Cada corte tendrá vista imprimible con folio, responsable, periodo, productos,
pagos, gastos, arqueo, diferencia, fotografías, estado y autorizaciones. La
impresión usará CSS de navegador y no requerirá generar un PDF en el servidor.

Los cierres diarios históricos de `gf.cash.closing` permanecerán disponibles en
una sección histórica diferenciada. La pantalla operativa nueva no mezclará un
cierre de calendario anterior con un corte por turno.

## Errores y recuperación

- Si no existe turno abierto después de la activación operativa, ventas y gastos
  PWA fallarán con un mensaje accionable para abrir o recuperar el turno; no se
  crearán movimientos huérfanos.
- La activación de esa regla ocurrirá solamente después de abrir el primer turno,
  para no interrumpir ventas durante el despliegue técnico.
- Si falla la red al cortar, la PWA consultará el turno activo y la clave de
  idempotencia antes de permitir otro intento.
- Si otra sesión cerró el turno, se mostrará el corte resultante y el nuevo turno.
- Si cambian compañía, almacén o permiso durante el flujo, el backend rechazará
  la operación y la PWA recargará la sesión.
- Un error de fotografía o autorización no eliminará el borrador capturado en la
  UI mientras la sesión siga vigente.

## Compatibilidad y migración

- `gf.cash.closing` y sus registros existentes no se modificarán destructivamente.
- Los endpoints actuales de cierre diario permanecerán disponibles durante la
  transición.
- El nuevo modelo vivirá en `gf_pwa_admin` y reutilizará helpers compartidos de
  denominaciones, diferencias y permisos donde sea seguro.
- La PWA mostrará el nuevo módulo solo cuando las capacidades del backend estén
  activas.
- La primera apertura permitirá incorporar los movimientos PWA no ligados desde
  una hora inicial confirmada por Angy.
- No se realizará backfill automático de cierres históricos por turno, porque no
  existe una frontera manual confiable para reconstruirlos.

## Estrategia de pruebas

### Backend Odoo

- secuencia `Noche D -> Día D -> Noche D+1`;
- ejemplo exacto de noche iniciada el 26 y asignada al 27;
- cortes tardíos que respetan la hora manual;
- unicidad de turno abierto por compañía/almacén;
- venta y gasto ligados autoritativamente al turno abierto;
- venta administrativa nocturna incluida en `Noche`;
- separación de efectivo y terminal;
- descuento de gastos en el esperado;
- desglose y fotografía de productos;
- exclusión contable de ventas canceladas;
- bloqueo de cancelación en `closed` y `pending_auth`;
- reapertura, cancelación, nueva versión y recierre;
- autorizaciones y evidencia por diferencia;
- idempotencia del cierre;
- concurrencia real entre venta, gasto y corte;
- aislamiento por compañía, almacén y empleado;
- arranque inicial sin traslapes ni doble asignación.

### PWA

- guard de permiso para Angy y denegación a POS diurno/nocturno;
- carga y actualización del turno activo;
- vista previa y fórmula de arqueo;
- validación de denominaciones, evidencia y fondo siguiente;
- copy explícito de la transición;
- recuperación tras respuesta incierta;
- conflicto por versión obsoleta;
- historial ordenado `Noche`, `Día`, consolidado;
- vista imprimible responsiva;
- recordatorios de 06:00 y 18:00 sin cierre automático;
- zona horaria de México alrededor de medianoche.

## Criterios de aceptación

1. Una venta administrativa hecha el 26 a las 21:00, durante `Noche 27`, aparece
   en el corte nocturno del 27.
2. Una venta hecha después del corte manual de las 06:00 aparece en `Día 27`,
   incluso si el corte ocurrió algunos minutos tarde.
3. Dos requests concurrentes de cierre no crean turnos duplicados.
4. Una venta concurrente con el corte pertenece exactamente a un turno.
5. El efectivo esperado excluye terminal y descuenta gastos.
6. El reporte cerrado conserva su desglose aunque cambie posteriormente el
   catálogo de productos.
7. No se puede cancelar una venta de un corte cerrado sin reapertura.
8. Reabrir un corte no absorbe ventas del turno actualmente abierto.
9. Héctor y el usuario POS día no pueden ejecutar endpoints administrativos de
   cortes.
10. Los cierres diarios históricos siguen consultables y no se reinterpretan.

## Fuera de alcance

- cierre automático a las 06:00 o 18:00;
- reconstrucción automática de turnos históricos;
- inclusión de ecommerce, KoldHome o ventas externas al POS PWA;
- conciliación bancaria automática de terminales;
- retiro físico de efectivo o pólizas contables automáticas;
- cambios al catálogo cerrado de motivos de cancelación.
