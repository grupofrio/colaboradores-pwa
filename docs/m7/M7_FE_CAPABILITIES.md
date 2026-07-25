# M7 Frontend — Escalera económica y DAG de capabilities

## La escalera (L0–L6) — sólo L1 activo

| Nivel | Significado | Estado v1 |
|-------|-------------|-----------|
| L0 | No evaluable (ni ingreso) | — |
| **L1** | **Ingreso / venta neta verificable POR MONEDA** | **ACTUAL** |
| L2 | Margen bruto observable — exige **COGS histórico** comparable | bloqueado |
| L3 | Contribución (margen bruto − costos variables asignables) | bloqueado |
| L4 | Resultado operativo parcial | bloqueado |
| L5 | Utilidad operativa (todos los gastos operativos) | bloqueado |
| L6 | Utilidad neta (financieros, impuestos, etc.) | bloqueado |

**Sin barra de progreso porcentual.** Un "% de rentabilidad" sería una afirmación
que el dato no sostiene. El nivel se **deriva** del contrato, no se declara.

## El DAG (6 capabilities fuertes, todas bloqueadas)

```
net_profit_observable
  └─ operating_profit_observable
       └─ contribution_margin_observable  ── variable_costs_observable
            └─ gross_margin_observable ── historical_cogs_observable
                                       ── historical_sales_cost_match_supported
                                       ── revenue_observable ✓ (único cumplido)
consolidated_profitability_supported ── currency_normalization_supported ── historical_fx_available
```

Cada capability lleva `prerequisites` + `compatibility_requirements` (moneda · UOM ·
fecha · granularidad · compañía · match histórico) + `unmet_requirements` + `reason`.

## El bypass que NO existe

`current_standard_cost_presence` (¿está el costo estándar de HOY en la línea?) **no
habilita** `gross_margin_observable`. El costo actual no es el COGS histórico de la
venta. Aunque las 728 líneas tuvieran costo estándar hoy, el margen sigue bloqueado.

Pruebas: `tests/m7Capabilities.test.mjs` — "costo estándar ACTUAL presente NO habilita
gross_margin", "el DAG es un orden parcial", "gross_margin exige compatibilidades".
