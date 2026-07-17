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

## Bundling del fixture demo (RESUELTO — antes un MAJOR de Codex)

Codex marcó como MAJOR que el fixture financiero pudiera viajar en el bundle
productivo. **Corregido**: el fixture se carga por **import dinámico gated**
(`virtual:m7-demo-fixture`), que en build de producción resuelve a un stub
(`demoFixtureLoader.prod.js`) que **no importa el fixture**. Evidencia:

- El chunk de la pantalla bajó de ~122 kB a ~57 kB al salir el fixture.
- `scripts/check_m7_demo_bundle.mjs` (en `npm run build`) falla si cualquier
  sentinel del fixture (run_id, scope_key, content commit, importe distintivo)
  aparece en `dist/`. Resultado: **OK (fixture ausente en dist productivo)**.
- `sourcemap: false` en `vite.config.js` ⇒ no hay leak vía sourcemaps públicos.
- Gate `canLoadM7DemoFixture` fail-closed: producción real NUNCA, aunque el flag
  esté encendido (ver [`M7_FE_DEMO.md`](M7_FE_DEMO.md)).

## Vulnerabilidades npm

17 (0 critical); ninguna runtime alcanzable desde M7; sin fix seguro no-breaking.
Ver [`M7_FE_NPM_AUDIT.md`](M7_FE_NPM_AUDIT.md).

Pruebas: `tests/m7Exports.test.mjs`, `tests/m7AccessApi.test.mjs`,
`tests/m7DemoGate.test.mjs`, `scripts/check_m7_demo_bundle.mjs`.
