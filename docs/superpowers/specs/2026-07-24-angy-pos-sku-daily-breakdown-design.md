# Desglose diario de ventas POS por SKU para Angélica

## Objetivo

Agregar a `Caja del día` un desglose de las ventas de mostrador de Angélica
Jaimes para una sola fecha. La vista debe abrir en el día actual, permitir
consultar fechas anteriores y mostrar por producto:

- SKU;
- nombre;
- cantidad vendida;
- monto total vendido;
- peso total.

La primera entrega será visible únicamente para la sesión de Angélica Jaimes.
No cambia la experiencia de auxiliares administrativos, otros gerentes o
Dirección.

## Contexto actual

El dashboard administrativo obtiene sus datos con
`GET /pwa-admin/today-sales`. El endpoint:

- fija la consulta al día actual;
- filtra por empresa, almacén y alcance del empleado autenticado;
- para una gerente de CEDIS amplía el alcance a empleados que comparten su
  cuenta analítica;
- incluye pedidos `sale` y `done`;
- excluye KoldHome, e-commerce y otros pedidos que no pertenecen al POS de
  mostrador;
- devuelve encabezados de pedidos, pero no líneas ni agregados por producto.

La PWA no puede construir un histórico correcto sólo con el contrato actual.
Consultar el detalle de cada ticket también produciría un patrón N+1 y
duplicaría lógica contable en el cliente.

## Enfoques considerados

### 1. Ampliar el endpoint actual

Agregar una fecha opcional y un agregado por producto a
`/pwa-admin/today-sales`.

Ventajas:

- una consulta por fecha;
- conserva en Odoo los filtros de autorización y canal;
- mantiene compatibilidad con consumidores actuales;
- evita descargar y reagrupar todos los tickets en el navegador.

Desventaja:

- requiere cambios coordinados en Odoo y la PWA.

Este es el enfoque seleccionado.

### 2. Consultar el detalle de cada ticket

La PWA pediría las ventas y luego `sale-detail` para cada pedido.

Se descarta porque genera múltiples solicitudes, empeora con días de alto
volumen y aún requiere modificar el backend para consultar fechas anteriores.

### 3. Crear un endpoint de reportes independiente

Se descarta para esta primera entrega porque duplicaría filtros y
autorizaciones del endpoint existente sin aportar una separación necesaria.

## Contrato de datos

### Solicitud

El endpoint conserva su ruta:

```text
GET /pwa-admin/today-sales
```

Parámetros:

| Parámetro | Obligatorio | Descripción |
| --- | --- | --- |
| `company_id` | sí | Razón social activa |
| `warehouse_id` | sí | Almacén activo |
| `date` | no | Día local `YYYY-MM-DD`; por defecto, hoy |

El backend debe rechazar fechas inválidas y fechas posteriores al día local
actual.

### Alcance y corte diario

La consulta conserva los filtros actuales de empresa, almacén, empleado,
estado y canal. El rango de `date_order` se calcula con la zona horaria del
usuario; si no es válida, se usa `America/Mexico_City`.

El rango es semiabierto:

```text
[inicio local convertido a UTC, siguiente medianoche local convertida a UTC)
```

Esto evita perder o duplicar ventas alrededor de medianoche.

### Agregación

Odoo agrupa las líneas vendibles de los pedidos resultantes por
`product.product`. Se excluyen líneas de sección, nota u otras líneas sin
producto vendible.

Cada fila agregada debe tener:

```json
{
  "product_id": 123,
  "sku": "ROL-55",
  "product_name": "Rolito 5.5 kg",
  "quantity": 8,
  "amount_total": 960,
  "weight_per_unit_kg": 5.5,
  "weight_total_kg": 44,
  "weight_configured": true
}
```

Reglas:

- `quantity`: suma de `product_uom_qty`;
- `amount_total`: suma de `price_total`, después de descuento e impuestos;
- `weight_per_unit_kg`: `product_id.weight`;
- `weight_total_kg`: `quantity * weight_per_unit_kg`;
- `weight_configured`: `true` sólo cuando el peso unitario es mayor que cero;
- `sku`: `default_code`; puede ser vacío;
- el orden es descendente por cantidad y después alfabético por producto.

La respuesta existente conserva `orders`, `items`, `count` y `total_amount`.
Se agregan:

