# M7 Frontend — QA y validación

## Gates ejecutados (esta entrega)

| Gate | Comando | Resultado |
|------|---------|-----------|
| Tests M7 | `node --test tests/m7*.test.mjs` | **94/94 PASS** |
| Suite completa | `node --test tests/**/*.test.mjs` | **1207/1207 PASS** |
| Lint | `npm run lint` | **limpio** (0 warnings, `--max-warnings 0`) |
| Build | `npm run build` | **OK** (chunk `ScreenRentabilidadCostosM7` emitido) |
| Leak scan M3 | (en build) | **OK** |
| Leak check M4 | (en build) | **OK** |

Node 24.18.0 vía Volta (`%LOCALAPPDATA%\Volta\tools\image\node\24.18.0`).

## Cobertura de las 7 suites M7 (94 pruebas)

- `m7Contract` — envelope, 4 ejes disjuntos, L1, provenance, L2-sin-COGS rechazado,
  match null, DAG, multi-moneda, linaje, PII, findings/runs, universos.
- `m7MetricStates` — los 9 estados, 0≠null, distinguibilidad, ningún no-ok pintable.
- `m7AccessApi` — fail-closed, allowlist, GET-only, run_id/scope_key server-side,
  clasificación de errores.
- `m7Capabilities` — escalera L0–L6, DAG, sin bypass por costo estándar actual.
- `m7Semantics` — pedido≠ingreso, costo actual≠COGS, match null, SVL "no positivo",
  gastos, team_id, flota, FX, nota de incidencias, ejes independientes.
- `m7Exports` — PII, formula injection, por moneda, linaje, filename, revoke URL.
- `m7Surface` — identidad propia, una autoridad, M1–M6 intactos, route guard.

## No tautológico

Cada prueba de wording lee la pantalla/meta reales (no una copia). Cada prueba de
mutación **muerde**: cambia el fixture a un estado inválido y exige que el validador o
`resolveM7Metric` lo rechace. Las pruebas de filtros verifican `matched.length > 0`
para los soportados y ausencia para los no soportados.

## Pendiente de runtime (fuera de esta entrega, declarado)

- API real del backend #211 **no probada** (no desplegado).
- Preview de Vercel: pendiente de push del PR DRAFT.
- Smoke e2e con backend vivo: bloqueado hasta despliegue + S/N.
