# M5 — Limitaciones conocidas (frontend v1)

Backend: **PR #208 (DRAFT)**; el head se consulta en GitHub. El código que midió
es `e32abcea` (= run.auditor_build_sha, con test que lo compara).

## 0. Lo que gobierna todo
De 36 reglas, **CERO incumplimientos**: 8 riesgos (2,905) · 9 anomalías (6,151)
· 6 cumplen · 13 no evaluables · **9,056 incidencias**. La respuesta medida a
"¿cuadra?" es **NO**: entregado > cargado con 0 refills (M5-G-06, 1 incidencia
= la condición agregada), 160/356 reconciliaciones con diferencia.

## 1. Fronteras duras (capabilities=false, "—" en la UI)
- **Stock por unidad**: NO existe modelo de inventario por vehículo.
- Kg esperados vs reales / carga vs capacidad: v1.1 (umbral+cómputo).
- Stock de almacén: cadencia de snapshots sin ratificar.
- Conciliación financiera = **M6 (no iniciado)** · rentabilidad = **M7**.

## 2. Heterogeneidad declarada
Las sumas del cuadre mezclan UOM entre productos: señal direccional. El total
de incidencias mezcla planes/líneas/paradas/reconciliaciones y lo DICE; la
condición agregada cuenta 1.

## 3. Evidencia
NO formal (XML-RPC read-only; odoo-shell bloqueado). El SQL del manifiesto
nunca ha corrido: el runbook exige comparar conteos antes de ingerir.

## 4. Rebase futuro
M3 (#71) y M4 (#72) siguen DRAFT: cuando mergeen, los `if` inline de
m2/m3/m4/m5 se funden en navModel/registry/App/api — conflicto esperado,
resolución semántica.
