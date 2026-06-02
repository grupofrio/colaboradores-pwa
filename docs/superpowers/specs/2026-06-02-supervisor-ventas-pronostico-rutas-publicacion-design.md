# Supervisor Ventas - Pronostico por rutas con clientes editables

## Contexto

La pantalla `Supervisor de Ventas > Pronostico` ya permite planear rutas del CEDIS con filtros de poligono, subpoligono, canales, dias de visita, ventanas horarias y clasificacion de demanda. El flujo actual crea o reutiliza un `gf.route.plan`, pero no le da a la supervisora una revision clara de los clientes que entraran a la ruta antes de publicar el plan diario.

El cambio deseado es que la supervisora pueda escoger una fecha, ver las rutas de su CEDIS/analitica para esa fecha, abrir una ruta, seleccionar el poligono del CEDIS y los subpoligonos incluidos, generar una propuesta de clientes, editar esa lista manualmente y publicar el `gf.route.plan`.

## Decision aprobada

- La fecha del plan diario se selecciona antes de escoger ruta.
- La primera vista muestra tarjetas de rutas del CEDIS/analitica para la fecha seleccionada.
- La ruta maestra `gf.route` se usa como plantilla; no se publica ni se modifica como registro maestro.
- El plan operativo diario es `gf.route.plan`, identificado por `route_id + date_target`.
- Si no hay plan para esa ruta/fecha, se crea en `draft` al generar la propuesta.
- La confirmacion final publica el `gf.route.plan` cambiandolo a `published`.
- Antes de publicar, la supervisora ve la lista de clientes que se agregaran al plan.
- La lista de clientes es editable: puede quitar clientes propuestos y agregar clientes manualmente.
- Quitar un cliente solo lo quita del plan diario; nunca borra el cliente maestro.

## Flujo de usuario

1. La supervisora entra a `/equipo/pronostico`.
2. Selecciona la fecha objetivo del plan diario.
3. La PWA carga rutas del CEDIS/analitica para esa fecha.
4. Cada tarjeta de ruta muestra:
   - nombre de ruta;
   - vendedor/chofer asignado;
   - estado del `gf.route.plan` para esa fecha;
   - total de clientes/stops;
   - accion principal: `Crear propuesta`, `Revisar clientes` o `Ver publicado`.
5. La supervisora abre una ruta.
6. En el detalle de ruta confirma el poligono CEDIS.
7. La PWA muestra los subpoligonos incluidos en ese poligono.
8. La supervisora selecciona uno o varios subpoligonos, o usa todo el poligono.
9. La PWA pide al backend una propuesta de clientes.
10. El backend crea o reutiliza el `gf.route.plan` en `draft` si hace falta y devuelve los clientes sugeridos.
11. La supervisora revisa la lista.
12. Puede quitar clientes del plan.
13. Puede agregar clientes manualmente mediante buscador.
14. Al confirmar, la PWA publica el plan diario.
15. El plan queda en `published` y disponible para los flujos operativos aguas abajo.

## Arquitectura frontend

`src/modules/supervisor-ventas/ScreenPronostico.jsx` mantiene el modo manual, pero se reorganiza en dos niveles:

### Fecha y rutas

- Selector de fecha como primer control de la pantalla.
- Al cambiar fecha, se refresca `getRouteTemplatesForPlanning(dateTarget)`.
- Las tarjetas de ruta usan el estado normalizado de `routePlanning.js`.
- El resumen superior muestra CEDIS, fecha, rutas sin plan, rutas draft y rutas publicadas.

### Detalle de ruta

- Al seleccionar una ruta, la pantalla entra a un detalle o panel dedicado.
- La ruta seleccionada queda fija hasta volver a la lista.
- El detalle muestra:
  - ruta y vendedor/chofer;
  - estado del plan;
  - poligono seleccionado;
  - subpoligonos disponibles;
  - filtros que se conserven del flujo actual;
  - lista editable de clientes;
  - acciones `Guardar borrador` y `Publicar plan` cuando aplique.

La lista de clientes debe distinguir, si el backend lo entrega, entre:

- cliente sugerido por poligono/subpoligono;
- cliente agregado manualmente;
- cliente ya existente en el plan.

## API cliente propuesta

Agregar o extender funciones en `src/modules/supervisor-ventas/api.js`:

### `previewRoutePlanCustomers(criteria)`

Genera o refresca una propuesta de clientes sin publicar el plan.

Payload cliente:

```json
{
  "route_id": 10,
  "date_target": "2026-06-03",
  "polygon_id": 20,
  "subpolygon_ids": [101, 102],
  "channel_ids": [1, 2],
  "visit_days": [],
  "time_window_id": null,
  "demand_classes": []
}
```

Respuesta normalizada:

```json
{
  "ok": true,
  "route_plan_id": 3001,
  "state": "draft",
  "customers": [
    {
      "id": 55,
      "stop_id": 9001,
      "name": "Abarrotes Sol",
      "address": "Av 1",
      "source": "suggested",
      "subpolygon_id": 101,
      "subpolygon_name": "A",
      "channels": ["Mayoreo"],
      "visit_days": ["monday"],
      "time_window": "Tarde"
    }
  ]
}
```

