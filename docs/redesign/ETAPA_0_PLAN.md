# KOLD OS · Rediseño de experiencia — Plan Etapa 0

> **Frase rectora:** KOLD OS debe decirme *qué está pasando, qué importa, qué debo
> decidir o hacer y dónde puedo revisar la evidencia*. La evidencia técnica no se
> elimina: se conserva íntegra, pero deja de competir con la información directiva
> en la primera capa.

La Etapa 0 se divide en dos PR independientes. **Este documento y su
implementación cubren SOLO la Etapa 0A** (aprobada). La 0B queda planeada, no
iniciada.

## Regla rectora de la etapa

Extender la arquitectura canónica de navegación (`registry.js` · `navModel.js` ·
`AppNav` · `ACCESS_POLICY_RESOLVERS` · sesión válida · fail-closed · desktop/móvil),
**no** crear otra. **Cero** cambios de reglas, cálculos, payloads, permisos o
semántica de negocio. Todo lo que se mueve es presentación.

---

## ETAPA 0A — Infraestructura común + piloto M6 + correcciones M1/M3/Torre (ESTE PR)

> **Alcance HONESTO de #78:** este PR crea la infraestructura común y la ESTRENA en
> M6 (piloto acotado); NO afirma que la experiencia común ya esté adoptada en M1–M6.

### Qué entrega exactamente
- **Componentes creados:** `ModuleHeader`, `DataFreshness`, `EvidenceSection`,
  `StateScreen` (+ adaptadores `readM1..M6PresentationMeta`, verificados por tests).
- **Torre:** `/torre` con parseo seguro + `StateScreen` (sin error crudo);
  `/torre/backlog` recupera nav global.
- **M1:** corrección de leyenda de filtros (los KPIs son totales globales).
- **M3:** affordance de scroll horizontal.
- **M6 (piloto):** integra `DataFreshness` + `EvidenceSection` + copy curado (retira
  `docs/*.md` y la telemetría forense de la capa 1). **M6 CONSERVA su encabezado
  propio; NO fue sustituido por `ModuleHeader`.**

### Estado de adopción (para no sobre-declarar)
- `ModuleHeader` **NO es la autoridad del encabezado de ningún módulo todavía** (está
  creado y probado; se adopta por módulo en 0A.2/Etapa 2).
- **M2, M4, M5 NO adoptan** los componentes en #78. Sus adaptadores están
  construidos y verificados, pero **no cableados**.
- La adopción de los componentes en **M2/M4/M5 será Etapa 0A.2**, después de validar #78.

