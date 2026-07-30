# Historial de ventas de Iguala para Angélica y Sugey

**Fecha:** 2026-07-30  
**Estado:** Diseño aprobado por el usuario  
**Alcance:** PWA Colaboradores y backend Odoo de `/pwa-admin`.

## Objetivo

Incorporar una sección para consultar e imprimir tickets históricos de ventas
de Iguala. Angélica y Sugey podrán consultar un día o rango de fechas, buscar
por nombre de cliente o folio, revisar el empleado vendedor responsable, la
hora CDMX, las líneas de orden, el pago y su tipo; además podrán seleccionar
varias ventas, ver su monto acumulado e imprimir sus tickets mediante una sola
acción.

No será posible consultar una sucursal distinta de Iguala.

## Contexto actual

La PWA ya cuenta con `GET /pwa-admin/today-sales`, limitado al día actual, y
`GET /pwa-admin/sale-detail?order_id=…`, que carga un ticket individual.
`ScreenTicket` ya presenta e imprime ese ticket. El contrato actual no cubre
historial, búsqueda, líneas por orden ni la restricción permanente de Iguala.

Crear el historial con detalles individuales sería un patrón N+1 y dejaría el
alcance de sucursal en el navegador. Se necesita una consulta autoritativa
desde Odoo.

## Enfoques considerados

### 1. Endpoint de historial autoritativo de Iguala — seleccionado

Odoo publica una lista paginada de ventas enriquecidas, y resuelve en el
servidor la identidad autorizada y el alcance de Iguala.

Ventajas: cubre historial, búsqueda y detalle sin consultas por fila; evita
exponer ventas de otra sucursal; mantiene consistencia para lista, selección e
impresión. Requiere cambios coordinados en Odoo y PWA.

### 2. Reutilizar `today-sales` y filtrar en la PWA

Se descarta: no sirve para fechas anteriores, no contiene el detalle pedido y
el filtro de Iguala sería evadible desde el navegador.

### 3. Mostrar un reporte o iframe de Odoo

Se descarta: no integra selección, total acumulado ni tickets con el formato
de la PWA.

## Autorización y alcance

### Backend: autoridad única

Cada solicitud usa el token de sesión PWA. Odoo resuelve el empleado actor y
verifica que pertenezca a una allowlist configurable de responsables de
historial de ventas de Iguala, sembrada con Angélica y Sugey. La configuración
usa IDs de empleado, nunca nombre, rol ni valores del navegador.

La misma política usa una configuración única
`gf_pwa_admin.iguala_sales_scope`, que contiene los IDs de los almacenes de
Iguala, las cuentas analíticas de código `IGU` y `IGU34`, y los canales POS
de mostrador permitidos. Una orden pertenece al historial únicamente si cumple
simultáneamente:

1. `warehouse_id` pertenece a los almacenes configurados;
2. su cuenta analítica es una de las dos cuentas configuradas; y
3. pertenece a un canal POS de mostrador configurado.

La instalación productiva debe tener estos tres grupos configurados antes de
habilitar el endpoint; si falta uno, el servicio falla cerrado. Los filtros de
empresa, almacén, analítica o actor recibidos desde el cliente no pueden
ampliar ese alcance: deben ser compatibles con la configuración fija o la
solicitud se rechaza. Un token inválido, actor no autorizado o intento de salir
del alcance devuelve acceso denegado y ningún dato parcial.

### PWA: visibilidad de producto

La navegación y la ruta se muestran a las sesiones de Angélica y Sugey con una
allowlist de IDs de empleado configurable por entorno. Es sólo una mejora de
experiencia: Odoo sigue siendo la autoridad. La interfaz muestra `Sucursal
fija: Iguala` y no incluye selector de sucursal.

## Contrato de datos

### `GET /pwa-admin/iguala-sales-history`

| Parámetro | Requerido | Regla |
| --- | --- | --- |
| `date_from` | no | Fecha local `YYYY-MM-DD`; si se omite junto con `date_to`, se usa hoy CDMX. |
| `date_to` | no | Fecha local `YYYY-MM-DD`; si sólo llega uno de los dos extremos, ese día se usa para ambos. |
| `search` | no | Busca por cliente o folio, sin distinguir mayúsculas ni acentos. |
| `page` | no | Entero positivo; por defecto 1. |
| `page_size` | no | Entero de 1 a 100; por defecto 50. |

