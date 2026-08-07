# M2 — Runbook operativo (v2)

## 0. Cadena completa (quién hace qué)

1. **Sebastián**: revisa/mergea backend PR GrupoVeniu/GrupoFrio#201 → deploy Odoo.sh
   (instalar `gf_kold_os_m2` es no-op: flag nace "0").
2. **Operador autorizado**: corre el auditor read-only y **e ingiere** el run (abajo).
3. **Yamil (S/N)**: enciende `gf_kold_os.m2.enabled = "1"`.
4. **Sebastián**: revisa/mergea frontend PR #68 (después de #67 + rebase) → Vercel deploy.
5. La superficie `/planeacion` muestra datos reales; sin pasos 1-3 muestra
   UNAVAILABLE/disabled honestos.

## 1. Ejecutar la auditoría read-only (producción)

```
KOLD_TOWER_M2_ENVIRONMENT=production
KOLD_TOWER_M2_PRODUCTION_CONFIRM=AUTHORIZE_KOLD_TOWER_M2_READ_ONLY_PRODUCTION
KOLD_TOWER_M2_EXPECTED_DATABASE=grupofrio-grupofrio-31972140
KOLD_TOWER_M2_COMPANY_IDS=1,34,35,36
KOLD_TOWER_M2_WINDOW_DAYS=90
KOLD_TOWER_M2_RUN_ID=<token opaco>  KOLD_TOWER_M2_BUILD_SHA=<sha auditor>
odoo-shell … < gf_route_compliance/tools/audit_kold_tower_m2_readonly.py > run.log
```

Guardas automáticas: READ ONLY verificado, write-probe 25006, rollback, timeouts.
Extraer el JSON de la línea `JSON_SUMMARY=` a `reporte.json`.

## 2. Ingerir el run al observatorio (única escritura; idempotente)

```
KOLD_OS_M2_INGEST_FILE=/ruta/reporte.json \
KOLD_OS_M2_INGEST_CONFIRM=INGEST_KOLD_OS_M2_RUN \
odoo-shell … < gf_kold_os_m2/tools/ingest_kold_os_m2_run.py
```

- Sin `KOLD_OS_M2_INGEST_CONFIRM` ⇒ **dry-run con rollback** (verifica sin escribir).
- Re-ingestar la misma evidencia ⇒ `created=False` (dedupe por `run_id` +
  `evidence_sha256`; constraints SQL).
- Solo escribe `gf.kold.os.m2.*` (datastore del observatorio) — jamás tablas operativas.
- El lifecycle (new/persistent/recurrent) se calcula al ingerir contra la cadena previa.

## 3. Encender/apagar la API

`gf_kold_os.m2.enabled`: `"0"` (default, deploy no-op) → `"1"` SOLO con S/N. Apagar =
volver a "0" (los endpoints responden 503 feature_disabled al instante).

## 4. Verificación de evidencia

- `manifest_sha256` del run debe coincidir con el del build del auditor (propiedad
  determinista del código; el de producción es `0fb967bd06eb…9204c` @ `fb03840`).
- `evidence_sha256` = sha256 del JSON canónico sin campos volátiles (render_report lo
  verifica al emitir; la ingesta lo usa como clave de dedupe).

## 5. Estados y acción

| Señal en UI | Significado | Acción |
|---|---|---|
| AUDITOR: PASS + DATOS: RED/AMBER | M2 funciona; incumplimientos reales | Trabajo operativo por área responsable |
| ⚠ CORRIDA STALE (edad) | Run > 7 días | Correr §1 + §2 de nuevo |
| "API apagada (flag)" | feature_disabled | Encender flag (S/N) |
| "Sin fuente de datos" | backend sin deploy o sin runs | Completar §0 pasos 1-2 |
| "Versión de contrato no soportada" | backend publicó schema nuevo | Actualizar PWA (coordinar M2_DATA_CONTRACT) |
| Sesión expirada / sin permiso | auth | Login / revisar matriz de permisos |

## 6. Rollback

- **Frontend**: revert del PR #68 (front-only, sin estado servidor).
- **Backend**: apagar flag (inmediato) → desinstalar módulo si hiciera falta (sus tablas
  son del observatorio; nada operativo depende de ellas).
- **Datos ingeridos**: `unlink` de la corrida (cascade a findings) desde shell autorizado.
- **Datos operativos**: no aplica — M2 jamás los toca.

## 7. Retención e higiene

Sin poda automática v1 (1 run + ~16 findings por corrida ≈ KB); política de retención =
decisión operativa posterior (el modelo lo soporta con unlink por fecha). Nunca commitear
el JSON del run real a ningún repo; nunca publicarlo estático (test de blindaje).