### `saveRoutePlanDraft(payload)`

Crea o reutiliza el `gf.route.plan` para `route_id + date_target` y guarda la lista editable en `draft`.

### `removeCustomerFromRoutePlan(routePlanId, customerOrStopId)`

Quita un cliente del plan diario. Si el backend tiene `stop_id`, se prefiere quitar por `stop_id` para evitar ambiguedades. No modifica `res.partner`.

### `publishRoutePlan(routePlanId)`

Publica el plan diario. Cambia `gf.route.plan.state` de `draft` a `published`.

### Funciones existentes reutilizadas

- `getRouteTemplatesForPlanning(dateTarget)`.
- `getPlanningPolygons()`.
- `getPlanningSubpolygons(polygonId)`.
- `getPlanningChannels()`.
- `getPlanningTimeWindows()`.
- `searchPlanningCustomers(query)`.
- `addCustomerToRoutePlan(routePlanId, customerId, notes)`.

## Backend/Odoo

Odoo debe ser la fuente de verdad para:

- pertenencia de clientes a poligono/subpoligono;
- validacion de CEDIS y analitica;
- creacion idempotente de `gf.route.plan`;
- creacion, reemplazo o eliminacion de `gf.route.stop`;
- transicion de estado `draft -> published`.

La PWA no calcula geometria ni decide pertenencia por coordenadas.

Endpoints backend propuestos:

- `POST /gf/salesops/supervisor/v2/route_plan/preview_customers`
- `POST /gf/salesops/supervisor/v2/route_plan/save_draft`
- `POST /gf/salesops/supervisor/v2/route_plan/remove_customer`
- `POST /gf/salesops/supervisor/v2/route_plan/publish`

`route_plan/preview_customers` puede crear o reutilizar el plan en `draft` si no existe. Debe devolver el `route_plan_id`, el estado y la lista normalizada de clientes/stops.

## Estados y permisos

- `sin_plan`: no existe plan para `route_id + date_target`. La accion genera propuesta y crea draft.
- `draft`: permite regenerar propuesta, agregar clientes, quitar clientes y publicar.
- `published`: permite revisar. Si se permite editar publicados, debe ser con accion explicita y solo cuando la ruta no haya iniciado ejecucion.
- `in_progress`: solo lectura.
- `closed` o `reconciled`: solo lectura.
- Plan con carga aceptada o ruta iniciada: solo lectura.

Regla recomendada: las modificaciones manuales completas solo se permiten en `draft`. Para editar un plan `published`, el backend debe validar que no exista carga aceptada, ruta iniciada, ventas, visitas o cierre.

## Errores funcionales

La PWA debe mostrar mensajes accionables para:

- `missing_warehouse_id`: usuario sin CEDIS asignado.
- `missing_x_analytic_account_id`: usuario sin analitica CEDIS.
- `route_not_in_warehouse`: ruta fuera del CEDIS de sesion.
- `route_not_in_analytic_scope`: ruta fuera de la analitica de la supervisora.
- `polygon_required`: falta poligono.
- `polygon_not_found`: poligono inexistente o fuera de alcance.
- `subpolygon_outside_polygon`: subpoligono no pertenece al poligono.
- `no_customers_found`: no hay clientes para esos filtros.
- `customer_already_in_plan`: cliente ya existe en el plan.
- `plan_not_editable`: el plan ya no permite cambios.
- `route_plan_publish_failed`: no se pudo publicar el plan.

## Pruebas

### Unitarias PWA

- Payload de propuesta conserva fecha, ruta, poligono y multiples subpoligonos.
- `subpolygon_ids = []` significa todo el poligono.
- Normalizacion de clientes conserva `stop_id`, `source`, canal, ventana y subpoligono.
- Estados de tarjeta: sin plan, draft, published, in_progress y cerrados.
- Mensajes funcionales de errores nuevos.
- Bloqueo de edicion cuando el plan ya no es editable.

### QA manual

1. Login como supervisora con CEDIS y analitica.
2. Abrir `/equipo/pronostico`.
3. Seleccionar fecha futura.
4. Ver rutas del CEDIS con estado correcto para esa fecha.
5. Abrir ruta sin plan.
6. Seleccionar poligono y varios subpoligonos.
7. Generar propuesta y verificar que se crea plan `draft`.
8. Quitar un cliente propuesto.
9. Agregar un cliente manual.
10. Publicar el plan y verificar `gf.route.plan.state = published`.
11. Reabrir la misma ruta/fecha y verificar lista publicada.
12. Intentar editar plan iniciado o cerrado y verificar modo solo lectura.

## Fuera de alcance

- Crear o editar rutas maestras `gf.route`.
- Disenar poligonos o subpoligonos desde la PWA.
- Borrar clientes maestros.
- Redisenar el flujo de carga, aceptacion de ruta o liquidacion.
- Implementar calculo geografico en frontend.
