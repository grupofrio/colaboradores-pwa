// Fixture del DEMO de M5 — emitido por el CODIGO REAL del backend
// (GrupoVeniu/GrupoFrio PR #208, rama feat/kold-os-m5-inventory-flow-observability):
// kold_os_m5_audit_core (manifiesto/sanitizador/hashes) + kold_os_m5_core
// (36 reglas, catalogo UNIVERSES, contrato epistemico, product_flow_kpis),
// alimentado con AGREGADOS REALES medidos por XML-RPC read-only contra
// produccion, ventana [2026-04-16, 2026-07-15), cias 1/34/35/36.
//
// LINAJE: `measuring_commit` es el codigo que PRODUJO esta derivacion y es el
// mismo valor que `run.auditor_build_sha` del envelope (hay test). El head del
// PR avanza; el sello no se reescribe (leccion 36 de M4).
//
// ⚠ is_production_shell_run = FALSE: NO es la corrida odoo-shell de produccion
// (bloqueada: sin llave SSH + modulo sin desplegar). Los NUMEROS son reales; la
// CORRIDA FORMAL no. La UI lo declara con un banner no ambiguo.
// ⚠ JAMAS fuente productiva: solo DEV / Preview con VITE_ENABLE_M5_DEMO.

export const M5_API_FIXTURE_PROVENANCE = Object.freeze({
  kind: 'real_code_generated_measured_aggregates',
  backend_pr: 'GrupoVeniu/GrupoFrio#208',
  measuring_commit: 'e32abceae21e3b782fa976d5c20051bc500423c6',
  audited_base: '7c461e56',
  auditor_core: 'gf_kold_os_m5/lib/kold_os_m5_audit_core.py',
  backend_core: 'gf_kold_os_m5/lib/kold_os_m5_core.py',
  measurement_channel: 'xmlrpc_readonly (search_count/read_group) — cero writes, cero PII',
  business_numbers: 'REALES — produccion 2026-07-15, ventana [2026-04-16, 2026-07-15)',
  is_production_shell_run: false,
  production_shell_run_blocked_by: Object.freeze([
    'ssh_key_not_registered', 'module_not_deployed', 'production_shell_unavailable',
  ]),
  evidence_source: 'xml_rpc_read_only_measurements',
  evidence_classification: 'pre_deployment_semantic_validation',
})