```json
{
  "date": "2026-07-24",
  "products": [],
  "product_totals": {
    "quantity": 0,
    "amount_total": 0,
    "weight_total_kg": 0,
    "products_without_weight": 0
  }
}
```

El total de peso excluye productos sin peso configurado. El conteo
`products_without_weight` permite indicarlo sin presentar un total engañoso.

## PWA

### Cliente y normalización

La capa `src/modules/admin/api.js` enviará `date` junto con `company_id` y
`warehouse_id`.

Una unidad pura y testeable normalizará la respuesta del backend:

- acepta el sobre `{ ok, data }`;
- usa arreglos vacíos y totales en cero ante campos opcionales ausentes;
- normaliza números sin convertir datos inválidos en `NaN`;
- calcula totales de respaldo sólo si el backend no los envía;
- expone un predicado aislado para reconocer la sesión de Angélica Jaimes
  mediante nombre normalizado sin acentos.

La visibilidad por nombre es deliberadamente temporal para esta primera
entrega. La autorización y el alcance de datos permanecen en Odoo; ocultar el
componente es una decisión de producto, no un control de seguridad.

### Interfaz

`HubV2` conserva los KPI y la actividad actuales. Para Angélica agrega debajo
de la tira de KPI una sección:

```text
Ventas POS por producto
[ selector de fecha ]

SKU | Producto | Cantidad | Monto total | Peso
...
Totales
```

Comportamiento:

- fecha inicial: hoy en tiempo local;
- sólo se selecciona un día;
- el máximo del selector es hoy;
- cambiar la fecha actualiza únicamente el desglose;
- el polling del dashboard no debe sobrescribir una fecha histórica elegida;
- en escritorio se muestra una tabla;
- en pantallas pequeñas se muestran tarjetas por producto;
- la fila final totaliza cantidad, monto y peso.

Presentación de valores:

- SKU vacío: `Sin SKU`;
- monto: moneda MXN;
- peso configurado: kilogramos;
- peso no configurado: `Peso no configurado`;
- si faltan pesos, el total incluye una advertencia con el número de productos
  omitidos.

## Estados de interfaz

### Carga

La sección muestra su propio indicador de carga. Los KPI y la actividad no
quedan bloqueados.

### Sin ventas

Se muestra:

```text
No hay ventas POS para esta fecha.
```

Los totales son cero.

### Error

Se muestra un mensaje dentro de la sección y un botón `Reintentar`. El error no
oculta ni invalida el resto de `Caja del día`.

### Respuesta parcial

Un producto sin peso sigue apareciendo con cantidad y monto. Sólo se omite de
la suma de kilogramos y se muestra la advertencia correspondiente.

## Pruebas

### Backend Odoo

Cubrir:

- ausencia de `date` usa hoy;
- fecha histórica válida;
- fecha futura o inválida se rechaza;
- límites diarios respetan la zona horaria;
- alcance analítico de Angélica se conserva;
- pedidos borrador, cancelados, KoldHome y e-commerce se excluyen;
- líneas se agrupan correctamente por producto;
- cantidad, monto y peso se suman correctamente;
- productos sin SKU o peso producen el contrato esperado;
- campos de respuesta existentes permanecen compatibles.

### PWA

Cubrir:

- normalización del sobre y valores numéricos;
- detección de la sesión de Angélica con y sin acentos;
- otros usuarios no reciben el componente personalizado;
- hoy es la fecha inicial y el selector no permite fechas futuras;
- cambio de fecha envía el parámetro correcto;
- render de filas y totales;
- estado vacío;
- error y reintento;
- advertencia por peso faltante;
- el polling general no cambia la fecha histórica.

### Verificación final

Antes de integrar:

- pruebas enfocadas de Odoo;
- pruebas enfocadas de PWA;
- `npm test`;
- `npm run lint`;
- `npm run build`;
- revisión manual de la sección en escritorio y móvil;
- comprobación de que un usuario distinto de Angélica conserva la vista
  anterior.

## Integración

La implementación se hará en una rama de trabajo. Al finalizar y verificar:

1. commitear los cambios de Odoo en su repositorio correspondiente;
2. commitear los cambios de PWA sin incluir modificaciones locales ajenas;
3. actualizar `main` desde su remoto;
4. integrar la rama verificada en `main`;
5. resolver cualquier conflicto sin descartar trabajo existente;
6. ejecutar nuevamente la verificación después del merge.
