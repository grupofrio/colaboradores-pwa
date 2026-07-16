# M6 — Release notes (frontend)

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Estado

**DRAFT.** No Ready · no merge · no deploy · cero writes · sin reviewers.

Backend: `gf_kold_os_m6` **construido en LOCAL, no publicado** (el repo Odoo migra
a `grupofrio/gf`). El numero de PR del backend no existe todavia y **no se fija en
runtime**: un numero de PR en el codigo envejece y miente (M5 cito el PR de M4).

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
