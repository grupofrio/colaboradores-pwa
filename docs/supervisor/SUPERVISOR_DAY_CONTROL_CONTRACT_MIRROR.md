# SUPERVISOR_DAY_CONTROL_CONTRACT_MIRROR — consumo frontend

**La autoridad del contrato es el JSON Schema versionado**, no este Markdown ni
el del backend: copias locales verificables en
`src/modules/supervisor-ventas/dayControl/contracts/`
(`supervisor_day_control_v1.schema.json`, `supervisor_radar_v1.schema.json`,
golden fixtures y `CONTRACT_SOURCE.json` con sha256 + procedencia = backend PR
GrupoVeniu/GrupoFrio#220). `tests/supervisorContractDrift.test.mjs` verifica:
integridad sha256 de las copias, deep-equal de los fixtures JS contra los
golden, conformidad de golden/fixtures con el schema (mini-validador que
muerde) y ausencia de PII en los artefactos.

## Reglas de consumo (frontend)

- Endpoints (convención V2): `POST /gf/salesops/supervisor/v2/day-control` y
  `/radar` con `{meta:{tz}, data:{date}}`. **Identidad SOLO por
  `X-GF-Employee-Token`** — el cliente NO manda `employee_id` (si lo manda, debe
  coincidir con el del token; nunca selecciona identidad ni scope).
- **Doble candado**: `FEATURE_DISABLED` puede venir del flag global o del flag
  de la sucursal ⇒ estado `disabled` honesto. `DATE_NOT_ALLOWED` (radar con
  fecha ≠ operativa actual) ⇒ estado propio, no error genérico.
- **null ≠ 0**: todo monto pasa por `presentation.moneyText(amount, currency,
  available)` — null/capability off ⇒ "Sin dato"; **la moneda viene del
  contrato** (`sales.currency`, `sales_day_currency`, `cash_pending_currency`);
  sin currency ⇒ "Moneda no disponible" (jamás se asume MXN).
- **Multi-moneda**: si `capabilities.sales_consolidated=false`, el total es null
  y se listan `sales_day_by_currency[]` — nunca se suman monedas en el cliente.
- `departure.status`: `not_departed | on_time | late | unknown` — `unknown` =
  "Sin dato de salida" (neutral, NUNCA suma a tarde). `tolerance{minutes,
  source: branch|fallback}` viene del payload (por ruta y global).
- `close.stage`: 5 etapas + `unknown` ("Estado por confirmar"); "Liquidada" solo
  si el backend lo afirma.
- **Incidencias = marcadores**: `incident_markers[]` /
  `incident_markers_count`, copy neutral ("marcadores de incidencia");
  `incidents_lifecycle_available=false` ⇒ jamás se presentan como "casos
  abiertos". No existe `incidents_open` ni prioridad `high_incident`.
- **Cargas** (autoridad `stock.picking`; van.* DESCARTADO): `route.loads
  {available, pending_acceptance_count, items[{picking_id, load_kind, status,
  picking_state, created_at, accepted_at}]}`. Se presentan SOLO estados del
  backend: `prepared`→"Refill preparado" · `pending_acceptance`→"Pendiente de
  aceptar" · `accepted`→"Aceptado" · `cancelled` · `unknown`→"Estado no
  disponible". **Prohibido** el vocabulario van.* ("solicitud de refill",
  "aprobación de supervisor/inventario"). `loads.available=false` ⇒ "Información
  de cargas no disponible" (jamás 0); `pending_acceptance_count=null` ⇒
  "Aceptación no verificable". `manual`/`initial` **nunca** se presentan como
  refill. Flujo: almacén crea la carga → chofer acepta; la PWA solo LEE.
- **Devolución/merma**: `capabilities.route_return_receipt_available=false` ⇒
  no se presenta como recibida (futuro contrato `route_return_receipt`). La
  etapa de cierre `validated` refleja conciliación DE SISTEMA, no recepción
  física (nota `return_receipt_note`).
- `position` puede ser null; `signal_status` del backend se pasa por
  `presentation.safeSignalStatus` (timestamp futuro / edad negativa / enum
  desconocido ⇒ `invalid`, nunca `recent`). Umbrales SIEMPRE de
  `thresholds` del payload — el frontend no hardcodea 10/45.
- `priorities[]`: se muestran con su `reason` y severidad, agrupadas SIN
  reordenar; sin tipos inventados; enum desconocido ⇒ neutral. **P1-B/P2**: cada
  prioridad porta `count` (≥1). El backend YA deduplica `load_pending_acceptance`
  **por ruta** con dedup ROBUSTA (por `picking_id`; `count` = pickings ÚNICOS;
  `occurred_at` = `created_at` válido más antiguo, `null` si ninguno válido): una
  ruta con N refills pendientes emite UNA prioridad con `count=N` y `reason` en
  plural ("2 refills pendientes…"); el frontend pinta UNA tarjeta con un chip `×N`
  (`priorityCountChip`), JAMÁS N tarjetas. **`related_entity_ids` fue ELIMINADO del
  contrato v1** (RED-2 P2): sin consumidor runtime ni deep-link autorizado;
  `count` basta. No se reemplaza por otro array de ids.
- **Timezone (P1-C/P3)**: `timezone` + `timezone_source` (`branch|company|
  system_fallback`) vienen RESUELTOS server-side. `timezone` **puede** ser `UTC`
  si esa es la config canónica de company/branch (RED-2 P3: se acepta cualquier
  IANA válida; el fallback canónico sigue siendo `America/Mexico_City`, nunca
  UTC). El frontend SOLO los etiqueta (`timezoneSourceLabel`) y usa `payload.date`
  para la fecha operativa (`operationalDateLabel`, validación ESTRICTA
  `YYYY-MM-DD` + fecha civil real; **NUNCA** `Date`/`Intl`/zona local del
  navegador; fuera de contrato ⇒ "Fecha operativa no disponible"). Si el cliente
  mandara `meta.tz`/`meta.timezone`/`tz`/`timezone`, el backend los ignora y los
  lista en `rejected_params`.
- `capabilities` gobiernan qué se pinta; `data_notes.times_are_server_received`
  ⇒ horas "registrado HH:MM"; `counters` (posiciones inválidas/fuera de
  ventana) se muestran como nota técnica, no como datos.
- `rejected_params`: si aparece, es bug del cliente (mandó scope) — log y
  corregir, no reintentar con otros valores.
