# M3 — Especificación funcional · "Ejecución de rutas" (frontend)

**KOLD OS · M3 (Ejecución operativa en campo, cumplimiento de ruta y cierre) · 2026-07-15.**
Superficie READ-ONLY que consume EXCLUSIVAMENTE la API autenticada de
**`gf_kold_os_m3` (GrupoVeniu/GrupoFrio PR #202)**. Evidencia lo que NO se está
haciendo en la cadena: asignación/arranque → paradas → venta/no-venta/cobro →
carga/inventario → incidentes → cierre/conciliación/corte → plan vs real.
**M3 observa, no corrige** (cero botones de acción; `auto_fix=false` por contrato;
tests de ausencia de verbos de escritura).

## Arquitectura

```
src/modules/ejecucion/
├── ScreenEjecucionM3.jsx    ejecutiva (12+ KPIs) + 8 bloques + detalle + exports
└── m3/ contract.js (envelope kold.os.m3.api/1, granularidad validada en ambas
    direcciones) · m3Api.js (cliente canónico api(): timeout/errores/límite/
    sin persistencia; /latest /findings /runs) · access.js (readM3Access) ·
    demoGate.js (DEV o VITE_ENABLE_M3_DEMO) · m3Meta.js (8 categorías) ·
    filters.js (demo/contrato) · exporters.js (CSV anti-inyección + STALE/DEMO +
    plan-vs-real) · fixtures/apiLatestFixture.js (código real + NÚMEROS REALES)
```

Cableado: módulo `ejecucion` en el registry con **`accessPolicy: 'm3'`** →
`isModuleVisibleForSession`/`getVisibleModulesForSession`/
`getModuleEntryDecisionForSession` (navModel) deciden tarjeta+nav+clic con
`readM3Access`; guard `M3EjecucionRoute` (App.jsx) revalida; el backend es la
última línea (flag→token→acceso server-side). Handler `directKoldOsM3` en
api.js: GET-only, allowlist de params (SIN employee_id), sin fallback n8n.

## Datos y estados

- `/latest` → run (guardas/hashes/scope) + `stale`/`age_days` + **kpis** +
  `summary` + 38 `rule_results` + findings (lifecycle + granularidad
  AGGREGATE/**BRANCH** real) + corrected + history + capabilities.
- `/findings` → tabla paginada server-side (filtros del contrato).
- Estados técnicos: PASS/FAIL/STALE/UNAVAILABLE (+disabled/session/forbidden/
  schema_mismatch/invalid/error del cliente). Operativos: GREEN/AMBER/RED/
  NOT_EVALUABLE. Copy literal: *"M3 está funcionando y detectó
  incumplimientos"* — jamás "M3 falló" porque una ruta no cerró.
- Sin backend desplegado ⇒ UNAVAILABLE honesto (nunca datos falsos).

## Resultados reales que mostrará (medición 2026-07-15)

Cumplimiento de visita **29.35%** · 171/352 rutas sin cerrar · 204/204 cajas
abiertas · 1,469/1,469 no-ventas sin motivo · 5,534 visitas <1 min · 5,743
check-ins fuera de radio · 975 visitas fuera de plan · 22,030 incidencias ·
sucursales dimensionales: #1 y #29. (Ver M3_RULE_CATALOG del backend.)

## Orden de liberación

Backend #202 (merge+deploy flag OFF → auditor+ingesta → flag S/N) → este PR.
Comparte `registry/navModel/ScreenHome/App/api` con los PRs #67/#68 NO
mergeados: desarrollado desde main con los MISMOS nombres de función ⇒ el
rebase posterior es unión mecánica (documentado; no se rebasa sobre ramas sin
merge).
