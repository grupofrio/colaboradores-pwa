// ─── KOLD OS · M2 — FIXTURE: reconstrucción sanitizada del run 2026-07-14 ────
// ⚠️ ESTO NO ES LA EVIDENCIA ORIGINAL. Es una RECONSTRUCCIÓN determinista del
// run real del auditor M2 en producción (2026-07-14), construida a partir de
// los AGREGADOS REPORTADOS. Uso: tests + modo demo (?demo=1) de la superficie.
//
// · Los números marcados [REPORTADO] reproducen exactamente las cifras del run
//   real comunicadas por dirección (293/484, 424/484, 144/484, 133/484, 30,
//   37/39, 46, 21, 48, 10, 29, 56.82%, 0.6667, 2 202, 192, 7 026/42 421,
//   42 372/92 días, 41 372 finales, 342 ms, 13/13).
// · Los campos no reportados (desgloses por estado, versiones de módulos,
//   fechas internas) son RECONSTRUCCIONES plausibles y neutras, elegidas para
//   ser consistentes con los agregados. Ver M2_FIXTURE_PROVENANCE.
// · `evidence_sha256` y `run_id_sha256` son MARCADORES SINTÉTICOS del fixture:
//   NO corresponden a la evidencia real (esa vive fuera del repo). El hash de
//   la evidencia real se cita solo como referencia en la procedencia.
// · Sin PII, sin nombres, sin credenciales: mismo sanitizador conceptual que
//   el auditor (claves sensibles prohibidas por contrato).

export const M2_FIXTURE_PROVENANCE = Object.freeze({
  kind: 'sanitized_reconstruction',
  reconstructed_from: 'agregados reportados del run real 2026-07-14 (producción)',
  real_run: Object.freeze({
    database: 'grupofrio-grupofrio-31972140',
    auditor_build_sha: 'fb03840919cf5ee9cc9f939d88f0d7f5456187be',
    manifest_sha256: '0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c',
    evidence_sha256: '317252aac2653ef0f650725a0372419ce413502ef83713949a9a720a83310435',
    duration_ms: 342,
    queries: '13/13, 0 omitidas, exit 0',
  }),
  synthetic_fields: Object.freeze([
    'run_id_sha256 (marcador del fixture)',
    'evidence_sha256 (marcador del fixture, NO el real)',
    'started_at/finished_at (aproximados al día del run)',
    'desglose por estado de weekly_plan_metrics y snapshot_metrics',
    'desglose por fuente de branch_resolution_metrics (consistente con D4-B1: 100% resuelto)',
    'filas de module_status / optimizer_configuration / schema_catalog',
    'fechas internas oldest/newest y stop_count',
  ]),
})

