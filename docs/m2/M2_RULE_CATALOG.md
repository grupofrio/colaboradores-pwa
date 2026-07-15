# M2 — Catálogo canónico de reglas (v1)

Versión: `kold.tower.m2.rules/1` · fuente ejecutable: `src/modules/planeacion/m2/ruleCatalog.js`
(el código es la verdad; este doc explica). **auto_fix = false en todas** (verificado por test).

## Resultado del run real 2026-07-14 (producción, 484 planes / 90 días)

| Código | Regla | Resultado real | Estado |
|---|---|---|---|
| M2-A-01 | Plan sin territorio | **293/484 = 60.54%** | 🔴 |
| M2-A-02 | Territorio inválido | contrato v1 sin dato | ⚪ NOT_EVALUABLE |
| M2-A-03 | Territorio inactivo | contrato v1 sin dato | ⚪ NOT_EVALUABLE |
| M2-B-01 | Plan sin evidencia del solver | **424/484 = 87.60%** | 🔴 |
| M2-B-02 | Distancia por fuente de respaldo | 0 detectados | 🟢 |
| M2-B-03 | Solver desactualizado | corrida ≤ 7 días | 🟢 |
| M2-C-01 | Plan sin vehículo | **133/484 = 27.48%** | 🔴 |
| M2-C-02 | Plan sin capacidad | **144/484 = 29.75%** | 🔴 |
| M2-C-03 | Plan diario con sobrecapacidad | **30** | 🔴 |
| M2-C-04 | Línea semanal con sobrecapacidad | **29** | 🔴 |
| M2-C-05 | Vehículo inactivo/fuera de compañía | contrato v1 sin dato | ⚪ NOT_EVALUABLE |
| M2-D-01 | Plan publicado sin carga | **37/39 = 94.87%** | 🔴 |
| M2-D-02 | Plan diario sin snapshot | **46** | 🔴 |
| M2-D-03 | Plan diario sin stops | **21** | 🔴 |
| M2-D-04 | Línea semanal publicada sin almacén | **48** | 🔴 |
| M2-D-05 | Línea semanal sin snapshot | **10** | 🟠 |
| M2-E-01 | Cobertura forecast insuficiente | **56.82%** (< 70) | 🔴 |
| M2-E-02 | Confianza de snapshot baja | **0.6667** (< 0.70) | 🔴 |
| M2-E-03 | Líneas en fallback | **2 202** | 🟠 |
| M2-E-04 | Warnings de snapshot | **192** | 🟠 |
| M2-E-05 | Snapshot desactualizado | ≤ 3 días | 🟢 |
| M2-F-01 | Cobertura actual_kg insuficiente | **7 026/42 421 = 16.56%** | 🔴 |
| M2-F-02 | Forecast sin marcar final | 41 372/42 372 = 97.64% | 🟢 |
| M2-F-03 | Días sin forecast en la ventana | 92 días ≥ ventana 90 | 🟢 |

**Totales**: 24 reglas · 21 evaluables · 12 🔴 · 4 🟠 · 5 🟢 · 3 ⚪.

## Estructura de cada regla

`code` · `category` (A territorio / B solver / C vehículo-capacidad / D carga-handoff /
E snapshots-forecast / F resultado real) · `name` · `description` · `severity` (high/medium) ·
`entity_type` · `source_model` · `query_id` + `numerator`/`denominator` (campos del contrato) ·
`threshold` · `evidence_fields` · `responsible_area` · `recommended_action` · `auto_fix: false`.

## Tipos de umbral

- **zero** — 0 = GREEN; >0 = RED (severidad high) o AMBER (medium).
- **min_pct** — ≥ green_at GREEN · ≥ amber_at AMBER · menor RED.
- **min_score** — igual, sobre score 0..1.
- **max_age_days** — antigüedad vs corte del run.
- **manual** — sin dato en contrato v1 ⇒ NOT_EVALUABLE con razón explícita.

## Origen de umbrales

- **90/70 de cobertura (M2-E-01)**: heredado del semáforo honesto de Route Intelligence
  (decisión D-A, MVP1.5A).
- **0.85/0.70 confianza, 80/50 actual_kg, 95/80 final, 7d solver, 3d snapshot**: defaults v1
  **pendientes de ratificación** por dirección/planeación. Cambiarlos = editar el catálogo
  versionado (PR), nunca la UI.

## Responsabilidad por categoría (mapa explícito — Fase 6)

| Categoría | Área responsable |
|---|---|
| Territorio | Operaciones / Administración de sucursal |
| Solver | Planeación / Sistemas |
| Vehículo y capacidad | Operaciones / Flota |
| Carga y handoff | Almacén / Jefe de ruta |
| Snapshots y forecast | Planeación / Comercial / Datos |
| Resultado real | Operación de campo / Cierre de ruta |

`responsible_employee_id` solo se poblará cuando exista **fuente autoritativa** (no inferencia);
mientras tanto `owner_status = unassigned`. SLA: no documentado hoy ⇒ no se muestra.