export const M5_API_LATEST_FIXTURE = Object.freeze({
  "age_days": 0.0,
  "applied_scope": {
    "level": "global"
  },
  "capabilities": {
    "classifications": [
      "definitive",
      "caveated",
      "exploratory",
      "not_evaluable",
      "invalid"
    ],
    "features": {
      "actual_kg": true,
      "aggregate": true,
      "branch_dimension": false,
      "company_dimension": false,
      "consignment_model": true,
      "consignment_rules": false,
      "entity_detail": false,
      "expected_vs_actual_kg": false,
      "financial_reconciliation": false,
      "findings_pagination": true,
      "history": true,
      "load_acceptance": true,
      "load_capacity_check": false,
      "load_tracking": true,
      "location_dimension": false,
      "lot_tracking": false,
      "movement_type_dimension": false,
      "product_dimension": false,
      "product_weights": true,
      "profitability": false,
      "reconciliation": true,
      "refill_model": true,
      "refill_usage": false,
      "returns_tracking": true,
      "route_findings": false,
      "uom_dimension": false,
      "vehicle_dimension": false,
      "vehicle_inventory": false,
      "warehouse_dimension": false,
      "warehouse_stock_audit": false
    },
    "findings_max_page_size": 100,
    "granularities": [
      "aggregate"
    ],
    "optional_query_ids": [
      "consignment_metrics",
      "snapshot_metrics"
    ],
    "required_query_ids": [
      "module_status",
      "schema_catalog",
      "scope_validation",
      "product_catalog_metrics",
      "load_metrics",
      "picking_metrics",
      "outflow_metrics",
      "refill_metrics",
      "reconciliation_metrics",
      "weight_metrics"
    ],
    "stale_days": 7,
    "verdicts": [
      "incumplimiento",
      "riesgo",
      "anomalia",
      "cumple",
      "no_evaluable"
    ]
  },
  "corrected": [],
  "findings": [
    {
      "approved_threshold": false,
      "business_assumption": "Sin SKU la trazabilidad entre sistemas depende del nombre, que cambia.",
      "category": "catalogo_pesos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 23,
      "description": "Productos del catálogo operativo con default_code vacío.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "product",
      "evidence_limitations": "El campo no es obligatorio por constraint; el catálogo puede operar por id interno.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "no_sku_count",
          "product_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "product_catalog_metrics"
      },
      "expected_rule": "Un producto operativo debería tener código para trazabilidad.",
      "finding_id": "M5-A-02::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::product:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 23,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 23,
      "observed_value": "23 de 23 (100.0%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 100.0,
      "recommended_action": "Asignar default_code en el maestro de producto.",
      "responsible_area": "Operaciones / Datos maestros de producto",
      "rule_code": "M5-A-02",
      "severity": "medium",
      "source_model": "product.product",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (default_code), sin política aprobada de codificación.",
      "title": "Producto operativo sin SKU (default_code)",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "universe_id": "operational_products_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin carga registrada no hay punto de partida para cuadrar el flujo.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 369,
      "description": "Planes fuera de draft/cancel sin load_picking_ids ni load_picking_id.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "plan",
      "evidence_limitations": "Puede haber rutas legítimas sin carga (p. ej. supervisión); no hay política que exija carga para publicar.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "no_load_count",
          "published_plan_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "load_metrics"
      },
      "expected_rule": "Una ruta publicada debería tener su carga registrada en inventario.",
      "finding_id": "M5-B-01::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::plan:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 147,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 147,
      "observed_value": "147 de 369 (39.84%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 39.84,
      "recommended_action": "Registrar la carga por stock.picking vinculado al plan.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-B-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Modelo (load_picking_ids/gf_route_plan_id), sin política aprobada.",
      "title": "Plan publicado sin carga vinculada",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "universe_id": "published_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El sello marca el corte entre preparación y ejecución.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 222,
      "description": "Planes con carga vinculada y load_sealed=False.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "plan",
      "evidence_limitations": "El sello es opcional en el modelo; su omisión puede ser operación en curso.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "unsealed_loaded_count",
          "loaded_plan_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "load_metrics"
      },
      "expected_rule": "La carga debería sellarse antes de salir del almacén.",
      "finding_id": "M5-B-02::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::plan:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 19,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 19,
      "observed_value": "19 de 222 (8.56%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 8.56,
      "recommended_action": "Sellar la carga (load_sealed) al cerrar la preparación.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-B-02",
      "severity": "medium",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (load_sealed), sin política aprobada de sellado.",
      "title": "Plan con carga sin sellar",
      "universe": "Subconjunto de los planes publicados que tienen AL MENOS una carga vinculada (load_picking_ids canónico O load_picking_id legacy).",
      "universe_id": "loaded_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin vehículo no hay control de capacidad kg ni inventario de unidad.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 222,
      "description": "Planes con carga vinculada y vehicle_id vacío.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "plan",
      "evidence_limitations": "El vehículo puede asignarse después de la carga; sin política de orden.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "no_vehicle_loaded_count",
          "loaded_plan_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "load_metrics"
      },
      "expected_rule": "Una carga sin vehículo no puede validarse contra capacidad.",
      "finding_id": "M5-B-03::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::plan:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 65,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 65,
      "observed_value": "65 de 222 (29.28%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 29.28,
      "recommended_action": "Asignar vehículo al plan antes de cargar.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-B-03",
      "severity": "medium",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (vehicle_id), sin política aprobada.",
      "title": "Plan con carga sin vehículo asignado",
      "universe": "Subconjunto de los planes publicados que tienen AL MENOS una carga vinculada (load_picking_ids canónico O load_picking_id legacy).",
      "universe_id": "loaded_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Un picking abierto deja la cantidad cargada sin confirmar.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 596,
      "description": "Pickings de carga en estado distinto de done/cancel.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "picking",
      "evidence_limitations": "Puede ser operación del día en curso; la ventana incluye hoy-1.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "open_count",
          "picking_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "picking_metrics"
      },
      "expected_rule": "Una carga vinculada a plan debería confirmarse (done) o cancelarse.",
      "finding_id": "M5-B-04::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::picking:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 24,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 24,
      "observed_value": "24 de 596 (4.03%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 4.03,
      "recommended_action": "Cerrar o cancelar los pickings de carga abiertos.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-B-04",
      "severity": "medium",
      "source_model": "stock.picking",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (state), sin SLA aprobado de confirmación.",
      "title": "Picking de carga sin realizar",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "universe_id": "route_load_pickings_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La cancelación puede ser correcciones normales de operación.",
      "category": "carga",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 596,
      "description": "Pickings de carga cancelados en la ventana.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "picking",
      "evidence_limitations": "Sin política que defina cancelación aceptable, es una señal, no una falta.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "cancel_count",
          "picking_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "picking_metrics"
      },
      "expected_rule": "Observación del volumen de cancelación de cargas.",
      "finding_id": "M5-B-05::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::picking:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 21,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 21,
      "observed_value": "21 de 596 (3.52%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 3.52,
      "recommended_action": "Revisar patrones si la cancelación crece.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-B-05",
      "severity": "low",
      "source_model": "stock.picking",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "title": "Picking de carga cancelado (observación)",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "universe_id": "route_load_pickings_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El flujo de confirmación existe en el modelo y NO se usa (2 de 5,637).",
      "category": "salidas",
      "classification": "exploratory",
      "confidence": "medium",
      "denominator": 5637,
      "description": "Líneas con reception_state=pending.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "line",
      "evidence_limitations": "Sin política que exija confirmar la recepción, la ausencia masiva es una señal de adopción, no una falta individual.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "pending_reception_count",
          "line_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "outflow_metrics"
      },
      "expected_rule": "La entrega debería confirmarse en la parada (reception_state).",
      "finding_id": "M5-D-03::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::line:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 5635,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 5635,
      "observed_value": "5635 de 5637 (99.96%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 99.96,
      "recommended_action": "Definir con dirección si la confirmación de recepción es obligatoria.",
      "responsible_area": "Operaciones / Ejecución de ruta",
      "rule_code": "M5-D-03",
      "severity": "medium",
      "source_model": "gf.route.stop.line",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada de confirmación.",
      "title": "Salida sin recepción confirmada en la parada",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La merma en parada es una declaración de campo sin aprobación estructurada.",
      "category": "salidas",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 5637,
      "description": "Líneas con line_type=scrap.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "line",
      "evidence_limitations": "Sin motivo estructurado obligatorio ni política de merma aprobada.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "scrap_line_count",
          "line_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "outflow_metrics"
      },
      "expected_rule": "Observación del volumen de merma declarada en campo.",
      "finding_id": "M5-D-04::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::line:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 19,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 19,
      "observed_value": "19 de 5637 (0.34%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 0.34,
      "recommended_action": "Cruzar contra mermas de reconciliación en v1.1.",
      "responsible_area": "Operaciones / Ejecución de ruta",
      "rule_code": "M5-D-04",
      "severity": "low",
      "source_model": "gf.route.stop.line",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "title": "Salida marcada como merma en parada (observación)",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin devolución registrada, el sobrante no regresa al inventario observable.",
      "category": "devoluciones",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 178,
      "description": "Planes reconciled/closed con return_picking_id vacío.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "plan",
      "evidence_limitations": "Ninguna política exige return_picking al cierre (una minoría lo registra): la ausencia masiva es señal de proceso, no falta individual medible.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "closed_recon_no_return_count",
          "closed_recon_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "load_metrics"
      },
      "expected_rule": "Al cerrar la ruta, el remanente debería regresar por picking de devolución.",
      "finding_id": "M5-F-01::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::plan:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 165,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 165,
      "observed_value": "165 de 178 (92.7%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 92.7,
      "recommended_action": "Definir con dirección si la devolución registrada es obligatoria al cierre.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-F-01",
      "severity": "high",
      "source_model": "gf.route.plan",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Sin política aprobada de devolución al cierre.",
      "title": "Plan cerrado sin picking de devolución",
      "universe": "Planes de la ventana en estado reconciled o closed (ciclo terminado).",
      "universe_id": "closed_or_reconciled_plans_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La devolución en parada convive con la devolución del cierre; hoy no se cruzan.",
      "category": "devoluciones",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 5637,
      "description": "Líneas con line_type=return.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "line",
      "evidence_limitations": "Sin cruce implementado, solo se observa el volumen.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "return_line_count",
          "line_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "outflow_metrics"
      },
      "expected_rule": "Observación del volumen de devolución declarado en campo.",
      "finding_id": "M5-F-02::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::line:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 36,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 36,
      "observed_value": "36 de 5637 (0.64%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 0.64,
      "recommended_action": "Cruzar contra qty_returned de reconciliación en v1.1.",
      "responsible_area": "Operaciones / Almacén y despacho",
      "rule_code": "M5-F-02",
      "severity": "low",
      "source_model": "gf.route.stop.line",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "title": "Líneas de devolución en paradas (observación)",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La diferencia es EL indicador de que el flujo no cuadra.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 356,
      "description": "gf.dispatch.reconciliation con qty_difference != 0.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "reconciliation",
      "evidence_limitations": "Sin umbral aprobado de diferencia aceptable, cada caso es señal exploratoria; las cantidades suman UOM heterogéneas entre productos.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "with_difference_count",
          "recon_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "reconciliation_metrics"
      },
      "expected_rule": "Cargado − entregado − devuelto − merma debería cuadrar en cero.",
      "finding_id": "M5-G-01::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::reconciliation:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 160,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 160,
      "observed_value": "160 de 356 (44.94%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 44.94,
      "recommended_action": "Definir con dirección el umbral de diferencia aceptable.",
      "responsible_area": "Operaciones / Control de inventario",
      "rule_code": "M5-G-01",
      "severity": "high",
      "source_model": "gf.dispatch.reconciliation",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Sin umbral aprobado.",
      "title": "Reconciliación con diferencia distinta de cero",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Entregar más de lo cargado con cero refills registrados implica entradas de producto que el sistema no ve.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 356,
      "description": "Reconciliaciones con qty_difference < 0.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "reconciliation",
      "evidence_limitations": "Puede ser recarga real no registrada, captura duplicada o signo del cálculo; sin política ni inspección por registro (v1.1), es señal exploratoria.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "negative_difference_count",
          "recon_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "reconciliation_metrics"
      },
      "expected_rule": "No debería entregarse más producto del que se cargó (con 0 refills registrados).",
      "finding_id": "M5-G-02::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::reconciliation:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 92,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 92,
      "observed_value": "92 de 356 (25.84%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 25.84,
      "recommended_action": "Investigar el registro de recargas fuera del flujo observable.",
      "responsible_area": "Operaciones / Control de inventario",
      "rule_code": "M5-G-02",
      "severity": "high",
      "source_model": "gf.dispatch.reconciliation",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Sin umbral aprobado.",
      "title": "Diferencia NEGATIVA: salió más de lo cargado",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Una reconciliación abierta deja el cuadre del plan sin sellar.",
      "category": "mermas_diferencias",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 356,
      "description": "Reconciliaciones en estado draft.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "reconciliation",
      "evidence_limitations": "Puede ser operación en curso; sin SLA aprobado de cierre.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "recon_open_count",
          "recon_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "reconciliation_metrics"
      },
      "expected_rule": "La reconciliación debería cerrarse (done) al terminar el ciclo.",
      "finding_id": "M5-G-03::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::reconciliation:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 266,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 266,
      "observed_value": "266 de 356 (74.72%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 74.72,
      "recommended_action": "Cerrar las reconciliaciones pendientes.",
      "responsible_area": "Operaciones / Control de inventario",
      "rule_code": "M5-G-03",
      "severity": "medium",
      "source_model": "gf.dispatch.reconciliation",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (state), sin SLA aprobado.",
      "title": "Reconciliación sin cerrar (draft)",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La merma al cierre carece de motivo estructurado y aprobación.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 356,
      "description": "Reconciliaciones con qty_scrap > 0.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "reconciliation",
      "evidence_limitations": "Sin política de merma aprobada, es observación.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "with_scrap_count",
          "recon_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "reconciliation_metrics"
      },
      "expected_rule": "Observación del volumen de merma reconocido al cierre.",
      "finding_id": "M5-G-05::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::reconciliation:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 22,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 22,
      "observed_value": "22 de 356 (6.18%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 6.18,
      "recommended_action": "Definir motivos estructurados de merma en v1.1.",
      "responsible_area": "Operaciones / Control de inventario",
      "rule_code": "M5-G-05",
      "severity": "low",
      "source_model": "gf.dispatch.reconciliation",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "title": "Merma declarada en reconciliación (observación)",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Se entregaron 4,811.5 unidades más de las cargadas (44,418.5 vs 39,607) con CERO refills registrados: hay entradas de producto que el flujo no observa.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": null,
      "description": "Suma global qty_delivered > suma qty_loaded con 0 refills en ventana.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "aggregate_condition",
      "evidence_limitations": "1 incidencia = LA CONDICIÓN AGREGADA detectada (no un conteo de registros); las sumas mezclan UOM heterogéneas entre productos (señal direccional).",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "delivered_exceeds_loaded_flag",
          null
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "reconciliation_metrics"
      },
      "expected_rule": "En el agregado, lo entregado no puede exceder lo cargado más las recargas.",
      "finding_id": "M5-G-06::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::aggregate_condition:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 1,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 1,
      "observed_value": "1",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": null,
      "recommended_action": "Investigar la vía real de recargas y el signo del cálculo de diferencia.",
      "responsible_area": "Operaciones / Control de inventario",
      "rule_code": "M5-G-06",
      "severity": "high",
      "source_model": "gf.dispatch.reconciliation",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Identidad aritmética del flujo (sin umbral que aprobar).",
      "title": "El flujo agregado NO cuadra: entregado excede cargado",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "actual_kg alimenta demanda (M2) y rentabilidad (M7): sin él, ambos ciegan.",
      "category": "kilogramos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 7748,
      "description": "Paradas done con actual_weight_kg <= 0.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "stop",
      "evidence_limitations": "El sync de actual_kg es batch (wizard), no en línea: parte del hueco es cadencia de sincronización, no ausencia de dato de origen.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "executed_missing_actual_kg_count",
          "executed_stop_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "weight_metrics"
      },
      "expected_rule": "Toda parada ejecutada debería registrar sus kg reales.",
      "finding_id": "M5-H-01::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::stop:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 2359,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 2359,
      "observed_value": "2359 de 7748 (30.45%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 30.45,
      "recommended_action": "Sincronizar actual_kg (wizard de sync) y cerrar el hueco de captura.",
      "responsible_area": "Operaciones / Planeación y datos",
      "rule_code": "M5-H-01",
      "severity": "high",
      "source_model": "gf.route.stop",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "RED",
      "threshold_source": "Modelo (actual_weight_kg), sin SLA aprobado de sincronización.",
      "title": "Parada ejecutada sin actual_kg",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "universe_id": "executed_stops_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin capacidad no hay control de sobrecarga ni optimización honesta.",
      "category": "kilogramos",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 10,
      "description": "fleet.vehicle activo con x_capacity_kg <= 0.",
      "entity_id": null,
      "entity_reference": "AGREGADO (scope completo, contrato v1)",
      "entity_type": "vehicle",
      "evidence_limitations": "El campo no es obligatorio por constraint.",
      "evidence_reference": {
        "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
        "contract_build_sha": null,
        "evidence_classification": "pre_deployment_semantic_validation",
        "evidence_fields": [
          "vehicle_no_capacity_count",
          "vehicle_count"
        ],
        "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
        "evidence_source": "xml_rpc_read_only_measurements",
        "is_production_shell_run": false,
        "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
        "query_id": "weight_metrics"
      },
      "expected_rule": "Todo vehículo operativo declara su capacidad en kg.",
      "finding_id": "M5-H-02::2ee6492465e4628edd75525a7e4645d80a75713f90a8f46c9d0fa9f004873f41::vehicle:aggregate",
      "first_seen_at": "2026-07-15T09:00:00.400000Z",
      "granularity": "aggregate",
      "incidence_semantics": "Incidencias detectadas, NO entidades unicas ni unidades de producto.",
      "incidences": 2,
      "last_seen_at": "2026-07-15T09:00:00.400000Z",
      "lifecycle_status": "new",
      "numerator": 2,
      "observed_value": "2 de 10 (20.0%)",
      "occurrence_count": 1,
      "owner_status": "unassigned",
      "pct": 20.0,
      "recommended_action": "Capturar x_capacity_kg en la flota.",
      "responsible_area": "Operaciones / Planeación y datos",
      "rule_code": "M5-H-02",
      "severity": "medium",
      "source_model": "fleet.vehicle",
      "source_timestamp": "2026-07-15T09:00:00.400000Z",
      "status": "AMBER",
      "threshold_source": "Modelo (x_capacity_kg), sin política aprobada.",
      "title": "Vehículo activo sin capacidad kg",
      "universe": "Vehículos activos de la flota (fleet.vehicle active=true).",
      "universe_id": "active_fleet_vehicles",
      "verdict": "riesgo"
    }
  ],
  "history": {
    "latest_finished_at": "2026-07-15T09:00:00.400000Z",
    "previous_finished_at": null,
    "runs_count": 1
  },
  "kpis": {
    "active_vehicles": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "active"
      ],
      "source_model": "fleet.vehicle",
      "universe": "Vehículos activos de la flota (fleet.vehicle active=true).",
      "value": 10.0
    },
    "branch_stock_snapshots": {
      "caveat": "Corte diario POR SUCURSAL (no por unidad); cadencia no ratificada.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "create_date"
      ],
      "source_model": "gf.stock.snapshot",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "value": 57.0
    },
    "consignments_active": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "gf.consignment",
      "universe": "Consignaciones (gf.consignment) de las compañías del scope (sin ventana).",
      "value": 2.0
    },
    "executed_stops": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "gf.route.stop",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "value": 7748.0
    },
    "executed_stops_with_actual_kg": {
      "caveat": "El sync de actual_kg es batch (wizard): parte del hueco es cadencia.",
      "coverage": 69.55,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "actual_weight_kg"
      ],
      "source_model": "gf.route.stop",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "value": 5389.0
    },
    "load_pickings": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "gf_route_plan_id",
        "scheduled_date"
      ],
      "source_model": "stock.picking",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "value": 596.0
    },
    "load_pickings_cancelled": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "stock.picking",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "value": 21.0
    },
    "load_pickings_done": {
      "caveat": null,
      "coverage": 92.45,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "stock.picking",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "value": 551.0
    },
    "load_pickings_open": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "stock.picking",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "value": 24.0
    },
    "loaded_plans": {
      "caveat": null,
      "coverage": 60.16,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "load_picking_ids",
        "load_picking_id"
      ],
      "source_model": "gf.route.plan",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "value": 222.0
    },
    "operational_products": {
      "caveat": "Catálogo OPERATIVO (con movimiento), no el maestro completo.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "id"
      ],
      "source_model": "product.product",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "value": 23.0
    },
    "operational_products_without_sku": {
      "caveat": "Sin SKU la trazabilidad entre sistemas depende del nombre.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "default_code"
      ],
      "source_model": "product.product",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "value": 23.0
    },
    "operational_products_without_weight": {
      "caveat": "coverage = % de productos CON peso válido.",
      "coverage": 100.0,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "weight"
      ],
      "source_model": "product.template",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "value": 0.0
    },
    "outflow_delivery_lines": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "line_type"
      ],
      "source_model": "gf.route.stop.line",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "value": 5582.0
    },
    "outflow_lines": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "quantity",
        "line_type"
      ],
      "source_model": "gf.route.stop.line",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "value": 5637.0
    },
    "outflow_lines_pending_reception": {
      "caveat": "El flujo de confirmación de recepción existe y casi no se usa.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "reception_state"
      ],
      "source_model": "gf.route.stop.line",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "value": 5635.0
    },
    "outflow_return_lines": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "line_type"
      ],
      "source_model": "gf.route.stop.line",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "value": 36.0
    },
    "outflow_scrap_lines": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "line_type"
      ],
      "source_model": "gf.route.stop.line",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "value": 19.0
    },
    "plans_without_load": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "load_picking_ids",
        "load_picking_id"
      ],
      "source_model": "gf.route.plan",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "value": 147.0
    },
    "published_plans": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state",
        "date"
      ],
      "source_model": "gf.route.plan",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "value": 369.0
    },
    "reconciliations": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "route_plan_id"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 356.0
    },
    "reconciliations_done": {
      "caveat": null,
      "coverage": 25.28,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "state"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 90.0
    },
    "reconciliations_negative_difference": {
      "caveat": "Diferencia negativa = salió más de lo que entró al flujo observable.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_difference"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 92.0
    },
    "reconciliations_with_difference": {
      "caveat": null,
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_difference"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 160.0
    },
    "refill_requests_all_time": {
      "caveat": "Histórico completo, sin ventana.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "id"
      ],
      "source_model": "van.refill.request",
      "universe": "Solicitudes de recarga (van.refill.request) con request_date en la ventana.",
      "value": 1.0
    },
    "refill_requests_window": {
      "caveat": "El flujo existe y midió 0 en la ventana (1 en toda la historia).",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "request_date"
      ],
      "source_model": "van.refill.request",
      "universe": "Solicitudes de recarga (van.refill.request) con request_date en la ventana.",
      "value": 0.0
    },
    "units_delivered_sum": {
      "caveat": "Suma de cantidades entre productos con UOM heterogéneas: señal direccional del cuadre, NO unidades físicas comparables.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_delivered"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 44418.5
    },
    "units_difference_sum": {
      "caveat": "Suma de cantidades entre productos con UOM heterogéneas: señal direccional del cuadre, NO unidades físicas comparables.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_difference"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": -5231.0
    },
    "units_loaded_sum": {
      "caveat": "Suma de cantidades entre productos con UOM heterogéneas: señal direccional del cuadre, NO unidades físicas comparables.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_loaded"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 39607.0
    },
    "units_returned_sum": {
      "caveat": "Suma de cantidades entre productos con UOM heterogéneas: señal direccional del cuadre, NO unidades físicas comparables.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_returned"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 313.5
    },
    "units_scrap_sum": {
      "caveat": "Suma de cantidades entre productos con UOM heterogéneas: señal direccional del cuadre, NO unidades físicas comparables.",
      "coverage": null,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "qty_scrap"
      ],
      "source_model": "gf.dispatch.reconciliation",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "value": 106.0
    },
    "vehicles_with_capacity_kg": {
      "caveat": null,
      "coverage": 80.0,
      "data_as_of": "2026-07-15T09:00:00.400000Z",
      "source_fields": [
        "x_capacity_kg"
      ],
      "source_model": "fleet.vehicle",
      "universe": "Vehículos activos de la flota (fleet.vehicle active=true).",
      "value": 8.0
    }
  },
  "metrics": {
    "consignment_metrics": [
      {
        "active_count": 2,
        "consignment_count": 2
      }
    ],
    "load_metrics": [
      {
        "closed_no_recon_count": 0,
        "closed_recon_count": 178,
        "closed_recon_no_return_count": 165,
        "loaded_plan_count": 222,
        "no_load_count": 147,
        "no_vehicle_loaded_count": 65,
        "published_plan_count": 369,
        "unsealed_loaded_count": 19
      }
    ],
    "module_status": [
      {
        "name": "fleet",
        "state": "installed",
        "version": "18.0.1.0"
      },
      {
        "name": "gf_kold_os_m5",
        "state": "uninstalled",
        "version": null
      },
      {
        "name": "gf_logistics_ops",
        "state": "installed",
        "version": "18.0.1.0"
      },
      {
        "name": "gf_route_demand_snapshot",
        "state": "installed",
        "version": "18.0.1.0"
      },
      {
        "name": "os_customer_zones",
        "state": "installed",
        "version": "18.0.1.0"
      },
      {
        "name": "stock",
        "state": "installed",
        "version": "18.0.1.2"
      }
    ],
    "outflow_metrics": [
      {
        "delivery_line_count": 5582,
        "line_count": 5637,
        "no_product_count": 0,
        "pending_reception_count": 5635,
        "qty_le0_count": 0,
        "received_count": 2,
        "return_line_count": 36,
        "scrap_line_count": 19,
        "uom_mismatch_count": 0
      }
    ],
    "picking_metrics": [
      {
        "cancel_count": 21,
        "done_count": 551,
        "open_count": 24,
        "picking_count": 596
      }
    ],
    "product_catalog_metrics": [
      {
        "archived_count": 0,
        "no_sku_count": 23,
        "product_count": 23,
        "weight_le0_count": 0
      }
    ],
    "reconciliation_metrics": [
      {
        "delivered_exceeds_loaded_flag": 1,
        "negative_difference_count": 92,
        "recon_count": 356,
        "recon_done_count": 90,
        "recon_open_count": 266,
        "sum_delivered": 44418.5,
        "sum_difference": -5231.0,
        "sum_loaded": 39607.0,
        "sum_returned": 313.5,
        "sum_scrap": 106.0,
        "with_difference_count": 160,
        "with_scrap_count": 22
      }
    ],
    "refill_metrics": [
      {
        "refill_all_time_count": 1,
        "refill_count": 0,
        "refill_without_picking_count": 0
      }
    ],
    "schema_catalog": [
      {
        "column_name": "active",
        "table_name": "fleet_vehicle"
      },
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
        "table_name": "gf_consignment"
      },
      {
        "column_name": "id",
        "table_name": "gf_consignment"
      },
      {
        "column_name": "state",
        "table_name": "gf_consignment"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "id",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "qty_delivered",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "qty_difference",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "qty_loaded",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "qty_returned",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "qty_scrap",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "route_plan_id",
        "table_name": "gf_dispatch_reconciliation"
      },
      {
        "column_name": "state",
        "table_name": "gf_dispatch_reconciliation"
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
        "column_name": "id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "load_picking_id",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "load_sealed",
        "table_name": "gf_route_plan"
      },
      {
        "column_name": "return_picking_id",
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
        "column_name": "actual_weight_kg",
        "table_name": "gf_route_stop"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_stop"
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
        "column_name": "state",
        "table_name": "gf_route_stop"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "id",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "line_type",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "product_id",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "product_uom_id",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "quantity",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "reception_state",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "stop_id",
        "table_name": "gf_route_stop_line"
      },
      {
        "column_name": "company_id",
        "table_name": "gf_stock_snapshot"
      },
      {
        "column_name": "create_date",
        "table_name": "gf_stock_snapshot"
      },
      {
        "column_name": "id",
        "table_name": "gf_stock_snapshot"
      },
      {
        "column_name": "latest_version",
        "table_name": "ir_module_module"
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
        "column_name": "active",
        "table_name": "product_product"
      },
      {
        "column_name": "default_code",
        "table_name": "product_product"
      },
      {
        "column_name": "id",
        "table_name": "product_product"
      },
      {
        "column_name": "product_tmpl_id",
        "table_name": "product_product"
      },
      {
        "column_name": "id",
        "table_name": "product_template"
      },
      {
        "column_name": "uom_id",
        "table_name": "product_template"
      },
      {
        "column_name": "weight",
        "table_name": "product_template"
      },
      {
        "column_name": "company_id",
        "table_name": "stock_picking"
      },
      {
        "column_name": "gf_route_plan_id",
        "table_name": "stock_picking"
      },
      {
        "column_name": "id",
        "table_name": "stock_picking"
      },
      {
        "column_name": "scheduled_date",
        "table_name": "stock_picking"
      },
      {
        "column_name": "state",
        "table_name": "stock_picking"
      },
      {
        "column_name": "category_id",
        "table_name": "uom_uom"
      },
      {
        "column_name": "id",
        "table_name": "uom_uom"
      },
      {
        "column_name": "id",
        "table_name": "van_refill_request"
      },
      {
        "column_name": "request_date",
        "table_name": "van_refill_request"
      },
      {
        "column_name": "stock_picking_id",
        "table_name": "van_refill_request"
      }
    ],
    "scope_validation": [
      {
        "published_plan_count": 369
      }
    ],
    "snapshot_metrics": [
      {
        "snapshot_count": 57
      }
    ],
    "weight_metrics": [
      {
        "executed_missing_actual_kg_count": 2359,
        "executed_stop_count": 7748,
        "executed_with_actual_kg_count": 5389,
        "vehicle_count": 10,
        "vehicle_no_capacity_count": 2,
        "vehicle_with_capacity_count": 8
      }
    ]
  },
  "ok": true,
  "read_only": true,
  "rule_results": [
    {
      "approved_threshold": false,
      "business_assumption": "Sin peso unitario no hay kg esperados ni control de capacidad.",
      "category": "catalogo_pesos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 23,
      "evidence_limitations": "Odoo no obliga weight>0 (sin constraint): un cero puede ser captura pendiente.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Producto operativo sin peso unitario",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 23 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-A-01",
      "severity": "high",
      "status": "GREEN",
      "threshold_source": "Modelo (weight), sin política aprobada de peso obligatorio.",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "universe_id": "operational_products_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin SKU la trazabilidad entre sistemas depende del nombre, que cambia.",
      "category": "catalogo_pesos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 23,
      "evidence_limitations": "El campo no es obligatorio por constraint; el catálogo puede operar por id interno.",
      "granularity": "aggregate",
      "incidences": 23,
      "name": "Producto operativo sin SKU (default_code)",
      "not_evaluable_reason": null,
      "numerator": 23,
      "observed_value": "23 de 23 (100.0%)",
      "pct": 100.0,
      "rule_code": "M5-A-02",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (default_code), sin política aprobada de codificación.",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "universe_id": "operational_products_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Archivar un producto en movimiento rompe reportes y recompras.",
      "category": "catalogo_pesos",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 23,
      "evidence_limitations": "El archivado puede ser una depuración legítima posterior al movimiento.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Producto archivado con movimientos en la ventana",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 23 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-A-03",
      "severity": "medium",
      "status": "GREEN",
      "threshold_source": "Modelo (active), sin política de archivado aprobada.",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "universe_id": "operational_products_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Una conversión imposible invalida cantidades y kg de esa línea.",
      "category": "catalogo_pesos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 5637,
      "evidence_limitations": "El ORM tolera la escritura; la conversión falla silenciosamente después (el código de actual_kg cae a la cantidad cruda ante UOM incompatibles).",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Línea de salida con UOM de categoría incompatible",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 5637 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-A-04",
      "severity": "high",
      "status": "GREEN",
      "threshold_source": "Modelo (uom_category), sin constraint que lo prohíba.",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Un peso sin fuente no distingue báscula de estimación.",
      "category": "catalogo_pesos",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin campo de fuente por producto, cualquier medición sería inventada.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Peso manual sin fuente declarada",
      "not_evaluable_reason": "No existe campo de método/fuente de peso por PRODUCTO: la fuente solo se registra por parada (weight_source_at_snapshot) y el fallback global (gf_route_actual_kg.demand_unit_weight_kg) está deshabilitado. Evaluable en v1.1 si el maestro declara la fuente.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-A-05",
      "severity": "low",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (campo inexistente en v1).",
      "universe": "Productos (product.product) con al menos una línea de salida en paradas de la ventana — el catálogo OPERATIVO real, no el maestro completo de productos.",
      "universe_id": "operational_products_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin carga registrada no hay punto de partida para cuadrar el flujo.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 369,
      "evidence_limitations": "Puede haber rutas legítimas sin carga (p. ej. supervisión); no hay política que exija carga para publicar.",
      "granularity": "aggregate",
      "incidences": 147,
      "name": "Plan publicado sin carga vinculada",
      "not_evaluable_reason": null,
      "numerator": 147,
      "observed_value": "147 de 369 (39.84%)",
      "pct": 39.84,
      "rule_code": "M5-B-01",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Modelo (load_picking_ids/gf_route_plan_id), sin política aprobada.",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "universe_id": "published_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El sello marca el corte entre preparación y ejecución.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 222,
      "evidence_limitations": "El sello es opcional en el modelo; su omisión puede ser operación en curso.",
      "granularity": "aggregate",
      "incidences": 19,
      "name": "Plan con carga sin sellar",
      "not_evaluable_reason": null,
      "numerator": 19,
      "observed_value": "19 de 222 (8.56%)",
      "pct": 8.56,
      "rule_code": "M5-B-02",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (load_sealed), sin política aprobada de sellado.",
      "universe": "Subconjunto de los planes publicados que tienen AL MENOS una carga vinculada (load_picking_ids canónico O load_picking_id legacy).",
      "universe_id": "loaded_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin vehículo no hay control de capacidad kg ni inventario de unidad.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 222,
      "evidence_limitations": "El vehículo puede asignarse después de la carga; sin política de orden.",
      "granularity": "aggregate",
      "incidences": 65,
      "name": "Plan con carga sin vehículo asignado",
      "not_evaluable_reason": null,
      "numerator": 65,
      "observed_value": "65 de 222 (29.28%)",
      "pct": 29.28,
      "rule_code": "M5-B-03",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (vehicle_id), sin política aprobada.",
      "universe": "Subconjunto de los planes publicados que tienen AL MENOS una carga vinculada (load_picking_ids canónico O load_picking_id legacy).",
      "universe_id": "loaded_route_plans_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Un picking abierto deja la cantidad cargada sin confirmar.",
      "category": "carga",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 596,
      "evidence_limitations": "Puede ser operación del día en curso; la ventana incluye hoy-1.",
      "granularity": "aggregate",
      "incidences": 24,
      "name": "Picking de carga sin realizar",
      "not_evaluable_reason": null,
      "numerator": 24,
      "observed_value": "24 de 596 (4.03%)",
      "pct": 4.03,
      "rule_code": "M5-B-04",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (state), sin SLA aprobado de confirmación.",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "universe_id": "route_load_pickings_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La cancelación puede ser correcciones normales de operación.",
      "category": "carga",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 596,
      "evidence_limitations": "Sin política que defina cancelación aceptable, es una señal, no una falta.",
      "granularity": "aggregate",
      "incidences": 21,
      "name": "Picking de carga cancelado (observación)",
      "not_evaluable_reason": null,
      "numerator": 21,
      "observed_value": "21 de 596 (3.52%)",
      "pct": 3.52,
      "rule_code": "M5-B-05",
      "severity": "low",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "universe_id": "route_load_pickings_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Cargar sobre capacidad es un riesgo operativo y legal.",
      "category": "carga",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin kg por carga computados, cualquier verificación sería inventada.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Carga excede capacidad kg del vehículo",
      "not_evaluable_reason": "Requiere computar kg por picking (líneas × peso × conversión UOM) que el contrato v1 no implementa. Los insumos existen (weight, x_capacity_kg): es alcance v1.1, no imposibilidad.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-B-06",
      "severity": "high",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (cómputo fuera del alcance v1).",
      "universe": "Subconjunto de los planes publicados que tienen AL MENOS una carga vinculada (load_picking_ids canónico O load_picking_id legacy).",
      "universe_id": "loaded_route_plans_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin stock por unidad, 'disponible en camioneta' no es observable.",
      "category": "stock_unidad",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Auditar un modelo inexistente sería inventar datos.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Inventario por unidad (vehículo)",
      "not_evaluable_reason": "NO EXISTE modelo de inventario por unidad/vehículo en el código desplegado: el stock de la camioneta no se registra como tal. gf.stock.snapshot es el corte DIARIO POR SUCURSAL, no por unidad. capabilities.vehicle_inventory=false lo declara.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-C-01",
      "severity": "high",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (modelo inexistente).",
      "universe": "Vehículos activos de la flota (fleet.vehicle active=true).",
      "universe_id": "active_fleet_vehicles",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El snapshot es el ancla del stock inicial de cada día.",
      "category": "stock_unidad",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin cadencia aprobada no hay denominador honesto.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Cobertura de snapshots de stock de sucursal",
      "not_evaluable_reason": "La cadencia esperada (¿un snapshot por sucursal por día hábil?) no está ratificada: sin ella, 'faltan snapshots' no es medible. Se midieron 57 en la ventana como observación cruda.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-C-02",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (cadencia no ratificada).",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "universe_id": "published_route_plans_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": true,
      "business_assumption": "El ORM declara product_id required=True: el modelo lo PROHÍBE.",
      "category": "salidas",
      "classification": "definitive",
      "confidence": "high",
      "denominator": 5637,
      "evidence_limitations": "Ninguna: si aparece >0 es corrupción de datos, no criterio de negocio.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Línea de salida sin producto",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 5637 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-D-01",
      "severity": "high",
      "status": "GREEN",
      "threshold_source": "Modelo (required=True en product_id).",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Una línea en cero no mueve producto y ensucia el cuadre.",
      "category": "salidas",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 5637,
      "evidence_limitations": "Sin constraint que exija quantity>0 (lección A6 de M4: 'inválido' ≠ 'prohibido').",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Línea de salida con cantidad <= 0",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 5637 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-D-02",
      "severity": "medium",
      "status": "GREEN",
      "threshold_source": "Modelo (quantity), sin constraint ni política.",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El flujo de confirmación existe en el modelo y NO se usa (2 de 5,637).",
      "category": "salidas",
      "classification": "exploratory",
      "confidence": "medium",
      "denominator": 5637,
      "evidence_limitations": "Sin política que exija confirmar la recepción, la ausencia masiva es una señal de adopción, no una falta individual.",
      "granularity": "aggregate",
      "incidences": 5635,
      "name": "Salida sin recepción confirmada en la parada",
      "not_evaluable_reason": null,
      "numerator": 5635,
      "observed_value": "5635 de 5637 (99.96%)",
      "pct": 99.96,
      "rule_code": "M5-D-03",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada de confirmación.",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La merma en parada es una declaración de campo sin aprobación estructurada.",
      "category": "salidas",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 5637,
      "evidence_limitations": "Sin motivo estructurado obligatorio ni política de merma aprobada.",
      "granularity": "aggregate",
      "incidences": 19,
      "name": "Salida marcada como merma en parada (observación)",
      "not_evaluable_reason": null,
      "numerator": 19,
      "observed_value": "19 de 5637 (0.34%)",
      "pct": 0.34,
      "rule_code": "M5-D-04",
      "severity": "low",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Dos vías de recarga (refill vs picking directo) fragmentan la trazabilidad.",
      "category": "refill",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Con universo 0 no hay denominador para reglas de calidad del refill.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Flujo de refill sin uso operativo",
      "not_evaluable_reason": "El modelo existe con flujo completo (estados, aprobación, picking) y midió 0 solicitudes en la ventana — 1 en TODA la historia. Las recargas reales entran hoy como pickings adicionales del plan (load_picking_ids), no por este flujo. Ninguna política exige usarlo, así que su desuso no es un incumplimiento medible.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-E-01",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (flujo sin uso; vía canónica sin ratificar).",
      "universe": "Solicitudes de recarga (van.refill.request) con request_date en la ventana.",
      "universe_id": "refill_requests_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin picking el refill no toca inventario.",
      "category": "refill",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 0,
      "evidence_limitations": "Con 0 solicitudes en la ventana el denominador es cero: la regla queda no evaluable por datos, no por diseño.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Refill sin picking de almacén",
      "not_evaluable_reason": "métrica no disponible / denominador cero",
      "numerator": 0,
      "observed_value": "Métrica no disponible o denominador cero",
      "pct": null,
      "rule_code": "M5-E-02",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "Modelo (stock_picking_id), sin política aprobada.",
      "universe": "Solicitudes de recarga (van.refill.request) con request_date en la ventana.",
      "universe_id": "refill_requests_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin devolución registrada, el sobrante no regresa al inventario observable.",
      "category": "devoluciones",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 178,
      "evidence_limitations": "Ninguna política exige return_picking al cierre (una minoría lo registra): la ausencia masiva es señal de proceso, no falta individual medible.",
      "granularity": "aggregate",
      "incidences": 165,
      "name": "Plan cerrado sin picking de devolución",
      "not_evaluable_reason": null,
      "numerator": 165,
      "observed_value": "165 de 178 (92.7%)",
      "pct": 92.7,
      "rule_code": "M5-F-01",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Sin política aprobada de devolución al cierre.",
      "universe": "Planes de la ventana en estado reconciled o closed (ciclo terminado).",
      "universe_id": "closed_or_reconciled_plans_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La devolución en parada convive con la devolución del cierre; hoy no se cruzan.",
      "category": "devoluciones",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 5637,
      "evidence_limitations": "Sin cruce implementado, solo se observa el volumen.",
      "granularity": "aggregate",
      "incidences": 36,
      "name": "Líneas de devolución en paradas (observación)",
      "not_evaluable_reason": null,
      "numerator": 36,
      "observed_value": "36 de 5637 (0.64%)",
      "pct": 0.64,
      "rule_code": "M5-F-02",
      "severity": "low",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "universe": "Líneas de producto en paradas (gf.route.stop.line) cuyos planes caen en la ventana — la SALIDA de producto registrada en campo.",
      "universe_id": "outflow_stop_lines_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Una devolución tardía descuadra el día que ya se reportó.",
      "category": "devoluciones",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin el join por registro no es medible en v1.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Devolución posterior al cierre",
      "not_evaluable_reason": "Requiere comparar fechas picking vs cierre por plan (join por registro) que el contrato agregado v1 no implementa.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-F-03",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (fuera del alcance v1).",
      "universe": "Pickings de carga/recarga (stock.picking con gf_route_plan_id) de las compañías del scope con scheduled_date en la ventana.",
      "universe_id": "route_load_pickings_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La diferencia es EL indicador de que el flujo no cuadra.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 356,
      "evidence_limitations": "Sin umbral aprobado de diferencia aceptable, cada caso es señal exploratoria; las cantidades suman UOM heterogéneas entre productos.",
      "granularity": "aggregate",
      "incidences": 160,
      "name": "Reconciliación con diferencia distinta de cero",
      "not_evaluable_reason": null,
      "numerator": 160,
      "observed_value": "160 de 356 (44.94%)",
      "pct": 44.94,
      "rule_code": "M5-G-01",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Sin umbral aprobado.",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Entregar más de lo cargado con cero refills registrados implica entradas de producto que el sistema no ve.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": 356,
      "evidence_limitations": "Puede ser recarga real no registrada, captura duplicada o signo del cálculo; sin política ni inspección por registro (v1.1), es señal exploratoria.",
      "granularity": "aggregate",
      "incidences": 92,
      "name": "Diferencia NEGATIVA: salió más de lo cargado",
      "not_evaluable_reason": null,
      "numerator": 92,
      "observed_value": "92 de 356 (25.84%)",
      "pct": 25.84,
      "rule_code": "M5-G-02",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Sin umbral aprobado.",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Una reconciliación abierta deja el cuadre del plan sin sellar.",
      "category": "mermas_diferencias",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 356,
      "evidence_limitations": "Puede ser operación en curso; sin SLA aprobado de cierre.",
      "granularity": "aggregate",
      "incidences": 266,
      "name": "Reconciliación sin cerrar (draft)",
      "not_evaluable_reason": null,
      "numerator": 266,
      "observed_value": "266 de 356 (74.72%)",
      "pct": 74.72,
      "rule_code": "M5-G-03",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (state), sin SLA aprobado.",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin reconciliación no hay cuadre del plan.",
      "category": "mermas_diferencias",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 178,
      "evidence_limitations": "El flujo actual la genera al reconciliar; se vigila que siga siendo cierto.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Plan cerrado sin reconciliación",
      "not_evaluable_reason": null,
      "numerator": 0,
      "observed_value": "0 de 178 (0.0%)",
      "pct": 0.0,
      "rule_code": "M5-G-04",
      "severity": "high",
      "status": "GREEN",
      "threshold_source": "Modelo (flujo de cierre), sin política formal.",
      "universe": "Planes de la ventana en estado reconciled o closed (ciclo terminado).",
      "universe_id": "closed_or_reconciled_plans_in_window",
      "verdict": "cumple"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La merma al cierre carece de motivo estructurado y aprobación.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "low",
      "denominator": 356,
      "evidence_limitations": "Sin política de merma aprobada, es observación.",
      "granularity": "aggregate",
      "incidences": 22,
      "name": "Merma declarada en reconciliación (observación)",
      "not_evaluable_reason": null,
      "numerator": 22,
      "observed_value": "22 de 356 (6.18%)",
      "pct": 6.18,
      "rule_code": "M5-G-05",
      "severity": "low",
      "status": "AMBER",
      "threshold_source": "Sin política aprobada.",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Se entregaron 4,811.5 unidades más de las cargadas (44,418.5 vs 39,607) con CERO refills registrados: hay entradas de producto que el flujo no observa.",
      "category": "mermas_diferencias",
      "classification": "exploratory",
      "confidence": "high",
      "denominator": null,
      "evidence_limitations": "1 incidencia = LA CONDICIÓN AGREGADA detectada (no un conteo de registros); las sumas mezclan UOM heterogéneas entre productos (señal direccional).",
      "granularity": "aggregate",
      "incidences": 1,
      "name": "El flujo agregado NO cuadra: entregado excede cargado",
      "not_evaluable_reason": null,
      "numerator": 1,
      "observed_value": "1",
      "pct": null,
      "rule_code": "M5-G-06",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Identidad aritmética del flujo (sin umbral que aprobar).",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "anomalia"
    },
    {
      "approved_threshold": false,
      "business_assumption": "actual_kg alimenta demanda (M2) y rentabilidad (M7): sin él, ambos ciegan.",
      "category": "kilogramos",
      "classification": "caveated",
      "confidence": "high",
      "denominator": 7748,
      "evidence_limitations": "El sync de actual_kg es batch (wizard), no en línea: parte del hueco es cadencia de sincronización, no ausencia de dato de origen.",
      "granularity": "aggregate",
      "incidences": 2359,
      "name": "Parada ejecutada sin actual_kg",
      "not_evaluable_reason": null,
      "numerator": 2359,
      "observed_value": "2359 de 7748 (30.45%)",
      "pct": 30.45,
      "rule_code": "M5-H-01",
      "severity": "high",
      "status": "RED",
      "threshold_source": "Modelo (actual_weight_kg), sin SLA aprobado de sincronización.",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "universe_id": "executed_stops_in_window",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin capacidad no hay control de sobrecarga ni optimización honesta.",
      "category": "kilogramos",
      "classification": "caveated",
      "confidence": "medium",
      "denominator": 10,
      "evidence_limitations": "El campo no es obligatorio por constraint.",
      "granularity": "aggregate",
      "incidences": 2,
      "name": "Vehículo activo sin capacidad kg",
      "not_evaluable_reason": null,
      "numerator": 2,
      "observed_value": "2 de 10 (20.0%)",
      "pct": 20.0,
      "rule_code": "M5-H-02",
      "severity": "medium",
      "status": "AMBER",
      "threshold_source": "Modelo (x_capacity_kg), sin política aprobada.",
      "universe": "Vehículos activos de la flota (fleet.vehicle active=true).",
      "universe_id": "active_fleet_vehicles",
      "verdict": "riesgo"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El previsto vs real es la base del forecast de demanda.",
      "category": "kilogramos",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin cadencia aprobada no hay denominador honesto.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Cobertura de kg previstos (predicted_weight_kg)",
      "not_evaluable_reason": "predicted_weight_kg se calcula por sync de snapshot de demanda cuya cadencia no está ratificada: medir 'faltan previstos' sin cadencia aprobada produciría ruido (23,867 de 26,160 sin dato, la mayoría paradas futuras aún sin snapshot).",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-H-03",
      "severity": "low",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (cadencia no ratificada).",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "universe_id": "executed_stops_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La divergencia sostenida delata pesos de catálogo o capturas incorrectas.",
      "category": "kilogramos",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Comparar subconjuntos con cobertura dispar produciría conclusiones falsas.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Divergencia kg esperados vs reales",
      "not_evaluable_reason": "El campo weight_delta_kg existe por parada, pero el umbral de divergencia aceptable no está aprobado y la cobertura de ambos kg (previsto 8.8%, real 69.6% de ejecutadas) hace que cualquier agregado v1 compare subconjuntos distintos.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-H-04",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (umbral no aprobado + cobertura dispar).",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "universe_id": "executed_stops_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "La consignación es inventario fuera de casa: sin cuadre es riesgo directo.",
      "category": "consignacion",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Con 2 registros, cualquier porcentaje sería ruido estadístico.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "Reglas de saldo de consignación",
      "not_evaluable_reason": "El flujo existe (gf.consignment/line/move) con 2 registros activos: universo marginal y reglas de saldo (inicial vs movimientos) no implementadas en el contrato agregado v1.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-I-01",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (universo marginal; reglas v1.1).",
      "universe": "Consignaciones (gf.consignment) de las compañías del scope (sin ventana).",
      "universe_id": "consignments_in_scope",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "El handoff M5→M3 valida que ejecución y carga hablan del mismo producto.",
      "category": "handoffs",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Solo se observa; no se escribe ni se infiere.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "M5→M3: carga aceptada vs ejecución de ruta",
      "not_evaluable_reason": "El cruce por plan (carga aceptada visible en ejecución) requiere join por registro fuera del contrato agregado v1. M3 (#202/#71) sigue sin mergear: el handoff se diseñará contra su contrato final.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-J-01",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (fuera del alcance v1).",
      "universe": "Planes de ruta (gf.route.plan) de las compañías del scope con date en la ventana y state fuera de draft/cancel.",
      "universe_id": "published_route_plans_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Las diferencias detectadas (ver M5-G-01) son el insumo natural de M6.",
      "category": "handoffs",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Sin M6, el cruce sería contra un dominio no observado.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "M5→M6: diferencia física sin conciliación financiera",
      "not_evaluable_reason": "M6 (caja/cobranza/conciliación) NO existe todavía como módulo KOLD OS: no hay contraparte financiera observable que cruzar.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-J-02",
      "severity": "high",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (M6 no iniciado).",
      "universe": "Reconciliaciones de despacho (gf.dispatch.reconciliation) de planes de la ventana: la fuente canónica de cargado/entregado/devuelto/merma/diferencia por plan.",
      "universe_id": "route_reconciliations_in_window",
      "verdict": "no_evaluable"
    },
    {
      "approved_threshold": false,
      "business_assumption": "Sin kg reales, la rentabilidad por kg de M7 nace ciega.",
      "category": "handoffs",
      "classification": "not_evaluable",
      "confidence": "n/a",
      "denominator": null,
      "evidence_limitations": "Ver M5-H-01: misma medición, sin doble conteo.",
      "granularity": "aggregate",
      "incidences": null,
      "name": "M5→M7: kg reales disponibles para rentabilidad",
      "not_evaluable_reason": "La señal ya se mide en M5-H-01 (2,359 ejecutadas sin actual_kg, 69.55%% de cobertura): repetirla aquí duplicaría incidencias. Esta regla existe para declarar la frontera y se activará como cruce real cuando M7 exista.",
      "numerator": null,
      "observed_value": "No evaluable en el contrato v1",
      "pct": null,
      "rule_code": "M5-J-03",
      "severity": "medium",
      "status": "NOT_EVALUABLE",
      "threshold_source": "n/a (M7 no iniciado; señal en M5-H-01).",
      "universe": "Paradas EJECUTADAS (gf.route.stop state=done) de planes en la ventana.",
      "universe_id": "executed_stops_in_window",
      "verdict": "no_evaluable"
    }
  ],
  "run": {
    "auditor_build_sha": "e32abceae21e3b782fa976d5c20051bc500423c6",
    "contract_build_sha": null,
    "duration_ms": 400,
    "environment": "dev",
    "evidence_classification": "pre_deployment_semantic_validation",
    "evidence_sha256": "2b2c7bb606334f0eea6c8d8ceada089e067a69420708c209dfd5b0f82b96828c",
    "evidence_source": "xml_rpc_read_only_measurements",
    "executed_queries": [
      "module_status",
      "schema_catalog",
      "scope_validation",
      "product_catalog_metrics",
      "load_metrics",
      "picking_metrics",
      "outflow_metrics",
      "refill_metrics",
      "reconciliation_metrics",
      "weight_metrics",
      "consignment_metrics",
      "snapshot_metrics"
    ],
    "finished_at": "2026-07-15T09:00:00.400000Z",
    "ingested_at": null,
    "is_production_shell_run": false,
    "manifest_sha256": "a76f68c1457c371a5bdb51152bd53621c40d087e87c653663ae58562b6f33631",
    "production_shell_run_blocked_by": [
      "ssh_key_not_registered",
      "module_not_deployed",
      "production_shell_unavailable"
    ],
    "rollback_confirmed": true,
    "run_id": "d250b98bc285d5a57139716df365dc08c76ae108a075962807ef5dca47c36d14",
    "scope": {
      "company_ids": [
        1,
        34,
        35,
        36
      ],
      "timezone": "America/Mexico_City",
      "window_days": 90,
      "window_end_exclusive": "2026-07-15",
      "window_start": "2026-04-16"
    },
    "skipped_queries": [],
    "started_at": "2026-07-15T09:00:00Z",
    "status": "PASS",
    "technical_state": "PASS",
    "transaction_read_only": true,
    "write_blocked": true
  },
  "schema_version": "kold.os.m5.api/1",
  "stale": false,
  "summary": {
    "compliant_rule_count": 6,
    "definitive_incident_count": 0,
    "definitive_incident_rule_count": 0,
    "exploratory_signal_count": 6151,
    "exploratory_signal_rule_count": 9,
    "not_evaluable_rule_count": 13,
    "overall_status": "AMBER",
    "rules_fail": 0,
    "rules_not_evaluable": 13,
    "rules_pass": 6,
    "rules_warning": 17,
    "total_incidences": 9056,
    "total_rules": 36,
    "unique_records_available": false,
    "warning_count": 2905,
    "warning_rule_count": 8
  }
})
