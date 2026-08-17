# Auditoría Supervisora de Ventas — 2026-08-15

Auditoría contra `origin/main` (read-only). No se interpretó documentación histórica como verdad si contradice el código actual.

## Repos y SHA

| Repo | Rama de trabajo | SHA `origin/main` | Commit |
|---|---|---|---|
| `grupofrio/gf` | `feat/supervisor-weekly-planning-readiness` | `f8bf961857a3f33fcf2ad68ec9fd58d911cec19c` | Merge PR #88 |
| `grupofrio/colaboradores-pwa` | `feat/supervisor-weekly-planning-matrix` | `97259fdf799b5d2b8afcf83089dc975eeccd3c19` | Merge PR #190 |

PRs abiertos relevantes: ninguno de matriz/optimizer/prospectos/copiloto-supervisor. Abiertos de otros temas (CI Odoo, energía, gerente, dependabot).

PRs mergeados que SÍ tocan este puesto (evidencia en main):

- gf #22 readiness, #23 optimize+revision, #24 routes-week, #28 prospects, #32 recarga, #33 snapshot, #39 review, #60 filtro segmento
- PWA #149/#166 matriz, #177 readiness, #178 optimizar y publicar, #182 snapshot, #183 recarga, #184 prospectos, #185 stop publish on review fail, #186/#189 copiloto gerencial

## Scoreboard

### GREEN — correcto

- Matriz semanal es la portada de **Mis planes de mañana** (`RutasMananaMatriz` + `MisRutasManana`).
- Filas = planes operativos curados SO/SP/P; `counts.total` dinámico; **no hay hardcode de 15**.
- `null ≠ 0` en cobertura: sin plan ⇒ `has_plan=false` / "Sin ruta", nunca 0%.
- Mañana "asignado" solo si **todos** los `gf.route.plan` asociados tienen unidad+chofer+vendedor.
- CTAs de mañana (Asignar / Reasignar / Elegir ruta) entran al flujo de armar.
- Orden backend: sin asignar mañana primero, luego menor cobertura.
- Ensure de **una** ruta diaria con unión SP+SO y P+SO (dedupe por `partner.id`).
- Snapshot HTTP exige `demand_snapshot_id`; FE `interpretDemandSnapshotResponse` no acepta 200 vacío.
- Optimize llama `action_optimize_with_external_solver`; exige `plan_revision` + status `success|partial`.
- Review llama `action_review_optimized_route`; warning exige confirmación; blocked no publica.
- Publish envía `plan_revision`; maneja `revision_mismatch` con un reintento.
- Recarga CEDIS preview/apply existe y obliga reoptimizar en FE.
- Prospectos: scope token, `add_lead` no convierte a cliente, stop `lead`.
- Copiloto gerencial **niega** `supervisor_ventas` (allowlist solo gerente).

### YELLOW — incompleto

