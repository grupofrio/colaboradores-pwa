# M6 — Filtros

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Orden OBLIGATORIO

```
usuario elige filtros
  -> request al backend (todos los filtros viajan)
  -> el BACKEND filtra
  -> el BACKEND cuenta
  -> el BACKEND pagina
  -> el frontend REPRESENTA
```

**El frontend NUNCA hace `response.items.filter(...)` para un filtro funcional.**
Ése fue el bug 3 de M3: filtrar despues de paginar hace que el total mienta y que
los filtros "pierdan" resultados de las paginas siguientes.

`filters.js` **no exporta** ninguna funcion que filtre `items`: solo construye los
params que viajan y decide que filtro se MUESTRA.

## Allowlist (espejo EXACTO del backend, 15 params)

`run_id` · `scope_key` · `category` · `rule_code` · `classification` · `verdict` ·
`severity` · `lifecycle_status` · `responsible_area` · `entity_type` · `search` ·
`date_from` · `date_to` · `page` · `page_size`

## Los CUATRO EJES se filtran POR SEPARADO

Un unico selector "estado" colapsaria los ejes (bug D). Hay un selector por eje:
veredicto · clasificacion · severidad · ciclo de vida · bloque.

## Filtros que NO se muestran, y por que

| Param | Razon |
|---|---|
| `company_id` | `company_dimension=false` — v1 es agregado |
| `branch_id` | `branch_dimension=false` — v1 es agregado |
| `currency_id` | `currency_dimension=false` — el hallazgo no porta moneda |
| `journal_id` | `journal_dimension=false` |
| `aging_bucket` | el aging vive en el snapshot, no en el hallazgo |
| `partner_id` | identidad de cliente = PII; jamas viaja |

Mostrar un filtro que el hallazgo no puede satisfacer devolveria **0 siempre**:
una mentira silenciosa. La razon se muestra en la UI.

## rejected_params

Los dos fallos del espejo son **mudos**: un param de mas cae en
`rejected_params` y el backend devuelve la lista **SIN filtrar**; uno de menos se
descarta antes de salir. Por eso `rejected_params` **se publica** y la UI lo
muestra en **banner rojo**: "la lista que ves NO esta filtrada por ellos".

## Demo

En demo **no hay servidor**, asi que no hay filtrado server-side. La UI muestra la
lista **sin filtrar** y lo **declara** en un banner, en vez de simular un filtrado
que no ocurrio (eso escondería justo el bug que este modulo debe evitar).
