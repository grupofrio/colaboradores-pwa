# M4 — Spec de UI (pantalla /ventas-clientes)

**Regla rectora: la UI muestra VEREDICTOS, no solo colores.**

1. **Encabezado**: título + pills READ-ONLY / AUDITOR / DATOS / EVIDENCIA
   FORMAL·NO FORMAL / DEMO + línea de contexto (corte, ventana absoluta, scope,
   nº consultas, linaje auditor_build_sha, manifest/evidence sha, fuente).
2. **Banners**: MODO DEMO (provisional + commit congelado) · EVIDENCIA NO FORMAL
   (por el DATO `!run.is_production_shell_run`, con bloqueadores y build) ·
   STALE (edad + umbral) · copy "Lee los veredictos…" + frontera M8.
3. **Qué prueba la evidencia**: 5 VerdictTile (incumplimiento/riesgo/anomalía/
   cumple/no evaluable) con reglas e incidencias; nota total = suma exacta.
4. **Señal comercial**: 16 KpiTile derivados de `metrics`, cada uno con universo
   visible y caveat en tooltip; corte en el título de la sección. "Reactivados"
   y "Entregados" = "—" con frontera declarada (definición pendiente / M5).
5. **9 bloques comerciales**: peor veredicto del bloque como pill, conteo por
   veredicto, reglas con "umbral no aprobado" cuando aplica, granularidad, CTA
   que filtra el detalle.
6. **Detalle de regla**: filtros con efecto real (categoría/veredicto/
   clasificación/severidad/ciclo(gated ≥2 corridas)/entidad/área/búsqueda),
   tabla (Veredicto/Regla/Hallazgo/Clasificación/Granularidad/Entidad/Observado/
   Ciclo/Área/Última detección), paginación server-side.
7. **Panel del hallazgo**: qué se observó / qué se esperaba / universo /
   cobertura (num/den/pct) / supuesto / limitaciones / umbral+fuente /
   clasificación+severidad / entidad / ciclo / área / acción recomendada
   ("M4 observa; no ejecuta") / linaje completo.
8. **Exports**: CSV / JSON / resumen / recurrencia / handoff M4→M2.
9. **Estados**: loading, disabled, unavailable, session_expired, forbidden,
   schema_mismatch, invalid, error — copy honesto por estado.
10. Sin botones de acción comercial. Sin PII. Responsive (grid auto-fill,
    overflow-x en tabla). aria-labels en filtros; role="alert" en avisos.
