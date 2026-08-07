// ─── KOLD OS · M2 — FIXTURE del envelope /latest (kold.os.m2.api/1) ─────────
// GENERADO POR CÓDIGO REAL, no reconstruido a mano:
//   1) reporte del auditor emitido por kold_tower_m2_audit_core @ fb03840
//      (cursor scriptado con los agregados REPORTADOS del run de producción
//      2026-07-14; mismo manifest_sha256 que producción: 0fb967bd06eb…9204c);
//   2) envelope construido por gf_kold_os_m2/lib/kold_os_m2_core.py
//      (derivación de reglas, lifecycle, capabilities, sanitización).
// USO: tests de contrato + modo demo (solo DEV/Preview autorizado — jamás
// producción). NO es la evidencia productiva (evidence_sha256 propio).
export const M2_API_FIXTURE_PROVENANCE = Object.freeze({
  kind: 'real_code_generated',
  auditor_core: 'gf_route_compliance/tools/kold_tower_m2_audit_core.py @ fb03840919cf5ee9cc9f939d88f0d7f5456187be',
  backend_core: 'gf_kold_os_m2/lib/kold_os_m2_core.py (PR GrupoVeniu/GrupoFrio#201)',
  production_manifest_sha256_match: true,
  production_evidence_sha256: '317252aac2653ef0f650725a0372419ce413502ef83713949a9a720a83310435',
  is_production_evidence: false,
})

