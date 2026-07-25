# Supervisor Operations Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/equipo` en un home operativo Hoy/Ayer respaldado por `day-control`, con fallback exclusivo al Control Comercial legado cuando los feature flags estén apagados.

**Architecture:** Un coordinador de ruta consulta el día operativo sin enviar fecha ni scope, clasifica el envelope y decide entre legado, estado seguro o nueva pantalla. La lógica de fechas, contrato y view model vive en módulos puros; la UI consume propiedades ya presentables y mantiene Hoy/Ayer independientes.

**Tech Stack:** React 18, React Router 6, JavaScript ESM, Vite 5, `node:test`, SSR con ReactDOM y esbuild, API JSON-RPC directa a Odoo.

---

## Precondiciones

- Worktree:
  `/Users/sebis/Documents/odoo/gf-pwa-colaboradores/.worktrees/pr80-supervisor-operations`
- Rama local: `codex/pr80-supervisor-operations`
- Rama remota del PR: `feat/supervisor-operations-home-v1-prep`
- Spec aprobada:
  `docs/superpowers/specs/2026-07-24-supervisor-operations-today-design.md`
- Backend canónico:
  `GrupoVeniu/GrupoFrio@0014dc512aa3329b719d9ef24fbd0c8e939c7c8d`
- Línea base PREP comprobada antes del plan: 1,172 pruebas, 0 fallos.
- No tocar los cambios de la carpeta principal del usuario.

## Estructura de archivos

### Crear

- `src/modules/supervisor-ventas/dayControl/operationalDate.js`
  Validación y aritmética civil sin `Date`/`Intl`.
- `src/modules/supervisor-ventas/dayControl/api.js`
  Construcción de la petición permitida y llamada al endpoint.
- `src/modules/supervisor-ventas/dayControl/state.js`
  Guard runtime, clasificación de envelopes y errores seguros.
- `src/modules/supervisor-ventas/dayControl/controller.js`
  Secuencia Hoy→Ayer con publicación progresiva de Hoy.
- `src/modules/supervisor-ventas/dayControl/viewModel.js`
  Modelo presentable, comparación diaria y allowlist de navegación.
- `src/modules/supervisor-ventas/dayControl/SupervisorDayOverview.jsx`
  Jornada, resultado comercial y cierre/caja.
- `src/modules/supervisor-ventas/dayControl/SupervisorRouteOperations.jsx`
  Prioridades y rutas.
- `src/modules/supervisor-ventas/dayControl/SupervisorQuickActions.jsx`
  Acciones internas existentes.
- `src/modules/supervisor-ventas/ScreenSupervisorToday.jsx`
  Header, tabs, composición y estado de cada día.
- `src/modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx`
  Coordinador Hoy/Ayer y switch legado/nuevo/estado.
- `tests/supervisorDayControlDate.test.mjs`
- `tests/supervisorDayControlApi.test.mjs`
- `tests/supervisorDayControlState.test.mjs`
- `tests/supervisorDayControlViewModel.test.mjs`
- `tests/supervisorDayControlUi.test.mjs`
- `tests/supervisorOperationsEntry.test.mjs`
- `tests/supervisorOperationsController.test.mjs`
- `tests/supervisorOperationsWiring.test.mjs`
- `scripts/check_supervisor_day_control_leak.mjs`
- `docs/supervisor/SUPERVISOR_OPERATIONS_TODAY_QA.md`

### Modificar

- `src/lib/api.js`
  Passthrough POST directo a Odoo; nunca n8n.
- `src/modules/supervisor-ventas/dayControl/presentation.js`
  Reutilizar la única validación civil y añadir solo helpers presentacionales
  necesarios.
- `src/modules/supervisor-ventas/dayControl/contracts/CONTRACT_SOURCE.json`
  Ancla al merge head backend.
- `docs/supervisor/SUPERVISOR_DAY_CONTROL_CONTRACT_MIRROR.md`
  Misma ancla canónica.
- `docs/supervisor/SUPERVISOR_OPERATING_EXPERIENCE.md`
  Estado real de la fase Hoy y radar diferido.
- `docs/supervisor/SUPERVISOR_PILOT.md`
  Checklist de exposición y QA sin afirmar flags encendidos.
- `tests/supervisorContractDrift.test.mjs`
  Exigir el merge head final.
- `src/App.jsx`
  Montar el coordinador en `/equipo`; conservar todas las subrutas.
- `package.json`
  Añadir guard de fuga al build.

## Reglas de ejecución

- Aplicar @superpowers:test-driven-development en cada tarea funcional.
- No escribir implementación antes de observar la prueba roja.
- Ejecutar pruebas enfocadas después de cada cambio y la suite completa en los
  checkpoints indicados.
- No importar fixtures desde ningún módulo runtime.
- No usar `Date`/`Intl` para calcular Hoy o Ayer.
- No enviar `employee_id`, compañía, sucursal, analítica o timezone.
- No marcar el PR listo ni fusionarlo si falta QA con flags OFF y ON.

---

### Task 1: Sincronizar el PR con `main` y establecer la nueva línea base

**Files:**
- Merge: `origin/main` into `codex/pr80-supervisor-operations`
- Verify: todos los archivos PREP bajo `docs/supervisor/` y
  `src/modules/supervisor-ventas/dayControl/`

- [ ] **Step 1: Actualizar referencias remotas**

Run:

```bash
git fetch origin main feat/supervisor-operations-home-v1-prep
```

Expected: ambas referencias se actualizan sin modificar la carpeta principal.

- [ ] **Step 2: Confirmar anticipadamente que el merge no tiene conflictos**

Run:

```bash
git merge-base HEAD origin/main
```

Copiar el hash impreso y ejecutar:

```bash
git merge-tree <MERGE_BASE_IMPRESO> HEAD origin/main
```

Expected en el snapshot revisado: no aparecen bloques `changed in both`,
`added in both` ni `CONFLICT`. Si `main` avanzó y aparece un conflicto, resolver
solo los archivos en alcance, preservar ambos conjuntos de cambios y repetir
la línea base antes de continuar.

