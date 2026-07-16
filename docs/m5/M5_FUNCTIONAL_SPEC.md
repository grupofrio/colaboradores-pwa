# M5 — Spec funcional (frontend "Inventario y flujo")

**Estado: backend GrupoVeniu/GrupoFrio PR #208 (DRAFT) · evidencia NO formal ·
cero PII · cero writes · PR DRAFT, no Ready.**

Observatorio READ-ONLY del flujo de producto: 10 bloques (catálogo/pesos, carga,
stock de unidad, salidas, refill, devoluciones, mermas/diferencias, kilogramos,
consignación, handoffs M3/M6/M7) desde GET /pwa-kold-os/m5/{latest,findings,runs}.
Responde: "¿lo cargado, vendido, recargado, devuelto y disponible CUADRA?".

## Acceso (v1, fail-closed)
direccion_general / admin_plataforma → GLOBAL; resto → SIN ACCESO (deny
documentado en el backend). UNA decisión (readM5Access vía navModel) gobierna
Home/nav/Más/rail/clic; M5InventarioRoute revalida la URL.

## Qué NO hace
No crea/valida/ajusta movimientos, pickings, cargas, refills, devoluciones,
productos ni pesos. No deriva KPIs (los emite el backend). No muestra PII. Sin
fallback n8n. Producción ignora ?demo=1.
