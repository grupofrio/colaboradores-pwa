# M2 — Release notes v2 (API real + correcciones Codex RED)

**PRs**: frontend `#68` (`feat/kold-os-m2-planning-readiness`) + backend
**GrupoVeniu/GrupoFrio `#201`** (`feat/kold-os-m2-observability-api`, módulo nuevo
`gf_kold_os_m2`). Ambos DRAFT.

## ⚠️ ORDEN DE MERGE OBLIGATORIO

**1) PR #67 → 2) PR backend #201 → 3) rebase de #68 sobre main post-#67 → 4) rerun
completo → 5) revisión Sebastián → 6) merge #68.** #68 NO se rebasa todavía (no se rebasa
sobre ramas no mergeadas). Dependencia #68→#201 es de DESPLIEGUE (sin backend la UI muestra
UNAVAILABLE honesto), no de compilación.

## v2 — qué cambió vs v1 (Codex RED)

- **Fuente real**: la superficie consume SOLO `GET /pwa-kold-os/m2/latest` y
  `/pwa-kold-os/m2/findings` (autenticados, read-only, paginados) vía `api()` canónico
  (handler `directKoldOsM2`, GET-only, sin fallback n8n). Se eliminó el loader de JSON
  estático `/m2/*` y el motor de derivación client-side (el catálogo canónico y el
  lifecycle viven en el backend).
- **Historial real**: datastore del observatorio (`gf.kold.os.m2.*`) con ingesta manual
  idempotente; lifecycle new/persistent/recurrent/corrected calculado entre corridas
  REALES; la UI solo muestra persistencia/tendencias con ≥ 2 corridas.
- **Permisos consistentes (blocker #7)**: `accessPolicy:'m2'` en el registry +
  `isModuleVisibleForSession`/`getModuleEntryDecisionForSession` — la MISMA autoridad
  (`readM2Access`) decide tarjeta, nav, Más, rail, clic y ruta; `admin_plataforma` ve y
  entra (es la proyección de `direccion_general`; documentado A4).
- **Semántica (#8/#9)**: "**Incidencias detectadas**" (no "registros afectados") con
  `unique_records_available:false`; "**Detalle de regla**" + badges
  AGREGADO/SUCURSAL/REGISTRO; sin enlace a Odoo hasta IDs reales.
- **Demo fuera de producción (#12)**: `isM2DemoAllowed` (DEV o `VITE_ENABLE_M2_DEMO` en
  Preview); producción ignora `?demo=1`; exports de demo marcados `_DEMO`.
- **CSV injection (#11)**: neutralización con apóstrofo pre-escape para `= + - @` y
  tab/CR/LF iniciales + suite de tests; `revokeObjectURL` verificado.
- **Contrato versionado (#13)**: `schema_version` explícito, versión futura ⇒ error
  controlado, campos extra compatibles, `capabilities` con required/optional query ids;
  **scope flexible** (sin compañías fijas en la UI).
- **STALE (#B10)**: bandera del backend + warning prominente con edad + exports marcados
  `_STALE` + metadata; lectura permitida, jamás presentado como vigente.
- **Cliente endurecido (B1)**: timeout duro, límite de tamaño, 401/403/404/409/5xx
  mapeados, cero persistencia de evidencia en el navegador, resultados tardíos descartados.
- **Fixture por código real (Track C)**: auditor real @fb03840 → core backend real →
  envelope; manifest_sha256 idéntico al de producción; procedencia declarada.

## Estado de datos al liberar

Auditor técnico **PASS** · datos reales **RED** (13 rojas · 3 ámbar · 39 004 incidencias).
Resultado esperado del observatorio, no defecto de la entrega.

## Sin cambios

PR #67 (intacto) · flag Tower · TowerRoute/superficie Tower · tablas operativas Odoo ·
producción (cero deploys desde estos PRs).
