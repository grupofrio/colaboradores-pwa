# Controles = 15 reglas · Backdating = 3 días (MGR-GAP-014 / 015)

## Canonical: 15 reglas

Fuente FE (port PR-MGR-05): `controlsCatalog.js` → `CONTROL_RULES.length === 15`
incluyendo la regla 15 `sale_in_cut_and_route` (cruce de canales).

Cualquier comentario/doc que diga “14 reglas” es residual y debe corregirse al portar
Fase 3. Tests (`controlsPanel.test.mjs`) afirman **15**, no 14.

## Backdating

Producto real (backend Fase 3):

```text
BACKDATING_DAYS = 3
```

en `gf_saleops/services/gerente_controls.py` (rama histórica
`feat/gerente-controls-backend`).

**No** inventar parámetro `expense_backdate_days` en `ir.config_parameter` en este
cierre. Hacerlo configurable es feature nueva (decisión aparte).

Documentación alineada: umbral fijo de 3 días civiles entre fecha del gasto y captura.
