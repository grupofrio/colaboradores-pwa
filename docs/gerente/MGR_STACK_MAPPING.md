# Gerente FE — mapeo de stack histórico → `main` canónico

Fecha: 2026-08-17  
Rama productiva backend: `main` (confirmada en Odoo.sh).  
Base FE canónica: `grupofrio/colaboradores-pwa` → `main`.

## Regla

Los PRs draft FE#157–#164 están apilados sobre historia **anterior al Copiloto Gerencial**
(`ScreenCopilotoGerencial` / `/gerente/copiloto`). Retarget ciego a `main` **borra** esa
superficie (MGR-GAP-006). Portar solo el delta sobre `main` actual.

## Frontend (`grupofrio/colaboradores-pwa`)

| PR histórico | Base antigua | Clasificación vs `main` | Acción canónica |
|---|---|---|---|
| FE#157 `fix/gerente-rotos-fase1` | old main (pre-copiloto) | **still_needed** (estados honestos) | PR-MGR-04 / parcial en ports |
| FE#159 `fix/gerente-scope-fase1` | stack #157 | **still_needed** (scope FE) | PR-MGR-02/04 según delta |
| FE#163 `feat/gerente-v2-shell` | stack #159 | **still_needed** + **conflicting** (quita copiloto) | PR-MGR-05 con copiloto preservado |
| FE#164 `feat/gerente-controls-panel` | stack #163 | **still_needed** (15 reglas UI) | PR-MGR-05 |
| FE#160 gastos unificados | stack | **deferred** (GF2) | fuera de F1–F3 cierre |
| FE#161 POS IVA | stack | **deferred** | fuera de F1–F3 cierre |

## Lo que YA está en `main` y NO se debe perder

- `/gerente/copiloto` + `ScreenCopilotoGerencial`
- módulo registry `copiloto_gerencial`
- hub legacy con card Copiloto
- tests `managerCopilot.test.mjs` + navGuards

## PR-MGR-01 (este PR)

- Documenta el mapeo (este archivo)
- Agrega test **explícito de no-regresión** MGR-GAP-006: si desaparece
  `/gerente/copiloto` del routing/registry/menú Gerente → FAIL

## Gaps

- MGR-GAP-001/002 prep (documentación de integración canónica)
- MGR-GAP-006: preservación Copiloto con test rojo si se elimina