- [ ] **Step 3: Fusionar `origin/main`**

Run:

```bash
git merge --no-edit origin/main
```

Expected: merge commit limpio. Deben entrar #78/#79, incluyendo:

- `src/components/kold/StateScreen.jsx`
- `src/components/kold/DataFreshness.jsx`
- `src/components/kold/ModuleHeader.jsx`
- `tests/helpers/renderJsx.mjs`

- [ ] **Step 4: Reinstalar exactamente el lockfile fusionado**

Run:

```bash
npm ci
```

Expected: instalación exitosa sin editar `package-lock.json`.

- [ ] **Step 5: Verificar que PREP y dependencias conviven**

Run:

```bash
test -f src/modules/supervisor-ventas/dayControl/presentation.js
test -f src/components/kold/StateScreen.jsx
git status --short
```

Expected: ambos archivos existen; solo el plan/spec ya comprometidos y el merge
esperado forman parte de la rama.

- [ ] **Step 6: Ejecutar línea base fusionada**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: 0 fallos, lint sin warnings y build exitoso. Registrar el nuevo conteo
de pruebas en el documento QA.

---

### Task 2: Reanclar las copias contractuales al backend fusionado

**Files:**
- Modify: `tests/supervisorContractDrift.test.mjs`
- Modify: `src/modules/supervisor-ventas/dayControl/contracts/CONTRACT_SOURCE.json`
- Modify: `docs/supervisor/SUPERVISOR_DAY_CONTROL_CONTRACT_MIRROR.md`

- [ ] **Step 1: Escribir la prueba roja del merge head**

Añadir cerca de las pruebas de procedencia:

```js
const BACKEND_MERGE_HEAD = '0014dc512aa3329b719d9ef24fbd0c8e939c7c8d'

test('la procedencia contractual apunta al merge head final de backend #220', () => {
  assert.equal(SOURCE.source.head, BACKEND_MERGE_HEAD)
})
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run:

```bash
node --test tests/supervisorContractDrift.test.mjs
```

Expected: FAIL porque `SOURCE.source.head` todavía es `52308bb1`.

- [ ] **Step 3: Actualizar las dos anclas, sin tocar schemas ni goldens**

En `CONTRACT_SOURCE.json`:

```json
"head": "0014dc512aa3329b719d9ef24fbd0c8e939c7c8d"
```

En el preámbulo del mirror:

```md
> **Ancla canónica (merge head backend):**
> `0014dc512aa3329b719d9ef24fbd0c8e939c7c8d`
```

No recalcular SHA256: el compare backend confirmó que los cuatro artefactos
JSON de contrato no cambiaron.

- [ ] **Step 4: Ejecutar drift completo**

Run:

```bash
node --test tests/supervisorContractDrift.test.mjs
```

Expected: PASS; hashes, deep-equal, schema y head final verdes.

- [ ] **Step 5: Commit**

```bash
git add tests/supervisorContractDrift.test.mjs src/modules/supervisor-ventas/dayControl/contracts/CONTRACT_SOURCE.json docs/supervisor/SUPERVISOR_DAY_CONTROL_CONTRACT_MIRROR.md
git commit -m "chore(supervisor): anchor day control contract to backend merge"
```

---

### Task 3: Implementar fecha operativa civil sin timezone del navegador

**Files:**
- Create: `tests/supervisorDayControlDate.test.mjs`
- Create: `src/modules/supervisor-ventas/dayControl/operationalDate.js`
- Modify: `src/modules/supervisor-ventas/dayControl/presentation.js`

- [ ] **Step 1: Escribir las pruebas rojas**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isOperationalDate,
  previousOperationalDate,
} from '../src/modules/supervisor-ventas/dayControl/operationalDate.js'

test('valida únicamente fechas civiles YYYY-MM-DD reales', () => {
  assert.equal(isOperationalDate('2026-07-24'), true)
  assert.equal(isOperationalDate('2024-02-29'), true)
  for (const value of ['2026-02-29', '2026-13-01', '2026-00-01',
    '2026-01-32', '2026-01-01T00:00:00Z', '', null]) {
    assert.equal(isOperationalDate(value), false)
  }
})

test('obtiene ayer en cambios de mes, año y bisiesto', () => {
  assert.equal(previousOperationalDate('2026-07-24'), '2026-07-23')
  assert.equal(previousOperationalDate('2026-03-01'), '2026-02-28')
  assert.equal(previousOperationalDate('2024-03-01'), '2024-02-29')
  assert.equal(previousOperationalDate('2026-01-01'), '2025-12-31')
})

test('rechaza una fecha inválida en vez de adivinar', () => {
  assert.throws(() => previousOperationalDate('2026-02-29'), /fecha operativa/i)
})
```

- [ ] **Step 2: Verificar el fallo**

Run:

```bash
node --test tests/supervisorDayControlDate.test.mjs
```

Expected: FAIL con módulo inexistente.

- [ ] **Step 3: Implementar aritmética civil mínima**

```js
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const leap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const pad = (value) => String(value).padStart(2, '0')

export function parseOperationalDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return null
  const max = month === 2 && leap(year) ? 29 : DAYS[month - 1]
  return day <= max ? { year, month, day } : null
}

export const isOperationalDate = (value) => parseOperationalDate(value) !== null

export function previousOperationalDate(value) {
  const parsed = parseOperationalDate(value)
  if (!parsed) throw new TypeError('Fecha operativa inválida')
  let { year, month, day } = parsed
  day -= 1
  if (day === 0) {
    month -= 1
    if (month === 0) {
      year -= 1
      month = 12
    }
    day = month === 2 && leap(year) ? 29 : DAYS[month - 1]
  }
  return `${year}-${pad(month)}-${pad(day)}`
}
```

- [ ] **Step 4: Eliminar la validación civil duplicada**

En `presentation.js`, importar `isOperationalDate` y hacer que
`operationalDateLabel` la reutilice:

```js
import { isOperationalDate } from './operationalDate.js'

export function operationalDateLabel(payloadDate) {
  return isOperationalDate(payloadDate)
    ? payloadDate
    : 'Fecha operativa no disponible'
}
```

- [ ] **Step 5: Ejecutar pruebas enfocadas**

Run:

```bash
node --test tests/supervisorDayControlDate.test.mjs tests/supervisorDayControlPresentation.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/supervisorDayControlDate.test.mjs src/modules/supervisor-ventas/dayControl/operationalDate.js src/modules/supervisor-ventas/dayControl/presentation.js
git commit -m "feat(supervisor): derive yesterday from server operational date"
```

---

### Task 4: Enrutar Day Control directamente a Odoo y blindar el payload

**Files:**
- Create: `tests/supervisorDayControlApi.test.mjs`
- Create: `src/modules/supervisor-ventas/dayControl/api.js`
- Modify: `src/lib/api.js`

- [ ] **Step 1: Escribir pruebas rojas de transporte**

Usar el patrón de localStorage/fetch de
`tests/supervisorRouteTemplatesApi.test.mjs`.

Casos obligatorios:

```js
test('Hoy usa Odoo directo y omite fecha, identidad, scope y timezone', async () => {
  const response = await requestSupervisorDayControl()
  assert.equal(call.url, '/odoo-api/gf/salesops/supervisor/v2/day-control')
  assert.deepEqual(call.params, { data: {} })
  assert.equal(call.headers['X-GF-Employee-Token'], 'employee-token-test')
  assertNoForbiddenKeys(call.params)
  assert.equal(response.status, 'ok')
})

test('Ayer envía solo la fecha civil validada', async () => {
  await requestSupervisorDayControl('2026-07-23')
  assert.deepEqual(call.params, { data: { date: '2026-07-23' } })
})

test('una fecha inválida no toca la red', async () => {
  await assert.rejects(
    requestSupervisorDayControl('2026-02-29'),
    /fecha operativa/i,
  )
  assert.equal(calls.length, 0)
})
```

`assertNoForbiddenKeys` debe buscar recursivamente:

```js
const FORBIDDEN = new Set([
  'employee_id', 'company_id', 'branch_id', 'analytic_account_id',
  'warehouse_id', 'tz', 'timezone',
])
```

- [ ] **Step 2: Verificar que el test falla**

Run:

```bash
node --test tests/supervisorDayControlApi.test.mjs
```

Expected: FAIL porque el módulo no existe. Si se prueba con `api()` directamente,
la URL observada sería `/api-n8n/...`, confirmando el defecto.

- [ ] **Step 3: Implementar el constructor y cliente**

```js
import { api } from '../../../lib/api.js'
import { isOperationalDate } from './operationalDate.js'

export const SUPERVISOR_DAY_CONTROL_PATH =
  '/gf/salesops/supervisor/v2/day-control'

export function buildDayControlRequest(date) {
  if (date === undefined) return { data: {} }
  if (!isOperationalDate(date)) throw new TypeError('Fecha operativa inválida')
  return { data: { date } }
}

export function requestSupervisorDayControl(date) {
  return api('POST', SUPERVISOR_DAY_CONTROL_PATH, buildDayControlRequest(date))
}
```

- [ ] **Step 4: Añadir passthrough directo, POST-only**

En `src/lib/api.js`:

```js
const SUPERVISOR_DAY_CONTROL_PATH =
  '/gf/salesops/supervisor/v2/day-control'

async function directSupervisorDayControl(method, path, body) {
  const cleanPath = path.split('?')[0]
  if (cleanPath !== SUPERVISOR_DAY_CONTROL_PATH) return NO_DIRECT
  if (method !== 'POST') {
    throw new ApiError('method_not_allowed', {
      status: 405,
      code: 'method_not_allowed',
    })
  }
  return odooJson(cleanPath, body || {})
}
```

Agregar `directSupervisorDayControl` antes de `directSupervisorVentas` en
`routeDirect`. No usar `supervisorMeta()` ni ningún helper que agregue scope.

- [ ] **Step 5: Ejecutar pruebas**

Run:

```bash
node --test tests/supervisorDayControlApi.test.mjs tests/supervisorRouteTemplatesApi.test.mjs
```

Expected: PASS; Day Control va a `/odoo-api`, y las APIs supervisor existentes
siguen verdes.

- [ ] **Step 6: Commit**

```bash
git add tests/supervisorDayControlApi.test.mjs src/modules/supervisor-ventas/dayControl/api.js src/lib/api.js
git commit -m "feat(supervisor): call day control through direct Odoo transport"
```

---

### Task 5: Clasificar envelopes y errores sin fallback engañoso

**Files:**
- Create: `tests/supervisorDayControlState.test.mjs`
- Create: `src/modules/supervisor-ventas/dayControl/state.js`

- [ ] **Step 1: Escribir la matriz roja**

Importar `DAY_CONTROL_FIXTURE` y comprobar:

```js
test('acepta el contrato mínimo válido', () => {
  assert.equal(classifyDayControlEnvelope({
    status: 'ok', code: 'OK', data: DAY_CONTROL_FIXTURE,
  }).kind, 'valid')
})

test('payload válido sin rutas es empty, no error ni ceros inventados', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.routes = []
  payload.summary.routes_total = 0
  assert.equal(classifyDayControlEnvelope({
    status: 'ok', code: 'OK', data: payload,
  }).kind, 'empty')
})

test('solo FEATURE_DISABLED activa disabled', () => {
  assert.equal(errorEnvelope('FEATURE_DISABLED').kind, 'disabled')
  for (const [code, kind] of [
    ['UNAUTHORIZED', 'unauthorized'],
    ['FORBIDDEN', 'forbidden'],
    ['NO_BRANCH_SCOPE', 'no_scope'],
    ['MULTI_BRANCH', 'ambiguous_scope'],
    ['DATE_NOT_ALLOWED', 'date_unavailable'],
    ['SERVER_MISCONFIG', 'error'],
    ['VALIDATION_ERROR', 'invalid_contract'],
  ]) {
    assert.equal(errorEnvelope(code).kind, kind)
  }
})

test('contrato roto no se degrada como partial', () => {
  for (const mutation of [
    (p) => { p.contract = 'otra-version' },
    (p) => { p.date = '2026-02-29' },
    (p) => { p.routes = null },
    (p) => { p.priorities = {} },
    (p) => { p.summary = null },
    (p) => { p.capabilities = null },
  ]) {
    const payload = structuredClone(DAY_CONTROL_FIXTURE)
    mutation(payload)
    assert.equal(classifyDayControlEnvelope({
      status: 'ok', code: 'OK', data: payload,
    }).kind, 'invalid_contract')
  }
})
```

