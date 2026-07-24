# M6 — Linaje: la divergencia esperada y el gate que la cierra

> **DOCUMENTO ÚNICO del linaje de M6.** Si otro archivo dice algo distinto sobre
> qué commit midió qué, éste manda y el otro está mal.

## Estado hoy

| | |
|---|---|
| Backend `auditor_build_sha` (sello actual) | **`9c23d5d2`** |
| Frontend fixture `measuring_commit` | **`fe53d564`** |
| Frontend fixture `run.auditor_build_sha` | **`fe53d564`** (coherente consigo mismo — hay test) |
| Clasificación | **`expected_pre_migration_lineage_mismatch`** |
| Cruce de contrato | **35/36** — la 36ª es exactamente ésta |
| ¿Bloquea la auditoría de Codex? | **NO** |
| ¿Bloquea **Ready final**? | **SÍ** |

## Qué NO significa

Esto **no** es un desajuste de contrato ni de cifras. Verificado, no supuesto:

| | |
|---|---|
| Totales | **idénticos** — 29 reglas / 6,006 incidencias |
| Estructura del envelope | **idéntica** |
| Los cuatro ejes | **idénticos** (hay test que espeja los 4) |
| Universos (10) | **idénticos** |
| Capabilities | **idénticas** |
| Semántica | **idéntica** |

**Sólo difiere de qué commit salió la derivación.**

## Por qué NO se "arregla" ahora

El sello `9c23d5d2` **también es temporal**. Cuando el backend aterrice en
`grupofrio/gf`, los SHA se reescriben otra vez y el sello cambiará de nuevo.
Alinear el fixture hoy:

- costaría un commit,
- daría una falsa sensación de cierre (36/36 sin serlo de verdad),
- y habría que rehacerlo mañana con el SHA definitivo.

**El sello se pone UNA vez, al final.** Perseguirlo en cada rebase intermedio es
churn que además enseña a ignorar el gate.

Lo que **sí** se hizo: dejar de ser tácito. La divergencia viaja **en el dato**
(`lineage_status`, `backend_current_seal`,
`lineage_resync_required_before_ready`, `contract_crosscheck`), no en la prosa —
y hay test que falla si alguien declara `36/36` o borra la clasificación.

## 🚦 GATE — antes de Ready final

**Se deben cumplir las TRES igualdades:**

```
backend auditor_build_sha
    ==
frontend fixture measuring_commit
    ==
el commit que REALMENTE produjo el envelope
```

**No usar HEAD.** El head del PR es quien *empaqueta*, no quien *midió*. Si el
envelope lo produjo otro commit, el sello es ése — aunque el head sea más nuevo.
Ésa es la distinción entre `auditor_build_sha` (qué código MIDIÓ, inmutable) y
`contract_build_sha` (quién empaquetó).

**Mientras el gate no pase: el contrato es 35/36, no 36/36.** Nadie marca Ready.

## Procedimiento de re-sellado post-portado

Orden estricto — el paso 2 va **después** del 1 porque un commit no puede
contener su propio SHA (lección 36):

```bash
# ── BACKEND, en grupofrio/gf ────────────────────────────────────────────────
# 1. Aplicar los patches y confirmar los tests puros (129/129).
#    En este punto el sello del fixture apunta a un commit que NO existe aquí.
git log --format=%H -1 -- gf_kold_os_m6/lib     # ← el commit que MIDIÓ
#    Verificar que exista y sea ancestro del head:
git merge-base --is-ancestor <SELLO_NUEVO> HEAD && echo "ancestro OK"

# 2. Sellar, en un commit POSTERIOR y separado:
#    - gf_kold_os_m6/tests/fixtures/contract_fixture_report.json → auditor_build_sha
#    - docs que lo citen (se DERIVAN, no se escriben a mano)
git commit -m "chore(m6): stamp the lineage of the M6 auditor (<SELLO_NUEVO>)"

# 3. Confirmar que lib/ no cambió entre el sello y el head:
git diff --numstat <SELLO_NUEVO> HEAD -- gf_kold_os_m6/lib   # debe estar vacío
```

## Procedimiento de resincronización del fixture de #75

```bash
# ── FRONTEND, en grupofrio/colaboradores-pwa ───────────────────────────────
# 4. Regenerar el envelope DESDE el backend portado (no editar a mano):
#    scripts/regen_fe_fixture.py, con el sello nuevo. Invariante duro: las
#    cifras NO se mueven (29 reglas / 6,006 incidencias). Si se mueven, algo
#    más cambió y hay que investigarlo antes de sellar.

# 5. Actualizar en apiLatestFixture.js:
#      measuring_commit                     := <SELLO_NUEVO>
#      backend_current_seal                 := <SELLO_NUEVO>
#      lineage_status                       := 'synced'
#      lineage_resync_required_before_ready := false
#      contract_crosscheck                  := '36/36'
#      backend_status                       := <el que corresponda en gf>
#      backend_temp_pr                      := <el PR real de gf>

# 6. Los tests DEBEN moverse con el dato (están escritos para eso):
#    - 'linaje divergente del backend: DECLARADO' exige notEqual y 35/36:
#      cuando el linaje se sincronice, ESE test debe reescribirse a 'synced'
#      y 36/36. Que falle es la señal de que el gate se cruzó de verdad.
npm test    # 722/722
```

**El paso 6 es a propósito.** El test está escrito para romperse cuando el estado
cambie: un test que sobreviviera a la sincronización no estaría verificando nada.

## Quién cierra qué

| Paso | Gate | Autoriza |
|---|---|---|
| 1–3 | re-sellado del backend | S/N de Yamil |
| 4–6 | resincronización del fixture | S/N de Yamil |
| — | **Ready final** | S/N de Yamil, **sólo con el gate en verde** |

## Historia (por qué existe este documento)

`fe53d564` era el sello original del backend local. El rebase del **PR #210**
(DRAFT temporal pre-migración que **no se mergea** y se cierra sin merge) sobre la
base vigente (`a6cb652a`, +47 commits) reescribió los SHA y `fe53d564` **dejó de
ser ancestro** de la rama: para quien auditara el PR, el sello habría apuntado al
vacío. Se re-selló el backend a `9c23d5d2` — **contenido de `lib/` idéntico, 0
líneas de diff**: cambió el commit, no el código.

El frontend no se tocó (no estaba autorizado, y de todos modos habría que
rehacerlo al portar). De ahí la divergencia. Codex la revisó y la confirmó como
deliberada.