El servidor valida extremos, rechaza fechas futuras y limita el rango a 31
días calendario, inclusive. Filtra `date_order` en
`America/Mexico_City` con un intervalo semiabierto:

```text
[00:00 de date_from CDMX convertido a UTC,
 00:00 del día posterior a date_to CDMX convertido a UTC)
```

Así no se pierden ni duplican ventas alrededor de medianoche.

```json
{
  "timezone": "America/Mexico_City",
  "scope_label": "Iguala",
  "filters": { "date_from": "2026-07-29", "date_to": "2026-07-30", "search": "S25375" },
  "pagination": { "page": 1, "page_size": 50, "total": 1 },
  "orders": [
    {
      "id": 25375,
      "folio": "S25375",
      "ordered_at": "2026-07-30T07:57:27-06:00",
      "customer": { "id": 10, "name": "VENTA PUBLICO IGUALA NOCHE" },
      "responsible_employee": { "id": 717, "name": "Angélica Jaimes" },
      "payment": { "method": "cash", "label": "Efectivo", "amount": 320.0 },
      "currency": "MXN",
      "amount_total": 320.0,
      "state": "sale",
      "lines": [
        { "product_id": 100, "product_name": "Producto", "quantity": 2, "unit_price": 160.0, "line_total": 320.0 }
      ]
    }
  ]
}
```

Reglas del contrato:

- incluye sólo órdenes válidas y vendidas del canal de mostrador de Iguala;
  excluye borradores, canceladas y canales ajenos;
- `ordered_at` incluye el offset CDMX; la PWA no debe adivinar una zona;
- `responsible_employee` es el vendedor que registró la orden;
- `payment.method` conserva la clave de Odoo y `payment.label` es lo que verá
  la usuaria, por ejemplo `Efectivo` o `Crédito`;
- un pago mixto devuelve `payment.breakdown`, el rótulo `Pago mixto` y conserva
  el total de la venta en `amount_total`;
- `lines` sólo incluye líneas vendibles, con cantidad, precio e importe final;
- los importes son números MXN calculados autoritativamente en Odoo;
- el orden es descendente por fecha/hora y después por ID.

### Impresión seleccionada

La PWA envía exclusivamente los IDs marcados a
`POST /pwa-admin/iguala-sales-tickets` con
`{ "order_ids": [25375, 25374] }`. El arreglo debe tener entre 1 y 100 IDs
distintos. Odoo revalida identidad y alcance para cada ID; no devuelve
resultados parciales si alguno queda fuera de Iguala o dejó de ser visible.

La respuesta exitosa usa el mismo sobre que la lista:

```json
{
  "ok": true,
  "data": {
    "timezone": "America/Mexico_City",
    "tickets": [
      {
        "order_id": 25375,
        "folio": "S25375",
        "ordered_at": "2026-07-30T07:57:27-06:00",
        "customer": { "name": "VENTA PUBLICO IGUALA NOCHE" },
        "responsible_employee": { "name": "Angélica Jaimes" },
        "currency": "MXN",
        "subtotal": 320.0,
        "amount_total": 320.0,
        "payment": { "method": "cash", "label": "Efectivo", "amount": 320.0 },
        "lines": [
          { "product_name": "Producto", "quantity": 2, "unit_price": 160.0, "line_total": 320.0 }
        ]
      }
    ]
  }
}
```

`tickets` se devuelve exactamente en el mismo orden de `order_ids`, y cada
elemento se correlaciona con su petición mediante `order_id`. La PWA
renderiza un ticket de 80 mm por venta, con salto de página entre tickets, y
abre una sola acción de impresión.

Las respuestas de error de ambos endpoints usan
`{ "ok": false, "error": { "code": "...", "message": "..." } }`: `403`
para acceso denegado, `400` para filtros, límites o payload inválidos y
`409` cuando una impresión incluye una orden ya no visible dentro del alcance.

## Experiencia PWA

### Entrada y filtros

Se añade `Historial de ventas` a la navegación de Administración y una ruta
protegida, por ejemplo `/admin/ventas`. En escritorio usa `AdminShell`; en
móvil usa tarjetas para conservar toda la información sin una tabla angosta.

