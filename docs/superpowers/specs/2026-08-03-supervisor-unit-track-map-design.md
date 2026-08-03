# Supervisor Unit-Track Map Design

## Purpose

Give a sales supervisor a read-only map of a selected vendor's operational route for the current authorized day: current GPS position, a decimated route trail, and planned versus check-in stop locations.

## Placement

The feature belongs inside the existing vendor detail screen, `ScreenDetalleVendedor`, reached from the Control Comercial team list at `/equipo/vendedor/:vendedorId?route_id=<plan-id>`. It does not introduce a new top-level PWA route.

## Data flow

The screen requests `GET /pwa-supv/unit-track?plan_id=<plan-id>&date=<optional>` through the existing `api()` layer. `directSupervisorVentas` converts that PWA-friendly GET into `POST /gf/salesops/supervisor/v2/unit-track` with the normal `supervisorMeta()` and `{data: {plan_id, date}}` contract. Odoo remains the source of truth for supervisor identity, branch, operational-day authorization, and Radar feature flags. This requires #245 plus #246 deployed: #246 fixes the mobile-warehouse lookup that previously excluded every valid GPS point.

The client normalizes only valid coordinates in memory. It renders them with Leaflet/OpenStreetMap, then discards them when the view unmounts or changes plan. Pending requests are aborted or ignored by a per-plan request identity, so a previous vendor's geometry cannot appear during navigation.

## UX states

- Ready: current marker, trail, and planned/check-in stops appear in a card titled “Recorrido de unidad”.
- No GPS trail: retain the vendor detail and stop list, show available current/stops, and state “Sin recorrido GPS disponible para esta jornada.”
- Feature disabled, forbidden, or wrong date: show a compact unavailable card and no location geometry.
- Transport/server failure: show a retry control for the map only; do not block the rest of the detail view.

## Safety and privacy

The UI is read-only. It stores no location data in browser persistence, sends no writes, and never derives scope in the client. It renders only after the existing backend authorization succeeds. Production enablement requires the Radar flag and confirmed notice to the field team.

## Non-goals

- Live polling or background GPS tracking.
- Editing routes, stops, locations, or driver information.
- Historical date browsing beyond the backend's operational-date policy.
- Changing the existing dashboard navigation or route-plan naming cleanup.
- Changing the Brief Iguala n8n report.