| Ítem | Actual | Esperado | Causa | Archivos | Endpoints / modelos | Riesgo | Solución |
|---|---|---|---|---|---|---|---|
| Celdas de asignación | Cobertura + "Sin ruta"/semáforo. Mañana: asignada vs sin asignar. No PUBLICADA/EN CURSO/CERRADA en histórico. | Distinguir SIN RUTA / SIN ASIGNAR / ASIGNADA / PUBLICADA / EN CURSO / CERRADA | DTO de día no trae `assignment_state` ni missing_* | `routes_week_core.py`, `RutasMananaMatriz.jsx` | `POST .../routes-week` · `gf.route.plan` | Lectura incompleta de la semana | Extender celda aditivamente |
| Orden de atención | Solo: no asignado → cobertura | Sin ruta, incompleto, bloqueado, pendiente opt, listo, publicado | Falta estado operacional rico | `routes_week_core.py` | routes-week | Prioridad visual débil | Rank operacional determinista |
| Filtros | Ninguno | Todos / Pendientes / Listos / SO / SP / P / huecos | No implementado | `RutasMananaMatriz.jsx` | — | Matriz N filas difícil de escanear | Filtros simples en FE sobre contrato |
| Flujo guiado | Recursos primero; un botón "Optimizar y publicar"; snapshot aparece al fallar | Planes → clientes → recursos → demanda → opt → review → publish | UX histórica | `PlanearMananaTab.jsx` | ensure, snapshot, optimize, review, publish | Se salta demanda hasta el error | Stepper + CTA "Preparar ruta" |
| Lenguaje snapshot | CTA "Generar snapshot de demanda" | "Preparar demanda y optimizar"; snapshot solo debug | Copy técnico | `PlanearMananaTab.jsx` | generate-snapshot | Fricción operativa | Relabel; conservar id en zona técnica |
| Unassigned / geo FE | Warning; no deshabilita publicar | 0 unassigned y 0 missing geo para publicar | FE confía en review/server | `planearModel.js`, `PlanearMananaTab.jsx` | optimize DTO `unassigned_count`; review `missing_geo_count` | Intento de publish inválido | Gate FE + gate BE siempre-on si count>0 |
| Invalidación snapshot al asignar unidad | Limpia opt/review, **no** `snapshotResult` | Regenerar snapshot al cambiar unidad (guarda `vehicle_id`) | Hueco UI | `PlanearMananaTab.jsx` handleAssign | assign-resources, snapshot.vehicle_id | UI dice "demanda congelada" obsoleta | Invalidar snapshotResult; BE fingerprint ya invalida revision |
| Combinación 1–2 fuentes | SP+SO y P+SO sí; SO+SO posible en M2M pero FE no lo manda; SP+SP rechazado (`subpolygon_ids` max 1) | 1 o 2 planes operativos = **una** ruta | Contrato ensure legado | `supervisor.py` route_plan_ensure; shim PWA | `.../route_plan/ensure` | No se puede armar SO+SO / SP+SP | `sources[]` aditivo + unión server-side |
| Provenance de unión | Stops no muestran "Segmento X + SP Y" | Conservar origen por partner | No viaja en DTO de clientes | preview/add | `gf.route.stop` | Supervisora no ve de dónde salió el cliente | provenance en preview/ensure DTO |
| Review `distance_source` | Solo en optimize DTO | Mostrar OSRM vs Haversine en revisión | No está en review HTTP | `supervisor_secure_writes.py` | review | Presentar Haversine como km vial | Copiar `distance_source` al review DTO |
| Publish revision | Solo si flag `gf_salesops.require_optimized_publish.enabled` **OFF** | Publicar revisión vigente | Flag apagado a propósito (retrocompat) | `supervisor_secure_writes.py` | publish | API directa puede publicar sin optimize | Si el cliente **envía** `plan_revision`, validarla siempre. **No encender el flag productivo.** |
| Prospecto en publicada | `add_lead` permite draft/published/in_progress; no fuerza reoptimize salvo flag | Tras add: requiere re-snapshot + reopt + review + republicar | Máquina D3/D4 vive en fingerprint + flag | add_lead | `gf.route.plan` | Publicada con parada nueva y secuencia vieja | FE invalida; BE mismatch si hay revision |
| Edición post-publish | add_customer/add_lead en published; no hay reopen canónico | Solo si BE confirma seguro; bloquear in_progress/load_sealed/closed | State machine Odoo | secure writes | `gf.route.plan.state` | Writes en ruta en curso | Respetar `plan_not_editable`; no write de state desde el navegador |

### RED — bug

| Ítem | Actual | Esperado | Causa | Archivos | Endpoints | Riesgo | Solución |
|---|---|---|---|---|---|---|---|
| Resumen ejecutivo / "faltan X" | No existe | Totales verificables de mañana y semana | FE ignora counts agregados; BE no manda `summary` | `RutasMananaMatriz.jsx`, `supervisor_dto_reads.py` | routes-week | Supervisora no ve backlog | `summary{}` aditivo + UI |
| `remove_customer` | PWA llama `/pwa-supv/route-plan-remove-customer` → `/gf/salesops/supervisor/v2/route_plan/remove_customer` | Quitar cliente del plan | **El endpoint no existe en gf_saleops** | `api.js`, `lib/api.js`, `PlanearMananaTab.jsx` | remove_customer | Quitar cliente falla en runtime | Implementar write seguro con `action_exclude_from_plan` |
| Copiloto supervisora | No existe; solo `/gerente/copiloto` | Copiloto comercial read-only, allowlist server-side | Producto no construido | — | — | Hueco de producto | Endpoints `/pwa-supv/copilot/*` + allowlist; **no** abrir copiloto gerencial |

