# M7 Frontend — Revisión de vulnerabilidades npm

Ejecutado en la ronda de corrección post-auditoría de Codex. `npm audit` (2026-07-17)
reporta **17 vulnerabilidades: 0 critical · 7 high · 9 moderate · 1 low**.

## Hallazgo central

**`npm audit fix` (sin `--force`) aplica CERO cambios**: no hay ninguna corrección
segura/no-breaking disponible en el árbol actual. Cada arreglo exige un salto
**MAYOR** de Vite (`vite@8`, `vite-plugin-pwa@1.3.0`, `esbuild` vía Vite), que es
**breaking** para TODO el app (M1–M7), no sólo M7. Por la regla de Codex —"no
actualizar indiscriminadamente"— **no se ejecuta `npm audit fix --force` en este PR**.

Ninguna de las 17 viaja en el **bundle productivo** salvo `react-router-dom`
(runtime), y esa **no es alcanzable desde M7**.

## Tabla

| Paquete | Sev | Directo | Runtime/Dev | Alcanzable en M7 | Fix | Decisión |
|---------|-----|---------|-------------|------------------|-----|----------|
| vite | high | sí | **build/dev** | no (no se sirve dev en prod) | vite@8 **MAJOR** | PR infra propio + S/N |
| esbuild | moderate | no (vía vite) | **build/dev** | no (uso build API, no dev server) | vite@8 **MAJOR** | PR infra propio + S/N |
| @babel/plugin-transform-modules-systemjs | high | no | **build** | no | sí (cascada) | con el PR de Vite |
| @babel/core | low | no | **build** | no | sí | con el PR de Vite |
| serialize-javascript | high | no | **build** | no | sí | con el PR de Vite |
| @rollup/plugin-terser | moderate | no | **build** | no | sí | con el PR de Vite |
| workbox-build | moderate | no | **build (PWA)** | no | sí | con el PR de Vite |
| vite-plugin-pwa | moderate | sí | **build (PWA)** | no | v1.3.0 **MAJOR** | PR infra propio + S/N |
| lodash | high | no | **build** | no | sí | con el PR de Vite |
| picomatch | high | no | **build** | no | sí | con el PR de Vite |
| flatted | high | no | **build (eslint)** | no | sí | con el PR de Vite |
| fast-uri | high | no | **build** | no | sí | con el PR de Vite |
| postcss | moderate | no | **build (tailwind)** | no | sí | con el PR de Vite |
| js-yaml | moderate | no | **build** | no | sí | con el PR de Vite |
| brace-expansion | moderate | no | **build** | no | sí | con el PR de Vite |
| **react-router** | moderate | no (vía dom) | **RUNTIME** | **no** (ver abajo) | sí | PR de dependencias propio |
| **react-router-dom** | moderate | sí | **RUNTIME** | **no** (ver abajo) | sí | PR de dependencias propio |

## El único runtime: react-router-dom (open redirect via `//`)

La vulnerabilidad: un redirect same-origin con path que empieza en `//` puede
reinterpretarse como URL protocol-relative (open redirect). **Alcanzabilidad en M7:
NINGUNA** — el único redirect de M7 es `<Navigate to="/" replace />` con destino
**literal estático**; M7 jamás construye un destino de redirect a partir de input del
usuario. La alcanzabilidad a nivel app depende de otras rutas y es anterior a M7.

- **Mitigación M7**: no se derivan destinos de redirect de datos externos.
- **Fix**: bump de `react-router-dom` a la línea parcheada. Toca el lockfile
  compartido (afecta a M1–M7) ⇒ **PR de dependencias dedicado con su propia
  revisión**, no dentro de este PR de M7.

## Veredicto

- **0 critical.** Ninguna vulnerabilidad runtime es alcanzable desde M7.
- **Blocker para este PR M7 (frontend): NO.**
- **Owner del follow-up**: infraestructura/plataforma (Yamil asigna).
- **Fecha de revisión**: 2026-07-17. Re-evaluar al abrir el PR de Vite v8.
- **CI**: si el pipeline corre `npm audit`, reportará estas 17 hasta el PR de Vite;
  no se declara "CI verde" ignorándolas — se declaran aquí con su decisión.

Nota: la prueba `tests/m7ScreenRender.test.mjs` usa la API de **build** de esbuild
(bundling), no su dev-server; la vía vulnerable (dev-server) no se ejercita.
