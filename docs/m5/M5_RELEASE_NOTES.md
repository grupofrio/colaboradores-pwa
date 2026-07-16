# M5 — Release notes (frontend)

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

## Estado

**DRAFT.** No Ready · no merge · no deploy · flag OFF · cero writes.
Backend: `gf_kold_os_m5` (el numero de PR vive aqui y en el historial, no en el
codigo runtime: un numero de PR en runtime envejece y miente).

## Historial de auditorias

| Ronda | Veredicto | Que encontro |
|---|---|---|
| 1 | **RED** (Codex) | el titular "el flujo NO cuadra" no estaba respaldado: mezclaba conciliaciones abiertas con finales |
| 2 | **RED** (Codex) | residuos M4 + docs/tests desincronizados: manifest "Sales, customers and channels", tools apuntando a `reporte_m4.json`, docs con cifras de la v1 |
| 3 | pendiente de reauditoria acotada | correcciones de esta vuelta |

## Cambios de esta vuelta

- Comentario del cliente API sin numero de PR (citaba el PR de M4).
- Docs **derivados del fixture**, no escritos a mano: dejan de declarar 36 reglas,
  9,056 incidencias, sello `e32abcea`, 715/715 y "¿cuadra? — NO".
- Tests con `category: 'recurrencia'` (categoria de M4, inexistente en M5)
  eliminados; los tests vacuos ahora exigen `length > 0` antes de evaluar su
  invariante.
- `classification` y `verdict` dejan de colapsarse: el summary publica
  `anomaly_rule_count` (veredicto) y `classification_rule_counts` (clasificacion).

## Cifras vigentes

38 reglas · **0** incumplimientos · 9 riesgos · 8 anomalias ·
7 cumplen · 14 no evaluables · **8,802** incidencias · tests 727/727.