### WHITE — no existe

- Tablero checklist global (ruta ≠ recursos ≠ optimizada ≠ publicada) como bloque separado.
- Selección 1–2 filas + sticky "Armar una ruta".
- Contrato `sources[]` en ensure.
- Copiloto comercial `supervisor_ventas`.
- Tool `get_tomorrow_readiness`.
- Campo HTTP `summary` en routes-week.
- `assignment_state` / `missing_vehicle|driver|salesperson` en celdas de día.
- UX "Ruta vial optimizada" vs "Aproximación Haversine".

## Arquitectura a reutilizar (no reconstruir)

- Matriz: `routes_week_core.build_operational_rows` + `GET/POST routes-week`.
- Ensure/unión: `route_plan_ensure` + `apply_planning_criteria` + `_collect_dynamic_polygon_entries` (dedupe `("customer", partner.id)`).
- Writes: `add_customer`, `add_lead`, `assign-resources`, `generate-snapshot`, `optimize`, `review`, `publish`, recarga.
- Optimizer: `action_optimize_with_external_solver` + fingerprint `_optimizer_input_fingerprint`.
- Readiness: `gf_route_readiness.action_review_optimized_route`.
- Prospectos: `prospects/scope|list` + `add_lead`.
- Copiloto visual: `ScreenCopilotoGerencial.jsx` como referencia de UI, **no** de allowlist.

## Combinación de planes — decisión de arquitectura

`gf.route.plan` persiste **un** `planning_subpolygon_id` y M2M `planning_customer_segment_ids`.

- 1 fuente (SO/SP/P): camino ensure actual.
- SP+SO / P+SO: ya es **una** ruta (unión + dedupe).
- SO+SO: una ruta; persistir ambos en `planning_customer_segment_ids`.
- SP+SP / P+P / P+SP: una ruta; generar con la primera fuente y agregar elegibles de la segunda vía `action_add_manual_customer` + `_eligible_partners`. Match de matriz: SP extra via `stop.subpolygon_id` / `extra_subpolygon_ids` en el DTO (sin segundo `gf.route.plan`).

No se crean dos planes diarios para una ejecución.

## Matriz de invalidación (evidencia de código)

Fingerprint optimizer (`gf_route_external_optimizer._optimizer_input_fingerprint`): fecha, vehículo/capacidad, chofer, vendedor, depot, opciones, cada stop (seq, customer, excluded, load, geo, windows).

| Cambio | Snapshot | Optimize / `plan_revision` | Review |
|---|---|---|---|
| Agregar/quitar cliente | INVALID (stops/líneas) | INVALID | INVALID |
| Agregar prospecto | INVALID | INVALID | INVALID |
| Cambiar fuentes P/SP/SO | INVALID (ensure regenera stops) | INVALID | INVALID |
| Cambiar fecha | INVALID | INVALID | INVALID |
| Cambiar unidad | REGENERAR (snapshot guarda `vehicle_id`) | INVALID (`v:`, `cap:`) | INVALID |
| Cambiar chofer | conserva demanda de partners | INVALID (`dr:`) | INVALID |
| Cambiar vendedor | conserva demanda de partners | INVALID (`sp:`) | INVALID |
| Aplicar recarga | conserva (loads cambian → fingerprint) | INVALID | INVALID |

Publish con `plan_revision` enviada debe rechazar mismatch aunque el flag global siga OFF.

**No se enciende** `gf_salesops.require_optimized_publish.enabled` ni `gf_branch_copilot.enabled` (flags productivos).

## Baseline tests

Registrado en el reporte final de la misión. Rojos preexistentes se listan aparte y no se "arreglan" de pasada salvo que bloqueen este contrato.
