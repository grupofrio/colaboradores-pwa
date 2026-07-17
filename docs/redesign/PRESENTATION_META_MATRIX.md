# Matriz PresentationMeta M1–M6

`ModuleHeader` NO lee seis payloads ad-hoc: cada módulo tiene un adaptador
`readMxPresentationMeta(payload)` que **normaliza metadata** (no recalcula negocio) a
una forma común. Esta matriz documenta, por campo visual, el **path backend exacto**,
el **fallback** y el **estado si falta**. Verificado leyendo las pantallas en `main`.

## Forma común que devuelve cada adaptador

```
{ title,               // título de negocio (glosario 0B; en 0A conserva el actual)
  dataAsOf,            // ISO | null
  period,             // { kind:'range', start, endExclusive } | { kind:'days', days } | null
  companies,          // number[]  (ids; el label lo pone la UI vía COMPANY_LABELS)
  branchScope,        // string | null
  formal,             // boolean | null   (is_production_shell_run)
  source,             // string | null    (measurement_method o fuente declarada)
  decisionCaveats,    // string[]  (capa 1: no-formal, cobertura baja, dato viejo…)
  technicalEvidence,  // { run_id, scope_key, evidence_sha256, duration_ms,
                      //   executed_queries, manifest, contract, extra{} }
  auditor, status }   // technical_state / overall_status (badges)
```

## Campo visual → path backend, por módulo

| Campo | M1 | M2 | M3 | M4 | M5 | M6 | Si falta |
|-------|----|----|----|----|----|----|----------|
| dataAsOf | `data.dataAsOf` (de `p.data_as_of`) | `run.finished_at` | `run.finished_at` | `run.finished_at` | `run.finished_at` | `run.finished_at` | "corte no informado"; sin freshness |
| period | — (snapshot) | `run.scope.window_days` (nº) | `run.scope.window_days` (nº) | `run.scope.window_start` / `window_end_exclusive` | idem M4 | `run.scope.window_start` / `window_end_exclusive` | ocultar chip periodo |
| companies | — (branch-scoped) | `run.scope.company_ids` | `run.scope.company_ids` | `run.scope.company_ids` | `run.scope.company_ids` | `run.scope.company_ids` | "compañías no informadas" |
| branchScope | selector M1 | — (agregado) | — | — | — | — | "agregado" |
| formal | n/a | (no se muestra) | `run.is_production_shell_run` | `run.is_production_shell_run` | `run.is_production_shell_run` | `run.is_production_shell_run` | omitir pill |
| source | endpoint backlog | literal módulo | literal módulo | — | — | `run.measurement_method` | "fuente no informada" |
| auditor | n/a | `run.technical_state` | `run.technical_state` | `run.technical_state` | `run.technical_state` | `run.technical_state` | omitir badge |
| status | n/a | `summary.overall_status` | `summary.overall_status` | `payload.summary.overall_status` | idem | `payload.summary.overall_status` | "estado no informado" |

**Inconsistencias reales que la matriz resuelve (por eso hacen falta adaptadores):**
1. **periodo**: M2/M3 emiten `window_days` (número); M4/M5/M6 emiten rango de fechas;
   M1 no tiene ventana (snapshot de backlog). El adaptador normaliza a `period.kind`.
2. **data_as_of**: M1 usa `data.dataAsOf` (top-level); el resto `run.finished_at`;
   M4/M5 además traen `kpi.data_as_of` por tile (no se usa en el header).
3. **auditor/status**: el binding local difiere entre pantallas; el path canónico es
   `run.technical_state` y `summary.overall_status` (o `payload.summary.overall_status`).
4. **M1 es el outlier**: modelo de backlog, no el shape auditor-contrato. Su adaptador
   mapea lo mínimo (dataAsOf, branchScope) y declara el resto como no aplicable.

## Regla dura (test por adaptador)
Un campo ausente **no** produce copy falso: devuelve el estado "no informado"; nunca
un `0`, una fecha inventada ni una compañía por defecto. Cada adaptador tiene un test
que verifica el path correcto y el estado-si-falta.
