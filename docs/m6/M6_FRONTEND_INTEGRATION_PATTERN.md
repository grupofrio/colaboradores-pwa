# M6 frontend — Patrón de integración canónico

> Extraído de **`main` = `1460185`** (el único estado mergeado). **NO se copia
> nada de M3 (#71), M4 (#72) ni M5 (#74): siguen DRAFT.**

## El patrón real de main (no inventar una arquitectura paralela)

### 1. `src/modules/registry.js` — fuente canónica de módulos
Entrada con `id`, `label`, `shortLabel`, `route`, `tone`, `roles` (sólo
documentación cuando hay `accessPolicy`), `accessPolicy`, `status`, `icon`,
`navPriority`, `showOnHome`, `showInNav`.

### 2. `src/lib/navModel.js` — DISPATCH INLINE (no hay mapa de resolvers)

**Éste es el hallazgo central de la auditoría.** `main` resuelve las políticas con
un `if` inline en **dos** funciones:

```js
// isModuleVisibleForSession()
if (module.towerGated) return readAuthoritativeTowerStatus(session) != null
if (module.accessPolicy === 'm2') return readM2Access(session).level === 'global'
if (module.accessPolicy) return false            // política desconocida => fail-closed

// getModuleEntryDecisionForSession()
if (module?.accessPolicy === 'm2') {
  return readM2Access(session).level === 'global'
    ? { type: 'direct', ... } : { type: 'denied', ... }
}
if (module?.accessPolicy) return { type: 'denied', ... }
```

⚠️ **`ACCESS_POLICY_RESOLVERS` NO existe en main** — lo introduce **M3 (#71),
que sigue DRAFT**. M6 **NO** lo usa y **NO** crea un segundo resolver: añade su
`if` inline junto al de M2, antes de la línea fail-closed. Cuando #71 mergee, el
rebase convierte esos `if` en entradas del mapa (ver `M6_REBASE_PLAN.md`).

### 3. `src/App.jsx` — route guard propio por módulo
```js
function M2PlaneacionRoute({ children }) {
  const { session } = useSession()
  if (!isValidAuthenticatedSession(session)) return <Navigate to="/login" replace />
  if (readM2Access(session).level !== 'global') return <Navigate to="/" replace />
  return children
}
```
Más `lazy(() => import(...))`, un `…Mount()` y la `<Route>`. El guard es la
**autoridad final** de la ruta.

### 4. `src/lib/api.js` — handler directo a Odoo, sin fallback n8n
```js
async function directKoldOsM2(method, path) {
  const query = new URLSearchParams(path.split('?')[1] || '')
  const cleanPath = path.split('?')[0]
  if (!isKoldOsM2Path(cleanPath)) return NO_DIRECT
  if (method !== 'GET') throw new ApiError('method_not_allowed', { status: 405, ... })
  return odooHttp('GET', cleanPath, filterKoldOsM2Params(query))
}
```
Registrado en el array `directHandlers`. `odooHttp` aporta `X-GF-Employee-Token`
vía `buildBaseHeaders` y convierte errores en `ApiError(status/code)`. Sin retries.

### 5. `src/lib/koldOsM2Route.js` — paths + allowlist de params
`isKoldOsM2Path(cleanPath)` y `filterKoldOsM2Params(query)`: **espejo exacto** del
allowlist del backend; jamás deja pasar `employee_id`/`domain`.

### 6. `src/modules/planeacion/m2/access.js` — contrato de acceso fail-closed
`M2_ALLOWED_JOB_KEYS` + `readM2Access(session)` → `{level, reason}`.

## Qué hereda M6 y qué NO

| Elemento | M6 | Nota |
|---|---|---|
| Registry entry con `accessPolicy` | **igual** | id propio `cash-reconciliation` |
| Dispatch **inline** en `navModel` (2 puntos) | **igual** | `'m6'` junto a `'m2'` |
| Route guard propio en `App.jsx` | **igual** | `M6CajaRoute` |
| Handler directo GET-only en `api.js` | **igual** | `directKoldOsM6` |
| `koldOsM6Route.js` con allowlist espejo | **igual** | del backend M6 |
| `access.js` con `readM6Access` | **igual patrón** | **pero sólo `direccion_general`** (ver abajo) |
| `ACCESS_POLICY_RESOLVERS` (M3) | **NO** | DRAFT; se adopta en el rebase |
| Cualquier cosa de M4/M5 | **NO** | DRAFT |

## La divergencia deliberada con M2: `admin_plataforma`

M2 acepta `direccion_general` **y** `admin_plataforma` (su proyección server-side)
porque **su backend también acepta ambas**.

**El backend M6 NO**: `_access_for` sólo compara contra `ALLOWED_JOB_KEYS =
("direccion_general",)`. La constante `ALLOWED_TOWER_STATUS` existe pero **nunca
se usa** (verificado: aparece 1 sola vez, en su declaración).

⇒ El frontend de M6 acepta **sólo `direccion_general`**. Aceptar
`admin_plataforma` mostraría la tarjeta a alguien a quien el backend responde
**403** = el bug de M1 (tarjeta visible, clic bloqueado).

**Si dirección quiere habilitar `admin_plataforma`**: es una línea en el backend
(`_access_for` debe consultar `ALLOWED_TOWER_STATUS`) **y** una en el frontend,
con su S/N — no una inferencia del frontend.

## Archivos compartidos que M6 toca (mínimo absoluto)

| Archivo | Cambio de M6 | Líneas |
|---|---|---|
| `src/modules/registry.js` | +1 entrada de módulo | ~14 |
| `src/lib/navModel.js` | +1 `if` en cada uno de los 2 dispatch + import | ~8 |
| `src/App.jsx` | +lazy, +guard, +mount, +route, +import | ~20 |
| `src/lib/api.js` | +`directKoldOsM6` + registro en `directHandlers` + import | ~14 |

**Cero refactorizaciones de M1–M5.** Todo lo demás vive en
`src/modules/caja-conciliacion/` y `src/lib/koldOsM6Route.js` (archivos nuevos).
