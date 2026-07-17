# M7 Frontend — Exports

Todos client-side, read-only, sin PII, con linaje declarado y sin consolidar monedas.

## Qué se puede exportar

| Export | Función | Contenido |
|--------|---------|-----------|
| Hallazgos CSV | `findingsToCsv` | columnas del contrato (sin PII) + cabecera de linaje + nota de incidencias |
| Evidencia JSON | `evidenceJson` | run + summary + capabilities + capability_requirements, sanitizado |
| Capacidades TXT | `capabilitiesText` | nivel alcanzado + capabilities NO disponibles con lo que falta |

## Garantías (cada una con prueba)

1. **Sin PII.** `sanitizeForExport` elimina claves PII en cualquier nivel; ninguna
   columna del CSV es PII.
2. **Sin formula injection.** `neutralizeCsvCell` prefija `'` a celdas que empiecen
   con `= + - @` / tab / CR, **antes** del escaping.
3. **Por moneda, jamás consolidado.** El CSV declara `MULTI-MONEDA SIN CONSOLIDAR` y
   no contiene la suma de los totales de moneda.
4. **Linaje declarado.** Cada export lleva: origen, evidencia (NO formal /
   `xml_rpc_read_only`), linaje pre-migración, nivel económico, ventana, compañías,
   monedas, `scope_key`, `run_id`, `auditor_build_sha`, `contract_build_sha`.
5. **Nombre honesto.** `exportFilename` marca `_DEMO_NONFORMAL_STALE_UNCONSOLIDATED`
   según corresponda.
6. **Sin handles vivos.** `downloadTextFile` revoca el object URL.
7. **Tope de filas.** `M7_EXPORT_MAX_ROWS = 5000` (con log implícito por corte).

Pruebas: `tests/m7Exports.test.mjs` (13 casos).
