# Etapa 0A — QA Visual (Vercel Preview)

- **Preview URL**: `https://colaboradores-pwa-git-feat-ux-etapa0a-fundamentos-grupofrio.vercel.app`
  (deployment `dpl_Gp3zJFKvhs3skoeTk7vZ2KAyXmgg`, READY)
- **Head SHA auditado**: `c3dfb1a` (los cambios de la ronda de revisión —adaptadores/
  tests/docs— no alteran el render de los gates; se re-verificará el head final).
- **Fecha**: 2026-07-17 · **Navegador**: Chrome autenticado (mcp claude-in-chrome).

## ⛔ BLOQUEO — no se pudo completar la QA visual autenticada

**Causa exacta (verificada, no supuesta):** la sesión autenticada vive en el origen de
**producción** `colaboradores.grupofrio.mx` (token en `localStorage`, por-origen). El
Preview corre en un **origen distinto** (`*.vercel.app`), así que **no hereda la
sesión**. Al abrir el Preview se muestra la **pantalla de login** (PIN de empleado +
Barcode), y `/torre` **redirige a `/login`**. Autenticar el Preview exige **capturar el
PIN/barcode del empleado** — una **entrada de credenciales que NO realizo** (acción
prohibida). No solicito el PIN al usuario ni ejecuto el flujo de magic-link.

Evidencia del bloqueo:
- `GET /` (Preview) → login (desktop 1568px: captura tomada, shell responsive OK).
- `GET /torre` (Preview) → redirige a `/login` (StateScreen tras `TowerRoute`, requiere sesión).

## Lo que SÍ quedó verificado (sin sesión)

| Ítem | Cómo | Resultado |
|------|------|-----------|
| El Preview compila y bootea | `GET /` en Chrome | ✅ login shell renderiza, responsive |
| `/torre` no es alcanzable sin sesión | redirect a `/login` | ✅ (coherente con `TowerRoute`) |
| StateScreen sin error crudo | `tests/uxTorreAndGates` + `uxComponents` (SSR real) | ✅ |
| ModuleHeader/EvidenceSection/DataFreshness render | `tests/uxComponents` (SSR real) | ✅ |
| M6 sin `docs/*.md` ni telemetría en capa 1 | `tests/uxM6Gate5` + build | ✅ (código/fixture) |
| M1 leyenda / M3 affordance | `tests/uxTorreAndGates` (fuente) | ✅ (código) |
| Estado "antes" (producción) | capturas de la auditoría UX | referencia |

## Checklist visual solicitado — estado

Cada punto queda **NO VERIFICADO VISUALMENTE EN PREVIEW** (bloqueo de sesión), y
**VERIFICADO POR SSR/test/código** donde aplica. No se declara PASS visual.

| Pantalla / criterio | Viewport | Estado |
|---------------------|----------|--------|
| A. Home | 375/tablet/desktop | ⛔ bloqueado (sesión) |
| B. `/torre` StateScreen + salida a Inicio | — | ⛔ visual bloqueado · ✅ SSR/test |
| C. `/torre/backlog` con nav global | — | ⛔ visual bloqueado · ✅ test navModel |
| D. M1 filtros + leyenda | — | ⛔ visual bloqueado · ✅ test/código |
| E. M3 affordance de scroll | — | ⛔ visual bloqueado · ✅ test/código |
| F. M6 sin docs/hashes/consultas en capa 1 | — | ⛔ visual bloqueado · ✅ test/build |
| G. EvidenceSection cerrado/abierto | — | ⛔ visual bloqueado · ✅ SSR |
| DataFreshness sin rojo de riesgo | — | ⛔ visual bloqueado · ✅ SSR test |
| Sin solape / sin scroll horizontal global | — | ⛔ bloqueado |
| Nav móvil/desktop | — | ⛔ bloqueado |

## Cómo desbloquear la QA visual autenticada (decisión de Yamil)

1. **Iniciar sesión en el Preview** con un PIN/barcode válido (lo hace Yamil o Sebas
   directamente en el dominio del Preview), y entonces retomo el recorrido y las
   capturas 375/tablet/desktop. **Yo no ingreso credenciales.**
2. O habilitar un modo de vista sin datos sensibles en el Preview (fuera de 0A).
3. **No** se valida contra producción (implicaría merge/deploy, no autorizado).

**Conclusión honesta:** la QA visual autenticada del Preview queda **pendiente** por el
bloqueo de sesión cross-origin; no se declara completa. Los gates están cubiertos por
render SSR real + tests + build; falta la confirmación visual autenticada.
