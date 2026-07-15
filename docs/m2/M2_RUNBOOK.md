# M2 — Runbook operativo

## 1. Cómo ejecutar la auditoría read-only (reproducir evidencia)

La ejecuta **backend (Sebastián)** vía odoo-shell sobre el módulo `gf_route_compliance`
(GrupoVeniu/GrupoFrio). Variables (producción):

```
KOLD_TOWER_M2_ENVIRONMENT=production
KOLD_TOWER_M2_PRODUCTION_CONFIRM=AUTHORIZE_KOLD_TOWER_M2_READ_ONLY_PRODUCTION
KOLD_TOWER_M2_EXPECTED_DATABASE=grupofrio-grupofrio-31972140
KOLD_TOWER_M2_COMPANY_IDS=1,34,35,36
KOLD_TOWER_M2_WINDOW_DAYS=90
KOLD_TOWER_M2_RUN_ID=<token opaco>
KOLD_TOWER_M2_BUILD_SHA=<sha del auditor>
```

```
odoo-shell ... < gf_route_compliance/tools/audit_kold_tower_m2_readonly.py
```

Salida: `KOLD_TOWER_M2_AUDIT_STATUS=PASS`, hashes de manifiesto/evidencia y `JSON_SUMMARY=`
(el run). Guardas automáticas: transacción READ ONLY verificada, write-probe bloqueado, rollback
confirmado, timeouts. Si algo falla → exit 2 y NO hay evidencia parcial.

## 2. Cómo verificar la evidencia

- `manifest_sha256` debe coincidir con el manifiesto del build (propiedad determinista del código).
- `evidence_sha256` = sha256 del JSON canónico sin campos volátiles (`render_report` lo verifica).
- Run real de referencia (2026-07-14): manifest `0fb967bd06eb…9204c`, evidencia `317252aac265…0435`,
  build `fb03840919cf…7be`, 342 ms, 13/13.

## 3. Cómo publicar el run a la superficie (v1.1 — NO hecho en este PR)

La PWA lee `GET /m2/kold.tower.m2.run.latest.json` (base allowlisted). Opciones de fuente, ambas
con su propia autorización:

- **Recomendada**: endpoint autenticado en Odoo (`/pwa-tower/m2-run`, patrón gf_tower_m1: flag OFF
  por default + token + rol + scope) y un rewrite `/m2/*` → endpoint en `vercel.json`.
- Alternativa: origen estático **gateado** (nunca `public/` del repo — test de blindaje lo prohíbe).

Mientras no exista fuente publicada: la pantalla muestra **UNAVAILABLE honesto** y el modo
`?demo=1` permite revisar la superficie con la reconstrucción sanitizada.

## 4. Estados y qué hacer

| Señal | Significado | Acción |
|---|---|---|
| AUDITOR: PASS + DATOS: RED/AMBER | M2 funciona; hay incumplimientos | Trabajo operativo por área responsable (ver hallazgo) |
| AUDITOR: STALE | Run > 7 días | Ejecutar nueva corrida (§1) |
| AUDITOR: FAIL | Guardas técnicas fallaron | NO usar datos; revisar log del auditor; avisar a Sistemas |
| AUDITOR: UNAVAILABLE | Sin run publicado / contrato inválido | Publicar run (§3) o revisar validación |

## 5. Rollback

- **Superficie**: revertir el merge del PR de M2 (revert PR) — no hay estado en servidor ni datos
  persistidos; el módulo es front-only.
- **Datos**: no aplica — M2 no escribe. La corrida del auditor es READ ONLY con rollback interno
  confirmado por contrato.
- **Acceso**: quitar el módulo del registry o vaciar la allowlist de `access.js` (una línea) en un
  PR de emergencia.

## 6. Higiene

- Nunca commitear el JSON del run real al repo (contiene métricas operativas; el fixture ya cubre
  demo/tests con reconstrucción sanitizada).
- Nunca poner credenciales en el run ni en la URL — el sanitizador del auditor y el de exportación
  los rechazan/redactan, pero la política es no acercarlos.