export const M2_API_LATEST_FIXTURE = Object.freeze({
  "age_days": 0.06,
  "applied_scope": {
    "level": "global"
  },
  "capabilities": {
    "features": {
      "branch_dimension": false,
      "entity_detail": false,
      "findings_pagination": true,
      "history": true
    },
    "findings_max_page_size": 100,
    "granularities": [
      "aggregate"
    ],
    "optional_query_ids": [],
    "required_query_ids": [
      "branch_resolution_metrics",
      "capacity_metrics",
      "forecast_metrics",
      "handoff_metrics",
      "history_metrics",
      "module_status",
      "optimizer_configuration",
      "schema_catalog",
      "scope_validation",
      "snapshot_metrics",
      "solver_evidence_metrics",
      "territory_load_handoff_metrics",
      "weekly_plan_metrics"
    ],
    "stale_days": 7
  },
  "corrected": [],
  "findings": [
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "territorio",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios sin polígono ni subpolígono de planeación asignado.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "missing_territory_count",
          "plan_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "territory_load_handoff_metrics"
      },
      "expected_rule": "Todo plan diario debe tener planning_polygon_id o planning_subpolygon_id.",
      "finding_id": "M2-A-01::global:all::route_plan:aggregate",
      "finding_key": "M2-A-01::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 293,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 293,
      "observed_value": "293 de 484 (60.54%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 60.54,
      "recommended_action": "Asignar territorio en el plan semanal antes de publicar.",
      "responsible_area": "Operaciones / Administración de sucursal",
      "responsible_employee_id": null,
      "rule_code": "M2-A-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan sin territorio"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "solver",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios sin registro de ejecución del optimizador externo.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "solver_evidence_count",
          "plan_count",
          "solver_status"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "solver_evidence_metrics"
      },
      "expected_rule": "Todo plan publicado debe conservar evidencia de la corrida del solver.",
      "finding_id": "M2-B-01::global:all::route_plan:aggregate",
      "finding_key": "M2-B-01::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 424,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 424,
      "observed_value": "424 de 484 (87.6%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 87.6,
      "recommended_action": "Ejecutar el optimizador antes de publicar; si fue manual, registrarlo.",
      "responsible_area": "Planeación / Sistemas",
      "responsible_employee_id": null,
      "rule_code": "M2-B-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan sin evidencia del solver"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "vehiculo_capacidad",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios sin vehículo asignado.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "missing_vehicle_count",
          "plan_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "capacity_metrics"
      },
      "expected_rule": "Todo plan diario debe tener vehicle_id asignado.",
      "finding_id": "M2-C-01::global:all::route_plan:aggregate",
      "finding_key": "M2-C-01::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 133,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 133,
      "observed_value": "133 de 484 (27.48%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 27.48,
      "recommended_action": "Asignar vehículo desde el plan semanal.",
      "responsible_area": "Operaciones / Flota",
      "responsible_employee_id": null,
      "rule_code": "M2-C-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan sin vehículo"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "vehiculo_capacidad",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes cuyo vehículo no declara capacidad (x_capacity_kg <= 0).",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "missing_capacity_count",
          "plan_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "capacity_metrics"
      },
      "expected_rule": "Todo vehículo planificado debe declarar capacidad en kg.",
      "finding_id": "M2-C-02::global:all::route_plan:aggregate",
      "finding_key": "M2-C-02::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 144,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 144,
      "observed_value": "144 de 484 (29.75%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 29.75,
      "recommended_action": "Capturar x_capacity_kg en la ficha del vehículo (Flota).",
      "responsible_area": "Operaciones / Flota",
      "responsible_employee_id": null,
      "rule_code": "M2-C-02",
      "severity": "high",
      "source_model": "fleet.vehicle",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan sin capacidad"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "vehiculo_capacidad",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios cuya demanda excede la capacidad del vehículo.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "overcapacity_count",
          "plan_count",
          "split_count",
          "reload_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "capacity_metrics"
      },
      "expected_rule": "La demanda asignada no debe exceder la capacidad (split/reload).",
      "finding_id": "M2-C-03::global:all::route_plan:aggregate",
      "finding_key": "M2-C-03::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 30,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 30,
      "observed_value": "30 de 484 (6.2%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 6.2,
      "recommended_action": "Redistribuir demanda o asignar vehículo de mayor capacidad.",
      "responsible_area": "Operaciones / Flota",
      "responsible_employee_id": null,
      "rule_code": "M2-C-03",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan diario con sobrecapacidad"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "vehiculo_capacidad",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 480,
      "description": "Líneas del plan semanal con demanda por encima de la capacidad.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "weekly_plan_line",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "overcapacity_line_count",
          "line_count",
          "state"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "weekly_plan_metrics"
      },
      "expected_rule": "Ninguna línea semanal debe planearse por encima de la capacidad.",
      "finding_id": "M2-C-04::global:all::weekly_plan_line:aggregate",
      "finding_key": "M2-C-04::global:all::weekly_plan_line:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 29,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 29,
      "observed_value": "29 de 480 (6.04%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 6.04,
      "recommended_action": "Rebalancear la semana antes de publicar.",
      "responsible_area": "Operaciones / Flota",
      "responsible_employee_id": null,
      "rule_code": "M2-C-04",
      "severity": "high",
      "source_model": "gf.route.weekly.plan.line",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Línea semanal con sobrecapacidad"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "carga_handoff",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 39,
      "description": "Planes published sin picking de carga vinculado (handoff no ocurrió).",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "published_without_load_count",
          "published_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "territory_load_handoff_metrics"
      },
      "expected_rule": "Todo plan publicado debe generar su carga (stock.picking).",
      "finding_id": "M2-D-01::global:all::route_plan:aggregate",
      "finding_key": "M2-D-01::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 37,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 37,
      "observed_value": "37 de 39 (94.87%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 94.87,
      "recommended_action": "Generar la carga desde el plan publicado.",
      "responsible_area": "Almacén / Jefe de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-D-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan publicado sin carga"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "carga_handoff",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios sin demand_snapshot_id (sin evidencia de demanda).",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "plan_missing_snapshot_count",
          "daily_plan_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "handoff_metrics"
      },
      "expected_rule": "Todo plan diario debe anclarse a un snapshot de demanda.",
      "finding_id": "M2-D-02::global:all::route_plan:aggregate",
      "finding_key": "M2-D-02::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 46,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 46,
      "observed_value": "46 de 484 (9.5%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 9.5,
      "recommended_action": "Generar snapshot antes de derivar el plan diario.",
      "responsible_area": "Almacén / Jefe de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-D-02",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan diario sin snapshot de demanda"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "carga_handoff",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 484,
      "description": "Planes diarios sin ninguna parada (plan vacío u orfandad de handoff).",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "route_plan",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "plan_without_stops_count",
          "daily_plan_count",
          "stop_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "handoff_metrics"
      },
      "expected_rule": "Todo plan diario debe tener al menos una parada.",
      "finding_id": "M2-D-03::global:all::route_plan:aggregate",
      "finding_key": "M2-D-03::global:all::route_plan:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 21,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 21,
      "observed_value": "21 de 484 (4.34%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 4.34,
      "recommended_action": "Regenerar stops desde la línea semanal o cancelar el plan vacío.",
      "responsible_area": "Almacén / Jefe de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-D-03",
      "severity": "high",
      "source_model": "gf.route.stop",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Plan diario sin stops"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "carga_handoff",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 376,
      "description": "Líneas semanales publicadas sin almacén de despacho.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "weekly_plan_line",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "missing_warehouse_count",
          "line_count",
          "state"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "weekly_plan_metrics"
      },
      "expected_rule": "Una línea publicada debe declarar el almacén que despacha.",
      "finding_id": "M2-D-04::global:all::weekly_plan_line:aggregate",
      "finding_key": "M2-D-04::global:all::weekly_plan_line:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 48,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 48,
      "observed_value": "48 de 376 (12.77%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 12.77,
      "recommended_action": "Completar almacén de despacho antes de publicar la semana.",
      "responsible_area": "Almacén / Jefe de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-D-04",
      "severity": "high",
      "source_model": "gf.route.weekly.plan.line",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Línea semanal publicada sin almacén"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "carga_handoff",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 480,
      "description": "Líneas semanales sin snapshot de demanda vinculado.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "weekly_plan_line",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "missing_snapshot_count",
          "line_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "weekly_plan_metrics"
      },
      "expected_rule": "Toda línea semanal debe anclarse a un snapshot de demanda.",
      "finding_id": "M2-D-05::global:all::weekly_plan_line:aggregate",
      "finding_key": "M2-D-05::global:all::weekly_plan_line:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 10,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 10,
      "observed_value": "10 de 480 (2.08%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 2.08,
      "recommended_action": "Generar snapshot semanal antes de armar líneas.",
      "responsible_area": "Almacén / Jefe de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-D-05",
      "severity": "medium",
      "source_model": "gf.route.weekly.plan.line",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "AMBER",
      "title": "Línea semanal sin snapshot"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "snapshots_forecast",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": null,
      "description": "Cobertura promedio de forecast en snapshots bajo el umbral operativo.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "demand_snapshot",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "coverage_avg",
          "snapshot_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "snapshot_metrics"
      },
      "expected_rule": "Cobertura promedio >= 90% (GREEN) / >= 70% (AMBER). Fuente umbral: RI D-A.",
      "finding_id": "M2-E-01::global:all::demand_snapshot:aggregate",
      "finding_key": "M2-E-01::global:all::demand_snapshot:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": null,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 56.82000000000001,
      "observed_value": "56.82%",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 56.82,
      "recommended_action": "Aumentar cobertura del forecast antes de confiar en el plan.",
      "responsible_area": "Planeación / Comercial / Datos",
      "responsible_employee_id": null,
      "rule_code": "M2-E-01",
      "severity": "high",
      "source_model": "gf.route.demand.snapshot",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Cobertura de forecast insuficiente"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "snapshots_forecast",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": null,
      "description": "Score de confianza promedio de snapshots bajo el umbral.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "demand_snapshot",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "confidence_avg",
          "snapshot_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "snapshot_metrics"
      },
      "expected_rule": "Confianza promedio >= 0.85 (GREEN) / >= 0.70 (AMBER). Default v1 por ratificar.",
      "finding_id": "M2-E-02::global:all::demand_snapshot:aggregate",
      "finding_key": "M2-E-02::global:all::demand_snapshot:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": null,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 0.6667,
      "observed_value": "0.6667",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 0.6667,
      "recommended_action": "Revisar calidad de insumos del snapshot.",
      "responsible_area": "Planeación / Comercial / Datos",
      "responsible_employee_id": null,
      "rule_code": "M2-E-02",
      "severity": "high",
      "source_model": "gf.route.demand.snapshot",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Confianza de snapshot baja"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "snapshots_forecast",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 8412,
      "description": "Líneas de snapshot resueltas por mecanismo de respaldo.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "demand_snapshot",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "fallback_count",
          "line_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "snapshot_metrics"
      },
      "expected_rule": "Las líneas deben resolverse con forecast directo, no fallback.",
      "finding_id": "M2-E-03::global:all::demand_snapshot:aggregate",
      "finding_key": "M2-E-03::global:all::demand_snapshot:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 2202,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 2202,
      "observed_value": "2202 de 8412 (26.18%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 26.18,
      "recommended_action": "Cerrar huecos de forecast para los pares en fallback.",
      "responsible_area": "Planeación / Comercial / Datos",
      "responsible_employee_id": null,
      "rule_code": "M2-E-03",
      "severity": "medium",
      "source_model": "gf.route.demand.snapshot",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "AMBER",
      "title": "Líneas de snapshot en fallback"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "snapshots_forecast",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": null,
      "description": "Advertencias emitidas durante la generación de snapshots.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "demand_snapshot",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "warning_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "snapshot_metrics"
      },
      "expected_rule": "La generación de snapshots no debe emitir warnings.",
      "finding_id": "M2-E-04::global:all::demand_snapshot:aggregate",
      "finding_key": "M2-E-04::global:all::demand_snapshot:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 192,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 192,
      "observed_value": "192",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": null,
      "recommended_action": "Revisar el log de generación y atender las causas.",
      "responsible_area": "Planeación / Comercial / Datos",
      "responsible_employee_id": null,
      "rule_code": "M2-E-04",
      "severity": "medium",
      "source_model": "gf.route.demand.snapshot",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "AMBER",
      "title": "Warnings de snapshot"
    },
    {
      "auto_fix": false,
      "branch_code": null,
      "branch_id": null,
      "branch_name": null,
      "category": "resultado_real",
      "company_id": null,
      "company_scope": [
        1,
        34,
        35,
        36
      ],
      "denominator": 42421,
      "description": "Proporción de historia de demanda con actual_kg capturado.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "demand_history",
      "evidence_reference": {
        "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
        "evidence_fields": [
          "actual_kg_count",
          "row_count"
        ],
        "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
        "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
        "query_id": "history_metrics"
      },
      "expected_rule": "actual_kg capturado en >= 80% de la historia (GREEN) / >= 50% (AMBER). Default v1.",
      "finding_id": "M2-F-01::global:all::demand_history:aggregate",
      "finding_key": "M2-F-01::global:all::demand_history:aggregate",
      "first_seen_at": "2026-07-14T22:03:05.342000Z",
      "granularity": "aggregate",
      "incidences": 35395,
      "last_seen_at": "2026-07-14T22:03:05.342000Z",
      "lifecycle_status": "new",
      "numerator": 7026,
      "observed_value": "16.56%",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 16.56,
      "recommended_action": "Cerrar el ciclo de captura de venta real por ruta.",
      "responsible_area": "Operación de campo / Cierre de ruta",
      "responsible_employee_id": null,
      "rule_code": "M2-F-01",
      "severity": "high",
      "source_model": "kold.demand.history",
      "source_timestamp": "2026-07-14T22:03:05.342000Z",
      "status": "RED",
      "title": "Cobertura de resultado real insuficiente"
    }
  ],
  "history": {
    "latest_finished_at": "2026-07-14T22:03:05.342000Z",
    "previous_finished_at": null,
    "runs_count": 1
  },
  "metrics": {
    "branch_resolution_metrics": [
      {
        "plan_count": 64,
        "resolution_source": "company_default",
        "unresolved_count": 0
      },
      {
        "plan_count": 420,
        "resolution_source": "sale_warehouse",
        "unresolved_count": 0
      }
    ],
    "capacity_metrics": [
      {
        "missing_capacity_count": 144,
        "missing_vehicle_count": 133,
        "overcapacity_count": 30,
        "plan_count": 484,
        "reload_count": 0,
        "split_count": 0
      }
    ],
    "forecast_metrics": [
      {
        "covered_days": 92,
        "final_count": 41372,
        "newest_date": "2026-07-16",
        "oldest_date": "2026-04-16",
        "positive_kg_count": 41892,
        "row_count": 42372
      }
    ],
    "handoff_metrics": [
      {
        "daily_plan_count": 484,
        "plan_missing_snapshot_count": 46,
        "plan_without_stops_count": 21,
        "snapshot_linked_count": 470,
        "stop_count": 5214,
        "weekly_line_count": 480
      }
    ],
    "history_metrics": [
      {
        "actual_kg_count": 7026,
        "newest_date": "2026-07-13",
        "oldest_date": "2026-04-15",
        "predicted_kg_count": 42421,
        "row_count": 42421
      }
    ],
    "module_status": [
      {
        "name": "gf_logistics_ops",
        "state": "installed",
        "version": null
      },
      {
        "name": "gf_route_compliance",
        "state": "installed",
        "version": null
      },
      {
        "name": "gf_route_control_center",
        "state": "installed",
        "version": null
      },
      {
        "name": "gf_route_demand_snapshot",
        "state": "installed",
        "version": null
      },
      {
        "name": "gf_route_optimizer_v2",
        "state": "installed",
        "version": null
      },
      {
        "name": "kold_demand",
        "state": "installed",
        "version": null
      }
    ],
    "optimizer_configuration": [
      {
        "configured": true,
        "key": "gf_route_optimizer_external.base_url"
      },
      {
        "configured": true,
        "key": "gf_route_optimizer_external.enabled"
      },
      {
        "configured": true,
        "key": "gf_route_optimizer_external.token"
      }
    ],
    "schema_catalog": [
      {
        "column_name": "id",
        "table_name": "fleet_vehicle"
      },
      {
        "column_name": "x_capacity_kg",
        "table_name": "fleet_vehicle"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_ops_branch_config"
      },
      {
        "column_name": "id",
        "table_name": "gf_ops_branch_config"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "confidence_score",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "demand_snapshot_hash",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "demand_total_kg",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "fallback_count",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "forecast_coverage_pct",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "line_count",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "state",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "target_date",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "warning_count",
        "table_name": "gf_route_demand_snapshot"
      },
      {
        "column_name": "branch_resolution_source",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "capacity_resolution",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "date",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "demand_snapshot_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "effective_branch_config_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "external_solver_distance_source",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "external_solver_last_run_at",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "external_solver_status",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "planning_polygon_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "planning_subpolygon_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "route_overcapacity",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "state",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "vehicle_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "weekly_plan_line_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "id",
        "table_name": "gf_route_stop"
      },
      {
        "column_name": "route_plan_id",
        "table_name": "gf_route_stop"
      },
      {
        "column_name": "branch_config_id",
        "table_name": "gf_route_weekly_plan"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_weekly_plan"
      },
      {
        "column_name": "id",
        "table_name": "gf_route_weekly_plan"
      },
      {
        "column_name": "state",
        "table_name": "gf_route_weekly_plan"
      },
      {
        "column_name": "week_start_date",
        "table_name": "gf_route_weekly_plan"
      },
      {
        "column_name": "branch_config_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "date_planned",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "demand_overcapacity_kg",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "demand_snapshot_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "planned_driver_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "planned_vehicle_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "planned_warehouse_dispatch_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "weekly_plan_id",
        "table_name": "gf_route_weekly_plan_line"
      },
      {
        "column_name": "key",
        "table_name": "ir_config_parameter"
      },
      {
        "column_name": "value",
        "table_name": "ir_config_parameter"
      },
      {
        "column_name": "name",
        "table_name": "ir_module_module"
      },
      {
        "column_name": "state",
        "table_name": "ir_module_module"
      },
      {
        "column_name": "company_id",
        "table_name": "kold_demand_forecast"
      },
      {
        "column_name": "forecast_date",
        "table_name": "kold_demand_forecast"
      },
      {
        "column_name": "is_final",
        "table_name": "kold_demand_forecast"
      },
      {
        "column_name": "predicted_kg",
        "table_name": "kold_demand_forecast"
      },
      {
        "column_name": "actual_kg",
        "table_name": "kold_demand_history"
      },
      {
        "column_name": "company_id",
        "table_name": "kold_demand_history"
      },
      {
        "column_name": "forecast_date",
        "table_name": "kold_demand_history"
      },
      {
        "column_name": "predicted_kg",
        "table_name": "kold_demand_history"
      },
      {
        "column_name": "gf_route_plan_id",
        "table_name": "stock_picking"
      },
      {
        "column_name": "state",
        "table_name": "stock_picking"
      }
    ],
    "scope_validation": [
      {
        "invalid_branch_count": 0
      }
    ],
    "snapshot_metrics": [
      {
        "confidence_avg": 0.6667,
        "coverage_avg": 0.5682,
        "demand_total_kg": 1250000,
        "fallback_count": 2202,
        "hash_present_count": 88,
        "line_count": 8412,
        "newest_target_date": "2026-07-14",
        "snapshot_count": 88,
        "state": "validated",
        "warning_count": 192
      }
    ],
    "solver_evidence_metrics": [
      {
        "distance_source": "missing",
        "newest_solver_run_at": null,
        "plan_count": 424,
        "solver_evidence_count": 0,
        "solver_status": "missing"
      },
      {
        "distance_source": "external_solver",
        "newest_solver_run_at": "2026-07-13T11:20:00Z",
        "plan_count": 60,
        "solver_evidence_count": 60,
        "solver_status": "success"
      }
    ],
    "territory_load_handoff_metrics": [
      {
        "missing_territory_count": 293,
        "plan_count": 484,
        "published_count": 39,
        "published_without_load_count": 37
      }
    ],
    "weekly_plan_metrics": [
      {
        "line_count": 104,
        "missing_driver_count": 14,
        "missing_snapshot_count": 10,
        "missing_vehicle_count": 11,
        "missing_warehouse_count": 0,
        "overcapacity_line_count": 0,
        "plan_count": 9,
        "state": "draft"
      },
      {
        "line_count": 376,
        "missing_driver_count": 0,
        "missing_snapshot_count": 0,
        "missing_vehicle_count": 0,
        "missing_warehouse_count": 48,
        "overcapacity_line_count": 29,
        "plan_count": 34,
        "state": "published"
      }
    ]
  },
  "ok": true,
  "read_only": true,
  "rule_results": [
    {
      "category": "territorio",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 293,
      "name": "Plan sin territorio",
      "not_evaluable_reason": null,
      "numerator": 293,
      "observed_value": "293 de 484 (60.54%)",
      "pct": 60.54,
      "rule_code": "M2-A-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "territorio",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Territorio inválido",
      "not_evaluable_reason": "El contrato v1 del auditor no expone validez del territorio.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M2-A-02",
      "severity": "high",
      "status": "NOT_EVALUABLE"
    },
    {
      "category": "territorio",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Territorio inactivo",
      "not_evaluable_reason": "El contrato v1 del auditor no expone estado activo del territorio.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M2-A-03",
      "severity": "medium",
      "status": "NOT_EVALUABLE"
    },
    {
      "category": "solver",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 424,
      "name": "Plan sin evidencia del solver",
      "not_evaluable_reason": null,
      "numerator": 424,
      "observed_value": "424 de 484 (87.6%)",
      "pct": 87.6,
      "rule_code": "M2-B-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "solver",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Distancia por fuente de respaldo",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 484 (0.0%)",
      "pct": 0,
      "rule_code": "M2-B-02",
      "severity": "medium",
      "status": "GREEN"
    },
    {
      "category": "solver",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Ejecución del solver desactualizada",
      "not_evaluable_reason": null,
      "numerator": 1.4465896064814816,
      "observed_value": "1.45 días",
      "pct": 1.45,
      "rule_code": "M2-B-03",
      "severity": "medium",
      "status": "GREEN"
    },
    {
      "category": "vehiculo_capacidad",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 133,
      "name": "Plan sin vehículo",
      "not_evaluable_reason": null,
      "numerator": 133,
      "observed_value": "133 de 484 (27.48%)",
      "pct": 27.48,
      "rule_code": "M2-C-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "vehiculo_capacidad",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 144,
      "name": "Plan sin capacidad",
      "not_evaluable_reason": null,
      "numerator": 144,
      "observed_value": "144 de 484 (29.75%)",
      "pct": 29.75,
      "rule_code": "M2-C-02",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "vehiculo_capacidad",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 30,
      "name": "Plan diario con sobrecapacidad",
      "not_evaluable_reason": null,
      "numerator": 30,
      "observed_value": "30 de 484 (6.2%)",
      "pct": 6.2,
      "rule_code": "M2-C-03",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "vehiculo_capacidad",
      "denominator": 480,
      "granularity": "aggregate",
      "incidences": 29,
      "name": "Línea semanal con sobrecapacidad",
      "not_evaluable_reason": null,
      "numerator": 29,
      "observed_value": "29 de 480 (6.04%)",
      "pct": 6.04,
      "rule_code": "M2-C-04",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "vehiculo_capacidad",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Vehículo inactivo o fuera de compañía",
      "not_evaluable_reason": "El contrato v1 no expone estado/compañía del vehículo.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M2-C-05",
      "severity": "medium",
      "status": "NOT_EVALUABLE"
    },
    {
      "category": "carga_handoff",
      "denominator": 39,
      "granularity": "aggregate",
      "incidences": 37,
      "name": "Plan publicado sin carga",
      "not_evaluable_reason": null,
      "numerator": 37,
      "observed_value": "37 de 39 (94.87%)",
      "pct": 94.87,
      "rule_code": "M2-D-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "carga_handoff",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 46,
      "name": "Plan diario sin snapshot de demanda",
      "not_evaluable_reason": null,
      "numerator": 46,
      "observed_value": "46 de 484 (9.5%)",
      "pct": 9.5,
      "rule_code": "M2-D-02",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "carga_handoff",
      "denominator": 484,
      "granularity": "aggregate",
      "incidences": 21,
      "name": "Plan diario sin stops",
      "not_evaluable_reason": null,
      "numerator": 21,
      "observed_value": "21 de 484 (4.34%)",
      "pct": 4.34,
      "rule_code": "M2-D-03",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "carga_handoff",
      "denominator": 376,
      "granularity": "aggregate",
      "incidences": 48,
      "name": "Línea semanal publicada sin almacén",
      "not_evaluable_reason": null,
      "numerator": 48,
      "observed_value": "48 de 376 (12.77%)",
      "pct": 12.77,
      "rule_code": "M2-D-04",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "carga_handoff",
      "denominator": 480,
      "granularity": "aggregate",
      "incidences": 10,
      "name": "Línea semanal sin snapshot",
      "not_evaluable_reason": null,
      "numerator": 10,
      "observed_value": "10 de 480 (2.08%)",
      "pct": 2.08,
      "rule_code": "M2-D-05",
      "severity": "medium",
      "status": "AMBER"
    },
    {
      "category": "snapshots_forecast",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Cobertura de forecast insuficiente",
      "not_evaluable_reason": null,
      "numerator": 56.82000000000001,
      "observed_value": "56.82%",
      "pct": 56.82,
      "rule_code": "M2-E-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "snapshots_forecast",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Confianza de snapshot baja",
      "not_evaluable_reason": null,
      "numerator": 0.6667,
      "observed_value": "0.6667",
      "pct": 0.6667,
      "rule_code": "M2-E-02",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "snapshots_forecast",
      "denominator": 8412,
      "granularity": "aggregate",
      "incidences": 2202,
      "name": "Líneas de snapshot en fallback",
      "not_evaluable_reason": null,
      "numerator": 2202,
      "observed_value": "2202 de 8412 (26.18%)",
      "pct": 26.18,
      "rule_code": "M2-E-03",
      "severity": "medium",
      "status": "AMBER"
    },
    {
      "category": "snapshots_forecast",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": 192,
      "name": "Warnings de snapshot",
      "not_evaluable_reason": null,
      "numerator": 192,
      "observed_value": "192",
      "pct": null,
      "rule_code": "M2-E-04",
      "severity": "medium",
      "status": "AMBER"
    },
    {
      "category": "snapshots_forecast",
      "denominator": null,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Snapshot desactualizado",
      "not_evaluable_reason": null,
      "numerator": 0.9188118287037037,
      "observed_value": "0.92 días",
      "pct": 0.92,
      "rule_code": "M2-E-05",
      "severity": "medium",
      "status": "GREEN"
    },
    {
      "category": "resultado_real",
      "denominator": 42421,
      "granularity": "aggregate",
      "incidences": 35395,
      "name": "Cobertura de resultado real insuficiente",
      "not_evaluable_reason": null,
      "numerator": 7026,
      "observed_value": "16.56%",
      "pct": 16.56,
      "rule_code": "M2-F-01",
      "severity": "high",
      "status": "RED"
    },
    {
      "category": "resultado_real",
      "denominator": 42372,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Forecast sin marcar final",
      "not_evaluable_reason": null,
      "numerator": 41372,
      "observed_value": "97.64%",
      "pct": 97.64,
      "rule_code": "M2-F-02",
      "severity": "medium",
      "status": "GREEN"
    },
    {
      "category": "resultado_real",
      "denominator": 90,
      "granularity": "aggregate",
      "incidences": null,
      "name": "Días sin forecast en la ventana",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 90 (0.0%)",
      "pct": 0,
      "rule_code": "M2-F-03",
      "severity": "medium",
      "status": "GREEN"
    }
  ],
  "run": {
    "build_sha": "fb03840919cf5ee9cc9f939d88f0d7f5456187be",
    "duration_ms": 342,
    "environment": "dev",
    "evidence_sha256": "8dc9336cec928ca8a2fc626a5c86b7995958e6c726fe87731ed35d143d1af057",
    "executed_queries": [
      "schema_catalog",
      "module_status",
      "optimizer_configuration",
      "scope_validation",
      "forecast_metrics",
      "history_metrics",
      "snapshot_metrics",
      "weekly_plan_metrics",
      "handoff_metrics",
      "branch_resolution_metrics",
      "capacity_metrics",
      "solver_evidence_metrics",
      "territory_load_handoff_metrics"
    ],
    "finished_at": "2026-07-14T22:03:05.342000Z",
    "ingested_at": "2026-07-14T23:00:00Z",
    "manifest_sha256": "0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c",
    "rollback_confirmed": true,
    "run_id": "kold-os-m2-contract-fixture-2026-07-14",
    "scope": {
      "aggregate_all_companies": false,
      "branch_ids": [],
      "company_ids": [
        1,
        34,
        35,
        36
      ],
      "window_days": 90
    },
    "skipped_queries": [],
    "started_at": "2026-07-14T22:03:05Z",
    "status": "PASS",
    "technical_state": "PASS",
    "transaction_read_only": true,
    "write_blocked": true
  },
  "schema_version": "kold.os.m2.api/1",
  "stale": false,
  "summary": {
    "overall_status": "RED",
    "rules_fail": 13,
    "rules_not_evaluable": 3,
    "rules_pass": 5,
    "rules_warning": 3,
    "total_incidences": 39004,
    "total_rules": 24,
    "unique_records_available": false
  }
})
