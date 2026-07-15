# M4 — Lecciones de M1 y M2 (auditoría del código MERGEADO, no de mis heads)

Auditado el estado real: **PWA `origin/main` `b2b1472`** y **Odoo `origin/GrupoFrio`
`d6637b7e`**, leyendo cada archivo desde esos refs (no del working tree, que está
en ramas M3 sin mergear). Dos auditores independientes verificaron los hechos
contra el código, no contra los PR bodies antiguos.

## Correcciones a mis propias premisas (lo que el código dijo, no mi memoria)

1. **`ACCESS_POLICY_RESOLVERS` NO existe en main.** Es invención mía en la rama M3
   (`#71`, sin mergear). El patrón canónico MERGEADO es **dispatch inline**
   `if (module.accessPolicy === 'm2')` en `navModel.js:114`. **M4 hereda el patrón
   inline**, no el registro — o crearía una tercera arquitectura.
2. **M2 no tiene contrato epistémico** (`classification`/`verdict`/`universe`/
   `approved_threshold`). Eso nació en M3. **M4 lo hereda de M3, no de M2.**
3. **M2 usa ventana RELATIVA** (`window_days`, SQL `current_date - N`). La ventana
   absoluta `[window_start, window_end_exclusive)` es de M3. **M4 usa la absoluta.**
4. **El fixture M2 usa `is_production_evidence:false`**, no el
   `is_production_shell_run` de M3. **M4 usa el esquema más rico de M3.**
5. **El auditor M2 vive FUERA del módulo** (`gf_route_compliance/tools/`). **M3 lo
   puso dentro** (`gf_kold_os_m3/lib/`). **M4 sigue a M3: auditor dentro del módulo.**
6. **El core M2 lleva el hardening de Sebastián** (commit `53b8fa38`) que M3 NO
   tiene: `scope_fingerprint` en `stable_finding_key`, `is_chronological_append`,
   `run_id == run_id_sha256`, rechazo de floats no finitos, conflicto de identidad,
   `_history_presence` filtrado por scope. **M4 lo hereda desde el inicio.**

**M4 = arquitectura M2 (probada) + contrato epistémico y evidencia de M3 + rigor de
lifecycle de Sebastián.** Es la mejor síntesis de los tres.

## Tabla de lecciones (problema → detección → cambio → canónico → regla M4 → test)