Añadir prueba async para red:

```js
test('loadDayControlState convierte excepciones en error seguro', async () => {
  const result = await loadDayControlState(undefined, async () => {
    throw new Error('token secreto Unexpected token <html>')
  })
  assert.deepEqual(result, {
    kind: 'error',
    title: 'No pudimos cargar la operación',
    detail: 'Intenta nuevamente.',
    retryable: true,
  })
  assert.ok(!JSON.stringify(result).includes('token secreto'))
})
```

- [ ] **Step 2: Verificar el fallo**

Run:

```bash
node --test tests/supervisorDayControlState.test.mjs
```

Expected: FAIL con módulo inexistente.

- [ ] **Step 3: Implementar guard y mapa de códigos**

```js
import { requestSupervisorDayControl } from './api.js'
import { isOperationalDate } from './operationalDate.js'

const ERROR_KIND = Object.freeze({
  FEATURE_DISABLED: 'disabled',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NO_BRANCH_SCOPE: 'no_scope',
  MULTI_BRANCH: 'ambiguous_scope',
  DATE_NOT_ALLOWED: 'date_unavailable',
  SERVER_MISCONFIG: 'error',
  VALIDATION_ERROR: 'invalid_contract',
})

export function isDayControlPayload(value) {
  return Boolean(
    value
    && value.ok === true
    && value.contract === 'gf.salesops.supervisor.day_control/1'
    && isOperationalDate(value.date)
    && value.summary && typeof value.summary === 'object'
    && value.capabilities && typeof value.capabilities === 'object'
    && Array.isArray(value.routes)
    && Array.isArray(value.priorities)
  )
}

export function classifyDayControlEnvelope(envelope) {
  if (String(envelope?.status).toLowerCase() === 'error') {
    const code = String(envelope?.code || 'UNKNOWN')
    return stateCopy(ERROR_KIND[code] || 'error')
  }
  const payload = envelope?.data
  if (String(envelope?.status).toLowerCase() !== 'ok'
      || envelope?.code !== 'OK'
      || !isDayControlPayload(payload)) {
    return stateCopy('invalid_contract')
  }
  return {
    kind: payload.routes.length === 0 ? 'empty' : 'valid',
    payload,
  }
}

export async function loadDayControlState(date, requester = requestSupervisorDayControl) {
  try {
    return classifyDayControlEnvelope(await requester(date))
  } catch {
    return stateCopy('error')
  }
}
```

`stateCopy` debe devolver únicamente copy curado, `retryable` y `kind`; nunca el
mensaje técnico.

```js
const STATE_COPY = Object.freeze({
  idle: {
    title: '',
    detail: '',
    retryable: false,
  },
  loading: {
    title: 'Cargando la operación',
    detail: 'Estamos consultando la información del día.',
    retryable: false,
  },
  disabled: {
    title: 'Control diario todavía no habilitado',
    detail: '',
    retryable: false,
  },
  unauthorized: {
    title: 'Tu sesión necesita renovarse',
    detail: 'Vuelve a iniciar sesión para continuar.',
    retryable: false,
  },
  forbidden: {
    title: 'No tienes permiso para ver esta operación',
    detail: 'Solicita acceso al responsable de tu sucursal.',
    retryable: false,
  },
  no_scope: {
    title: 'No hay una sucursal operativa asignada',
    detail: 'Revisa la asignación de tu usuario.',
    retryable: false,
  },
  ambiguous_scope: {
    title: 'Tu usuario tiene más de una sucursal operativa',
    detail: 'Se necesita una única sucursal para continuar.',
    retryable: false,
  },
  date_unavailable: {
    title: 'La fecha no está disponible',
    detail: 'Selecciona otro día o intenta nuevamente.',
    retryable: true,
  },
  invalid_contract: {
    title: 'La información llegó en un formato no compatible',
    detail: 'Intenta nuevamente.',
    retryable: true,
  },
  error: {
    title: 'No pudimos cargar la operación',
    detail: 'Intenta nuevamente.',
    retryable: true,
  },
})

export function stateCopy(kind) {
  const copy = STATE_COPY[kind] || STATE_COPY.error
  return { kind, ...copy }
}
```

- [ ] **Step 4: Ejecutar pruebas**

Run:

```bash
node --test tests/supervisorDayControlState.test.mjs tests/supervisorDayControlApi.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/supervisorDayControlState.test.mjs src/modules/supervisor-ventas/dayControl/state.js
git commit -m "feat(supervisor): classify day control states fail closed"
```

---

### Task 6: Construir el view model honesto y las acciones permitidas

**Files:**
- Create: `tests/supervisorDayControlViewModel.test.mjs`
- Create: `src/modules/supervisor-ventas/dayControl/viewModel.js`
- Modify: `src/modules/supervisor-ventas/dayControl/presentation.js` only if a
  helper presentacional adicional is needed

- [ ] **Step 1: Escribir pruebas rojas del modelo**

Cubrir:

