# M4 — Spec funcional (frontend "Ventas y clientes")

**Estado: backend GrupoVeniu/GrupoFrio PR #205 (DRAFT, `4e195a92`) · evidencia
NO formal · cero PII · sin campañas (M8 LOCK) · cero writes · PR DRAFT, no
Ready.**

## Qué es
Observatorio READ-ONLY de la operación comercial: 9 bloques (maestro de
clientes, clasificación/canal, leads, pedidos confirmados, precio/descuento,
recurrencia, portafolio, pérdida/recompra, señal M4→M2) alimentados por la API
autenticada `gf_kold_os_m4` (GET /pwa-kold-os/m4/{latest,findings,runs}).

## Definiciones que la UI respeta al pie de la letra
- **Pedido confirmado** = `sale.order` `state='sale'` en el scope y la ventana.
  **Nunca "venta"**: no implica entregado (M5) / facturado / cobrado (M6) /
  margen (M7) / POS / devoluciones.
- **Vendedor** = SOLO `sale.order.user_id` (no es ownership comercial total).
- **Canal** = `res.partner.channel_id` **ACTUAL** del cliente (el pedido no
  tiene canal propio) ⇒ "actualmente sin canal clasificado", no "se vendió sin
  canal".
- **Cliente** = raíz comercial (`commercial_partner_id = id`) con historial de
  pedido confirmado en el scope. **584** activas
  (`active_commercial_customer_roots_in_scope`, el universo de la salud
  comercial) y **752** contando las 168 archivadas
  (`commercial_customer_roots_in_scope`, que solo usa la regla de archivados).
  **NO** es `res.partner customer_rank>0`: ese universo pre-A5 (2,333) dejaba
  fuera a 410 de los 713 que compran.
- **El universo lo declara el backend** (`universe_id` del catálogo canónico) y
  esta pantalla lo **renderiza**; no infiere cuál le toca a cada regla.

## Autoridad y acceso (v1, fail-closed)
- `direccion_general` (x_job_key efectivo) → GLOBAL.
- `admin_plataforma` (tower_status autoritativo, proyección server-side de
  direccion_general — el backend la acepta en `_access_for`) → GLOBAL.
- gerente_sucursal / supervisor_ventas / vendedor / chofer / jefe_ruta → SIN
  ACCESO (no existe rol comercial autoritativo por sucursal; autorizarlos “por
  nombre” = decisión S/N futura en AMBAS allowlists).
- Sesión inválida → /login. Política desconocida → oculto/denegado.
- UNA sola decisión para Home/nav/Más/rail/clic (`readM4Access` vía navModel);
  `M4VentasRoute` revalida como autoridad final de la URL.

## Flujo
1. `/latest` → valida contrato → header + banners (DEMO/no-formal/STALE) +
   veredictos + **KPIs emitidos por el backend** (cada uno con universo/fuente/
   cobertura/salvedad/corte) + 9 bloques. Las `capabilities` gobiernan: lo que
   el contrato no puede evaluar se muestra "—" con su razón, **nunca 0**.
2. `/findings` → tabla paginada SERVER-side con los filtros del contrato.
3. Panel de detalle por hallazgo: observado/esperado/universo/cobertura/
   supuesto/limitaciones/umbral+fuente/linaje/lifecycle.
4. Exports client-side: CSV, JSON evidencia, resumen ejecutivo, recurrencia,
   handoff M4→M2 (sufijos _DEMO/_STALE/_NONFORMAL).

## Qué NO hace
No edita clientes/pedidos/precios/canales; no crea ni cancela pedidos; no envía
WhatsApp/email/push (M8); no muestra PII; no persiste nada en el navegador; no
consume archivos públicos; sin fallback n8n. **No deriva KPIs**: si el backend
no lo emite, la pantalla no lo inventa.
