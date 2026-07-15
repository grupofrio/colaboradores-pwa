# M2 — Especificación funcional · "Planeación y readiness" (v2)

**KOLD OS · módulo Enterprise M2 (Demanda / planeación / optimización) · 2026-07-14.**
v2 responde al veredicto **RED de Codex** sobre la v1: ahora la superficie consume una
**fuente autenticada REAL** (backend `gf_kold_os_m2`, GrupoVeniu/GrupoFrio **PR #201**) y el
demo queda fuera de producción.

## 1. Propósito

M2 **evidencia lo que no se está haciendo** en la planeación de rutas. No corrige datos, no
"pone indicadores en verde", no ejecuta acciones (`auto_fix=false` en el 100% del catálogo,
verificado por tests en ambos lados). Responde: qué regla se incumple, cuántas incidencias,
en qué scope, desde cuándo, si persiste/corrigió/reincide, con qué evidencia y qué área
debe atenderlo.

## 2. Arquitectura (dos repos, una sola verdad)

```
GrupoVeniu/GrupoFrio (backend, PR #201)
└── gf_kold_os_m2/
    ├── lib/kold_os_m2_core.py     core PURO: contrato del auditor, catálogo
    │                              CANÓNICO de 24 reglas, derivación, lifecycle,
    │                              filtros, paginación, envelopes, sanitizador
    ├── models/                    datastore del observatorio (runs+findings)
    │                              + servicio fail-closed (flag→token→acceso)
    ├── controllers/               GET /pwa-kold-os/m2/latest · /findings
    └── tools/ingest_…py           ingesta manual idempotente (odoo-shell)

grupofrio/colaboradores-pwa (frontend, PR #68)
└── src/modules/planeacion/
    ├── ScreenPlaneacionM2.jsx     ejecutiva + detalle de regla + export
    └── m2/ contract.js (envelope kold.os.m2.api/1) · m2Api.js (cliente
        canónico api(): timeout/errores/límite de tamaño/sin persistencia) ·
        access.js (readM2Access) · demoGate.js (demo SOLO DEV/Preview) ·
        exporters.js (CSV anti-inyección + STALE) · filters.js (demo) ·
        m2Meta.js (labels) · fixtures/apiLatestFixture.js (generado por
        CÓDIGO REAL: auditor @fb03840 + core backend)
```

**El catálogo de reglas y el lifecycle son autoridad del BACKEND**; la PWA valida el
contrato y presenta. El frontend ya no deriva reglas en producción (la v1 lo hacía
client-side — eliminado).

## 3. Fuente de datos y flujo

1. El **auditor read-only** (`gf_route_compliance`, build `fb03840`, 13 queries en
   manifiesto cerrado, transacción READ ONLY + write-probe + rollback) corre en producción
   y emite su JSON (run real 2026-07-14: 342 ms, 13/13, contrato producción 3/3).
2. Un operador autorizado **ingiere** ese JSON al datastore del observatorio
   (idempotente por `run_id`/`evidence_sha256`; jamás tablas operativas).
3. La PWA consulta `GET /pwa-kold-os/m2/latest` y `GET /pwa-kold-os/m2/findings`
   (paginado server-side) vía el mecanismo canónico `api()` con
   `X-GF-Employee-Token` — **cero archivos públicos** (test de blindaje).

## 4. Estados honestos

| Plano | Estados |
|---|---|
| Técnico (auditor) | PASS / FAIL / **STALE** (>7 días, warning prominente + edad + exports marcados) / UNAVAILABLE |
| Fuente (cliente) | disabled (flag OFF) · unavailable (sin deploy/run) · session_expired · forbidden · schema_mismatch · invalid · error |
| Operativo (datos) | GREEN / AMBER / RED / NOT_EVALUABLE |

Estado real hoy: **auditor PASS · datos RED** (13 rojas · 3 ámbar · 5 verdes · 3 no
evaluables). La UI lo dice literal: *"M2 está funcionando y detectó incumplimientos"*.

## 5. Semántica (correcciones Codex)

- KPI = **"Incidencias detectadas"** (no "registros afectados"): afectaciones acumuladas
  por regla; una misma entidad puede violar varias reglas. `unique_records_available:false`
  en el contrato; "registros únicos" exigirá IDs deduplicables (v1.1).
- El detalle se llama **"Detalle de regla"** con badge de granularidad
  (**AGREGADO** / SUCURSAL / REGISTRO). "Detalle por registro" solo cuando exista
  `entity_id`; sin URL segura no hay enlace a Odoo.
- **Lifecycle real**: `new/persistent/recurrent` los calcula el backend al ingerir contra
  la cadena previa; `corrected` al servir. La UI solo muestra
  persistencia/reincidencia/corregidos/tendencias con **≥ 2 corridas reales**; con 1
  corrida: "new" + "sin historial" (nada sintético).
- **Demo** (`?demo=1`): SOLO con `import.meta.env.DEV` o `VITE_ENABLE_M2_DEMO==='true'`
  (Preview autorizado). Producción lo ignora (gate de código, no enlace oculto; con test).
  Exports de demo marcados `_DEMO` en el nombre.

## 6. Permisos (B3: una sola autoridad)

`readM2Access(session)` decide **tarjeta, nav móvil, Más, rail, clic y ruta** (módulo con
`accessPolicy:'m2'` en el registry + `isModuleVisibleForSession` /
`getModuleEntryDecisionForSession` + guard `M2PlaneacionRoute`). El backend aplica el mismo
contrato conceptual (`_access_for`). Ver M2_PERMISSIONS.md.

## 7. Orden de liberación

**1) PR #67 (Tower) → 2) PR backend GrupoVeniu/GrupoFrio#201 → 3) rebase de #68 sobre main
post-#67 → 4) rerun completo → 5) revisión Sebastián → 6) merge #68.** Sin backend
desplegado, la superficie muestra UNAVAILABLE honesto (jamás datos falsos).
