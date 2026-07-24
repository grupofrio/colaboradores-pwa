# M7 Frontend — Los nueve estados de una métrica

`resolveM7Metric(payload, spec)` es la **única autoridad** que interpreta una
métrica. Un tile jamás devuelve `null` en silencio: siempre resuelve a uno de nueve
estados distinguibles, cada uno con su razón legible.

| Estado | Cuándo | Qué ve el usuario |
|--------|--------|-------------------|
| `ok` | hay valor (0 **incluido**: es un dato) | el número |
| `not_evaluable` | `null` en campo declarado `nullable` | "—" + razón |
| `contract_error` | campo requerido ausente, `null` no-nullable, o capability inexistente | error visible |
| `capability_disabled` | el backend declara la capability `= false` | "no disponible" + capability |
| `metric_unavailable` | la query no vino / sin filas (cobertura parcial) | aviso de cobertura |
| `malformed_metric` | el valor no es del tipo declarado (o `NaN/Infinity`) | error de tipo |
| `backend_unavailable` | no hay payload | banner de backend caído |
| `multi_currency_unconsolidated` | se pidió un total consolidado sin normalización FX | "sin consolidar" |
| `lineage_mismatch` | el payload afirma formalidad sin sus marcas | aviso de linaje |

## Reglas duras

- **`0` es `ok`, no vacío.** El bug de M4/M5 fue tratar `0` y "ausente" como el mismo
  "—". Aquí `0` pinta `0`.
- **`null` (declarado nullable) ≠ `0`.** `not_evaluable` dice "no pude medir"; nunca
  se dibuja como cero.
- **Un campo requerido ausente NO se silencia:** `contract_error` grita que el
  contrato cambió y esa tarjeta "ya no mide lo que dice medir".
- **Los estados son mutuamente distinguibles** (probado: 8 fuentes de falla → 8
  estados distintos, ninguno colapsa).

Pruebas: `tests/m7MetricStates.test.mjs` (17 casos).
