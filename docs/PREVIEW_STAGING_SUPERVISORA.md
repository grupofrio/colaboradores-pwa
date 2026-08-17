# Preview target — Supervisora post-merge delta

This branch is a **non-production** frontend preview. It must not be merged to `main`.

| Key | Value |
|---|---|
| `PWA_FRONTEND_SHA` | `c9d40fa25a62550c48c74a88e9601a9448f4ae4d` (this branch starts from PWA main) |
| `PWA_BACKEND_TARGET` | `https://grupofrio-gf-staging10082026-36446797.dev.odoo.com` |
| `BACKEND_SHA` (config doc original) | `dd45bc3dad0bfe064d13e5998a759d6d89e41cb2` |
| `BACKEND_SHA` (E2E runtime) | `164793b2d073359dd0541376a005b3276a7acf17` |
| Preview URL | `https://colaboradores-pwa-git-cursor-supervisor-stagin-1dd9c2-grupofrio.vercel.app` |
| PR | colaboradores-pwa `#199` — **do not merge** |

Production `main` `vercel.json` remains pointed at `https://grupofrio-gf.odoo.com`.

## Fase 0 pre-activación — UI / E2E / visual (2026-08-17)

**STOP:** no merge-as-go-live · no piloto · no flags de activación en prod · esperar **S/N literal de Yamil**.

Gates HTTP/backend ya GREEN (P1-A/B/D, CKF4, ensure, N2, publish OFF/ON, delta #93 A–G, cierre #96 A–G, legacy channel) **no se reejecutaron**.

| Gate | Resultado |
|---|---|
| Preview unlock (`x-vercel-protection-bypass`) | **PASS** (HTTP 200; sin SSO) |
| Login UI (barcode+PIN staging efímero) | **PASS** → sesión `gf_session` con `capabilities.supervisorV2` + `branch.supervisor_v2_enabled` |
| Tab Hoy `/equipo` | **PASS** (Iguala Glaciem, day-control parcial) |
| Tab Rutas `/equipo/rutas` | **PASS** |
| Planear `/equipo/rutas/planear` | **PASS** (matriz mañana visible; sin publicar) |
| Equipo Más `/equipo/mas` | **PASS** |
| Clientes `/equipo/clientes` | **PASS** (empty state jornada) |
| Logout `/profile` → login | **PASS** |
| Visual 360 / 390 / 768 / 1280 | **PASS** (capturas en artifacts del agente) |
| Fixture cleanup | **PASS** (empleado QA archivado, barcode limpio, fuera de `employee_ids`, sesiones removidas) |

No se usó PIN de producción. No se tocaron `UNIQUE(route_id,date)`, P1-C/12kg, P2 ni Fase 1. Flags staging de escritura **no** se cambiaron para este E2E; prod writes siguen OFF (verificación previa read-only).
