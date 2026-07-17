# M7 Frontend — Seguridad

M7 abre el dato económico más sensible del negocio a un solo rol. Defensa en
profundidad.

## Superficie de datos

- **GET-only.** `directKoldOsM7` responde 405 a cualquier método distinto de GET. No
  hay writes, no hay n8n, no hay POST. El dominio económico es **observatorio**.
- **Cero PII.** `scanPii` recorre el payload completo; el validador rechaza cualquier
  clave PII (`partner_name, rfc, clabe, email, phone, …`). Los exports **dropean** PII
  en cualquier nivel (`sanitizeForExport`). `partner_id` nunca es filtrable.
- **Sin claves de otros módulos.** El validador rechaza `daily_close_metrics`,
  `route_compliance`, `stock_move_metrics`, … (arrastre de otro módulo).
- **Guard de tamaño.** `guardSize` (2 MB) evita payloads anómalos; `withTimeout`
  corta esperas colgadas.

## Exports (client-side)

- **Formula injection neutralizada.** Toda celda que empiece con `= + - @` (o
  tab/CR) se prefija con `'` **antes** del escaping de comillas. Excel/Sheets no la
  ejecutan.
- **Sin consolidado.** Ningún export suma MXN+USD ni convierte con tasa actual.
- **Object URL revocado.** `downloadTextFile` revoca el `blob:` URL tras el click; no
  deja handles vivos.

## Permisos

Fail-closed, sólo `direccion_general`, revalidado en el route guard. Ver
[`M7_FE_PERMISSIONS.md`](M7_FE_PERMISSIONS.md).

## Consideración honesta declarada

El fixture de demo se importa estáticamente en el chunk perezoso de la pantalla
(patrón idéntico a M6, ya mergeado). El **gate de demo controla el render, no el
bundling**: las cifras agregadas del fixture (sin PII) viajan en el JS del chunk. Si
Dirección decide que ni cifras agregadas de demo deben viajar, la mitigación es un
`import()` dinámico detrás del gate — misma decisión que enfrentaría M6; **no se
introdujo unilateralmente aquí** para no divergir del baseline mergeado.

Pruebas: `tests/m7Exports.test.mjs`, `tests/m7AccessApi.test.mjs`.