// El manifest_sha256 sí es el del manifiesto real: es una propiedad
// determinista del código del auditor (build fb03840), no de los datos.
export const M2_FIXTURE_RUN = Object.freeze({
  schema_version: 'kold.tower.m2.run/1',
  status: 'PASS',
  transaction_read_only: true,
  write_blocked: true,
  rollback_confirmed: true,
  environment: 'production',
  manifest_sha256: '0fb967bd06eb56c5886ba86c1009f9e5f359c5bab5df00cbc7820b2315a9204c',
  evidence_sha256: 'd12b1f4ff1d4d78065dd90b75e57961b9bcbd66c30fdffde97482df69c59b33a',
  run_id_sha256: '454068194456f5c4f04c6c270fbb6e519addd522eef60818726a73e3e4f7e791',
  build_sha: 'fb03840919cf5ee9cc9f939d88f0d7f5456187be',
  started_at: '2026-07-14T22:03:05.000Z',
  finished_at: '2026-07-14T22:03:05.342Z',
  duration_ms: 342, // [REPORTADO]
  scope: {
    aggregate_all_companies: false,
    company_ids: [1, 34, 35, 36], // [REPORTADO]
    branch_ids: [],
    window_days: 90, // [REPORTADO]
  },
  executed_queries: [
    'schema_catalog', 'module_status', 'optimizer_configuration', 'scope_validation',
    'forecast_metrics', 'history_metrics', 'snapshot_metrics', 'weekly_plan_metrics',
    'handoff_metrics', 'branch_resolution_metrics', 'capacity_metrics',
    'solver_evidence_metrics', 'territory_load_handoff_metrics',
  ], // 13/13 [REPORTADO]
  skipped_queries: [],
  findings: [], // findings del AUDITOR = queries omitidas; hubo 0 [REPORTADO]
  production_contract: {
    contract_satisfied: true,
    database_match: true,
    scope_exact: true,
  }, // 3/3 true [REPORTADO]
  metrics: {
    schema_catalog: [
      { table_name: 'gf_route_plan', column_name: 'id' },
      { table_name: 'gf_route_plan', column_name: 'state' },
      { table_name: 'gf_route_weekly_plan_line', column_name: 'id' },
      { table_name: 'gf_route_demand_snapshot', column_name: 'state' },
      { table_name: 'kold_demand_history', column_name: 'actual_kg' },
    ],
    module_status: [
      { name: 'gf_logistics_ops', state: 'installed', version: null },
      { name: 'gf_route_compliance', state: 'installed', version: null },
      { name: 'gf_route_control_center', state: 'installed', version: null },
      { name: 'gf_route_demand_snapshot', state: 'installed', version: null },
      { name: 'gf_route_optimizer_v2', state: 'installed', version: null },
      { name: 'kold_demand', state: 'installed', version: null },
    ],
    optimizer_configuration: [
      { key: 'gf_route_optimizer_external.base_url', configured: true },
      { key: 'gf_route_optimizer_external.enabled', configured: true },
      { key: 'gf_route_optimizer_external.token', configured: true },
    ],
    scope_validation: [{ invalid_branch_count: 0 }],
    forecast_metrics: [{
      row_count: 42372, // [REPORTADO]
      oldest_date: '2026-04-16',
      newest_date: '2026-07-16',
      final_count: 41372, // [REPORTADO]
      positive_kg_count: 41892,
      covered_days: 92, // [REPORTADO]
    }],
    history_metrics: [{
      row_count: 42421, // [REPORTADO]
      oldest_date: '2026-04-15',
      newest_date: '2026-07-13',
      actual_kg_count: 7026, // [REPORTADO] → 16.56%
      predicted_kg_count: 42421,
    }],
    snapshot_metrics: [{
      state: 'validated',
      snapshot_count: 88,
      line_count: 8412,
      demand_total_kg: 1250000.0,
      confidence_avg: 0.6667, // [REPORTADO]
      coverage_avg: 0.5682, // [REPORTADO] 56.82%
      fallback_count: 2202, // [REPORTADO]
      warning_count: 192, // [REPORTADO]
      hash_present_count: 88,
      newest_target_date: '2026-07-14',
    }],
    weekly_plan_metrics: [
      {
        state: 'draft',
        plan_count: 9,
        line_count: 104,
        missing_driver_count: 14,
        missing_vehicle_count: 11,
        missing_warehouse_count: 0,
        missing_snapshot_count: 10, // [REPORTADO] 10 líneas sin snapshot
        overcapacity_line_count: 0,
      },
      {
        state: 'published',
        plan_count: 34,
        line_count: 376,
        missing_driver_count: 0,
        missing_vehicle_count: 0,
        missing_warehouse_count: 48, // [REPORTADO] 48 publicadas sin almacén
        missing_snapshot_count: 0,
        overcapacity_line_count: 29, // [REPORTADO] 29 con sobrecapacidad
      },
    ],
    handoff_metrics: [{
      weekly_line_count: 480,
      snapshot_linked_count: 470,
      daily_plan_count: 484,
      stop_count: 5214,
      plan_missing_snapshot_count: 46, // [REPORTADO]
      plan_without_stops_count: 21, // [REPORTADO]
    }],
    branch_resolution_metrics: [
      { resolution_source: 'sale_warehouse', plan_count: 420, unresolved_count: 0 },
      { resolution_source: 'company_default', plan_count: 64, unresolved_count: 0 },
    ],
    capacity_metrics: [{
      plan_count: 484, // [REPORTADO] universo de planes
      missing_vehicle_count: 133, // [REPORTADO] 27.48%
      missing_capacity_count: 144, // [REPORTADO] 29.75%
      overcapacity_count: 30, // [REPORTADO]
      split_count: 0,
      reload_count: 0,
    }],
    solver_evidence_metrics: [
      {
        solver_status: 'missing',
        distance_source: 'missing',
        plan_count: 424, // [REPORTADO] 87.60% sin evidencia
        newest_solver_run_at: null,
        solver_evidence_count: 0,
      },
      {
        solver_status: 'success',
        distance_source: 'external_solver',
        plan_count: 60,
        newest_solver_run_at: '2026-07-13T11:20:00Z',
        solver_evidence_count: 60,
      },
    ],
    territory_load_handoff_metrics: [{
      plan_count: 484, // [REPORTADO]
      missing_territory_count: 293, // [REPORTADO] 60.54%
      published_count: 39, // [REPORTADO]
      published_without_load_count: 37, // [REPORTADO] 94.87%
    }],
  },
})
