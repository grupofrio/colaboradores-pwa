# M7 Frontend — QA y validación

## Gates ejecutados (esta entrega)

| Gate | Comando | Resultado |
|------|---------|-----------|
| Suite completa | `node --test tests/**/*.test.mjs` | **1249/1249 PASS** |
| Lint | `npm run lint` | **limpio** (0 warnings, `--max-warnings 0`) |
| Build | `npm run build` | **OK** (chunk M7 ~57 kB; fixture excluido) |
| Leak scan M3 | (en build) | **OK** |
| Leak check M4 | (en build) | **OK** |
| **Bundle demo M7** | `scripts/check_m7_demo_bundle.mjs` (en build) | **OK (fixture ausente en dist)** |
| **Render real (SSR)** | `tests/m7ScreenRender.test.mjs` | **5/5** (esbuild+react-dom/server) |
| **npm audit** | `npm audit` | 17 (0 critical); ver [`M7_FE_NPM_AUDIT.md`](M7_FE_NPM_AUDIT.md) |

Node 24.18.0 vía Volta (`%LOCALAPPDATA%\Volta\tools\image\node\24.18.0`).

## Suites de la corrección post-Codex

- `m7RunController` — selección histórica: ancla run_id/scope_key, conserva run al
  filtrar/paginar, clear→latest, mismatch, guarda de carrera (el código real que usa
  la pantalla, no una reimplementación).
- `m7DemoGate` — matriz del gate: DEV/Preview permiten, producción NUNCA, unauthorized no.
- `m7ScreenRender` — render REAL de la pantalla (esbuild bundle + react-dom/server +
  MemoryRouter): monta, L1, banner histórico, forbidden, sin claim falso.
- `m7ScreenWiring` — el cableado real: "Ver" despacha al controller, findings anclados,
  defensa, guarda de carrera, import dinámico del fixture, sin claim falso.
- `m7Exports` (ampliado) — CSV anclado al run seleccionado (A, no latest B).

> **Nota honesta sobre el render**: el repo no trae jsdom/RTL (añadirlos ampliaría la
> superficie de `npm audit` que Codex pide reducir). El render se hace transpilando la
> PANTALLA REAL con esbuild (ya presente vía Vite) y `react-dom/server`. Cubre el
> render inicial y los estados inyectados; las interacciones se cubren por el
> controller real (`m7RunController`) + el wiring de fuente.

## Cobertura de las 7 suites M7 originales (94 pruebas)

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