```js
test('construye jornada, venta, visitas y cinco etapas desde el golden', () => {
  const view = buildDayControlViewModel(DAY_CONTROL_FIXTURE)
  assert.deepEqual(view.journey, {
    total: 4, departed: 3, late: 1, notDeparted: 1, unknown: 0,
  })
  assert.equal(view.routes.length, 4)
  assert.equal(view.commercial.visits.text, '11/29')
  assert.equal(view.closure.stages.length, 5)
  assert.equal(view.closure.stages[0].key, 'open')
})

test('unknown permanece neutral y no suma tarde', () => {
  const payload = structuredClone(DAY_CONTROL_FIXTURE)
  payload.summary.departed_late = 0
  payload.summary.departure_unknown = 1
  const view = buildDayControlViewModel(payload)
  assert.equal(view.journey.late, 0)
  assert.equal(view.journey.unknown, 1)
})

test('multi-moneda se desglosa y no produce consolidado', () => {
  const view = buildDayControlViewModel(DAY_CONTROL_FIXTURE_DEGRADED)
  assert.equal(view.commercial.sales.consolidated, false)
  assert.equal(view.commercial.sales.lines.length, 2)
  assert.equal(view.commercial.sales.total, null)
})

test('comparación de venta exige disponibilidad, consolidación y misma moneda', () => {
  const today = structuredClone(DAY_CONTROL_FIXTURE)
  const yesterday = structuredClone(DAY_CONTROL_FIXTURE)
  yesterday.summary.sales_day_amount = 1000
  const differentCurrency = structuredClone(yesterday)
  differentCurrency.summary.sales_day_currency = 'USD'
  const unconsolidated = structuredClone(DAY_CONTROL_FIXTURE_DEGRADED)
  assert.equal(compareDailyMetrics(today, yesterday).sales.available, true)
  assert.equal(compareDailyMetrics(today, differentCurrency).sales.available, false)
  assert.equal(compareDailyMetrics(today, unconsolidated).sales.available, false)
})

test('allowlist genera solo rutas internas existentes', () => {
  const route = DAY_CONTROL_FIXTURE.routes[0]
  assert.equal(
    routeDetailHref(route),
    `/equipo/vendedor/${route.driver.employee_id}?route_id=${route.plan_id}`,
  )
  assert.equal(resolvePriorityAction({ type: 'closure_pending' }, []), '/equipo/cierre')
  assert.equal(resolvePriorityAction({ type: 'tipo_nuevo' }, []), null)
  assert.ok(!JSON.stringify(buildDayControlViewModel(DAY_CONTROL_FIXTURE))
    .includes('http'))
})
```

Añadir casos de null/capability false, cargas, señal inválida y caja
multi-moneda.

- [ ] **Step 2: Verificar el fallo**

Run:

```bash
node --test tests/supervisorDayControlViewModel.test.mjs
```

Expected: FAIL con módulo inexistente.

- [ ] **Step 3: Implementar el modelo por secciones**

Esqueleto:

```js
import {
  CLOSE_STAGE_ORDER,
  ageText,
  closeStageLabel,
  departureLabel,
  departureTone,
  deviationText,
  journeyBuckets,
  loadsSummaryText,
  moneyByCurrencyTexts,
  moneyText,
  priorityCountChip,
  safeSignalStatus,
  serverReceivedTimeLabel,
  signalLabel,
  timezoneSourceLabel,
} from './presentation.js'

export function routeDetailHref(route) {
  const employeeId = Number(route?.driver?.employee_id || 0)
  const planId = Number(route?.plan_id || 0)
  return employeeId && planId
    ? `/equipo/vendedor/${employeeId}?route_id=${planId}`
    : null
}

export function resolvePriorityAction(priority, routes) {
  if (priority?.type === 'closure_pending') return '/equipo/cierre'
  if (!['route_not_departed', 'gps_stale', 'load_pending_acceptance']
    .includes(priority?.type)) return null
  const route = routes.find(
    (item) => Number(item?.plan_id) === Number(priority?.route_id),
  )
  return routeDetailHref(route)
}
```

`buildDayControlViewModel`:

- usa `summary` y `capabilities` como autoridades;
- limita prioridades con `.slice(0, 5)` sin reordenar;
- crea `cash.lines` por moneda cuando no hay consolidado;
- convierte `generated_at` naive Odoo UTC a ISO (`...T...Z`) solo para
  `DataFreshness`; si no cumple forma segura, usa `null`;
- no incluye `position.latitude/longitude` en el view model de esta fase;
- expone `quickActions` como allowlist fija:
  `/equipo/sin-visitar`, `/equipo/recuperacion`, `/equipo/cierre`,
  `/equipo/pronostico`, `/equipo/clientes`.

- [ ] **Step 4: Ejecutar presentación + view model**

Run:

```bash
node --test tests/supervisorDayControlPresentation.test.mjs tests/supervisorDayControlViewModel.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/supervisorDayControlViewModel.test.mjs src/modules/supervisor-ventas/dayControl/viewModel.js src/modules/supervisor-ventas/dayControl/presentation.js
git commit -m "feat(supervisor): build honest day control view model"
```

---

### Task 7: Renderizar Operación de hoy con componentes reales

**Files:**
- Create: `tests/supervisorDayControlUi.test.mjs`
- Create: `src/modules/supervisor-ventas/ScreenSupervisorToday.jsx`
- Create: `src/modules/supervisor-ventas/dayControl/SupervisorDayOverview.jsx`
- Create: `src/modules/supervisor-ventas/dayControl/SupervisorRouteOperations.jsx`
- Create: `src/modules/supervisor-ventas/dayControl/SupervisorQuickActions.jsx`

- [ ] **Step 1: Escribir pruebas SSR rojas**

Usar `tests/helpers/renderJsx.mjs`, `MemoryRouter` y los payloads golden.

Casos:

