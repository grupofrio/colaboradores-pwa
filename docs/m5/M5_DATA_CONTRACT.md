# M5 — Contrato de datos (frontend)

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

## Los DOS EJES del contrato epistemico

`classification` y `verdict` son ejes **distintos** y no se colapsan:

| Eje | Valores | Que dice |
|---|---|---|
| `classification` | definitive · caveated · exploratory · not_evaluable · invalid | que tan solida es la evidencia |
| `verdict` | incumplimiento · riesgo · anomalia · cumple · no_evaluable | que se concluye |

En esta corrida **difieren**: 9 reglas tienen `classification=exploratory`
pero solo 8 tienen `verdict=anomalia`. La diferencia es **M5-G-06**:
exploratoria cuya condicion NO se cumple ⇒ su veredicto es `cumple`. Por eso el
summary publica ambos por separado (`anomaly_rule_count` vs
`classification_rule_counts.exploratory`): un solo campo no podia significar las
dos cosas.

## Lectura por VEREDICTO (38 reglas)

| Veredicto | Reglas |
|---|---:|
| incumplimiento | **0** |
| riesgo | 9 |
| anomalia | 8 |
| cumple | 7 |
| no_evaluable | 14 |
| **Total incidencias** | **8,802** (suma exacta recomputada) |

## Lectura por CLASIFICACION (las MISMAS 38 reglas)

definitive 1 · caveated 15 · exploratory 9 · not_evaluable 13

## Sumas de conciliacion

Son cantidades **REPORTADAS** por el documento, no hechos fisicos verificados, y
**jamas** mezclan estados:

| | Cargado | Entregado |
|---|---:|---:|
| **Finales** (90) | 15,043.5 | **14,921.5** |
| **Abiertas** (266) — trabajo en curso | 24,563.5 | 29,497.0 |

Por producto (finales): **3 de 261** lineas declaran difference.

Medido: `uom_category_count = 1`. Una sola categoria de UOM hace las sumas
consistentes **como conteo**, pero **NO implica intercambiabilidad fisica entre
productos distintos**: sumar una unidad de un SKU con una de otro no produce una
magnitud fisica. `uom_normalized_reconciliation` = false.

## Linaje

`measuring_commit` = `run.auditor_build_sha` = **`aa589965af604a41434da44d9946bafa991a921e`** — el codigo que
PRODUJO estas cifras, no el head del PR (hay test que fija la coherencia).
Ventana `[2026-04-16, 2026-07-15)`. ⚠️ `is_production_shell_run = false`: numeros reales,
corrida formal NO.
