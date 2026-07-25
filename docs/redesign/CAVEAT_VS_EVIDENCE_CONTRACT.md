# Contrato: `primary_decision_caveat` vs `technical_evidence`

Dos buckets con reglas de colocación distintas. La honestidad epistémica no se
pierde: se **reubica** para que la limitación que cambia una decisión sea visible y
la telemetría forense no compita con ella.

## `primary_decision_caveat` — permanece en CAPA 1

Una salvedad que, si el director no la ve, puede llevarlo a decidir mal. Se muestra
junto al dato / en el encabezado, nunca escondida en el acordeón.

| Caveat | Origen (payload) | Copy de capa 1 |
|--------|------------------|----------------|
| Evidencia no formal | `run.is_production_shell_run === false` | "Evidencia no formal (medición read-only)" |
| Dato viejo | `data_as_of` vs ahora (descriptivo en 0A) | "Datos medidos hace N horas" |
| Cobertura baja | `metric.coverage` / `caveat` bajo umbral | "Cobertura parcial: X de Y" |
| Datos parciales | `not_evaluable` en universo clave | "No evaluable con la evidencia actual" |
| Moneda no consolidada | `multi_currency_detected && !normalized` (M7) | "Importes por moneda; sin total global" |
| Universo incompleto | universo declarado incompleto | "Universo observado, no exhaustivo" |
| Capability no disponible | `feature === false` | "No disponible: <capability>" |

## `technical_evidence` — baja a `EvidenceSection` (colapsable, íntegro)

Material de auditoría/trazabilidad. No cambia la decisión directiva; sí importa para
Codex, Sebas y para reproducir. Se conserva **completo**.

| Elemento | Origen |
|----------|--------|
| Hashes | `run.run_id`, `run.scope_key`, `run.evidence_sha256`, `auditor_build_sha`, `contract_build_sha` |
| Manifest / contrato | `manifest`, `schema_version`, contrato del auditor |
| Telemetría | `run.duration_ms`, `run.executed_queries[]` (nº consultas) |
| Modelos / queries | `finding.source_model`, `finding.evidence_reference.query_id`, `source_fields` |
| Códigos de regla | `M2-A-01`… (en tablas de detalle se conservan; fuera de la frase de capa 1) |
| Lineage | pre-migración, reseal, measurement_method detallado |
| Rutas internas | `docs/*.md` referenciadas en textos de contrato |

## Regla de decisión (test)

- Un `primary_decision_caveat` activo **se renderiza en capa 1** → test lo verifica.
- La `technical_evidence` **no aparece en capa 1** (jerga/hashes/`docs/*.md`) → test
  la busca en el render primario y falla si aparece; la encuentra dentro de
  `EvidenceSection`.
- El shape lo produce cada `readMxPresentationMeta` como
  `{ decisionCaveats: string[], technicalEvidence: {...} }`.