### Excluido de 0A (para no confundir alcance)
Agrupación de navegación (`navGroup`), renombre global de módulos, reorden de Home,
`signalModel` productivo, Home "Hoy", bandeja de prioridades → **Etapa 0B / Etapa 1**.
Publicar el artefacto E1 (`public/e1/…` + rewrite) → **entrega E1-C separada, con su
propio PR/pruebas/S/N**. Tocar la rama de M7 (#76) → **prohibido**.

---

## AJUSTE 1 — Política exacta de `/torre`, `/torre/backlog`, `/torres/*`

| Ruta | Navegación | Acceso directo por URL | Nota |
|------|------------|------------------------|------|
| `/torre` (E1 Tower) | **OCULTA** de Home y nav mientras E1 no tenga artefacto publicado | `StateScreen` controlado ("aún no publicado") | ninguna tarjeta del registry apunta a `/torre` (verificado); el `torre_operativa` apunta a `/torre/backlog` |
| `/torre/backlog` (M1) | **navegación global visible** (recupera sidebar) | pantalla M1 normal | permite volver a otros módulos |
| `/torres/*` (requisiciones) | operativo full-screen (oculto) | igual que hoy | sin cambios |

En `navModel.js`: retirar `'/torre'` de `NAV_HIDDEN_PREFIXES` (que hoy oculta también
`/torre/backlog`) y agregar `/torre` a **`NAV_HIDDEN_EXACT`** (oculta la ruta exacta,
no sus subrutas). `/torre/backlog` recupera nav; `/torres/*` intacto por su subtree.
Tests explícitos para las **tres familias**.

## AJUSTE 2 — Parseo seguro de la respuesta de tower.status

`fetchTowerStatus` **no consume el body dos veces**. Secuencia obligatoria:
`fetch → content-type → body como texto (una sola vez) → validar status/ok →
validar content-type JSON → texto no vacío ni HTML → JSON.parse en try/catch →
normalizar error`. Errores internos distinguidos:
`TOWER_STATUS_NOT_PUBLISHED` · `TOWER_STATUS_HTTP_ERROR` · `TOWER_STATUS_INVALID_RESPONSE`.
El usuario ve copy simple y controlado; el detalle vive en logging/evidencia, sin
HTML ni "Unexpected token". Tests: 200+HTML · 404 · 500 · content-type incorrecto ·
JSON inválido · JSON válido · respuesta vacía.

## AJUSTE 3 — Los cinco gates de aceptación (exactos)

1. `/torre` **jamás** muestra error crudo.
2. `/torre/backlog` recupera navegación global.
3. M1 muestra leyenda correcta de filtros (totales globales vs tabla filtrada).
4. M3 muestra indicador/affordance de desplazamiento horizontal.
5. M6 **no** muestra rutas `docs/*.md` ni telemetría forense en la capa principal.

Cada gate se entrega con: causa anterior · archivo modificado · test · evidencia ·
resultado final (ver `docs/redesign/` y el cuerpo del PR).

---

## Causa raíz de `/torre` (traza completa)

`App.jsx:/torre → TowerRoute → ScreenKoldTowerE1 → TowerStatusBoard(base="/e1")
→ fetchTowerStatus → GET /e1/tower.status.<role>.json`.

- **A (datos):** no existe `public/e1/` — el artefacto E1-A nunca se entregó a la PWA
  (paso de build/CI de E1-C, no ejecutado).
- **B (infra):** `vercel.json` reescribe `/((?!assets|icons|manifest).*) → /index.html`;
  `e1` NO está excluido ⇒ el JSON faltante devuelve `/index.html` con **HTTP 200**.
- **C (parse):** `fetchTowerStatus` valida sólo `res.ok`; con 200+HTML ejecuta
  `res.json()` ⇒ `Unexpected token '<', "<!doctype "… is not valid JSON`.
- **Render:** `TowerStatusBoard` pinta el string crudo.

**Fix 0A (frontend, honesto — NO fabrica datos):** endurecer el parse (B/C) + estado
controlado (render) + ocultar `/torre` de la superficie (Ajuste 1). **A y el rewrite
NO se tocan en 0A** (E1-C, con su S/N).

---

## Contrato `primary_decision_caveat` vs `technical_evidence`

- **`primary_decision_caveat`** (capa 1, junto al dato, si afecta la decisión):
  cobertura baja · datos parciales · evidencia no formal · moneda no consolidada ·
  universo incompleto · dato viejo · capability no disponible. **No** se esconden.
- **`technical_evidence`** (baja a `EvidenceSection`, íntegro): hashes (`run_id`,
  `scope_key`, `evidence_sha256`), manifest, `duration_ms`, `executed_queries`,
  nombres de modelo, `query_id`, códigos de regla, lineage, rutas `docs/*.md`.

Ver [`CAVEAT_VS_EVIDENCE_CONTRACT.md`](CAVEAT_VS_EVIDENCE_CONTRACT.md).

## Matriz PresentationMeta y RFC de señal

- [`PRESENTATION_META_MATRIX.md`](PRESENTATION_META_MATRIX.md) — campo visual → path
  backend → fallback → estado-si-falta → test, por módulo M1–M6.
- [`RFC_SIGNAL_MODEL.md`](RFC_SIGNAL_MODEL.md) — schema preliminar (NO productivo en
  0A; se implementa en Etapa 1).
- [`FRESHNESS_POLICY_PROPOSAL.md`](FRESHNESS_POLICY_PROPOSAL.md) — cadencias
  propuestas por módulo (solo propuesta; en 0A la UI es descriptiva/neutral).

---

## Feature flag y rollback (0A)

`VITE_UX_ETAPA0` es **build-time**, no runtime (no hay rollback instantáneo sin
redeploy). Los **fixes duros** (los 5 gates) NO van tras flag: son correcciones. Los
componentes comunes conviven con los headers actuales durante Preview (cada módulo
migra atómicamente y se valida en su commit). Rollback 0A = `git revert` del merge (o
del commit del módulo). No se mantienen dos UIs.

## División en commits (0A)

1. `docs(ux): plan Etapa 0A + matrices + tokens semánticos`
2. `feat(ux): componentes kold + adaptadores PresentationMeta + tests`
3. `fix(ux): gates 1-4 — /torre parse-guard + StateScreen + navModel + M1 legend + M3 scroll`
4. `refactor(ux): gate 5 — M6 (piloto) integra DataFreshness/EvidenceSection + copy curado`
   · M6 conserva su encabezado propio; NO se sustituye por ModuleHeader; M2/M4/M5 sin adoptar (0A.2)

## Orden de integración con M7 (recordatorio, no se ejecuta aquí)

1) cerrar auditoría delta M7 #76 → 2) congelar su head → 3) 0A sobre main → 4) 0B →
5) rebasar M7 → 6) resolver registry/navModel/AppNav → 7) suite conjunta → 8) Codex →
9) S/N. **0A no toca la rama M7.**

---

## ETAPA 0B — Navegación y lenguaje común (NO iniciar aún)

`navGroup` (Operación/Negocio/Personal) · labels de negocio · orden coherente
Home/sidebar · grupos desktop + hoja "Más" · reglas: grupos post-autorización, sin
vacíos, sin duplicados, `activeId` más específico, fail-closed, `/torre/backlog` con
nav y `/torres/*` oculto, barra móvil primaria estable. Home: `src/screens/ScreenHome.jsx`
(ruta `/`, `getHomeModulesForSession` + `getModuleEntryDecisionForSession`). Rama y PR
propios, Codex y S/N separados.
