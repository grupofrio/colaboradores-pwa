# M7 Frontend — Permisos

## Regla única

`M7_ALLOWED_JOB_KEYS = ['direccion_general']`. **Sólo Dirección General.** Todo lo
demás: sin acceso (fail-closed).

Espeja EXACTAMENTE el backend #211: `_access_for` compara sólo contra
`ALLOWED_JOB_KEYS = ("direccion_general",)`. No hay otra constante de acceso (a
diferencia del `ALLOWED_TOWER_STATUS` fantasma que M6 eliminó).

## Una autoridad, cinco superficies

`readM7Access(session)` decide **tarjeta · home · nav · clic · route guard**. Es el
mismo error de M1 (tarjeta visible → 403) el que se previene: si una superficie usara
otra lógica, mostraría lo que el backend niega.

- Registry: `accessPolicy: 'm7'`.
- `navModel.js`: `ACCESS_POLICY_RESOLVERS.m7 = readM7Access`.
- `App.jsx`: `M7RentabilidadRoute` → `readM7Access(session).level !== 'global'` → redirect `/`.

## Divergencia deliberada con M2

M2 acepta `admin_plataforma` porque su backend también. **M7 no**, porque el backend
#211 sólo valida `direccion_general`. Un `admin_plataforma` (aunque traiga
`tower_status`) recibiría 403 → no se le muestra la tarjeta.

Habilitar otro rol es **una línea en el backend + una aquí, con su S/N** — nunca una
inferencia que el frontend haga solo.

Pruebas: `tests/m7AccessApi.test.mjs`, `tests/m7Surface.test.mjs`.
