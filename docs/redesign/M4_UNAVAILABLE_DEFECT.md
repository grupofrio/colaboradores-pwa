# Defecto pre-existente — M4 en dev sin backend

> **NO se corrige en #78** (0A no tocó M4/App/api; la región es idéntica en
> `origin/main`). Se documenta para un PR separado con S/N propio.

## Ruta / componente
- Ruta: `/ventas-clientes` (`ScreenVentasM4`, montada por `M4VentasRoute`).
- Condición: el módulo renderiza **sin payload de backend** (dev local / entorno sin
  `gf_kold_os_m4` desplegado o sin corridas), es decir `load.phase ∈ {unavailable,
  error, disabled, …}` con `payload === null`.

## Observado
En `npm run dev` (Vite HMR), al llegar a M4 sin backend, React captura un error en
`<ScreenVentasM4>` y el `ErrorBoundary` entra en un ciclo de recreación que
**congela el renderer** del preview local. Evidencia (console dev):
`The above error occurred in the <ScreenVentasM4> component … React will try to
recreate this component tree from scratch using the error boundary`
(4 repeticiones; stack apunta a `ScreenVentasM4.jsx` bajo `M4VentasRoute`).

## Estado de la investigación (honesto)
- La rama `!payload` (líneas ~325–349) **está guardada**: `Header` usa `payload?.run`
  y `run &&`; `copy` es un arreglo con fallback; `demoAllowed` es booleano. **No** es
  el origen evidente del throw.
- La línea del stack (`ScreenVentasM4.jsx:325:42`) es la **transpilada por HMR** y no
  mapea limpiamente a una expresión que desreferencie null en lectura estática.
- **No pude fijar la expresión exacta que lanza**: reproducirlo requiere una **sesión
  autenticada** (el dev local sin sesión aterriza en `/login`; el crash apareció en una
  navegación transitoria y el renderer se congeló antes de capturar el `TypeError`
  subyacente). No invento un número de línea que no pude confirmar.

## Por qué ocurre sin backend
Sin corridas ingeridas, la API de M4 responde no-ok ⇒ `payload=null`. Algún acceso en
el árbol de render (rama de estado no-ok, carga de demo, o un hook superior) toca una
estructura ausente y lanza; el `ErrorBoundary` reintenta en bucle bajo HMR.

## Comportamiento productivo
En **producción** M4 muestra la copia honesta "Sin fuente de datos disponible /
unavailable" (el backend `gf_kold_os_m4` no está desplegado). Es decir, el defecto se
manifiesta sobre todo en **dev/HMR**; conviene confirmar si en el build de producción
la misma rama es estable (no reproducido aquí por el bloqueo de sesión).

## Fix mínimo recomendado (para el PR separado)
1. Reproducir con sesión autenticada y capturar el `TypeError` exacto (expresión + línea real).
2. Envolver el árbol de M4 para que **cualquier** estado no-ok se renderice de forma
   segura (patrón `StateScreen`), sin depender de que cada acceso esté guardado.
3. Auditar el camino de carga de demo (`demoAllowed`/`loadM4DemoFixture`) por accesos
   no guardados.

## Tests requeridos
- Render (SSR/harness) de `ScreenVentasM4` con `load.phase` en cada estado no-ok
  (`unavailable`, `error`, `disabled`, `forbidden`, `session_expired`, `invalid`,
  `schema_mismatch`) **sin payload** ⇒ no lanza, muestra copy controlado.
- Regresión: un payload malformado no derriba la pantalla.

## PR propuesto (NO abrir sin S/N)
`fix(m4): render unavailable state safely without backend payload`
