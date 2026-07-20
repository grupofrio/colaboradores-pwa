# M7 Frontend — Selección histórica de corridas (vista PARCIAL honesta)

> Corrige el **BLOCKER** de la auditoría final de Codex: RunsTab hacía
> `setSelected(run_id)` (selección cosmética) mientras findings/summary/exports
> seguían mostrando la corrida `latest`, y la UI prometía "carga EXACTAMENTE ese
> run". Ahora la selección re-ancla de verdad, dentro de lo que el backend permite.

## El contrato real del backend #211 (leído, no supuesto)

| Endpoint | Acepta run_id | Devuelve por corrida |
|----------|---------------|----------------------|
| `GET /latest` | **NO** (sin params) | payload COMPLETO (summary, capabilities, metrics, findings) — SIEMPRE la más reciente |
| `GET /findings` | **SÍ** (+ scope_key) | findings de esa corrida; ecoa run_id/scope_key; run_id desconocido ⇒ 422 (jamás latest) |
| `GET /runs` | filtra | **metadata** por corrida (run_id, scope_key, finished_at, formal, measurement, auditor, finding_count). **NO** summary/capabilities/metrics |

**Consecuencia:** no existe forma en el backend de reconstruir el resumen, las
capacidades o las métricas de una corrida histórica. `/latest` no acepta run_id y
`/runs` no trae ese payload. Inventar soporte en el frontend sería mentir.

## Estrategia elegida: B — vista histórica PARCIAL y explícita

Al seleccionar una corrida:

- **SÍ se re-anclan** (a datos contractualmente disponibles):
  - **Hallazgos**: `GET /findings?run_id=…&scope_key=…` (+ filtros).
  - **Su exportación CSV**: reúne todas las páginas de esa corrida; el linaje y el
    nombre de archivo portan su run_id.
  - El panel de **Alcance** muestra la metadata de la corrida anclada.
- **NO cambian** (siguen siendo la corrida más reciente, y se DECLARA):
  - Resumen, Escalera económica, Señales por dominio, Capacidades.
  - Exportes de Evidencia JSON y Capabilities TXT (marcados `_latest`).

Un banner permanente lo dice: *"Viendo la corrida histórica X. Hallazgos y export
corresponden a esta corrida. Resumen/Escalera/Señales/Capacidades siguen mostrando
la corrida más reciente: el backend no expone un payload completo por corrida."*

## Autoridad única: `runController.js`

`initSelection` · `m7SelectionReducer` (SELECT/CLEAR) · `planFindingsRequest`
(ancla run_id+scope_key a cada consulta) · `findingsAnchorMismatch` (defensa) ·
`selectedRunContext` · `isLatestSelected` · `makeSeqGuard`.

Un solo estado (`selection`) alimenta RunsTab, FindingsTab, Exports, Scope y el
banner. No hay `selectedRunId` local en RunsTab ni otro runId en Findings.

## Garantías (cada una con prueba)

| Garantía | Prueba |
|----------|--------|
| Seleccionar A con latest B ⇒ la petición lleva A | `m7RunController` "la petición lleva A, no B" |
| Cambiar filtro conserva el run | `m7RunController` "cambiar filtro CONSERVA el run" |
| Cambiar página conserva run + scope | `m7RunController` "cambiar página CONSERVA run + scope" |
| Limpiar selección ⇒ vuelve a latest | `m7RunController` "vuelve a la corrida latest" |
| run_id desconocido ⇒ 422, **jamás** latest | backend `select_run`; FE envía run_id siempre |
| run/scope devuelto ≠ anclado ⇒ mismatch VISIBLE | `m7RunController` "findingsAnchorMismatch" |
| Export ancla a A, no a B | `m7Exports` "CSV de corrida histórica: linaje del run anclado" |
| Carrera A→B: respuesta tardía de A no pisa B | `m7RunController` "makeSeqGuard" |
| Botón "Ver" despacha al controller (no cosmético) | `m7ScreenWiring` "DESPACHA la selección" |
| El claim "carga EXACTAMENTE ese run" fue retirado | `m7ScreenWiring` + `m7ScreenRender` |
| El banner histórico se renderiza de verdad | `m7ScreenRender` "banner declara vista PARCIAL" |

## Estados de error/carga añadidos

`loading` · `run_mismatch` (corrida devuelta ≠ pedida) · `malformed_contract` (422)
· `unavailable` · export **bloqueado** mientras se prepara (`busy`).
