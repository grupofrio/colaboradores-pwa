# M4 — Patrón canónico de integración (extraído de main `b2b1472`)

Molde EXACTO para integrar M4 sin crear arquitectura paralela. Cada punto cita el
código real de M2/M1 en main. **Prohibido** crear `getVisibleModulesForM4`,
`getM4HomeModules`, navegación M4 paralela o guardas ad-hoc.

## 1. Cómo se registra un módulo — `src/modules/registry.js`

Molde (entrada `planeacion`, `registry.js:161-174`):
```js
{
  id: 'ventas-clientes', label: 'Ventas y clientes', shortLabel: 'Ventas',
  route: '/ventas-clientes', tone: '<token>', roles: ['direccion_general'],
  accessPolicy: 'm4', status: 'live', icon: '<icon>',
  navPriority: <n>, showOnHome: true, showInNav: true,
}
```
`roles` queda SOLO como documentación: `isModuleVisibleForRoles` excluye todo
módulo con `accessPolicy` (`registry.js:231`: `if (!module || module.towerGated ||
module.accessPolicy || ...) return false`).

## 2. Cómo se declara y resuelve una `accessPolicy` — `src/lib/navModel.js`

**En main es dispatch INLINE, no un registro.** Añadir UN `if` en cada función,
espejo del de `'m2'`:

`isModuleVisibleForSession` (`navModel.js:109-117`), orden EXACTO:
```
1. if (!module) return false
2. if (module.showInNav === false && module.showOnHome === false) return false
3. if (!isValidAuthenticatedSession(session)) return false
4. if (module.towerGated) return readAuthoritativeTowerStatus(session) != null
5. if (module.accessPolicy === 'm2') return readM2Access(session).level === 'global'
   + if (module.accessPolicy === 'm4') return readM4Access(session).level === 'global'   // ← M4
6. if (module.accessPolicy) return false      // desconocida → fail-closed
7. return isModuleVisibleForRoles(module, getEffectiveJobKeys(session))
```

`getModuleEntryDecisionForSession` (`navModel.js:142-155`), espejo:
```
1. if (!isValidAuthenticatedSession(session)) return { type:'denied', ... }
2. if (module?.accessPolicy === 'm2') return readM2Access(...).level==='global' ? direct : denied
   + if (module?.accessPolicy === 'm4') return readM4Access(...).level==='global' ? direct : denied
3. if (module?.accessPolicy) return { type:'denied', ... }
4. return getRoleAwareModuleEntryDecision(module, session)
```

Import a añadir: `import { readM4Access } from '../modules/ventas/m4/access.js'`.

> **Nota de orden con M3 (`#71`, sin mergear):** M3 refactorizó estos dos `if`
> a `ACCESS_POLICY_RESOLVERS`. M4 sigue el patrón MERGEADO (inline). Cuando M3
> mergee, quien rebase funde `m2` **y** `m4` al registro. Documentado, no bloqueante.

## 3. Home vs nav (NO reordenar — fix Sebastián `d7c2bb8`)

- `getVisibleModulesForSession` (`:120-129`): filtra por `isModuleVisibleForSession`,
  dedup por id, **NO ordena** (orden del registry).
- `getHomeModulesForSession` (`:132-134`): `.filter(m => m.showOnHome !== false)`, sin ordenar.
- `getNavModules` (`:161-167`): filtra `showInNav !== false` **y SÍ ordena** por
  `navPriorityOf` asc, desempate por índice del registry.
- `buildDesktopNav`/`buildMobileNav` consumen `getNavModules` (heredan el sort y el menú "Más").

M4 NO toca estas funciones salvo el `if` del punto 2.

## 4. Route guard — `src/App.jsx`

Molde (`M2PlaneacionRoute`, `App.jsx:231-236`):
```jsx
function M4VentasRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM4Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}
function ScreenVentasM4Mount() {
  const { session } = useSession()
  return <ScreenVentasM4 session={session} />
}
const ScreenVentasM4 = lazy(() => import('./modules/ventas/ScreenVentasM4'))
// <Route path="/ventas-clientes" element={<M4VentasRoute><ScreenVentasM4Mount /></M4VentasRoute>} />
```
Import: `import { readM4Access } from './modules/ventas/m4/access'`. NO usa
`ModuleRoleRoute`: guard propio, como M2 y Tower.

## 5. Enrutado de la API — `src/lib/api.js` + `src/lib/koldOsM4Route.js`

`koldOsM4Route.js` (molde `koldOsM2Route.js`, 28 líneas):
- `KOLD_OS_M4_LATEST_PATH='/pwa-kold-os/m4/latest'`, `..._FINDINGS_PATH='/pwa-kold-os/m4/findings'`,
  `..._RUNS_PATH='/pwa-kold-os/m4/runs'` (M4 SÍ expone runs; M2 no lo tenía).