```js
test('render válido muestra orden operativo y solo el día activo', () => {
  const html = render(todayState, yesterdayState, 'today')
  assertInOrder(html, [
    'Estado de jornada',
    'Prioridades',
    'Rutas',
    'Resultado comercial',
    'Cierre y caja',
  ])
  assert.match(html, /Hoy/)
  assert.match(html, /Ayer/)
  assert.match(html, /Ruta Demo Uno/)
  assert.ok(!/Mapa|Radar|tiempo real/i.test(html))
})

test('ayer activo no mezcla el total de hoy', () => {
  const todayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  const yesterdayPayload = structuredClone(DAY_CONTROL_FIXTURE)
  todayPayload.summary.sales_day_amount = 1234
  yesterdayPayload.summary.sales_day_amount = 9876
  const html = render(
    { kind: 'valid', payload: todayPayload },
    { kind: 'valid', payload: yesterdayPayload },
    'yesterday',
  )
  const salesTotal = html.match(
    /data-testid="commercial-sales-total"[^>]*>([^<]*)</,
  )?.[1] || ''
  assert.match(salesTotal, /9[,.]876/)
  assert.ok(!/1[,.]234/.test(salesTotal))
})

test('capability apagada muestra no disponible, no cero', () => {
  const html = render(degradedState, null, 'today')
  assert.match(html, /Información no disponible|Sin dato/)
  assert.ok(!/Moneda no disponible.*\$0/.test(html))
})

test('salida desconocida queda separada de tarde', () => {
  const html = render(unknownDepartureState, null, 'today')
  assert.match(html, /Sin dato de salida/)
})
```

También comprobar:

- cinco etapas;
- prioridad con razón y `×N`;
- links internos;
- mensaje de posición no disponible sin mapa;
- `validated` con nota de conciliación de sistema;
- freshness presente.

El componente debe poner `data-testid="commercial-sales-total"` en el valor
principal de venta para que la prueba no dependa de estilos ni confunda el
valor activo con la referencia comparativa.

- [ ] **Step 2: Verificar el fallo**

Run:

```bash
node --test tests/supervisorDayControlUi.test.mjs
```

Expected: FAIL porque los componentes no existen.

- [ ] **Step 3: Implementar la pantalla compositora**

Firma:

```jsx
export default function ScreenSupervisorToday({
  todayState,
  yesterdayState,
  activeDay,
  onSelectDay,
  onRefresh,
  nowMs,
}) {
  const activeState = activeDay === 'yesterday' ? yesterdayState : todayState
  // StateScreen para loading/error/empty del día seleccionado.
  // Payload válido => view model + secciones.
}
```

Usar:

```jsx
<ModuleHeader
  title="Operación de hoy"
  subtitle={`${view.header.branch} · ${view.header.date} · ${view.header.timezoneSource}`}
  meta={{
    dataAsOf: view.header.dataAsOf,
    branchScope: view.header.branch,
    source: 'Control diario del servidor',
    companies: [],
    decisionCaveats: [],
    technicalEvidence: {},
  }}
  nowMs={nowMs}
/>
```

No pasar `staleAfterHours` hasta que exista una cadencia aprobada. DataFreshness
debe ser descriptivo y neutral.

- [ ] **Step 4: Implementar componentes enfocados**

`SupervisorDayOverview.jsx`:

- grid de cinco buckets;
- venta diaria y visitas;
- cinco etapas + caja;
- `data-testid` por sección.

`SupervisorRouteOperations.jsx`:

- prioridades en orden backend;
- ruta, responsable, unidad, salida, visitas, venta, marcadores, señal,
  cargas y cierre;
- Link solo si el view model produjo href.

`SupervisorQuickActions.jsx`:

- renderiza exclusivamente la allowlist del view model.

CSS local mínimo en `ScreenSupervisorToday`:

```css
.supervisor-ops-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; }
.supervisor-ops-span-4 { grid-column: span 4; }
.supervisor-ops-span-8 { grid-column: span 8; }
@media (max-width: 760px) {
  .supervisor-ops-span-4,
  .supervisor-ops-span-8 { grid-column: 1 / -1; }
}
```

Contenedor máximo desktop: `1200px`; padding móvil: `16px`.

- [ ] **Step 5: Ejecutar SSR y regresión de componentes base**

Run:

```bash
node --test tests/supervisorDayControlUi.test.mjs tests/uxComponents.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/supervisorDayControlUi.test.mjs src/modules/supervisor-ventas/ScreenSupervisorToday.jsx src/modules/supervisor-ventas/dayControl/SupervisorDayOverview.jsx src/modules/supervisor-ventas/dayControl/SupervisorRouteOperations.jsx src/modules/supervisor-ventas/dayControl/SupervisorQuickActions.jsx
git commit -m "feat(supervisor): render operations today workspace"
```

---

### Task 8: Coordinar Hoy/Ayer, fallback legado y ruta `/equipo`

**Files:**
- Create: `tests/supervisorOperationsController.test.mjs`
- Create: `tests/supervisorOperationsEntry.test.mjs`
- Create: `tests/supervisorOperationsWiring.test.mjs`
- Create: `src/modules/supervisor-ventas/dayControl/controller.js`
- Create: `src/modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Escribir pruebas rojas del switch**

Exportar un componente puro `SupervisorOperationsSwitch` para SSR con
componentes inyectables:

```js
test('disabled monta exclusivamente el legado', () => {
  const html = renderSwitch({ kind: 'disabled' })
  assert.match(html, /LEGACY_CONTROL/)
  assert.ok(!html.includes('NEW_OPERATIONS'))
})

test('valid monta exclusivamente el home nuevo', () => {
  const html = renderSwitch({ kind: 'valid', payload: DAY_CONTROL_FIXTURE })
  assert.match(html, /NEW_OPERATIONS/)
  assert.ok(!html.includes('LEGACY_CONTROL'))
})

