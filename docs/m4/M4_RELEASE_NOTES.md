# M4 — Release notes (frontend v1 · PR DRAFT)

**NO Ready · NO merge · depende del dictamen de Codex sobre el backend
congelado `978994c4`.**

## Nuevo
- Módulo **"Ventas y clientes"** (`/ventas-clientes`, accessPolicy `m4`):
  observatorio read-only comercial con 9 bloques, veredictos epistémicos,
  KPIs con universo/caveat, detalle server-side, 5 exports seguros y demo
  gateado (DEV/Preview; producción ignora `?demo=1`).
- Cliente API GET-only (`m4Api`) + contrato fail-closed (`m4/contract.js`) +
  handler directo sin fallback n8n (`directKoldOsM4`).
- Permisos v1: direccion_general / admin_plataforma → global; resto sin acceso.
- 76 tests nuevos (697/697 total), lint 0, build OK, blindaje public/ OK.

## Integración (patrón mergeado de main, sin arquitectura paralela)
`registry.js` (+1 entrada) · `navModel.js` (+2 `if` inline espejo de m2) ·
`App.jsx` (guard `M4VentasRoute` + ruta) · `api.js` (+handler). M1 (Tower) y
M2 (Planeación) intactos — matriz de convivencia probada y smoke en runtime.

## Sin cambios funcionales
M1, M2, M3 (sigue en su rama), resto de módulos.

## Deuda declarada
Ver M4_KNOWN_LIMITATIONS (kpis con forma M3 en el backend congelado,
auditor_build_sha placeholder, definiciones comerciales sin ratificar,
rebase futuro con M3).
