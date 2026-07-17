# M7 Frontend — Matriz de prevención de fallas

> Cada fila es una falla real de un módulo anterior (o un RED de Codex al backend
> M7) y **la prueba concreta de M7 que la vuelve imposible de reintroducir sin
> ponerse roja**. Sin prueba que muerda, la mitigación no cuenta.

| # | Falla de origen | Módulo | Mitigación en M7 FE | Prueba que muerde |
|---|-----------------|--------|---------------------|-------------------|
| 1 | Tile devuelve `null` en silencio; "no medí" se confunde con "medí 0" | M4/M5 | `resolveM7Metric` con 9 estados; 0 es `ok` | `m7MetricStates` — "field zero → ok(0)", "los estados son mutuamente distinguibles (8+ distintos)" |
| 2 | Campo requerido ausente se pinta "—" | M4 | `contract_error` visible + razón | `m7MetricStates` — "field missing → contract_error VISIBLE" |
| 3 | Tarjeta más permisiva que el backend (403) | M1 | una autoridad `readM7Access` fail-closed | `m7Surface` — "la MISMA autoridad decide tarjeta, home, nav y clic"; `m7AccessApi` — "roles NO autorizados: fail-closed" |
| 4 | id/fixture prestado de otro módulo → colisión al mergear | M5←M4 | id `profitability-costs`, ruta propia, fixture derivado | `m7Surface` — "NO reutiliza el id/ruta de otro módulo" |
| 5 | Titular afirma más que el dato ("cuadra" sin conciliación) | M5 | nivel `L1` derivado; sin "utilidad/margen real" | `m7Surface` — "el título NO afirma utilidad/margen real"; `m7Contract` — "gross_margin false" |
| 6 | Documentación contradice el estado real | M5/M6 | docs declaran no-desplegado/no-formal/pre-migración | `M7_FE_LINEAGE_GATE` + provenance en `m7Contract` — "PR temporal, no desplegado, no formal" |
| 7 | `corrected` presentado como estado emitido | M6 backend RED | enum sin `corrected` + razón declarada | `m7Contract` — "corrected NO está en el enum" |
| 8 | `status=RED` leído como incumplimiento | M3/M6 | ejes independientes; incumplimiento exige umbral | `m7Contract` — "status=RED NO es incumplimiento; 0 incumplimientos" |
| 9 | Nivel L2 declarado sin COGS histórico | M7 backend RED | validador rechaza L2 sin `historical_cogs_observable` | `m7Contract` — "L2 declarado sin COGS histórico se RECHAZA" |
| 10 | Match histórico pintado como 0 o 0% | M7 backend RED | `count=null`, sin barra; "un null jamás se pinta como 0" | `m7Contract` — "count = null (jamás 0)"; `m7Semantics` — "NO EVALUABLE con count null" |
| 11 | Costo estándar ACTUAL leído como COGS/margen | M7 backend RED | sección separada; capability apaga margen aunque haya costo | `m7Capabilities` — "costo estándar ACTUAL presente NO habilita gross_margin" |
| 12 | Total consolidado MXN+USD falso | M7 backend RED | estado `multi_currency_unconsolidated`; importes por moneda | `m7MetricStates` — "requiresConsolidation → multi_currency_unconsolidated"; `m7Exports` — "no suma MXN+USD" |
| 13 | SVL descrito como "capas rotas" | M7 backend RED | "costo unitario no positivo"; fecha técnica declarada | `m7Semantics` — "no como capas rotas" |
| 14 | "0 líneas de gasto → no hubo gastos" | M7 backend RED | "no afirma ausencia de gastos" | `m7Semantics` — "gasto en cero no se afirma como ausencia" |
| 15 | `team_id` presentado como "canal validado" | M7 backend RED | "equipo comercial técnico, no un canal validado" | `m7Semantics` — "team_id … no como canal validado" |
| 16 | Filtro no soportado enviado → 0 siempre | M7 backend RED | 13 filtros no soportados NO se envían; se muestran con razón | `m7AccessApi` — "filtros NO soportados: ninguno en la allowlist" |
| 17 | Filtro con PII (`partner_id`) | M6/M7 | jamás en la allowlist; PII se dropea del export | `m7AccessApi` — "partner_id (PII) jamás filtrable"; `m7Exports` — "sanitizeForExport elimina PII" |
| 18 | Fórmula inyectada en CSV ejecuta en Excel | M6 | `neutralizeCsvCell` antes del escaping | `m7Exports` — "un título malicioso se neutraliza" |
| 19 | Demo presentado como evidencia productiva | M7 spec | gate DEV/Preview; nombre de archivo marca DEMO/NONFORMAL | `m7Exports` — "el nombre del archivo DECLARA DEMO/NONFORMAL" |
| 20 | Object URL vivo tras exportar | M6 | `downloadTextFile` revoca en `setTimeout(…,0)` | `m7Exports` — "downloadTextFile … REVOCA el object URL" |
| 21 | Regresión de M1–M6 al agregar M7 | integración | rutas/ids únicos; resolvers m2..m7 presentes | `m7Surface` — "módulos previos siguen presentes"; `koldOsAccessPolicy` — set de resolvers |

**Total: 21 fallas mapeadas, cada una con al menos una prueba que se pone roja si se
reintroduce.** Suite M7: 94 pruebas; suite completa: 1207 en verde.
