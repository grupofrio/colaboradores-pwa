# M6 — Permisos (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Matriz v1

| Rol | Acceso | Por que |
|---|:---:|---|
| `direccion_general` | **SI** (global) | job key autoritativa; **espejo exacto del backend** |
| todos los demas | **NO** (denegado) | fail-closed |

## La divergencia DELIBERADA con M2

M2 acepta `direccion_general` **y** `admin_plataforma` (su proyeccion
server-side) porque **su backend tambien acepta ambas**.

**El backend M6 NO**: su `_access_for` solo compara contra
`ALLOWED_JOB_KEYS = ("direccion_general",)`. La constante `ALLOWED_TOWER_STATUS`
existe pero **nunca se usa** (verificado en el codigo del backend local).

⇒ El frontend de M6 acepta **solo `direccion_general`**. Aceptar
`admin_plataforma` mostraria la tarjeta a alguien a quien el backend responde
**403** = el bug de M1 (tarjeta visible / clic bloqueado). **Fail-closed
significa alinearse con la autoridad, no con el rol que "deberia" poder.**

Hay test que lo fija: inyectar `admin_plataforma` en el resolver hace fallar la
suite.

## Roles del brief que NO se habilitan

`finanzas` · direccion financiera · gerente administrativo · `cobranza` · `caja` ·
`gerente_sucursal` · `admin_plataforma`.

**No existe job key autoritativa** para ellos en este entorno. Habilitarlos por
nombre textual abriria el dato mas sensible de la empresa a un rol que quiza no
significa lo que su nombre sugiere.

**Para habilitar uno** (cada uno con su S/N):
1. Confirmar la job key canonica REAL en `os_customer_zones`.
2. Agregarla **al backend** (`ALLOWED_JOB_KEYS`) **y** al frontend
   (`M6_ALLOWED_JOB_KEYS`) — en ese orden.
3. Si el scope fuera por sucursal: M6 v1 **no tiene** dimension de sucursal
   (`branch_dimension=false`); habria que construirla en el backend, no filtrar
   en el frontend.

## Las 5 superficies

`readM6Access` decide **tarjeta, nav, Mas, rail y clic**; `M6CajaRoute` (App.jsx)
revalida como autoridad final de la ruta. Una sola autoridad = imposible que la
tarjeta y el clic discrepen.
