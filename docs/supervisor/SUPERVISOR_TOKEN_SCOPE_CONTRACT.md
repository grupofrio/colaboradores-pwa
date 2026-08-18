# Supervisora — token + scope contract (team / Planear reads)

## Token headers (no equivalentes)

| Header | Rol |
|---|---|
| `X-GF-Employee-Token` | Credencial autoritativa de **Employee Mobile Session** para Supervisora. El backend resuelve employee → role → company → branch → analytic. |
| `Authorization: Bearer` | Token local/general de sesión PWA según el transporte actual. **No** autoriza identidad Supervisora. |

`api()` / `odooJson()` envían ambos cuando existen (`buildBaseHeaders`). Nunca promover Bearer a employee authority.

## Server-authoritative reads (P1 — lista cerrada de 6)

| PWA function | HTTP route | Backend | Client authority fields |
|---|---|---|---|
| `getTeam` | `GET /pwa-supv/team` | `POST /gf/salesops/supervisor/v2/team` | none |
| `getTeamRoutes` | `GET /pwa-supv/team-routes` | `POST /gf/salesops/supervisor/v2/team-routes` | `date` only (functional) |
| `getRouteTemplatesForPlanning` | `GET /pwa-supv/route-templates` | `POST /gf/salesops/supervisor/v2/route-templates` | `date_target` only (functional) |
| `getTeamTargets` | `GET /pwa-supv/team-targets` | `POST /gf/salesops/supervisor/v2/team-targets` | `date` / `period` only (functional) |
| `getWeekRoutes` | `GET /pwa-supv/week-routes` | `POST /gf/salesops/supervisor/v2/week-routes` | `week_start` / `week_end` only (functional) |
| month sales (via `getDayOverview`) | `GET /pwa-supv/month-sales-summary` | `POST /gf/salesops/supervisor/v2/month-sales-summary` | `date` only (functional) |

These must **not** call `/get_records_sorted` with `sudo=1` nor build domain from localStorage (`employee_id`, `company_id`, warehouse/CEDIS, analytic).

Security for week-routes lives on the backend. The UI may group/filter for presentation, but must not treat client-side employee filtering as the security boundary.

## `os_api.generic_model_policies`

Reviewed for this change: **yes**. Policy change required: **no** — dedicated supervisor DTOs, not generic RPC.

`GENERIC_MODEL_POLICY_REVIEWED=yes`  
`POLICY_CHANGE_REQUIRED=no`
