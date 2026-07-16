# M5 — Spec de UI (/inventario-flujo)

**Regla rectora: la UI muestra VEREDICTOS, no solo colores.**

1. Encabezado: pills READ-ONLY/AUDITOR/DATOS/EVIDENCIA/DEMO + corte, ventana,
   scope, linaje (midió + manifest + evidence).
2. Banners: MODO DEMO (PR y measuring_commit del backend) · EVIDENCIA NO FORMAL
   (por el DATO) · STALE · aviso rojo si el backend rechaza un filtro enviado.
3. Qué prueba la evidencia: 5 VerdictTile; total = suma exacta; semántica de
   incidencias declarada (la condición agregada del cuadre cuenta 1).
4. "¿El flujo cuadra?": KPIs del backend agrupados — Cuadre (sumas + caveat de
   UOM heterogéneas) · Carga · Catálogo/salidas/refill · Kilogramos y flota.
5. "Fuera del contrato v1": NotEvaluableTile para vehicle_inventory, kg
   esperados vs reales, carga vs capacidad, stock de almacén, conciliación
   financiera (M6), rentabilidad (M7) — "—" con razón, JAMÁS 0.
6. 10 bloques por categoría con peor veredicto, conteos e "umbral no aprobado".
7. Detalle server-side (filtros con efecto real) + panel del hallazgo con
   universo/fórmula/supuesto/limitaciones/umbral/linaje/lifecycle.
8. Exports: CSV (con universe_id) · JSON evidencia · resumen · diferencias y
   cuadre · handoff M5→M6/M7. Sin botones de acción. Sin PII.
