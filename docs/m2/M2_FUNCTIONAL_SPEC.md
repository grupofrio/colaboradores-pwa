# M2 — Especificación funcional · "Planeación y readiness"

**KOLD OS · módulo Enterprise M2 (Demanda / planeación / optimización) · superficie v1 · 2026-07-14**

## 1. Propósito

M2 **evidencia lo que no se está haciendo** en la planeación de rutas. No corrige datos, no "pone
indicadores en verde", no ejecuta acciones. Responde:

1. **Qué** está mal (regla incumplida del catálogo canónico).
2. **Cuántos** registros afecta (numerador/denominador/porcentaje).
3. **Dónde** (compañías del scope; sucursal = extensión v1.1, ver §7).
4. **Qué registros** (agregado v1; detalle por registro = extensión v1.1).
5. **Desde cuándo** (first_seen_at por historial de corridas).
6. **Evolución** (new / persistent / corrected / recurrent).
7. **Qué regla** no se cumplió (código M2-X-NN + expectativa declarada).
8. **Qué evidencia** lo respalda (query_id, campos, hashes del run).
9. **Qué área** debe atenderlo (mapa explícito de responsabilidad, sin nombres inventados).
10. **Si se corrigió** después (lifecycle corrected en corridas posteriores).

## 2. Qué NO hace M2 (por contrato)

No asigna territorios · no ejecuta el solver · no asigna vehículos · no completa capacidades ·
no genera carga · no crea snapshots · no inventa actual_kg · no corrige datos · no actualiza planes ·
no cierra hallazgos · no modifica producción. **auto_fix = false en el 100% del catálogo** y hay
tests que verifican la ausencia de verbos de escritura y de botones de acción.

## 3. Fuente de datos

El **auditor read-only** `gf_route_compliance/tools/kold_tower_m2_audit_core.py` (repo
GrupoVeniu/GrupoFrio, build `fb03840919cf…`): 13 consultas SQL en manifiesto cerrado, transacción
`READ ONLY`, write-probe bloqueado, rollback confirmado, sanitizador de evidencia (sin PII, sin
credenciales, solo agregados). El run de producción 2026-07-14: DB `grupofrio-grupofrio-31972140`,
compañías 1/34/35/36, ventana 90 días, 342 ms, 13/13, exit 0, contrato producción 3/3.

## 4. Arquitectura de la superficie (colaboradores-pwa)

```
src/modules/planeacion/
├── ScreenPlaneacionM2.jsx      pantalla (ejecutiva + drill-down + export)
└── m2/
    ├── contract.js             validación estricta del run (fail-closed) + estado técnico
    ├── ruleCatalog.js          catálogo canónico de reglas (6 categorías)
    ├── deriveFindings.js       motor: métricas → resultados/bloques/hallazgos
    ├── lifecycle.js            finding_id estable + new/persistent/corrected/recurrent
    ├── filters.js              filtros + paginación (puros)
    ├── exporters.js            CSV/JSON/resumen + sanitización defensa-en-profundidad
    ├── access.js               contrato de acceso fail-closed
    ├── loadM2Run.js            loader con base allowlisted /m2
    └── fixtures/realRun20260714.js  reconstrucción sanitizada del run real
```

Todo el cómputo es **client-side, puro y determinista** sobre el run validado. La ruta `/planeacion`
vive detrás de `M2PlaneacionRoute` (App.jsx) y el módulo `planeacion` está en el registry canónico
(tarjeta + nav global). Cero endpoints nuevos, cero writes, cero cambios de backend.

## 5. Estados honestos (separación dura)

| Plano | Estados | Significado |
|---|---|---|
| **Técnico (auditor)** | PASS / FAIL / STALE / UNAVAILABLE | ¿el run existe, validó su contrato y es reciente? |
| **Operativo (datos)** | GREEN / AMBER / RED / NOT_EVALUABLE | ¿los datos de planeación cumplen las reglas? |

Estado actual real: **auditor PASS · datos RED** (incumplimientos masivos). La UI lo comunica
explícitamente: *"M2 está funcionando y detectó incumplimientos"*. Un AMBER/RED de datos **no**
bloquea el módulo. NOT_EVALUABLE (gris) jamás se disfraza de 0%.

## 6. Vista ejecutiva y drill-down

- **Encabezado**: título, corte, ventana, compañías, duración, 13/13, badges READ-ONLY + técnico +
  operativo, hashes truncados (run/manifest/evidencia/build).
- **KPIs**: planes evaluados, reglas evaluadas, rojos, ámbar, registros afectados, compañías,
  persistentes, corregidos.
- **6 bloques**: Territorio · Solver · Vehículo y capacidad · Carga y handoff · Snapshots y forecast ·
  Resultado real — cada uno con conteo, %, semáforo, reglas, tendencia (a partir de la 2ª corrida)
  y acceso al drill-down.
- **Drill-down**: tabla paginada (10/pág.) con filtros por categoría, severidad, estado, ciclo de
  vida, entidad, área responsable, rango de fechas y búsqueda. Cada fila abre el detalle: regla,
  observado vs esperado, historial, evidencia, IDs técnicos, fuente, acción sugerida, "Copiar
  referencia". Sin botones de escritura; "Abrir en Odoo" queda para v1.1 (requiere entity_id).
- **Export**: CSV de hallazgos, JSON de evidencia, resumen ejecutivo imprimible (§M2_VALIDATION).

## 7. Limitación estructural v1 (declarada, no ocultada)

El contrato del auditor es **agregado** (counts por estado/fuente, sin GROUP BY compañía ni
sucursal y sin IDs de registro). Por eso en v1: atribución por sucursal = "agregado global",
drill-down a registros = no disponible, y los niveles de acceso por sucursal existen en el contrato
pero no se emiten. La **extensión v1.1** del contrato (detalle sanitizado y paginable) está
especificada en `M2_DATA_CONTRACT.md §5` y es del lado del auditor (Odoo/Sebastián).

## 8. Orden de liberación

**MERGEAR DESPUÉS DE PR #67.** Dependencia de ORDEN, no técnica: M2 se construyó sobre main
(post-#66) y no toca los archivos de la tarjeta Tower salvo `registry.js` (entrada nueva en sección
propia, no adyacente — merge limpio esperado en ambos órdenes).
