# M7 Frontend — Revisión de aprendizaje M1–M6

> Antes de escribir una línea de M7 se leyeron los frontends M1–M6 ya mergeados en
> `main`. Este documento fija **qué falló antes** y **qué se copió a propósito**.
> No es historia decorativa: cada fila se convirtió en una prueba de M7 (ver
> [`M7_FRONTEND_FAILURE_PREVENTION_MATRIX.md`](M7_FRONTEND_FAILURE_PREVENTION_MATRIX.md)).

## Lo que M7 hereda de cada módulo

| Módulo | Patrón adoptado | Dónde vive en M7 |
|--------|-----------------|------------------|
| **M1 Tower** | El **route guard revalida** con la MISMA autoridad que pinta la tarjeta. El bug de M1 fue mostrar una tarjeta que el backend luego negaba con 403. | `M7RentabilidadRoute` en `App.jsx` usa `readM7Access(session).level !== 'global'`, la misma función del registry y la nav. |
| **M2 Planeación** | `accessPolicy` + resolver central en `ACCESS_POLICY_RESOLVERS`. La política manda sobre el rol. | `m7: readM7Access` en `navModel.js`. |
| **M3 Ejecución** | Handler directo Odoo **GET-only**, jamás n8n; leak-scan del dist. | `directKoldOsM7` en `api.js` (405 salvo GET); fixture sin datos productivos. |
| **M4 Ventas** | **NO reutilizar el id/fixture de otro módulo.** M5 registró su módulo con el id de M4 (`ventas-clientes`) y colisionaron al mergear. También: el fixture M4 era tan real que ameritó un leak-scan. | id propio `profitability-costs`, ruta `/rentabilidad-costos`, fixture DERIVADO del core, sin PII. |
| **M5 Inventario** | El titular no puede afirmar más de lo que el dato prueba (M5 afirmó "cuadra" con `physical_reconciliation=false`). | Título "Rentabilidad y **costos**", subtítulo "camino hacia rentabilidad"; nunca "utilidad" ni "margen real". |
| **M6 Caja** | **`resolveMetric` autoridad única**: un tile jamás devuelve `null` en silencio; 0 es un dato, no un vacío. Exports sin PII + neutralización de fórmulas. Linaje pre-migración con gate previo a Ready. | `resolveM7Metric` (9 estados), `exporters.js`, `lineageState`, `M7_FE_LINEAGE_GATE`. |

## Los cinco errores que M7 tenía que no repetir

1. **El tile silencioso (M4/M5).** `if (!row || row[f]==null) return null` fundía cinco
   fallas distintas en el mismo "—". → `resolveM7Metric` distingue **nueve** estados.
2. **La tarjeta más permisiva que el backend (M1).** → una sola autoridad
   `readM7Access` decide tarjeta, home, nav, clic y route guard; fail-closed.
3. **El id/fixture prestado (M5←M4).** → identidad propia y fixture derivado.
4. **El titular que afirma de más (M5).** → el nivel económico se DERIVA (`L1`), y
   ningún texto promete utilidad/margen/consolidado.
5. **La documentación que contradice el estado real (M5/M6).** → los docs de M7
   declaran: backend #211 **no desplegado**, API real **no probada**, linaje
   **pre-migración**, evidencia **no formal**. Hay pruebas que muerden si un doc miente.

## Lo que M7 NO copió (divergencias deliberadas)

- **M2 acepta `admin_plataforma`; M7 no.** El backend #211 sólo valida
  `direccion_general` (no hay `ALLOWED_TOWER_STATUS` como el fantasma que M6 eliminó).
  Aceptar otro rol mostraría una tarjeta que recibiría 403 — el bug de M1.
- **M6 tiene 7 estados de métrica; M7 tiene 9.** M7 agrega
  `multi_currency_unconsolidated` (un total consolidado sería falso sin FX) y
  `lineage_mismatch` (el payload afirma formalidad sin sus marcas).
- **La escalera económica NO lleva barra de progreso %.** Un "% de rentabilidad"
  sería una afirmación que el dato no sostiene.
