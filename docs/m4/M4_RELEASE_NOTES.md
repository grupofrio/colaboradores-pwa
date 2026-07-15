# M4 — Release notes (frontend v1 · PR DRAFT)

**NO Ready · NO merge sin S/N · el backend (GrupoVeniu/GrupoFrio #205) se mergea
primero.**

## Nuevo
- Módulo **"Ventas y clientes"** (`/ventas-clientes`, accessPolicy `m4`):
  observatorio read-only comercial con 9 bloques, veredictos epistémicos, KPIs
  **emitidos por el backend** (universo/fuente/cobertura/salvedad/corte),
  detalle server-side, 5 exports seguros y demo gateado (DEV/Preview;
  producción ignora `?demo=1`).
- Cliente API GET-only (`m4Api`) + contrato fail-closed (`m4/contract.js`) +
  handler directo sin fallback n8n (`directKoldOsM4`).
- Permisos v1: direccion_general / admin_plataforma → global; resto sin acceso.
- 79 tests M4 (**700/700** total), lint 0, build OK, blindaje public/ OK.

## Cambios de esta vuelta (adaptación al contrato definitivo)
- **La conclusión cambió**: de "1 incumplimiento" a **CERO**. La UI ya no puede
  mostrar un incumplimiento que la evidencia no prueba (ver M4_KNOWN_LIMITATIONS
  §0). Totales: 0 / 9 / 5 / 8 / 15 · **12,158** incidencias.
- **Los KPIs dejaron de derivarse en la pantalla**: vienen de `payload.kpis` con
  su contrato. Si el backend no emite uno, el tile no se renderiza.
- **Las capabilities gobiernan la UI**: lo que el contrato v1 no evalúa se
  muestra "—" con su razón (M5 entrega · M6 financiero · M7 margen · POS ·
  devoluciones), **nunca 0**.
- **Copy**: "pedido confirmado" (nunca "venta"), "sin vendedor asignado en el
  pedido", "cliente actualmente sin canal clasificado".
- **Allowlist de `/findings` corregida**: ahora es el espejo exacto del backend.
  Antes enviaba `channel`/`customer_segment`/`product_id` (que el backend
  rechazaba ⇒ lista sin filtrar) y **descartaba `responsible_area`** (⇒ el
  selector no hacía nada). Dos tests lo fijan.
- **Linaje**: la procedencia declara `measuring_commit` (= `auditor_build_sha`
  del envelope, con test que los compara) en vez de un head de rama inestable.

## Integración (patrón mergeado de main, sin arquitectura paralela)
`registry.js` (+1 entrada) · `navModel.js` (+2 `if` inline espejo de m2) ·
`App.jsx` (guard `M4VentasRoute` + ruta) · `api.js` (+handler). M1 (Tower) y
M2 (Planeación) intactos — matriz de convivencia probada y smoke en runtime.

## Sin cambios funcionales
M1, M2, M3 (sigue en su rama), resto de módulos.

## Deuda declarada
Ver [M4_KNOWN_LIMITATIONS](M4_KNOWN_LIMITATIONS.md): definiciones comerciales sin
ratificar (⇒ exploratorias), corrida odoo-shell bloqueada, el SQL del manifiesto
nunca ejecutado, historial de 1 corrida, rebase futuro con M3.
