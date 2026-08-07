# M6 — Contrato de datos (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Los CUATRO EJES — independientes, ninguno derivado de otro

| Eje | Valores | Que dice | Fallback visual |
|---|---|---|---|
| `classification` | definitive · caveated · exploratory · not_evaluable · invalid | que tan solida es la evidencia | etiqueta; nunca color solo |
| `verdict` | incumplimiento · riesgo · anomalia · cumple · no_evaluable | que se concluye | pill con nombre + tooltip |
| `severity` | critical · high · medium · low · informational | que tan grave si es real | etiqueta |
| `lifecycle_status` | new · persistent · recurrent | como evoluciona entre corridas del MISMO scope | etiqueta |

**`status=RED` NO es `incumplimiento`** (bug 4 de M3). En esta corrida los tres
ejes DIFIEREN: veredicto (0/13/2/8/6) ≠ clasificacion (caveated 13 · definitive 0 · exploratory 11 · invalid 0 · not_evaluable 5) ≠
severidad (critical 1 · high 6 · informational 5 · low 4 · medium 13). Hay test que lo prueba: si un eje fuera funcion de otro, el
mapa seria 1:1.

## Campos del envelope que la UI consume

| Campo | Tipo | Nullable | Fuente | Uso | Fallback | Capability | PII |
|---|---|:---:|---|---|---|---|:---:|
| `schema_version` | string | no | backend | validar contrato | `schema_mismatch` | — | no |
| `read_only` | bool | no | backend | invariante | rechaza si != true | — | no |
| `run.run_id` | sha256 | no | auditor | linaje | "—" | — | no |
| `run.scope_key` | sha256 | no | auditor | **el historial jamas mezcla scopes** | rechaza | — | no |
| `run.auditor_build_sha` | hex | no | auditor | que codigo MIDIO | "—" | — | no |
| `run.contract_build_sha` | hex | **si** | auditor | quien EMPAQUETO | "sin sellar" | — | no |
| `run.is_production_shell_run` | bool | no | **el DATO** | banner formal/no formal | rechaza si no es bool | — | no |
| `run.measurement_method` | string | si | auditor | etiqueta de fuente | "—" | — | no |
| `run.production_shell_run_blocked_by` | string[] | si | auditor | por que no es formal | "—" | — | no |
| `run.scope.company_ids` | int[] | no | config | encabezado | rechaza si vacio | — | no |
| `run.scope.currency_ids` | int[] | si | config | **monedas del scope** | "—" | multi_currency | no |
| `run.scope.window_*` | date | no | config | ventana | rechaza | — | no |
| `summary.*_rule_count` | int | no | derivado | tiles por veredicto | 0 | — | no |
| `summary.classification_rule_counts` | obj | no | derivado | eje 2 | rechaza si falta | — | no |
| `summary.severity_rule_counts` | obj | no | derivado | eje 3 | rechaza si falta | — | no |
| `summary.total_incidences` | int | no | derivado | **suma exacta recomputada** | rechaza si difiere | — | no |
| `capabilities.features` | obj | no | backend | **gobiernan la UI** | rechaza si falta | — | no |
| `rule_results[]` | obj[] | no | derivado | universos + ejes | — | — | no |
| `metrics.<query>[0].<field>` | number | si | **auditor (filas crudas)** | tiles de cada bloque | **tile NO se renderiza** | — | no |
| `findings[]` | obj[] | si | derivado | tabla | "sin hallazgos" | — | no |
| `rejected_params` | string[] | no | backend | **banner rojo visible** | rechaza si falta | — | no |

### ⚠️ `kpis` NO existe en el envelope

El backend v1 **no emite un objeto `kpis`** con contrato (M5 si lo tiene). La
pantalla lee **`metrics`** — las filas crudas del manifiesto — y **cada tile
declara su query y su campo**. Leer `payload.kpis` habria renderizado nada en
silencio: el bug 8 (campo fantasma). Ver `M6_KNOWN_LIMITATIONS.md`.

## Cifras vigentes (29 reglas)

| Veredicto | Reglas |
|---|---:|
| incumplimiento | **0** |
| riesgo | 13 |
| anomalia | 2 |
| cumple | 8 |
| no_evaluable | 6 |
| **Total incidencias** | **6,006** |

Clasificacion: caveated 13 · definitive 0 · exploratory 11 · invalid 0 · not_evaluable 5 · Severidad: critical 1 · high 6 · informational 5 · low 4 · medium 13 · Hallazgos servidos: 15.

## Linaje

`measuring_commit` = `run.auditor_build_sha` = **`fe53d564eda81e0f1c5c2cb68aa2e8b51332ca22`** — el commit LOCAL del
backend que PRODUJO las cifras. **No es el head de ningun PR**: el backend no
tiene PR. Ventana `[2026-04-16, 2026-07-15)` · cias 1, 34, 35, 36 · monedas 1, 33 · scope_key
`bef3f17b1d236d7d…` · run `9d2bbaca41fdd829…`.
