# M6 — Exports

> **GENERADO desde el fixture real** (`src/modules/caja-conciliacion/m6/fixtures/apiLatestFixture.js`,
> emitido por el core del backend M6 LOCAL). Las cifras NO se escriben a mano: si
> este doc discrepa del envelope, es que alguien lo edito en vez de regenerarlo.
> **PR DRAFT · no Ready · no merge · no deploy · cero writes.**

## Los 7 exports

| Archivo | Contenido |
|---|---|
| `kold_os_m6_hallazgos.csv` | tabla de hallazgos (15 en esta corrida) |
| `kold_os_m6_evidencia.json` | envelope completo sanitizado |
| `kold_os_m6_resumen.txt` | resumen ejecutivo en **3 niveles** |
| `kold_os_m6_cartera_aging.txt` | cartera y aging (del snapshot) |
| `kold_os_m6_pagos_conciliacion.txt` | pagos y conciliacion (caveated) |
| `kold_os_m6_cierres_liquidaciones.txt` | cierres y liquidaciones (caveated) |
| `kold_os_m6_capacidades.txt` | capacidades y cobertura |

## Protecciones

- **Formula injection**: neutraliza `= + - @ TAB CR` **antes** del escaping.
- **Sin PII**: `sanitizeForExport` elimina claves; `sanitizeCsvText` redacta texto.
- **Tope**: 5,000 filas.
- **Sin mezclar monedas**: no hay total consolidado en ningun export.
- **Nombre honesto**: `_DEMO`, `_NONFORMAL`, `_STALE`.
- **`revokeObjectURL`** siempre.

## Todo export incluye

`scope_key` · `run_id` · `auditor_build_sha` · `contract_build_sha` · estado de
evidencia (FORMAL/NO FORMAL + bloqueadores) · ventana · compañias · **monedas** ·
capability flags · manifest/evidence sha256.

## Wording

Ningun export afirma "todo cuadra", "no cuadra", "faltante", "perdida" o "fraude".
Hay test que exige que **toda aparicion de esos terminos este NEGADA** (el texto
dice "NO es un faltante ni un pago perdido" — nombrarlo para negarlo es correcto).
