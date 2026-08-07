# M5 — Spec funcional (frontend "Inventario y flujo")

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

## Que responde — y que NO

La pregunta "¿lo cargado, vendido, recargado, devuelto y disponible cuadra?"
**NO se responde en v1**: `capabilities.physical_reconciliation` = **false**.

La v1 de este modulo afirmaba que el flujo "NO cuadra". Era falso y Codex emitio
RED: el titular mezclaba conciliaciones **abiertas** (trabajo en curso) con
**finales**. Medido por estado, en las finales lo entregado **no excede** lo
cargado.

La pantalla presenta **tres niveles**, nunca una conclusion:

1. **Senales reportadas** — lo que el documento declara, partido por estado y,
   cuando se puede, por producto.
2. **Cobertura de instrumentacion** — cuanto de la realidad se alcanza a observar.
3. **Capacidades no disponibles** — que NO se puede afirmar y por que.
   `capability=false` ⇒ **"—" con su razon, jamas un 0**.

## Alcance

Observatorio READ-ONLY del flujo fisico de producto desde
`GET /pwa-kold-os/m5/{latest,findings,runs}`: catalogo/pesos, carga, salidas,
refill, devoluciones, diferencias reportadas, kilogramos, consignacion y
handoffs M3/M6/M7. Cero writes: la pantalla no tiene un solo boton de accion
(`auto_fix=false` universal).

Ruta `/inventario-flujo` · id de registry `inventario-flujo` · `accessPolicy: 'm5'`.
