# Etapa 0A — QA Visual autenticada (Vercel Preview)

- **Preview URL**: `https://colaboradores-pwa-git-feat-ux-etapa0a-fundamentos-grupofrio.vercel.app`
  (deployment `dpl_EnyMZ9NiQYH72WeGSEnLgYvC9Bst`, READY, `target: null` = **Preview, no producción**, PR #78)
- **Head desplegado (confirmado)**: `741846cacfc98714c0338d0fc227b4b2b0a0e264`
- **Fecha**: 2026-07-17 · **Navegador**: Chrome autenticado (claude-in-chrome)
- **Sesión/rol**: sesión de **Yamil** (la inició él; NO se ingresaron ni leyeron
  credenciales). Rol con acceso a M1–M6; **sin** `operador_torres` (por eso `/torres`
  redirige a Home).

## Resultado global

**Desktop (viewport real 1966 CSS px): los 5 gates PASS.** **Responsive 375/tablet:
NO verificado — bloqueo de herramienta** (ver abajo). Sin blockers ni majors nuevos
en desktop.

## Matriz de pantallas · viewport · resultado

| # | Ruta | Escenario | Viewport | Resultado | Evidencia |
|---|------|-----------|----------|-----------|-----------|
| B | `/torre` | acceso directo | 1966 | **PASS** — StateScreen "El mapa de estado de la Torre aún no está publicado" + "Volver al inicio". Sin `Unexpected token`/HTML/JSON crudo (`rawErr:false`, `stateScreen:true`, DOM) | captura + JS |
| A | `/` Home | carga + módulos | 1966 | **PASS** — nav visible; NO hay tarjeta a `/torre` (torreExact=0); "Torre operativa" → `/torre/backlog`; sin overflow global | captura + JS |
| C | `/torre/backlog` (M1) | nav global | 1966 | **PASS** — sidebar global visible, contenido no comprimido, "Torre operativa" activo | captura |
| D | `/torre/backlog` (M1) | filtros + leyenda | 1966 | **PASS** — al activar "Solo candidatas": leyenda *"Los indicadores de arriba son totales globales; la tabla de abajo está filtrada (1 filtro)"*; KPIs sin cambiar; al limpiar, la leyenda desaparece | 2 capturas |
| E | `/ejecucion` (M3) | affordance scroll | 1966 | **PASS** — caption "Desliza horizontalmente…" (`m3-scroll-hint` presente); scroll horizontal real revela "Última detección"; sin overflow **global** (contenido dentro del contenedor de tabla) | 2 capturas + JS |
| F | `/caja-conciliacion` (M6) | capa 1 limpia | 1966 | **PASS** — sin `docs/*.md`, sin hashes, sin `run_id`/`scope_key`, sin "consultas", sin build sha; conserva corte/ventana/compañías/sucursales/monedas | captura |
| G | M6 | DataFreshness | 1966 | **PASS** — "🕐 Datos medidos hace 7 h", canal neutro (azul), **NO** rojo/ámbar/verde de riesgo | captura |
| H | M6 | Evidencia cerrada | 1966 | **PASS** — "▸ Evidencia técnica" colapsada, no compite con capa 1 | captura |
| I | M6 | Evidencia abierta | 1966 | **PASS** — Auditor: PASS · Fuente: odoo-shell (formal) · run_id · scope_key · evidence_sha256 · auditor_build_sha · Consultas: 11. Filas `clave: valor`, **sin `[object Object]`**, sin PII, sin romper layout | captura |
| — | `/torres` | full-screen operativo | 1966 | **NO TESTEABLE** — el rol de la sesión no tiene `operador_torres`; redirige a Home. Comportamiento nav-hidden cubierto por `tests/uxTorreAndGates` y sin cambios en 0A | JS (path=/) |

## Comprensión (por pantalla, 10 s)

- **/torre**: se entiende que la Torre no está lista y que el resto funciona; hay salida clara. (Observación menor: el encabezado del wrapper "KOLD Tower — Estado por rol / vista solo lectura del mapa real" precede al StateScreen y suena a que el mapa existe; el StateScreen lo aclara. **Minor/cosmetic**, no bloquea.)
- **M1**: se entiende "rutas pendientes de cierre"; la leyenda aclara global vs filtrado.
- **M3**: la tabla comunica que hay más columnas; sigue densa (rediseño = Etapa 2).
- **M6**: la capa 1 quedó más limpia (sin hashes/consultas); la evidencia está a un clic.

## Hallazgos (severidad)

| Hallazgo | Severidad |
|----------|-----------|
| `/torre`: el encabezado del wrapper ("mapa real del sistema") antecede al StateScreen "aún no publicado"; leve disonancia | **minor** — diferido a **0A.2** |
| M3 conserva su footer de telemetría en capa 1 (M3 no era gate 5; sólo M6 se limpió en 0A) | declarado, no regresión |
| Responsive móvil/tablet **NOT TESTED** (la emulación no llega al tab automatizado) | **gate de proceso previo al merge** (no de código) |

Sin blockers ni majors de código. Sin regresiones observadas en desktop.

## Responsive móvil/tablet — NOT TESTED (limitación de la herramienta)

**Estado: NO PROBADO.** Se intentaron dos vías y ninguna cambió el viewport de la
pestaña que la herramienta automatiza:
- `resize_window` a 390×844 → `window.innerWidth` permaneció en **1966**.
- **DevTools device toolbar** (F12 → Ctrl+Shift+M → 390×844 → recarga), operado
  manualmente por Yamil → remedido: `innerWidth` siguió en **1966** en la única
  pestaña del grupo automatizado. La emulación no alcanza esa pestaña.

Por decisión de Yamil (Opción 3) **no se sigue intentando** con la herramienta. Por
tanto **NO se verificaron visualmente** los viewports móvil (390×844) ni tablet
(768×1024). **No se infiere PASS por CSS ni por tests**: la revisión visual manual
responsive es un **gate OBLIGATORIO previo al merge**.

### PENDIENTE OBLIGATORIO antes del merge (revisión manual responsive)

Móvil **390×844** y tablet **768×1024**, para Home · `/torre` · `/torre/backlog` (M1
con/sin filtro) · M3 (scroll horizontal real) · M6 · EvidenceSection (cerrado/abierto):
- navegación inferior móvil visible + hoja "Más" funcional;
- qué navegación corresponde realmente a 768 (verificar en DOM, no asumir);
- safe-area inferior respetada; áreas táctiles suficientes;
- scroll horizontal de la tabla M3 sin overflow horizontal **global**;
- M6 sin telemetría en capa principal; EvidenceSection sin desbordar el ancho;
- sin solapes, sin cortes de texto/tarjetas, sin scroll horizontal global.

Ninguna de estas filas se declara PASS: todas quedan **NOT TESTED / pendientes**.

## Minor conocido (diferido a Etapa 0A.2)

En `/torre`, el encabezado del wrapper ("KOLD Tower — Estado por rol · vista solo
lectura del mapa real del sistema") antecede al `StateScreen` "El mapa de estado de la
Torre aún no está publicado", lo que genera una leve disonancia. **No bloquea** (el
StateScreen aclara). **Diferido a Etapa 0A.2**; no se corrige en #78.

## P3 — `build_sha` en EvidenceSection

M6 muestra `auditor_build_sha` (su identidad de build real); `build_sha` es el campo
de **M2** (null en M6, oculto correctamente por el componente). **No hay pérdida de
evidencia en M6.** El componente `EvidenceSection` YA renderiza `build_sha` cuando
existe; sólo se hará visible cuando **M2 adopte** el adaptador. **Decisión: B — validar
en 0A.2; sin cambio en #78.**

## Conclusión

- **Desktop (1966 px): PASS**, observado por Claude en el Preview autenticado (los 5
  gates funcionales + sin overflow global).
- **Móvil (390×844) y tablet (768×1024): NOT TESTED** por limitación de la
  herramienta. **No se infiere PASS por CSS ni tests.**
- **La revisión manual responsive es un gate previo al merge.**
- **Minor de `/torre`: diferido a 0A.2.**
- Código: sin blockers ni majors (auditoría estática de Codex).

Recomendación: **auditoría delta docs-only de Codex**; **merge bloqueado** hasta
completar la QA responsive manual 390/768.
