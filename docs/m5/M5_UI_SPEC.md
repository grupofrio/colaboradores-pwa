# M5 — Spec de UI

> **GENERADO desde el fixture real** (`src/modules/inventario/m5/fixtures/apiLatestFixture.js`,
> emitido por el core del backend). Las cifras NO se escriben a mano: si este doc
> discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · flag OFF · cero writes.**

## Secciones (en este orden)

1. **Nivel 1 · Senales reportadas en conciliacion** — conciliaciones totales /
   finales / abiertas; sumas REPORTADAS de finales (cargado, entregado, devuelto,
   merma); comparacion por producto. Cada tile declara universo, fuente,
   cobertura y salvedad al pasar el cursor.
2. **Nivel 2 · Cobertura de la instrumentacion** — recepcion confirmada, planes
   con carga adicional, movimientos realizados, presencia de `actual_kg`.
3. **Fuera del contrato v1** — capabilities en false: se muestra **"—" con su
   razon, JAMAS un 0**.
4. Carga · Catalogo, salidas y refill · Kilogramos y flota.

## Reglas duras

- El titulo **no** afirma un cuadre: dice "Senales del flujo".
- Ningun KPI numerico de "cuadre" se emite (`physical_reconciliation=false`).
- Los veredictos se muestran con nombre, no solo con color.
- El banner de evidencia se decide por el DATO (`!run.is_production_shell_run`),
  no por el modo de entrega.
- `rejected_params` se muestra en banner rojo: un filtro rechazado en silencio
  seria una mentira.

## Exports

Resumen ejecutivo · **Diferencias reportadas en conciliacion** (3 niveles) ·
Hallazgos CSV · Evidencia JSON · Handoff M5→M6/M7. Todos declaran DEMO/NO FORMAL
en el nombre del archivo y en el cuerpo.
