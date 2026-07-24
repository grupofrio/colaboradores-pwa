# Etapa 0A — QA Visual autenticada (Vercel Preview)

- **Preview URL**: `https://colaboradores-pwa-git-feat-ux-etapa0a-fundamentos-grupofrio.vercel.app`
  (deployment `dpl_EnyMZ9NiQYH72WeGSEnLgYvC9Bst`, READY, `target: null` = **Preview, no producción**, PR #78)
- **Head desplegado (confirmado)**: `741846cacfc98714c0338d0fc227b4b2b0a0e264`
- **Fecha**: 2026-07-17 · **Navegador**: Chrome autenticado (claude-in-chrome)
- **Sesión/rol**: sesión de **Yamil** (la inició él; NO se ingresaron ni leyeron
  credenciales). Rol con acceso a M1–M6; **sin** `operador_torres` (por eso `/torres`
  redirige a Home).

## Resultado global

**Desktop (viewport real 1966 CSS px): los 5 gates PASS** (observado por Claude).
**Móvil (dispositivo real): PASS** — validado manualmente por **Yamil** (2026-07-17).
**Tablet (768×1024): NOT TESTED** — sin dispositivo; riesgo residual **aceptado como
NO BLOQUEANTE** por el responsable. **Gate responsive: CERRADO.** Sin blockers ni majors.

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
| Responsive: **móvil PASS** (validado por Yamil en dispositivo real); **tablet NOT TESTED** (sin dispositivo) | riesgo residual **aceptado, no bloqueante**; gate **CERRADO** |

Sin blockers ni majors de código. Sin regresiones observadas en desktop.

## Responsive — CIERRE del gate (decisión de Yamil, 2026-07-17)

El gate responsive de #78 queda **CERRADO** con esta composición de evidencia:

- **Desktop (1966 CSS px): PASS** — observado por **Claude** en el Preview autenticado
  (los 5 gates + sin overflow global; ver matriz arriba).
- **Móvil (dispositivo real): PASS** — **validado manualmente por Yamil** (responsable),
  2026-07-17, sobre el recorrido responsive pre-registrado de la Etapa 0A (Home ·
  `/torre` · `/torre/backlog` M1 · M3 · M6 · EvidenceSection). **El veredicto es de
  Yamil; Claude NO observó el móvil.** No se transcriben observaciones por superficie
  que Yamil no haya detallado.
- **Tablet (768×1024): NOT TESTED** — no se dispuso de dispositivo. **Riesgo residual
  aceptado como NO BLOQUEANTE por decisión del responsable (Yamil).**

**El gate responsive ya no bloquea #78.**

### Contexto — por qué la validación móvil fue en dispositivo real

La emulación no alcanzó la pestaña que la herramienta automatiza: `resize_window` a
390×844 y la device toolbar de DevTools dejaron `window.innerWidth` en **1966**. Por
eso el móvil se validó **en dispositivo real por Yamil** (no por Claude) y el tablet
quedó pendiente por falta de dispositivo (riesgo aceptado, no bloqueante). No se infiere
PASS por CSS ni por tests: el móvil está respaldado por la validación manual de Yamil.

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

- **Desktop (1966 px): PASS** — observado por Claude en el Preview autenticado (los 5
  gates funcionales + sin overflow global).
- **Móvil (dispositivo real): PASS** — validado manualmente por Yamil (2026-07-17).
- **Tablet (768×1024): NOT TESTED** — riesgo residual **aceptado, no bloqueante** (Yamil).
- **Gate responsive: CERRADO** — ya no bloquea #78.
- **Minor de `/torre`: diferido a 0A.2.**
- Código: sin blockers ni majors (auditoría estática de Codex).

#78 permanece **DRAFT**; el merge queda sujeto a S/N (el gate responsive dejó de ser
el bloqueo). El minor de `/torre` sigue diferido a 0A.2.
