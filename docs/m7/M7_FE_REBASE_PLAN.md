# M7 Frontend — Plan de rebase

## Base actual

Rama `feat/kold-os-m7-profitability-observability`, creada desde `main` (que ya
contiene M2–M6 mergeados, incluido `ACCESS_POLICY_RESOLVERS` con m2..m6).

## Archivos tocados

**Nuevos** (aislados bajo `rentabilidad-costos/` + `koldOsM7Route.js` + 7 tests + docs):
sin colisión posible con otros módulos.

**Editados** (4 archivos compartidos — puntos de rebase a vigilar):

| Archivo | Cambio M7 | Riesgo de conflicto |
|---------|-----------|---------------------|
| `src/lib/navModel.js` | `import readM7Access` + `m7: readM7Access` en el registro | bajo (append) |
| `src/modules/registry.js` | entrada `profitability-costs`, `navPriority: 18` | bajo (append; prioridad libre) |
| `src/lib/api.js` | `import` + `directKoldOsM7` + push al array de handlers | bajo (append tras `directKoldOsM6`) |
| `src/App.jsx` | import + lazy + `M7RentabilidadRoute` + `<Route>` | bajo (append) |
| `tests/koldOsAccessPolicy.test.mjs` | set de resolvers `m2..m7` + navPriority 18 | medio (si otro PR toca el set) |

## Al rebasar sobre un `main` más nuevo

1. `git fetch && git rebase origin/main`.
2. Si otro módulo (M8+) tocó `navModel/registry/api/App`, resolver por **append**
   (M7 no reordena a nadie; `navPriority` 18 es el siguiente libre tras 17).
3. Si `koldOsAccessPolicy.test.mjs` cambió su set de resolvers, unir ambos (incluir m7).
4. Re-correr: `node --test tests/**/*.test.mjs` (debe dar 1207+), `npm run lint`,
   `npm run build`.
5. **Re-sellar el linaje** al portar el backend a `grupofrio/gf` (ver
   [`M7_FE_LINEAGE_GATE.md`](M7_FE_LINEAGE_GATE.md)).

## Antes de Ready

Rebase limpio + backend #211 desplegado + API real probada + Codex verde + S/N literal.
