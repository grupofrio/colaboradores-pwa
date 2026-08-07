# M6 — Seguridad (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Cero writes

M6 **jamas**: registra pagos · valida cortes · concilia · liquida · crea
depositos · modifica facturas o cartera · cambia estados · dispara
automatizaciones · usa n8n · envia mensajes.

El cliente API **no contiene** `POST`/`PUT`/`PATCH`/`DELETE` (hay test). El
handler de `api.js` responde **405** a cualquier verbo != GET. **Cero botones de
accion** en la pantalla.

## Sin fallback n8n

Las rutas `/pwa-kold-os/m6/*` viven **solo en Odoo**. El handler va directo con
`odooHttp` y devuelve `NO_DIRECT` para rutas ajenas. Hay test que verifica que no
hay n8n **en el codigo** (el comentario lo nombra para declarar la prohibicion).

## PII — el dominio mas sensible de la empresa

**Prohibido** en cualquier nivel: `partner_name`, `customer_name`,
`employee_name`, `display_name`, `full_name`, `rfc`, `vat`, `clabe`, `iban`,
`account_number`, `card_number`, `phone`, `mobile`, `email`, `address`, `note`,
`memo`, `reference_text`.

Tres capas: (1) el backend sanitiza en el origen; (2) `contract.js` **rechaza el
envelope** si detecta una clave PII en cualquier nivel; (3) los exports eliminan
y redactan. Hay test que inyecta `partner_name` y verifica que el scanner muerde.

**La tabla de hallazgos usa identificadores tecnicos sanitizados**: nunca nombre
de cliente, RFC, email, telefono, direccion, cuenta bancaria, CLABE, tarjeta,
referencia bancaria libre ni notas libres.

## Evidencia no persistida

El cliente NO usa `localStorage`, `sessionStorage`, `indexedDB` ni `caches`. Hay
test que escanea su ausencia.

## Demo blindado

`isM6DemoAllowed` exige `DEV === true` o `VITE_ENABLE_M6_DEMO === 'true'`. Sin
coercion laxa: `'1'` NO habilita. **Produccion lo ignora siempre.** Esto importa
mas en M6: sin backend desplegado el fixture es la unica fuente — si el gate
fallara, produccion mostraria un demo como si fuera su estado financiero.

## Exports

Formula injection neutralizada ANTES del escaping (`= + - @ TAB CR`) · sin PII ·
tope de 5,000 filas · `revokeObjectURL` · el nombre declara `_DEMO`,
`_NONFORMAL`, `_STALE` · el cuerpo declara linaje, scope_key, run_id y capabilities.
