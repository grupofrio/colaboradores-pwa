# M5 — Validación ejecutada (frontend, 2026-07-15)

**Base: main `1460185` · rama `feat/kold-os-m5-inventory-flow` · backend
GrupoVeniu/GrupoFrio PR #208 (midió `e32abcea`).**

| Gate | Resultado |
|---|---|
| `npm test` (main+M5) | **715/715** (93 M5) |
| `npm run lint` (max-warnings 0) | **0 warnings** |
| `npm run build` | OK (`ScreenInventarioM5` 142.21 kB · gzip 31.54 kB) |
| `check_public_e1` | OK |
| Smoke navegador | 6 casos, **0 errores de consola** |
| Backend (puros, otro repo) | **46/46** = 37 core + 4 scan + 5 filter-docs |

## Smoke (sesión LOCAL de prueba, eliminada al final)
| Caso | Resultado |
|---|---|
| admin_plataforma | `/inventario-flujo?demo=1`: `midió: e32abceae2…` · tiles **0/8/9/6/13** · total **9,056** · 6 tiles "—" · banners DEMO + NO FORMAL · cero "comercial" |
| Veredicto=incumplimiento (cero) | "Detalle de regla (0)" · "Sin hallazgos con estos filtros" · sin `rejected_params` oculto |
| supervisor_ventas | URL directa → expulsado a `/` |
| sin sesión | URL directa → `/login` |

## NO ejecutado
CI + Vercel Preview corren al abrir el PR (reporta el bot). Validación contra la
API real: imposible hasta merge+deploy del backend. Todo lo verificado es contra
el fixture emitido por el core real.
