# M4 — Spec funcional (frontend "Ventas y clientes")

**Estado: backend CONGELADO (978994c4) bajo auditoría de Codex · contrato
PROVISIONAL · evidencia NO formal · cero PII · sin campañas (M8 LOCK) · cero
writes · PR DRAFT, no Ready.**

## Qué es
Observatorio READ-ONLY de la operación comercial: 9 bloques (maestro de
clientes, clasificación/canal, leads, pedidos/ventas, precio/descuento,
recurrencia, portafolio, pérdida/recompra, señal M4→M2) alimentados por la API
autenticada `gf_kold_os_m4` (GET /pwa-kold-os/m4/{latest,findings,runs}).

## Autoridad y acceso (v1, fail-closed)
- `direccion_general` (x_job_key efectivo) → GLOBAL.
- `admin_plataforma` (tower_status autoritativo, proyección server-side de
  direccion_general — el backend congelado la acepta en `_access_for`) → GLOBAL.
- gerente_sucursal / supervisor_ventas / vendedor / chofer / jefe_ruta → SIN
  ACCESO (no existe rol comercial autoritativo por sucursal; autorizarlos “por
  nombre” = decisión S/N futura en AMBAS allowlists).
- Sesión inválida → /login. Política desconocida → oculto/denegado.
- UNA sola decisión para Home/nav/Más/rail/clic (`readM4Access` vía navModel);
  `M4VentasRoute` revalida como autoridad final de la URL.

## Flujo
1. `/latest` → valida contrato → header + banners (DEMO/no-formal/STALE) +
   veredictos + KPIs (derivados de `metrics`) + 9 bloques.
2. `/findings` → tabla paginada SERVER-side con filtros del contrato.
3. Panel de detalle por hallazgo: observado/esperado/universo/cobertura/
   supuesto/limitaciones/umbral+fuente/linaje/lifecycle.
4. Exports client-side: CSV, JSON evidencia, resumen ejecutivo, recurrencia,
   handoff M4→M2 (sufijos _DEMO/_STALE/_NONFORMAL).

## Qué NO hace
No edita clientes/pedidos/precios/canales; no crea ni cancela pedidos; no envía
WhatsApp/email/push (M8); no muestra PII; no persiste nada en el navegador; no
consume archivos públicos; sin fallback n8n.