La cabecera tendrá:

```text
Historial de ventas
Sucursal fija: Iguala
[desde] [hasta] [Buscar cliente o folio]
```

El valor inicial es el día CDMX actual. Cambiar fechas o terminar de escribir
una búsqueda reinicia la paginación y vuelve a consultar Odoo. La búsqueda usa
una espera breve de escritura y no descarga el histórico completo.

### Lista y selección

En escritorio, la tabla presenta:

```text
[ ] | Folio | Fecha y hora CDMX | Cliente | Responsable |
      Líneas de orden | Pago | Total
```

Las líneas se resumen en cada fila y se expanden para ver producto, cantidad,
precio e importe. Cada tarjeta móvil presenta los mismos datos y una casilla
visible.

La selección se conserva mientras los resultados pertenecen al mismo filtro;
al cambiar rango o búsqueda se limpia para no sumar pedidos que ya no están a
la vista. El checkbox de cabecera selecciona/deselecciona los elementos de la
página cargada. El ID de orden es único y no puede contarse dos veces.

### Barra de selección

Con ventas seleccionadas se muestra una barra fija:

```text
N tickets seleccionados · Total: $0.00 MXN · [Imprimir tickets]
```

El total suma `amount_total` de los IDs seleccionados y se formatea en MXN. El
botón se deshabilita sin selección, muestra progreso durante la obtención de
tickets y evita doble envío. La vista de impresión es sólo de lectura; no
permite cancelar ni modificar ventas. Al regresar se conservan filtros y
selección mientras siga la misma navegación.

## Estados y errores

- **Carga:** indicador dentro del contenido sin abandonar la pantalla.
- **Cambio de filtro:** el resultado previo se indica como actualizándose y no
  puede imprimirse como si fuera el filtro nuevo.
- **Sin ventas:** `No hay ventas de Iguala con estos filtros.` y total cero.
- **Error de consulta:** mensaje y `Reintentar`, sin inventar filas ni totales.
- **Acceso denegado:** estado explícito sin lista ni datos.
- **Error de impresión:** conserva la selección, informa que no se abrió ningún
  ticket y permite reintentar.
- **Contrato inválido:** el normalizador usa valores seguros, evita `NaN` y
  registra el detalle técnico sin exponer datos.

## Unidades de implementación

- `salesHistoryAccess.js`: allowlist local y guard de navegación;
- `salesHistoryApi.js`: consultas, filtros y normalización de contratos;
- `salesHistoryState.js`: búsqueda, selección sin duplicados y total acumulado;
- `ScreenSalesHistory.jsx`: filtros, lista, estados e impresión;
- componente reutilizable de ticket: extrae el cuerpo de `ScreenTicket` para
  imprimir uno o varios tickets con formato consistente.

La PWA no replica autorización, reglas de dinero, zona horaria ni alcance de
sucursal: esas decisiones son del backend.

## Pruebas

### Odoo

- tokens ausentes, inválidos o actores no autorizados;
- acceso de Angélica y Sugey;
- alcance fijo de Iguala y rechazo de IDs ajenos;
- fecha por defecto, histórica, futura e intervalo inválido, respetando CDMX;
- búsqueda por folio y cliente con mayúsculas/acentos;
- exclusión de pedidos borrador, cancelados y de canal ajeno;
- responsable, líneas, pagos efectivo/crédito/mixto, totales y paginación;
- impresión por lote correcta y rechazo atómico de un ID fuera de alcance.

### PWA

- allowlist de Angélica/Sugey y ocultamiento para otra sesión;
- serialización de filtros y normalización de respuestas completas, envueltas
  en `{ ok, data }`, opcionales e importes inválidos;
- selección individual, por página, deselección y ausencia de duplicados;
- acumulado exacto y limpieza de selección al cambiar filtro;
- render de responsable, hora CDMX, líneas, pago/tipo y total;
- estados de carga, vacío, denegado, error y reintento;
- impresión sólo con IDs seleccionados y protección de doble envío.

### Verificación final

Se ejecutarán las pruebas enfocadas, `npm test`, `npm run lint` y
`npm run build`. También habrá revisión manual en escritorio, móvil e
impresión de más de un ticket, y comprobación de que una sesión ajena no vea
la entrada ni obtenga datos de Odoo.
