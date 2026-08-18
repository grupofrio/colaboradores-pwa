# Supervisora — token + scope contract (team / Planear reads)

## Token headers (no equivalentes)

| Header | Rol |
|---|---|
| `X-GF-Employee-Token` | Credencial autoritativa de **Employee Mobile Session** para Supervisora. El backend resuelve employee → role → company → branch → analytic. |
| `Authorization: Bearer` | Token local/general de sesión PWA según el transporte actual. **No** autoriza identidad Supervisora. |

`api()` / `odooJson()` envían ambos cuando existen (`buildBaseHeaders`). Nunca promover Bearer a employee authority.

## Server-authoritative reads (P1)

| PWA function | HTTP route | Backend | Client authority fields |
|---|---|---|---|
| `getTeam` | `GET /pwa-supv/team` | `POST /gf/salesops/supervisor/v2/team` | none |
| `getTeamRoutes` | `GET /pwa-supv/team-routes` | `POST /gf/salesops/supervisor/v2/team-routes` | `date` only (functional) |
| `getRouteTemplatesForPlanning` | `GET /pwa-supv/route-templates` | `POST /gf/salesops/supervisor/v2/route-templates` | `date_target` only (functional) |

These must **not** call `/get_records_sorted` with `sudo=1` nor build domain from localStorage (`employee_id`, `company_id`, warehouse/CEDIS, analytic).

## `os_api.generic_model_policies`

Reviewed for this change: **yes**. Policy change required: **no** — dedicated supervisor DTOs, not generic RPC.