- `KOLD_OS_M4_FINDINGS_PARAMS` (frozen): espejo EXACTO de
  `core.FINDINGS_FILTER_PARAMS` (15), fijado por un test en cada repo: run_id,
  category, rule_code, classification, verdict, severity, lifecycle_status,
  responsible_area, granularity, entity_type, date_from, date_to, search, page,
  page_size.
  **JAMÁS** name/phone/email/rfc/employee_id/customer_name (PII). **Tampoco**
  channel/customer_segment/product_id ni company_id/branch_id ni route/plan/vehicle:
  el contrato v1 no tiene esas dimensiones.
- `isKoldOsM4Path(cleanPath)`: match exacto de los 3 paths.
- `filterKoldOsM4Params(query)`: itera SOLO la allowlist.

`api.js` handler (molde `directKoldOsM2` `:9307-9320`):
```js
async function directKoldOsM4(method, path) {
  const query = new URLSearchParams(path.split('?')[1] || '')
  const cleanPath = path.split('?')[0]
  if (!isKoldOsM4Path(cleanPath)) return NO_DIRECT
  if (method !== 'GET') throw new ApiError('method_not_allowed', { status: 405, code: 'method_not_allowed' })
  return odooHttp('GET', cleanPath, filterKoldOsM4Params(query))
}
```
Registrar en el array `directHandlers` (`api.js:9325`), junto a `directKoldOsM2`.

## 6. Manejo de errores del cliente — `src/modules/ventas/m4/m4Api.js`

Molde `m2Api.js`. `classifyM4Error(err)`: 503/feature_disabled→disabled(retryable);
401/no_session→session_expired; 403→forbidden; 404→unavailable(retryable);
409/schema_mismatch→schema_mismatch; timeout→error(retryable); resto→error.
`M4_TIMEOUT_MS=30000`, `M4_MAX_PAYLOAD_CHARS=2_000_000`, `withTimeout`, `guardSize`,
import LAZY de `api()`, alive-flag (sin AbortSignal, sin persistencia).

## 7. Protección de URL

Doble barrera: (a) `M4VentasRoute` en App.jsx revalida `readM4Access`; (b)
`readM4Access` fail-closed. El nav solo decide visibilidad; el guard es autoridad final.

## 8. Demo — `src/modules/ventas/m4/demoGate.js`

`isM4DemoAllowed(env)`: `env.DEV===true` → true; `env.VITE_ENABLE_M4_DEMO==='true'`
→ true; else false. Producción ignora `?demo=1` (gate de código, hay test).

## 9. Exports — `src/modules/ventas/m4/exporters.js`

Molde `m2/exporters.js`: `neutralizeCsvCell` (prefija `'` ante `= + - @` tab/CR/LF
ANTES del escaping RFC-4180), `sanitizeForExport` (drop de claves prohibidas,
credenciales→[REDACTED]), `exportFilename(base,ext,{stale,demo,nonformal})` con
sufijos `_DEMO`/`_STALE`/`_NONFORMAL` en el NOMBRE, `downloadTextFile` con
`revokeObjectURL`. Columnas CSV incluyen verdict/classification/approved_threshold.

## 10. Órdenes que se conservan

- Home: orden del registry (no navPriority).
- Nav/rail/Más: `navPriority` asc.
- Categorías/bloques de la pantalla: orden declarado en `m4Meta.js`.
- Veredictos: `M4_VERDICT_ORDER` (incumplimiento→riesgo→anomalia→cumple→no_evaluable).

## 11. Contrato del envelope — `src/modules/ventas/m4/contract.js`

Molde `m2/contract.js` **+ contrato epistémico de M3**: valida schema_version,
run (con metadata de evidencia M3-style: `is_production_shell_run`,
`production_shell_run_blocked_by`, `evidence_source`, `evidence_classification`,
`auditor_build_sha`/`contract_build_sha`, rechaza `build_sha` ambiguo), summary
(total = suma exacta, `unique_records_available:false`), rule_results Y findings
(classification/verdict/universe/approved_threshold; exploratory≠incumplimiento;
incumplimiento exige umbral; finding no contradice a su regla), scanForbiddenKeys.

## 12. Fixture — `src/modules/ventas/m4/fixtures/apiLatestFixture.js`

Generado por el core REAL del backend M4. `M4_API_FIXTURE_PROVENANCE` con
`is_production_shell_run:false`, `production_shell_run_blocked_by`, `evidence_source`,
`evidence_classification`, `auditor_build_sha`. Banner de la UI decide por el DATO
(`!run.is_production_shell_run`), no por `load.demo`.

## 13. Tests — `tests/m4*.test.mjs`

Replicar el cuarteto M2 + convivencia: `m4Surface`, `m4Api`, `m4Contract`,
`m4AccessFilters`, y ampliar `koldOsAccessPolicy` (o crear `m4` equivalente) con la
matriz M1+M2+M4. Backend: `test_kold_os_m4_core` (puro), `test_kold_os_m4_service`
(TransactionCase, preparado), `test_kold_os_m4_http` (HttpCase, preparado).