| # | Problema anterior | Cómo se detectó | Cambio (de quién) | Código canónico actual | Regla obligatoria para M4 | Test requerido |
|---|---|---|---|---|---|---|
| 1 | **Tarjeta visible pero clic bloqueado** (asimetría visibilidad/entrada) | Codex M1: card salía pero el clic caía a role-context | La MISMA autoridad decide tarjeta, nav y clic | `getModuleEntryDecisionForSession` usa el mismo `readMxAccess` que `isModuleVisibleForSession` (`navModel.js:146`) | La visibilidad y la decisión de entrada de M4 usan `readM4Access` idéntico | `m4Surface`: admin ve tarjeta **Y** el clic entra (sin asimetría) |
| 2 | **Autoridad `x_job_key` vs `tower_status`** confundidas | E1-C.2: gerente sin tower veía Torre | Tower = `readAuthoritativeTowerStatus`, nunca x_job_key | `isModuleVisibleForSession:113` (towerGated) vs `:114` (accessPolicy) | M4 es `accessPolicy:'m4'`, NO towerGated; su autoridad es `readM4Access` (job key + proyección) | `koldOsAccessPolicy`: direccion_general sin tower ve M4; supervisor con tower no |
| 3 | **Orden del Home vs navPriority** | fix Sebastián `d7c2bb8` | Home = orden del registry; nav = navPriority | `getHomeModulesForSession` NO ordena (`:132`); `getNavModules` SÍ (`:165`) | M4 NO reordena; hereda ambas funciones tal cual | `m4Surface`: Home conserva orden registry; nav ordena por navPriority |
| 4 | **`towerGated` vs `accessPolicy`** | M2 introdujo accessPolicy junto a towerGated | Ambos excluidos del camino por rol | `isModuleVisibleForRoles` excluye `towerGated \|\| accessPolicy` (`registry.js:231`) | M4 con `accessPolicy:'m4'` jamás sale por rol genérico | `m4Surface`: `isModuleVisibleForRoles(M4,[*])===false` |
| 5 | **Route guard como autoridad final** | Codex: la nav no puede ser la única barrera | Cada módulo tiene guard propio que revalida | `M2PlaneacionRoute` (`App.jsx:231`) revalida `readM2Access` | `M4Route` revalida `readM4Access`; no reutiliza el de Tower | `m4Surface`: URL directa `/ventas-clientes` sin acceso → redirect |
| 6 | **Una sola fuente de visibilidad** | bottom nav duplicado en 5 pantallas (#66) | Fuente única = `registry.js MODULES` | `getVisibleModulesForSession` sobre MODULES | M4 se declara SOLO en el registry; sin lista paralela | `m4Surface`: `/ventas-clientes` existe 1 vez en MODULES |
| 7 | **Una sola fuente de decisión de entrada** | asimetría del punto 1 | `getModuleEntryDecisionForSession` único | `navModel.js:142` | M4 no crea `getM4EntryDecision`; usa la función existente | `koldOsAccessPolicy`: entrada M4 vía la función canónica |
| 8 | **API directa sin fallback n8n** | M1: riesgo de fallback a n8n en 404 | Handler directo GET-only que corta el fallback | `directKoldOsM2` (`api.js:9307`), 405 en no-GET, NO_DIRECT si no matchea | `directKoldOsM4` GET-only, registrado en `directHandlers` | `m4Api`: directKoldOsM4 GET-only, sin fallback n8n |
| 9 | **GET-only** | contrato read-only | Controller `methods=["GET"]` → framework 405 | `controllers/main.py` M2 (2 rutas GET) | Endpoints M4 solo GET; POST → 405 | backend HttpCase: POST /latest → 404/405 |
| 10 | **Fixture vs evidencia real** | riesgo de leer el demo como corrida formal | Procedencia explícita + hashes diferenciados | `M2_API_FIXTURE_PROVENANCE.is_production_evidence:false`; M3: `is_production_shell_run:false` | Fixture M4 declara metadata M3-style completa; nunca suplanta corrida formal | `m4Contract`: fixture no formal con metadata completa → válido |
| 11 | **Demo fuera de producción** | `?demo=1` no debe existir en prod | Gate de código, no enlace oculto | `isM2DemoAllowed(env)`: DEV o `VITE_ENABLE_M2_DEMO` | `isM4DemoAllowed`; prod ignora `?demo=1` | `m4Surface`: gate niega en build productivo |
| 12 | **Datos agregados vs drill-down** | Codex M3: drill-down falso sin datos por registro | Solo dimensión con datos reales; resto aggregate | M2 v1 = aggregate; M3 = +branch real | M4 declara granularidad por regla; sin dimensión → aggregate + ids null | backend: aggregate no trae branch/entity ids |
| 13 | **"Incidencias" vs registros únicos** | Codex M2: total heterogéneo | `unique_records_available:false`; total = suma exacta | `summarize` (`kold_os_m2_core.py:1010`) | M4: total = suma exacta por veredicto; incidencias ≠ entidades | backend: invariante `summary.count == suma(rule_results)` |
| 14 | **Lifecycle real vs motor preparado** | M2: lifecycle solo con ≥2 corridas | `apply_lifecycle` con historia real | `apply_lifecycle(findings, history, current_scope_key)` | M4 gatea persistencia/tendencias a ≥2 corridas | backend: lifecycle new→persistent→corrected→recurrent |
| 15 | **schema_version** | evolución del contrato | Versión EXPLÍCITA, nunca inferida | `classifySchemaVersion` (`contract.js:34`) | M4: `kold.os.m4.api/1`; soportada/futura/ausente controladas | `m4Contract`: schema futura → error controlado |
| 16 | **capabilities** | features opcionales sin romper clientes viejos | `capabilities.required/optional_query_ids` | `capabilities` (`kold_os_m2_core.py:994`) | M4 declara capabilities; queries nuevas por capabilities | backend: query extra no rompe validate_report |
| 17 | **scope flexible / fail-closed** | Codex M2 B9: no fijar compañías | validate_report no fija cías; permisos sí fail-closed | `validate_report` flexible de scope (`:140`) | M4: contrato acepta otras cías; permiso fail-closed | `m4Contract`: scope flexible; acceso denegado por defecto |
| 18 | **CSV injection** | export hostil | `neutralizeCsvCell` antes del escaping | `exporters.js:33` (prefija `'` ante `=+-@`) | Exports M4 neutralizan fórmulas + redactan credenciales | `m4AccessFilters`: payload hostil no ejecutable en CSV |
| 19 | **STALE** | corrida vieja leída como vigente | `technical_state=STALE`, umbral 7d, recompute client-side | `isRunStale` (`contract.js:187`) | M4: STALE prominente + exports `_STALE` | `m4Surface`: STALE con edad; export marcado |
| 20 | **Permisos frontend/backend** | riesgo de divergencia | Mismo contrato de acceso en ambos lados | front `readM2Access` ↔ back `_access_for` (ambos = direccion_general/admin_plataforma global) | M4: `readM4Access` (front) === `_access_for` (back), byte a byte en semántica | `koldOsAccessPolicy` + backend service: misma matriz |
| 21 | **Contratos demasiado rígidos** | Codex M2: no fijar 1/34/35/36 en el validador | Contrato valida forma, no valores de scope | `validate_report` B9 (`:140`) | M4: valida estructura; los ids de cía no se hardcodean en el validador | `m4Contract`: otras compañías validan |
| 22 | **Pruebas unitarias vs Odoo reales** | no reportar GREEN sin runtime | Trío: puro + TransactionCase + HttpCase (Sebastián) | M2: 3 archivos de test; HttpCase nuevo `53b8fa38` | M4: puros ejecutados; TransactionCase/HttpCase PREPARADOS (sin runtime local) | separar "ejecutado" de "preparado" en el body |
| 23 | **Documentación honesta** | bodies más optimistas que el código | Docs declaran lo que NO se logró | M3 `M3_EVIDENCE_STATUS.md` (Track A bloqueado) | M4: docs encabezan con lo bloqueado (corrida formal, TransactionCase) | doc `M4_EVIDENCE_STATUS.md` declara bloqueos |
| 24 | **Merge/rebase con módulos existentes** | #71 quedó CONFLICTING tras #67/#68 | Resolver semánticamente, sin ours/theirs | rebase M3 sobre `b2b1472` (5 conflictos a mano) | M4 rama de main; el `if` de m4 convive con el de m2; documentar orden con M3 | `koldOsAccessPolicy`: m2 y m4 coexisten |
| 25 | **Preservación de M1/M2 al agregar módulos** | riesgo de romper Tower/M2 | matriz de convivencia probada | `m2Surface` matriz admin/supervisor/gerente | M4 no toca M1/M2/M3; matriz A–G prueba los tres intactos | `koldOsAccessPolicy`: M1+M2+M4 conviven, cada uno su gate |

## Lecciones de rigor de Sebastián (M2 `53b8fa38`) — obligatorias en M4

- **`scope_fingerprint(scope)`** hasheado dentro de `stable_finding_key`: dos
  corridas de scopes distintos NO mezclan lifecycle. (M3 NO lo tiene; M4 sí.)
- **`is_chronological_append`**: la ingesta rechaza una corrida cuyo `finished_at`
  no sea posterior a la última — no se corrompe el lifecycle con orden inverso.
- **`run_id == run_id_sha256`**: `validate_report` lo exige; la identidad es el hash.
- **Conflicto de identidad**: si existe una corrida por `run_id` O `evidence_sha256`
  pero no coinciden entre sí → error, no se ingiere basura.
- **Rechazo de floats no finitos** (inf/nan) en `sanitize_out` y `_is_scalar`.
- **`_history_presence` filtra por `scope_key`**: la historia del lifecycle solo
  considera corridas del mismo universo.

## Diferencia M1 vs M2 en permisos (para no copiar ciego — Fase 10)

- **M1 (Tower)**: rol por `employee.get_pwa_tower_status()`, roles
  `admin_plataforma`/`supervisor_ventas`, **scope por sucursal server-side**, y un
  `res.groups` técnico sin usuarios para blindar la vista SQL.
- **M2**: rol por **job keys** (`resolve_employee_pwa_job_key` + additional), solo
  `direccion_general` → global (admin_plataforma es su proyección de Tower);
  **global-only** (sin dimensión sucursal en v1); ACL `base.group_system`.
- **M4 sigue el patrón M2** (comercial es transversal, no por sucursal en v1), con
  la matriz de la Fase 10 y **fail-closed** donde no haya rol autoritativo.
