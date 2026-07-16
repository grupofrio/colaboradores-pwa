# M6 — Spec funcional (frontend "Caja y conciliacion")

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Que responde — y que NO

Pregunta rectora: **"¿donde esta el dinero y que falta para cerrar financiera y
administrativamente?"**

M6 v1 **NO responde con una conclusion global**. Presenta TRES NIVELES:

1. **Estado financiero reportado** — lo que las fuentes observadas declaran.
2. **Cobertura de la instrumentacion** — cuanto de la realidad se alcanza a ver.
3. **Capacidades no disponibles** — que NO se puede afirmar, y por que.

**Prohibido** decir "todo cuadra", "no cuadra", "faltante", "perdida", "fraude" o
"dinero desaparecido" salvo que una regla `definitive` con umbral **aprobado** lo
soporte. En v1 **no hay ninguna**: cero incumplimientos.

## Alcance

Observatorio READ-ONLY desde `GET /pwa-kold-os/m6/{latest,findings,runs}`:
facturacion y cuentas por cobrar · pagos · caja de ruta · corte y liquidacion ·
depositos · conciliacion · cartera y aging · handoffs · cobertura y capacidades.

**Cero writes**: no registra pagos, no valida cortes, no concilia, no liquida, no
crea depositos, no modifica facturas ni cartera. La pantalla no tiene un solo
boton de accion.

Ruta `/caja-conciliacion` · id de registry `cash-reconciliation` ·
`accessPolicy: 'm6'` · **solo `direccion_general`**.

## Estado del backend — leer antes de nada

El backend `gf_kold_os_m6` tiene un **PR temporal pre-migracion** (#210, DRAFT,
que **no se mergea**) y **no esta desplegado**: el repo
Odoo migra de `GrupoVeniu/GrupoFrio` a `grupofrio/gf`. **No existe endpoint
desplegado** ⇒ en produccion la pantalla resuelve `unavailable`. La **API real
JAMAS ha sido probada**. El demo (fixture del core real) solo vive en DEV/Preview.
