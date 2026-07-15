# M2 — Release notes v1 (superficie "Planeación y readiness")

**PR**: `feat(m2): expose planning readiness findings in KOLD OS` · rama
`feat/kold-os-m2-planning-readiness` · base main `3ed6fb8` (post-#66).

## ⚠️ ORDEN DE LIBERACIÓN: MERGEAR DESPUÉS DE PR #67

Dependencia de **orden**, no técnica. M2 no se apila sobre la rama de #67 ni la modifica. Único
archivo compartido: `src/modules/registry.js` (cada PR agrega su módulo en secciones distintas,
no adyacentes ⇒ auto-merge limpio esperado; si Git marcara conflicto, la resolución es trivial:
conservar ambas entradas).

## Nuevo

- **Módulo `planeacion`** en el catálogo canónico (tarjeta home + nav global, rol
  `direccion_general`), ruta `/planeacion` detrás del guard propio `M2PlaneacionRoute`
  (direccion_general x_job_key **o** admin_plataforma tower_status; fail-closed).
- **Superficie ejecutiva**: corte/ventana/compañías/duración/13-de-13, badges READ-ONLY + estado
  técnico del auditor + estado operativo de datos, 8 KPIs, 6 bloques semafóricos con acceso a
  drill-down.
- **Drill-down**: hallazgos paginados con 7 filtros + búsqueda + rango de fechas; panel de detalle
  con regla/observado/esperado/historial/evidencia/IDs/fuente/área responsable/acción sugerida y
  "Copiar referencia".
- **Ciclo de vida** determinista (new/persistent/corrected/recurrent) sobre historial de corridas
  (v1: 1 corrida ⇒ todo new; el motor ya soporta N).
- **Export read-only**: CSV de hallazgos, JSON de evidencia (con hashes/manifest), resumen
  ejecutivo imprimible. Sanitización defensa-en-profundidad.
- **Catálogo canónico de 24 reglas** en 6 categorías, con severidad, umbral, evidencia, área
  responsable y `auto_fix:false` universal.
- **Contrato validado** del run del auditor (`kold.tower.m2.run/1`) con estados técnicos
  PASS/FAIL/STALE/UNAVAILABLE.
- **Fixture de reconstrucción sanitizada** del run real 2026-07-14 (agregados reportados exactos,
  procedencia declarada) para tests y modo `?demo=1`.
- 67 tests nuevos (591/591 total) + docs (8 documentos en `docs/m2/`).

## Sin cambios

Backend/Odoo (cero), flag `gf_tower.m1.enabled` (cero), TowerRoute y superficie Tower (cero),
PR #67 (cero), ScreenHome/navModel de main (cero), endpoints (cero), `public/` (cero).

## Estado de datos al liberar

Auditor técnico **PASS** · datos reales **RED/AMBER** (12 reglas rojas, 4 ámbar — ver
M2_RULE_CATALOG). Esto es el RESULTADO esperado del observatorio, no un defecto de la entrega.

## Limitaciones conocidas

Ver `M2_KNOWN_LIMITATIONS.md`.
