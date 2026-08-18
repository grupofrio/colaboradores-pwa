# Gerente / Mi Sucursal — estado canónico post-merge

Fecha: 2026-08-18  
Repos: `grupofrio/gf` + `grupofrio/colaboradores-pwa` `main` post F1–F3.

## 1. Arquitectura actual

Shell **Mi Sucursal** (7 pestañas) detrás de doble candado:

| Candado | Clave | Default prod (2026-08-18 RO) |
|---|---|---|
| Global lectura | `gf_salesops.gerente_v2.enabled` | `0` |
| Global writes | `gf_salesops.gerente_writes.enabled` | `0` |
| Sucursal | `gf.ops.branch_config.gerente_v2_enabled` | `False` en todas las ramas activas |
| Copiloto | `gf_branch_copilot.enabled` | `1` |
| Facturación Copiloto | `gf_branch_copilot.invoicing.enabled` | `0` (+ branch `manager_copilot_invoicing_enabled=False`) |

Con flags OFF el hub legacy permanece; con V2 ON el shell monta Hoy/Equipo/Admin/Producción/Inventario/Controles/Más.

### Rutas reales

| Superficie | Ruta | Backend |
|---|---|---|
| Hoy | `/gerente` | `/gf/salesops/gerente/v2/today` |
| Equipo | `/gerente/equipo` | Supervisor V2 reads (+ pendientes RO) |
| Pendientes RO | `/gerente/pendientes` | `/gf/salesops/gerente/v2/pendientes` |
| Admin | `/gerente/admin` → `/admin/*` | `gf_pwa_admin` |
| Producción | `/gerente/produccion` | `/gf/salesops/gerente/v2/production` |
| Inventario | `/gerente/inventario` | `/gf/salesops/gerente/v2/inventory` |
| Controles | `/gerente/controles` | `/gf/salesops/gerente/v2/controls(+detail)` |
| Más | `/gerente/mas` | enlaces |
| Copiloto | `/gerente/copiloto` | `gf_branch_copilot` |
| Brief planta | `/brief-produccion` | brief (rol gerente autorizado) |
| Alertas | `/gerente/alertas` | `/gf/salesops/gerente/v2/alerts` (token-only; MGR-FINAL-02) |
| Forecast unlock | `/gerente/forecast` | `/gf/salesops/gerente/v2/forecast-unlock` (write flag) |

## 2. PRs F1–F3 mergeados (ancestros de main)

Backend: `#100` `#101` `#102` `#107`  
Frontend: `#200` `#201` `#202`

## 3. Seguridad

- Token empleado (`X-GF-Employee-Token`) → compañía + sucursal; fail-closed sin analítica.
- Tasks/notes: token → company → branch → record (`#101`).
- Cross-company / cross-branch: cubierto en suites Gerente Odoo 18.
- Legacy ORM+sudo en alerts/KPI/forecasts/unlock **eliminado en FE** (MGR-FINAL-02).
- Alcance almacenes Gerente: **`view_location_id`** (MGR-FINAL-01), no `lot_stock`.

## 4. Fase 0 (captura dimensionada)

Módulo `gf_expense_accounting_close` **installed** `18.0.2.0.0` en prod.  
Catálogo articles/CC rules = 0 → captura dimensionada **fail-closed**.  
**No bloquea** piloto read-only de Hoy/Equipo/Admin-read/Producción/Inventario/Controles/Más/Copiloto.  
**Sí bloquea** writes de captura/gastos dimensionados y retro-posting.

Detalle: `FASE0_READ_ONLY_STATE.md` + plan ops para Sebastián (humano).

## 5. `gerente_unidad`

Ver `GERENTE_UNIDAD_WRITES_REPORT.md`. Recomendación técnica: **OPTION B limited writes** (warehouse CEDIS status quo; quitar forecast-unlock V2 de unidad). **S/N Dirección — no implementado.**

## 6. FE diferido vs main

| PR | Clase | Acción piloto |
|---|---|---|
| FE#157 | STILL_MISSING (parcial) | Honesty KPI + kill unlock ORM → **cubierto selectivo MGR-FINAL-02** |
| FE#159 | STILL_MISSING (parcial) | Token-only alerts/KPI/forecasts → **cubierto selectivo MGR-FINAL-02**; AdminSubRoute/Metabase/identity gates → DEFERRED |
| FE#160 | SUPERSEDED | No portar (#194) |
| FE#161 | STILL_MISSING | Fuera de piloto RO |

## 7. CI

- Gerente Odoo 18 CI — GREEN en pushes `main` post-merge
- Odoo L2 — GREEN cuando aplica
- FE CI + Gerente FE CI — GREEN en merges #200–#202 / HEAD

## 8. Piloto recomendado (NO activar sin S/N)

```text
1 sucursal (p.ej. IGU × co.34 o 35 — elegir con Finance por view_location 820)
1 gerente
gf_salesops.gerente_v2.enabled = 1          # global
branch.gerente_v2_enabled = True            # solo esa sucursal
gf_salesops.gerente_writes.enabled = 0
Copiloto read-only ON (ya global)
invoicing OFF
```

Fase A: solo lecturas (Hoy…Controles, Copiloto).  
Fase B: writes tras S/N.  
Rollback: `gerente_v2.enabled=0` y/o branch flag False — sin revert de código.

## 9. Definition of Done — READY FOR GERENTE READ-ONLY PILOT

Marcado en el reporte de entrega de esta tarea. Facturación Copiloto: **NO**.

## 10. Gaps tracker (resumen)

| ID | Estado |
|---|---|
| MGR-GAP-001…006,010…016,020 | FIXED (F1–F3 + docs) |
| MGR-GAP-007/017 Fase 0 data | BLOCKED (humano; no bloquea RO pilot) |
| MGR-GAP-008/018 unidad writes | BLOCKED (S/N) |
| MGR-GAP-009 tasks/notes | FIXED (#101) |
| MGR-GAP-019 invoicing | DEFERRED / fuera |
| MGR-GAP-021 view_location dashboard | FIXED (MGR-FINAL-01) |
| MGR-GAP-022 legacy ORM alerts/KPI/forecast | FIXED (MGR-FINAL-02) |
| MGR-GAP-023 AdminSubRoute / Metabase / identity gates | DEFERRED |
| MGR-GAP-024 POS IVA server totals (FE#161) | DEFERRED |
| MGR-GAP-025 mobile gastos unify residual | DEFERRED / OBSOLETE vs #194 |
