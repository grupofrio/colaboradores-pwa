# M5 — Release notes (frontend v1 · PR DRAFT)

**NO Ready · NO merge sin S/N · el backend (#208) se mergea primero.**

- Módulo **"Inventario y flujo"** (`/inventario-flujo`, accessPolicy `m5`):
  observatorio read-only del flujo de producto, 10 bloques, KPIs del backend con
  contrato completo, `rejected_params` visible, capabilities gobiernan ("—" ≠ 0),
  5 exports seguros, demo gateado.
- Integración patrón mergeado de main (inline, espejo m2): registry +1,
  navModel +2 ifs, App.jsx guard+ruta, api.js handler. **M1–M4 intactos**.
- 93 tests M5 (**715/715** total), lint 0, build OK.
- Deuda declarada: ver M5_KNOWN_LIMITATIONS.
