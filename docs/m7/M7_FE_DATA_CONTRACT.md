# M7 Frontend — Contrato de datos

Esquema: **`kold.os.m7.api/1`**. El frontend valida el envelope ANTES de renderizar
(`validateM7Latest`); un esquema desconocido se marca `unsupported` y no se pinta.

## Top-level del `/latest`

`schema_version · read_only · run · summary · capabilities · capability_requirements
· rule_results · findings · history · metrics`

## Invariantes que el validador EXIGE (y que muerden si se rompen)

1. `read_only === true` (M7 es observatorio).
2. `run.scope_key` sha256; `run.is_production_shell_run` booleano (la formalidad se
   **deriva** del dato, no de una env var).
3. `summary.total_incidences` == suma recomputada de `incidences` de reglas con
   verdict incumplimiento/riesgo/anomalia.
4. `summary.total_incidences_note` menciona **"registros únicos"** y **"pesos"**.
5. `profitability_level_reached` dentro del catálogo L0–L6.
6. **L2+ exige `historical_cogs_observable === true`.** Un `L2` sin COGS histórico se
   rechaza (contrato inconsistente).
7. `historical_sales_cost_match_count === null` mientras `..._supported !== true`.
   Un `0` en su lugar se rechaza (`null` = no medible; `0` = medí ninguno).
8. `capability_requirements` presente (contrato del DAG).
9. Cada `rule_results[]` con classification/verdict/severity/universe_id del catálogo;
   `incumplimiento` sólo con `approved_threshold`.
10. **Cero PII** en cualquier nivel; **cero claves de otros módulos**
    (`daily_close_metrics`, `route_compliance`, …).

## Los cuatro ejes (independientes)

- classification `definitive/caveated/exploratory/not_evaluable/invalid`
- verdict `incumplimiento/riesgo/anomalia/cumple/no_evaluable`
- severity `critical/high/medium/low/informational`
- lifecycle `new/persistent/recurrent` — **sin `corrected`** (ausencia ≠ corrección).

`status=RED` **no** es incumplimiento: incumplimiento exige umbral aprobado por
dirección; en v1 no existe ninguno (`definitive_incident_rule_count = 0`).
