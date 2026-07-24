# M6 — Release notes (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Estado

**DRAFT.** No Ready · no merge · no deploy · cero writes · sin reviewers.

Backend: `gf_kold_os_m6` con **PR DRAFT temporal
[#210](https://github.com/GrupoVeniu/GrupoFrio/pull/210) que NO se mergea** — se
cierra sin merge; el repo Odoo migra a `grupofrio/gf`, donde se abrira el PR
definitivo. El numero **no se fija en runtime**: un PR citado en el codigo
envejece y miente (M5 cito el #205, que era el PR de M4).

**Cuatro cosas distintas — solo la primera es cierta:**

| | |
|---|---|
| PR existe | **SI** — #210, DRAFT, temporal, no se mergea |
| Backend desplegado | **NO** |
| API real probada | **NO** — no existe endpoint desplegado |
| Runtime validado | **NO** — el SQL del manifiesto nunca ha corrido |

Linaje: divergencia **esperada y declarada**
(`expected_pre_migration_lineage_mismatch`); contrato **35/36**. Se resincroniza
tras el portado — ver [M6_LINEAGE_GATE.md](M6_LINEAGE_GATE.md).

## Que trae

- Pantalla `/caja-conciliacion` en **3 niveles**: estado financiero reportado ·
  cobertura de instrumentacion · capacidades no disponibles.
- Cliente **GET-only** para `/pwa-kold-os/m6/{latest,findings,runs}`, sin
  fallback n8n, con 12 estados de UI.
- **4 ejes independientes** con filtros separados.
- Filtros **server-side**; `rejected_params` en banner rojo.
- **Currency-aware**: sin total consolidado con multi-moneda.
- 7 exports sin PII, con linaje y wording honesto.
- Demo solo DEV/Preview; **produccion muestra `unavailable`**.

## Cifras vigentes

29 reglas · **0** incumplimientos · 13 riesgos · 2 anomalias ·
8 cumplen · 6 no evaluables · **6,006** incidencias · 15
hallazgos servidos · tests **698/698**.

## Decisiones que un revisor debe conocer

1. **Solo `direccion_general`** — el backend no valida `admin_plataforma`;
   aceptarlo aqui reproduciria el bug de M1.
2. **La UI lee `metrics`, no `kpis`** — el backend v1 no emite `kpis`.
3. **Dispatch inline**, no `ACCESS_POLICY_RESOLVERS` — ese mapa lo introduce M3
   (#71), que sigue DRAFT.
4. **En demo la lista NO se filtra** — no hay servidor; se declara en vez de
   simular.

## Pendiente

API real · rebase M3/M4/M5 · validacion de Sebastian · S/N de Yamil para
merge/deploy.
