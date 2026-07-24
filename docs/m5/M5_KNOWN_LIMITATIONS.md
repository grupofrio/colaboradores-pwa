# M5 — Limitaciones conocidas

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

## Lo que M5 v1 NO puede afirmar

| Capability | Valor | Por que |
|---|:---:|---|
| `physical_reconciliation` | **false** | no hay base fisica integral comparable (M5-G-08 = no evaluable **por declaracion**) |
| `uom_normalized_reconciliation` | false | las sumas no se normalizan por producto/UOM |
| `delivery_acceptance_confirmed` | false | solo **2 de 5,637** lineas de salida tienen recepcion confirmada |
| `vehicle_inventory` | false | no existe el modelo de stock por unidad |
| `supplemental_load_attribution` | false | hay pickings adicionales que no se atribuyen a la conciliacion |
| `refill_model_coverage` | false | `van.refill.request` no captura las recargas reales |
| `physical_weight_verified` | false | `actual_weight_kg` se sincroniza por lote; presencia ≠ pesaje verificado |

## Lo que SI (con su limite)

- `raw_reconciliation_signal` = **true**: leemos lo que el documento reporta. Un
  total declarado **no es** un hecho fisico.
- `supplemental_load_detection` = **true**: **156 de 216** planes con carga
  tienen mas de un picking (hasta 7). Esto **refuta** que cada plan reciba
  exactamente una carga, pero **NO** los clasifica: un picking adicional puede
  ser recarga, correccion, retorno o despacho — el dominio mezcla traslados
  internos, recepciones y ordenes de entrega, y su tipo **no se clasifico**.
  **Multiples pickings ≠ refills.**
- `actual_weight_presence` = **true**: el campo existe y se cuenta.

## Trampas de lectura

- **Cero registros en `van.refill.request` ≠ cero recargas operativas**: prueba
  que ese modelo no las captura, no que no ocurran.
- **Conciliaciones abiertas ≠ evidencia**: sus cifras aun cambian. Mezclarlas con
  las finales produce un "descuadre" que solo refleja captura pendiente. Ese fue
  el error de la v1.
- **`uom_category_count = 1` ≠ intercambiabilidad fisica** entre productos.
- **Evidencia NO formal**: `is_production_shell_run = false`. Los numeros son
  reales (XML-RPC read-only contra produccion); la corrida formal odoo-shell esta
  bloqueada (sin llave SSH + modulo sin desplegar).