test('permiso, scope, red y contrato no caen al legado', () => {
  for (const kind of [
    'unauthorized', 'forbidden', 'no_scope', 'ambiguous_scope',
    'invalid_contract', 'error',
  ]) {
    const html = renderSwitch(stateCopy(kind))
    assert.ok(!html.includes('LEGACY_CONTROL'))
    assert.match(html, /kold-state-screen/)
  }
})
```

Prueba async del loader secuencial:

```js
test('solicita Ayer solo después de obtener la fecha de Hoy', async () => {
  const dates = []
  const publishedToday = []
  const requester = async (date) => {
    dates.push(date)
    return okEnvelope(fixtureFor(date || '2026-07-24'))
  }
  const result = await loadSupervisorOperationDays({
    requester,
    onToday: (state) => publishedToday.push(state.kind),
  })
  assert.deepEqual(dates, [undefined, '2026-07-23'])
  assert.deepEqual(publishedToday, ['valid'])
  assert.equal(result.today.kind, 'valid')
  assert.equal(result.yesterday.kind, 'valid')
})
```

Otros casos:

- disabled no solicita Ayer;
- Hoy error no solicita Ayer;
- Ayer error conserva Hoy;
- recarga vuelve a partir de Hoy;
- el componente declara y usa un request generation id para que una respuesta
  anterior no pise una recarga nueva.

- [ ] **Step 2: Escribir prueba roja de wiring**

Leer `src/App.jsx` y comprobar:

```js
assert.match(app, /ScreenSupervisorOperationsEntry/)
assert.match(app, /path="\/equipo"[\s\S]*ScreenSupervisorOperationsEntry/)
assert.equal((app.match(/path="\/equipo"/g) || []).length, 1)
for (const route of [
  '/equipo/vendedor/:vendedorId',
  '/equipo/sin-visitar',
  '/equipo/cierre',
  '/equipo/pronostico',
  '/equipo/clientes',
  '/equipo/recuperacion',
]) {
  assert.ok(app.includes(`path="${route}"`))
}
```

- [ ] **Step 3: Verificar fallos**

Run:

```bash
node --test tests/supervisorOperationsController.test.mjs tests/supervisorOperationsEntry.test.mjs tests/supervisorOperationsWiring.test.mjs
```

Expected: FAIL por módulos/wiring inexistentes.

- [ ] **Step 4: Implementar el controlador puro**

En `dayControl/controller.js`:

```js
import { loadDayControlState } from './state.js'
import { previousOperationalDate } from './operationalDate.js'

const IDLE = Object.freeze({ kind: 'idle' })
const canLoadYesterday = (state) =>
  state?.kind === 'valid' || state?.kind === 'empty'

export async function loadSupervisorOperationDays({
  requester,
  onToday = () => {},
  onYesterdayLoading = () => {},
}) {
  const today = await loadDayControlState(undefined, requester)
  onToday(today)
  if (!canLoadYesterday(today)) {
    return { today, yesterday: IDLE }
  }
  const yesterdayDate = previousOperationalDate(today.payload.date)
  onYesterdayLoading({ kind: 'loading', date: yesterdayDate })
  const yesterday = await loadDayControlState(yesterdayDate, requester)
  return { today, yesterday }
}
```

El test del controlador importa este `.js` puro directamente; no importa JSX.

- [ ] **Step 5: Implementar el switch y coordinador JSX**

Esqueleto:

```jsx
export function SupervisorOperationsSwitch({
  todayState,
  yesterdayState,
  activeDay,
  onSelectDay,
  onRefresh,
  LegacyComponent = ScreenControlComercial,
  OperationsComponent = ScreenSupervisorToday,
}) {
  if (todayState.kind === 'disabled') return <LegacyComponent />
  if (todayState.kind === 'valid' || todayState.kind === 'empty') {
    return (
      <OperationsComponent
        todayState={todayState}
        yesterdayState={yesterdayState}
        activeDay={activeDay}
        onSelectDay={onSelectDay}
        onRefresh={onRefresh}
      />
    )
  }
  return <SafeSupervisorState state={todayState} onRetry={onRefresh} />
}
```

El contenedor:

- empieza `today=loading`, `yesterday=idle`, `activeDay=today`;
- usa `loadDayControlState(undefined)` para Hoy;
- solo con `valid|empty` deriva Ayer desde `today.payload.date`;
- actualiza Hoy antes de iniciar Ayer;
- mantiene el estado de Ayer independiente;
- incrementa `requestGenerationRef` en cada recarga y cleanup para ignorar
  respuestas tardías;
- no hace retries automáticos.

En `tests/supervisorOperationsWiring.test.mjs`, comprobar que el fuente del
coordinador contiene `requestGenerationRef.current += 1` y verifica la misma
generación antes de cada `setState`.

- [ ] **Step 6: Cambiar únicamente la raíz `/equipo`**

En `src/App.jsx`:

```jsx
const ScreenSupervisorOperationsEntry = lazy(
  () => import('./modules/supervisor-ventas/ScreenSupervisorOperationsEntry')
)
```

Y:

```jsx
<Route
  path="/equipo"
  element={
    <ModuleRoleRoute moduleId="supervisor_ventas">
      <ScreenSupervisorOperationsEntry />
    </ModuleRoleRoute>
  }
