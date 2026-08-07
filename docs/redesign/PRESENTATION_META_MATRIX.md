# Matriz PresentationMeta M1–M6 (verificada contra fixtures reales)

`ModuleHeader` NO lee seis payloads ad-hoc: cada módulo tiene un adaptador
`readMxPresentationMeta(payload)` que **normaliza metadata** (no recalcula negocio).
Esta matriz se **verificó campo por campo contra el fixture real** de cada módulo
(`tests/uxPresentationMetaModules.test.mjs`). Regla dura: **un campo ausente ⇒ null;
jamás se inventa fuente, formalidad, auditor ni status.**

## Forma común que devuelve cada adaptador

```
{ title, dataAsOf, period, companies, branchScope, formal, source,
  auditor, status, decisionCaveats[], technicalEvidence{} }
```
`period` = `{kind:'range', start, endExclusive}` | `{kind:'days', days}` | `null`.

## Verificación por módulo (path real · presente · ausente)

| Campo | M1 | M2 | M3 | M4 | M5 | M6 |
|-------|----|----|----|----|----|----|
| **dataAsOf** | `data.dataAsOf` ✓ | `run.finished_at` ✓ | `run.finished_at` ✓ | `run.finished_at` ✓ | `run.finished_at` ✓ | `run.finished_at` ✓ |
| **period** | `null` (snapshot) | `days(90)` — `scope.window_days`; **sin rango** | `days(90)` (tiene rango, pero se usa days) | `range(2026-01-16→2026-07-15)` | `range(…)` | `range(…)`; **sin window_days** |
| **companies** | `[]` (sin company_ids) | `[1,34,35,36]` | `[1,34,35,36]` | `[1,34,35,36]` | `[1,34,35,36]` | `[1,34,35,36]` |
| **branchScope** | `null` (no hay label top-level; sí `branch_name` por fila) | `null` | `null` | `null` | `null` | `null` |
| **formal** (`is_production_shell_run`) | `null` | **`null` — ABSENTE en M2** | `false` | `false` | `false` | `false` |
| **source** (`measurement_method`) | `null` | **`null` — ABSENTE** | **`null` — ABSENTE** | **`null` — ABSENTE** | **`null` — ABSENTE** | `xml_rpc_read_only` (**único que lo emite**) |
| **auditor** (`run.technical_state`) | `null` | `PASS` | `PASS` | `PASS` | `PASS` | `PASS` |
| **status** (`summary.overall_status`) | `null` | `RED` | `RED` | `AMBER` | `AMBER` | `AMBER` |
| **evidence.build id** | `branch_resolution_source` | **`build_sha`** (M2 no usa auditor/contract) | `auditor_build_sha`+`contract_build_sha` | idem | idem | idem |

## Consecuencias honestas (correcciones tras verificar)

1. **`source` = null en M1–M5.** Sólo M6 emite `measurement_method`. El adaptador
   **no** coloca un literal ("gf_kold_os_mX"): ese texto vive hardcodeado en el
   *screen* de M2/M3, no en el contrato. El adaptador refleja el contrato: null.
2. **`formal` = null en M2.** M2 no emite `is_production_shell_run`; no se inventa
   formal/no-formal. Por eso M2 tampoco genera el caveat "Evidencia no formal".
3. **`period` de M2 es solo `days`** (no tiene rango de fechas en el contrato).
4. **build id difiere:** M2 usa `build_sha`; M3–M6 usan `auditor_build_sha`+
   `contract_build_sha`. `commonTechnicalEvidence` captura ambos (null el que no aplique).
5. **M1 `branchScope` = null** (el alcance de sucursal se resuelve server-side por
   token; el modelo top-level no lo expone).

## Estado de adopción (importante)

En Etapa 0A **sólo M6** consume estos adaptadores (vía `EvidenceSection`/`DataFreshness`,
y **M6 conserva su encabezado propio**, no fue sustituido por `ModuleHeader`). Los
adaptadores M1–M5 están **construidos y verificados por tests**, pero **no cableados**
en la app todavía: su adopción es **Etapa 0A.2**, tras validar #78.
