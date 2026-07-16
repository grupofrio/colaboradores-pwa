# M6 — Limitaciones conocidas (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## 1. El backend no existe desplegado

`gf_kold_os_m6` esta construido en **LOCAL** y **no publicado**: el repo Odoo
migra de `GrupoVeniu/GrupoFrio` a `grupofrio/gf`. **No hay PR del backend.**

⇒ **La API real JAMAS ha sido probada.** El cliente esta escrito contra el
contrato del backend local, pero ninguna request ha viajado. En produccion la
pantalla resuelve `unavailable`.

## 2. El envelope NO trae `kpis`

El backend v1 **no emite un objeto `kpis`** con contrato por indicador (M5 si).
La pantalla lee **`metrics`** — las filas crudas del manifiesto — y cada tile
declara su query y su campo de origen.

**Por que importa**: leer `payload.kpis` habria renderizado **nada en silencio**
(bug 8: campo fantasma). Se detecto ANTES de abrir el PR y hay test que fija que
`kpis` no existe: el dia que el backend lo emita, ese test recuerda migrar la
pantalla en vez de dejar dos fuentes conviviendo.

**Cerrar la brecha es trabajo del backend v1.1**: un `kpis` con
`{value, universe, source_model, source_fields, coverage, caveat, data_as_of}`.

## 3. Solo `direccion_general`

El backend solo valida ese job key (`ALLOWED_TOWER_STATUS` existe pero **no se
usa**). El frontend lo espeja exactamente. Ni `admin_plataforma` ni ningun rol
financiero entran hasta que exista job key autoritativa **y** el backend la valide.

## 4. Multi-moneda sin normalizacion

Monedas en el scope: **1, 33** (MXN + USD). `currency_normalization_supported =
false` ⇒ **no hay total consolidado global**. Los importes no se convierten en el
frontend: hacerlo con una tasa inventada produciria una cifra falsa.

## 5. v1 es AGREGADO

Sin dimension por compañia, sucursal, moneda, journal ni entidad. Los filtros de
esas dimensiones **no se ofrecen** (devolverian 0 siempre).

## 6. Depositos sin fuente canonica

`deposit_model = false`: `account.bank.statement.line` es un candidato, no
autoridad ratificada. En esta ventana hay **0** lineas bancarias.

## 7. Rebase pendiente

M3 (#71), M4 (#72) y M5 (#74) siguen **DRAFT** y compiten por los mismos archivos
compartidos. M6 usa el **dispatch inline de main**; cuando #71 mergee su
`ACCESS_POLICY_RESOLVERS`, hay que rebasar. Ver `M6_REBASE_PLAN.md`.

## 8. Evidencia no formal

`is_production_shell_run = false`. Los **numeros son reales**; la **corrida
formal no existe**. El SQL del manifiesto nunca ha corrido: el runbook del
backend exige compararlo contra los conteos medidos antes de ingerir.

## 9. Señales caveated que NO son conclusiones

- **205 de 205 cajas de vendedor con estado abierto**: puede ser una
  caja operativa permanente o una sesion sin cierre. **Requiere validacion
  funcional.** No son cajas abandonadas ni un faltante.
- **4,289 de 4,378 pagos sin conciliacion identificada**: puede ser
  anticipo, pago no aplicado, conciliacion parcial, pago reversado, flujo
  contable alternativo o cobertura del modelo. **No es dinero perdido.**
- **2 cierres de caja** en la ventana: cobertura del modelo baja.