/>
```

Eliminar el lazy import de `ScreenControlComercial` de App; el coordinador es su
único consumidor. No tocar las demás rutas.

- [ ] **Step 7: Ejecutar pruebas**

Run:

```bash
node --test tests/supervisorOperationsController.test.mjs tests/supervisorOperationsEntry.test.mjs tests/supervisorOperationsWiring.test.mjs tests/supervisorDayControlUi.test.mjs tests/navGuards.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/supervisorOperationsController.test.mjs tests/supervisorOperationsEntry.test.mjs tests/supervisorOperationsWiring.test.mjs src/modules/supervisor-ventas/dayControl/controller.js src/modules/supervisor-ventas/ScreenSupervisorOperationsEntry.jsx src/App.jsx
git commit -m "feat(supervisor): gate operations workspace behind day control"
```

---

### Task 9: Blindar bundle, actualizar documentación y verificar la entrega

**Files:**
- Create: `scripts/check_supervisor_day_control_leak.mjs`
- Create: `docs/supervisor/SUPERVISOR_OPERATIONS_TODAY_QA.md`
- Modify: `package.json`
- Modify: `docs/supervisor/SUPERVISOR_OPERATING_EXPERIENCE.md`
- Modify: `docs/supervisor/SUPERVISOR_PILOT.md`

- [ ] **Step 1: Crear el guard de bundle**

El script recorre `dist/assets` y falla si encuentra sentinels exclusivos de
fixtures/radar:

```js
const BANNED = [
  'BR-DEMO',
  'Ruta Demo Uno',
  'gf.salesops.supervisor.radar/1',
  '10.5001',
  '-35.5001',
]
```

Debe imprimir un resumen y salir `0` cuando no hay fuga; nunca imprimir el
contenido de archivos.

- [ ] **Step 2: Conectar el guard al build**

En `package.json`:

```json
"build": "vite build && node scripts/check_m3_dist_leaks.mjs && node scripts/check_m4_fixture_leak.mjs && node scripts/check_supervisor_day_control_leak.mjs"
```

- [ ] **Step 3: Ejecutar build y observar el guard**

Run:

```bash
npm run build
```

Expected: build exitoso y mensaje de supervisor leak check aprobado.

- [ ] **Step 4: Actualizar estado documental**

En `SUPERVISOR_OPERATING_EXPERIENCE.md`:

- cambiar PREP/bloqueado por #78/#79 a “Fase 1 implementada en PR #80”;
- declarar que esta fase incluye Hoy/Ayer;
- declarar radar/mapa diferidos;
- enlazar spec y plan.

En `SUPERVISOR_PILOT.md`:

- conservar flags OFF por default;
- exigir QA OFF/ON;
- no afirmar que staging o producción ya tienen flags activos.

Crear `SUPERVISOR_OPERATIONS_TODAY_QA.md`:

```md
# QA — Supervisor Operación de hoy

## Automatizado
- [ ] pruebas enfocadas
- [ ] suite completa
- [ ] lint
- [ ] build + leak guards

## Manual
- [ ] móvil 390×844
- [ ] desktop ≥1280 px
- [ ] flags OFF → Control Comercial legado
- [ ] flags ON → Operación de hoy
- [ ] Hoy
- [ ] Ayer
- [ ] error/retry
- [ ] empty
- [ ] partial
- [ ] sin posición
- [ ] multi-moneda
- [ ] links de ruta y cierre

## Evidencia
- Preview:
- Sesión/rol:
- Sucursal:
- Resultado:
```

Marcar únicamente lo realmente comprobado.

- [ ] **Step 5: Ejecutar verificación enfocada**

Run:

```bash
node --test tests/supervisor*.test.mjs
```

Expected: todas las pruebas supervisor pasan.

- [ ] **Step 6: Ejecutar verificación completa**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected:

- 0 tests fallidos;
- lint sin warnings;
- build y leak guards verdes;
- `git diff --check` sin salida;
- únicamente archivos de esta entrega modificados.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/check_supervisor_day_control_leak.mjs docs/supervisor/SUPERVISOR_OPERATING_EXPERIENCE.md docs/supervisor/SUPERVISOR_PILOT.md docs/supervisor/SUPERVISOR_OPERATIONS_TODAY_QA.md
git commit -m "docs(supervisor): prepare operations today pilot verification"
```

---

### Task 10: QA visual, publicación del PR #80 y merge seguro

**Files:**
- Modify only after evidence: `docs/supervisor/SUPERVISOR_OPERATIONS_TODAY_QA.md`
- GitHub: PR #80

- [ ] **Step 1: Arrancar preview local**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite disponible localmente.

- [ ] **Step 2: Verificar responsive**

Usar @vercel:agent-browser-verify o el navegador integrado:

- móvil 390×844;
- desktop 1440×900;
- sin overflow horizontal;
- orden de secciones aprobado;
- solo un día visible;
- sin radar/mapa;
- focus y labels accesibles.

- [ ] **Step 3: Verificar flags OFF en una sesión autorizada**

Expected: `/equipo` monta el Control Comercial existente.

Guardar URL/fecha/resultado en QA. No cambiar flags desde este repositorio.

- [ ] **Step 4: Verificar flags ON en entorno autorizado**

Requiere que un entorno ya tenga habilitados:

- `gf_salesops.supervisor_day_control.enabled`
- `gf.ops.branch_config.supervisor_day_control_enabled`

Expected: `/equipo` monta Operación de hoy y permite Hoy/Ayer. Verificar error,
empty/partial, rutas sin posición y moneda según datos disponibles.

Si no existe entorno autorizado con ambos flags, detener aquí: documentar el
bloqueo y mantener el PR en draft.

- [ ] **Step 5: Repetir gates finales tras completar QA**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short --branch
```

Expected: todo verde y worktree limpia.

- [ ] **Step 6: Push a la rama real del PR**

Run:

```bash
git push origin HEAD:feat/supervisor-operations-home-v1-prep
```

Expected: PR #80 actualizado sin force push.

- [ ] **Step 7: Actualizar PR y marcarlo listo**

Actualizar título a:

```text
feat(supervisor): add operations today workspace
```

El body debe resumir:

- fallback por `FEATURE_DISABLED`;
- Hoy/Ayer server-side;
- secciones incluidas;
- radar fuera de alcance;
- pruebas y QA;
- backend #220.

Run:

```bash
gh pr ready 80
gh pr checks 80 --watch
```

Expected: PR no-draft y todos los checks verdes.

- [ ] **Step 8: Revisión final antes del merge**

Aplicar @superpowers:requesting-code-review y
@superpowers:verification-before-completion.

Confirmar:

- mergeable;
- base `main`;
- CI verde;
- QA OFF/ON documentada;
- sin reviews solicitando cambios;
- sin nuevos commits en `main` que requieran resincronización.

- [ ] **Step 9: Fusionar**

Run:

```bash
gh pr merge 80 --squash --delete-branch
```

Expected: merge exitoso a `main`.

- [ ] **Step 10: Verificar `main` y cerrar la worktree**

Run:

```bash
gh run list --branch main --limit 5
gh pr view 80 --json state,mergedAt,mergeCommit,url
```

Expected: PR `MERGED` y CI de `main` verde.

Después aplicar @superpowers:finishing-a-development-branch para limpiar la
worktree sin tocar la carpeta principal del usuario.
