// ─── Fixtures del contrato Day Control / Radar (PREP · loads via stock.picking) ─
// GENERADO desde los golden canónicos en ./contracts/ (backend PR
// GrupoVeniu/GrupoFrio#220, contratos day_control/1 y radar/1). Datos 100%
// SINTÉTICOS (BR-DEMO, ids en bandas demo, moneda de prueba XTS, coordenadas
// oceánicas). Ronda YELLOW (RED-2 Codex P2/P3): prioridades con SOLO count (dedup
// robusta por picking_id; route 5102 = 2 refills pendientes ⇒ UNA prioridad
// count=2); related_entity_ids ELIMINADO del contrato v1; timezone_source
// server-side. Autoridad de cargas = stock.picking (van.* DESCARTADO).
// tests/supervisorContractDrift.test.mjs verifica deep-equal vs golden, integridad
// sha256, conformidad de schema y sintético-por-estructura (sin PII/van.*). No
// editar a mano: regenerar desde el golden.

export const DAY_CONTROL_FIXTURE = Object.freeze({
  "ok": true,
  "contract": "gf.salesops.supervisor.day_control/1",
  "generated_at": "2026-01-15 15:05:00",
  "date": "2026-01-15",
  "timezone": "America/Mexico_City",
  "timezone_source": "system_fallback",
  "branch": {
    "branch_config_id": 2001,
    "analytic_account_id": 2101,
    "warehouse_id": 4001,
    "name": "BR-DEMO Sucursal Demo"
  },
  "tolerance": {
    "minutes": 10,
    "source": "fallback"
  },
  "counters": {
    "positions_invalid": 0,
    "positions_out_of_window": 0
  },
  "summary": {
    "routes_total": 4,
    "departed": 3,
    "departed_late": 1,
    "not_departed": 1,
    "departure_unknown": 0,
    "stops_total": 29,
    "stops_done": 11,
    "sales_day_amount": 2800.5,
    "sales_day_currency": "XTS",
    "sales_day_available": true,
    "sales_day_by_currency": [
      {
        "currency": "XTS",
        "amount": 2800.5
      }
    ],
    "incident_markers_count": 1,
    "close": {
      "open": 3,
      "closed": 0,
      "corte_done": 1,
      "liquidated": 0,
      "validated": 0,
      "unknown": 0,
      "cash_pending_amount": 750,
      "cash_pending_currency": "XTS",
      "cash_pending_by_currency": [
        {
          "currency": "XTS",
          "amount": 750
        }
      ]
    },
    "pending_refill_acceptance": 2,
    "pending_initial_acceptance": 1,
    "loads_unknown_status": 0
  },
  "routes": [
    {
      "plan_id": 5101,
      "route_name": "Ruta Demo Uno",
      "route_date": "2026-01-15",
      "state": "in_progress",
      "driver": {
        "employee_id": 1001,
        "name": "Chofer Demo Uno"
      },
      "vehicle": {
        "id": 4101,
        "name": "Unidad Demo A"
      },
      "departure": {
        "target_at": 8,
        "real_at": "2026-01-15 14:05:00",
        "deviation_minutes": 5,
        "status": "on_time",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 10,
        "done": 4,
        "pending": 6,
        "progress_pct": 40,
        "next_stop": {
          "stop_id": 6101,
          "sequence": 5,
          "name": "Cliente Demo Cinco",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 1500.5,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "open",
        "cash_pending_amount": 0,
        "cash_pending_currency": null
      },
      "position": {
        "latitude": 10.5001,
        "longitude": -35.5001,
        "captured_at": "2026-01-15 15:01:00",
        "age_seconds": 240,
        "is_moving": true,
        "source": "employee_device",
        "signal_status": "recent"
      },
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": "2026-01-15 15:01:00"
      },
      "loads": {
        "available": true,
        "pending_acceptance_count": 0,
        "items": [
          {
            "picking_id": 9101,
            "load_kind": "initial",
            "status": "accepted",
            "picking_state": "done",
            "created_at": "2026-01-15 12:40:00",
            "accepted_at": "2026-01-15 13:05:00"
          }
        ]
      }
    },
    {
      "plan_id": 5102,
      "route_name": "Ruta Demo Dos",
      "route_date": "2026-01-15",
      "state": "in_progress",
      "driver": {
        "employee_id": 1002,
        "name": "Chofer Demo Dos"
      },
      "vehicle": {
        "id": 4102,
        "name": "Unidad Demo B"
      },
      "departure": {
        "target_at": 8,
        "real_at": "2026-01-15 14:25:00",
        "deviation_minutes": 25,
        "status": "late",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 8,
        "done": 2,
        "pending": 6,
        "progress_pct": 25,
        "next_stop": {
          "stop_id": 6201,
          "sequence": 3,
          "name": "Cliente Demo Tres",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 980,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [
        {
          "incident_type_id": 7101,
          "name": "Marcador Demo Unidad",
          "type": "vehicle",
          "severity": "medium",
          "requires_follow_up": false,
          "stop_id": 6202,
          "recorded_at": "2026-01-15 14:40:00"
        }
      ],
      "close": {
        "stage": "open",
        "cash_pending_amount": 0,
        "cash_pending_currency": null
      },
      "position": {
        "latitude": 10.5102,
        "longitude": -35.5102,
        "captured_at": "2026-01-15 14:40:00",
        "age_seconds": 1500,
        "is_moving": false,
        "source": "employee_device",
        "signal_status": "delayed"
      },
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": "2026-01-15 14:40:00"
      },
      "loads": {
        "available": true,
        "pending_acceptance_count": 2,
        "items": [
          {
            "picking_id": 9202,
            "load_kind": "refill",
            "status": "pending_acceptance",
            "picking_state": "assigned",
            "created_at": "2026-01-15 13:10:00",
            "accepted_at": null
          },
          {
            "picking_id": 9201,
            "load_kind": "refill",
            "status": "pending_acceptance",
            "picking_state": "assigned",
            "created_at": "2026-01-15 13:20:00",
            "accepted_at": null
          }
        ]
      }
    },
    {
      "plan_id": 5103,
      "route_name": "Ruta Demo Tres",
      "route_date": "2026-01-15",
      "state": "published",
      "driver": {
        "employee_id": 1003,
        "name": "Chofer Demo Tres"
      },
      "vehicle": {
        "id": 4103,
        "name": "Unidad Demo C"
      },
      "departure": {
        "target_at": 8,
        "real_at": null,
        "deviation_minutes": null,
        "status": "not_departed",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 6,
        "done": 0,
        "pending": 6,
        "progress_pct": 0,
        "next_stop": {
          "stop_id": 6301,
          "sequence": 1,
          "name": "Cliente Demo Uno",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 0,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "open",
        "cash_pending_amount": 0,
        "cash_pending_currency": null
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": true,
        "pending_acceptance_count": 1,
        "items": [
          {
            "picking_id": 9301,
            "load_kind": "initial",
            "status": "pending_acceptance",
            "picking_state": "assigned",
            "created_at": "2026-01-15 12:50:00",
            "accepted_at": null
          }
        ]
      }
    },
    {
      "plan_id": 5104,
      "route_name": "Ruta Demo Cuatro",
      "route_date": "2026-01-15",
      "state": "closed",
      "driver": {
        "employee_id": 1004,
        "name": "Chofer Demo Cuatro"
      },
      "vehicle": {
        "id": 4104,
        "name": "Unidad Demo D"
      },
      "departure": {
        "target_at": 7.5,
        "real_at": "2026-01-15 13:32:00",
        "deviation_minutes": 2,
        "status": "on_time",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 5,
        "done": 5,
        "pending": 0,
        "progress_pct": 100,
        "next_stop": null
      },
      "sales": {
        "day_amount": 320,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "corte_done",
        "cash_pending_amount": 750,
        "cash_pending_currency": "XTS"
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": true,
        "pending_acceptance_count": 0,
        "items": [
          {
            "picking_id": 9401,
            "load_kind": "initial",
            "status": "accepted",
            "picking_state": "done",
            "created_at": "2026-01-15 12:35:00",
            "accepted_at": "2026-01-15 13:00:00"
          }
        ]
      }
    }
  ],
  "priorities": [
    {
      "type": "route_not_departed",
      "severity": "critical",
      "reason": "Ruta Ruta Demo Tres sin salida registrada después de la hora objetivo (+10 min de tolerancia).",
      "entity_type": "route",
      "entity_id": 5103,
      "route_id": 5103,
      "count": 1,
      "occurred_at": null,
      "data_as_of": "2026-01-15 15:05:00"
    },
    {
      "type": "closure_pending",
      "severity": "critical",
      "reason": "Ruta Ruta Demo Cuatro en etapa 'corte_done' sin validación final y con caja pendiente.",
      "entity_type": "route",
      "entity_id": 5104,
      "route_id": 5104,
      "count": 1,
      "occurred_at": null,
      "data_as_of": "2026-01-15 15:05:00"
    },
    {
      "type": "load_pending_acceptance",
      "severity": "warning",
      "reason": "2 refills pendientes de aceptación del chofer en la ruta Ruta Demo Dos.",
      "entity_type": "route",
      "entity_id": 5102,
      "route_id": 5102,
      "count": 2,
      "occurred_at": "2026-01-15 13:10:00",
      "data_as_of": "2026-01-15 15:05:00"
    },
    {
      "type": "gps_stale",
      "severity": "warning",
      "reason": "Ruta Ruta Demo Dos en curso sin señal reciente del dispositivo del responsable.",
      "entity_type": "route",
      "entity_id": 5102,
      "route_id": 5102,
      "count": 1,
      "occurred_at": "2026-01-15 14:40:00",
      "data_as_of": "2026-01-15 15:05:00"
    }
  ],
  "data_notes": {
    "times_are_server_received": true,
    "scope_authority": "gf.route.plan.effective_branch_config_id (= branch_config de la supervisora); planes con resolución ambigua/desconocida tienen NULL y quedan excluidos. Sin fallback cross-branch.",
    "sales_source": "sale.order (state in sale/done) ligadas al plan vía gf_route_plan_id; suma de sale_cash_amount + sale_credit_amount del plan, en la moneda del plan.",
    "sales_effective_date": "La venta se atribuye al DÍA DEL PLAN (fecha comercial), no a la hora de sincronización.",
    "incident_markers_note": "Marcadores de catálogo (gf.route.incident) etiquetados en paradas; NO son casos con estado abierto/cerrado. recorded_at aproxima con write_date de la parada.",
    "position_source": "Posición reportada por el dispositivo del RESPONSABLE (hr.employee.latest_*), no del vehículo; solo jornada operativa actual.",
    "tower_cash_note": "Caja desde la vista canónica gf.tower.m1.route.backlog.cash (sin recalcular fórmula). La lectura interna no depende del flag del endpoint Tower M1 (ese flag gatea su superficie HTTP).",
    "loads_source": "Autoridad de cargas = stock.picking ligado al plan (gf_route_plan_id) con gf_route_load_kind (initial|refill|manual) y aceptación gf_route_load_accepted(+_at). Flujo oficial: almacén crea (van_load/create_execute) → chofer acepta (accept-load/accept-refill) → inventario móvil solo tras aceptación. Sin productos/costos/lotes en este resumen.",
    "loads_legacy_note": "Aceptación efectiva legacy de la carga inicial (plan.load_sealed + load_picking_id) espejada de stock.picking._is_route_load_accepted_effective; su accepted_at puede ser null.",
    "return_receipt_note": "Devolución vendible y merma: futuro contrato route_return_receipt (NO implementado). Limitación PREEXISTENTE: action_close_route marca la conciliación de sistema 'done' y genera el return picking DESPUÉS ⇒ la etapa 'validated' refleja conciliación DE SISTEMA, no recepción física en almacén."
  },
  "capabilities": {
    "routes_available": true,
    "sales_day_available": true,
    "sales_consolidated": true,
    "closure_cash_available": true,
    "positions_available": true,
    "incidents_lifecycle_available": false,
    "low_execution": false,
    "loads_available": true,
    "refill_classification_available": true,
    "load_acceptance_status_available": true,
    "route_return_receipt_available": false
  },
  "rejected_params": []
})

export const RADAR_FIXTURE = Object.freeze({
  "ok": true,
  "contract": "gf.salesops.supervisor.radar/1",
  "generated_at": "2026-01-15 15:05:00",
  "date": "2026-01-15",
  "timezone": "America/Mexico_City",
  "timezone_source": "system_fallback",
  "branch": {
    "branch_config_id": 2001,
    "analytic_account_id": 2101,
    "warehouse_id": 4001,
    "name": "BR-DEMO Sucursal Demo"
  },
  "units": [
    {
      "employee_id": 1001,
      "name": "Chofer Demo Uno",
      "plan_id": 5101,
      "route_name": "Ruta Demo Uno",
      "vehicle": {
        "id": 4101,
        "name": "Unidad Demo A"
      },
      "latitude": 10.5001,
      "longitude": -35.5001,
      "captured_at": "2026-01-15 15:01:00",
      "age_seconds": 240,
      "is_moving": true,
      "signal_status": "recent",
      "position_source": "employee_device",
      "stops": {
        "planned": [
          {
            "stop_id": 6101,
            "sequence": 1,
            "name": "Cliente Demo Uno",
            "latitude": 10.501,
            "longitude": -35.501,
            "done": true
          },
          {
            "stop_id": 6102,
            "sequence": 2,
            "name": "Cliente Demo Dos",
            "latitude": 10.502,
            "longitude": -35.502,
            "done": false
          }
        ],
        "planned_total": 10,
        "done": 4,
        "pending": 6,
        "missing_coordinates": 8
      }
    },
    {
      "employee_id": 1003,
      "name": "Chofer Demo Tres",
      "plan_id": 5103,
      "route_name": "Ruta Demo Tres",
      "vehicle": {
        "id": 4103,
        "name": "Unidad Demo C"
      },
      "latitude": null,
      "longitude": null,
      "captured_at": null,
      "age_seconds": null,
      "is_moving": null,
      "signal_status": "no_signal",
      "position_source": "employee_device",
      "stops": {
        "planned": [],
        "planned_total": 6,
        "done": 0,
        "pending": 6,
        "missing_coordinates": 6
      }
    }
  ],
  "thresholds": {
    "recent_seconds": 600,
    "stale_seconds": 2700,
    "position_max_age_hours": 12,
    "note": "Política de PRESENTACIÓN inicial (no hechos del dato); configurable vía ir.config_parameter."
  },
  "counters": {
    "positions_invalid": 0,
    "positions_out_of_window": 0
  },
  "capabilities": {
    "positions_available": true,
    "planned_stops_geocoded": true,
    "history_available": false,
    "realtime": false
  },
  "data_notes": {
    "position_source": "Posición reportada por el dispositivo del RESPONSABLE (empleado), no del vehículo.",
    "not_realtime": "Las posiciones pueden tener retraso; consulta captured_at. Prohibido presentar como tiempo real.",
    "privacy": "Sin batería, velocidad, precisión detallada ni histórico; solo jornada operativa actual y sucursal autorizada.",
    "operational_window": "Posición visible solo si fue capturada el MISMO día operativo local y con edad ≤ gf_salesops.radar_position_max_age_hours (default 12 h); inválidas/fuera de ventana se excluyen y se cuentan."
  },
  "rejected_params": []
})

// Variante degradada sintética: multi-moneda + cargas/capabilities apagadas (null≠0).
export const DAY_CONTROL_FIXTURE_DEGRADED = Object.freeze({
  "ok": true,
  "contract": "gf.salesops.supervisor.day_control/1",
  "generated_at": "2026-01-15 15:05:00",
  "date": "2026-01-15",
  "timezone": "America/Mexico_City",
  "branch": {
    "branch_config_id": 2001,
    "analytic_account_id": 2101,
    "warehouse_id": 4001,
    "name": "BR-DEMO Sucursal Demo"
  },
  "tolerance": {
    "minutes": 10,
    "source": "fallback"
  },
  "counters": {
    "positions_invalid": 0,
    "positions_out_of_window": 0
  },
  "summary": {
    "routes_total": 4,
    "departed": 3,
    "departed_late": 1,
    "not_departed": 1,
    "departure_unknown": 0,
    "stops_total": 29,
    "stops_done": 11,
    "sales_day_amount": null,
    "sales_day_currency": null,
    "sales_day_available": true,
    "sales_day_by_currency": [
      {
        "currency": "XTS",
        "amount": 2480.5
      },
      {
        "currency": "XXX",
        "amount": 320
      }
    ],
    "incident_markers_count": 1,
    "close": {
      "open": 3,
      "closed": 0,
      "corte_done": 1,
      "liquidated": 0,
      "validated": 0,
      "unknown": 0,
      "cash_pending_amount": null,
      "cash_pending_currency": null,
      "cash_pending_by_currency": []
    },
    "pending_refill_acceptance": null,
    "pending_initial_acceptance": null,
    "loads_unknown_status": 0
  },
  "routes": [
    {
      "plan_id": 5101,
      "route_name": "Ruta Demo Uno",
      "route_date": "2026-01-15",
      "state": "in_progress",
      "driver": {
        "employee_id": 1001,
        "name": "Chofer Demo Uno"
      },
      "vehicle": {
        "id": 4101,
        "name": "Unidad Demo A"
      },
      "departure": {
        "target_at": 8,
        "real_at": "2026-01-15 14:05:00",
        "deviation_minutes": 5,
        "status": "on_time",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 10,
        "done": 4,
        "pending": 6,
        "progress_pct": 40,
        "next_stop": {
          "stop_id": 6101,
          "sequence": 5,
          "name": "Cliente Demo Cinco",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 1500.5,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "open",
        "cash_pending_amount": null,
        "cash_pending_currency": null
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": false,
        "pending_acceptance_count": null,
        "items": []
      }
    },
    {
      "plan_id": 5102,
      "route_name": "Ruta Demo Dos",
      "route_date": "2026-01-15",
      "state": "in_progress",
      "driver": {
        "employee_id": 1002,
        "name": "Chofer Demo Dos"
      },
      "vehicle": {
        "id": 4102,
        "name": "Unidad Demo B"
      },
      "departure": {
        "target_at": 8,
        "real_at": "2026-01-15 14:25:00",
        "deviation_minutes": 25,
        "status": "late",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 8,
        "done": 2,
        "pending": 6,
        "progress_pct": 25,
        "next_stop": {
          "stop_id": 6201,
          "sequence": 3,
          "name": "Cliente Demo Tres",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 980,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [
        {
          "incident_type_id": 7101,
          "name": "Marcador Demo Unidad",
          "type": "vehicle",
          "severity": "medium",
          "requires_follow_up": false,
          "stop_id": 6202,
          "recorded_at": "2026-01-15 14:40:00"
        }
      ],
      "close": {
        "stage": "open",
        "cash_pending_amount": null,
        "cash_pending_currency": null
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": false,
        "pending_acceptance_count": null,
        "items": []
      }
    },
    {
      "plan_id": 5103,
      "route_name": "Ruta Demo Tres",
      "route_date": "2026-01-15",
      "state": "published",
      "driver": {
        "employee_id": 1003,
        "name": "Chofer Demo Tres"
      },
      "vehicle": {
        "id": 4103,
        "name": "Unidad Demo C"
      },
      "departure": {
        "target_at": 8,
        "real_at": null,
        "deviation_minutes": null,
        "status": "not_departed",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 6,
        "done": 0,
        "pending": 6,
        "progress_pct": 0,
        "next_stop": {
          "stop_id": 6301,
          "sequence": 1,
          "name": "Cliente Demo Uno",
          "eta": null
        }
      },
      "sales": {
        "day_amount": 0,
        "currency": "XTS",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "open",
        "cash_pending_amount": null,
        "cash_pending_currency": null
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": false,
        "pending_acceptance_count": null,
        "items": []
      }
    },
    {
      "plan_id": 5104,
      "route_name": "Ruta Demo Cuatro",
      "route_date": "2026-01-15",
      "state": "closed",
      "driver": {
        "employee_id": 1004,
        "name": "Chofer Demo Cuatro"
      },
      "vehicle": {
        "id": 4104,
        "name": "Unidad Demo D"
      },
      "departure": {
        "target_at": 7.5,
        "real_at": "2026-01-15 13:32:00",
        "deviation_minutes": 2,
        "status": "on_time",
        "tolerance_minutes": 10,
        "tolerance_source": "fallback"
      },
      "stops": {
        "total": 5,
        "done": 5,
        "pending": 0,
        "progress_pct": 100,
        "next_stop": null
      },
      "sales": {
        "day_amount": 320,
        "currency": "XXX",
        "available": true
      },
      "incident_markers": [],
      "close": {
        "stage": "corte_done",
        "cash_pending_amount": null,
        "cash_pending_currency": null
      },
      "position": null,
      "data_as_of": {
        "generated_at": "2026-01-15 15:05:00",
        "position_captured_at": null
      },
      "loads": {
        "available": false,
        "pending_acceptance_count": null,
        "items": []
      }
    }
  ],
  "priorities": [
    {
      "type": "route_not_departed",
      "severity": "critical",
      "reason": "Ruta Ruta Demo Tres sin salida registrada después de la hora objetivo (+10 min de tolerancia).",
      "entity_type": "route",
      "entity_id": 5103,
      "route_id": 5103,
      "count": 1,
      "occurred_at": null,
      "data_as_of": "2026-01-15 15:05:00"
    },
    {
      "type": "closure_pending",
      "severity": "critical",
      "reason": "Ruta Ruta Demo Cuatro en etapa 'corte_done' sin validación final y con caja pendiente.",
      "entity_type": "route",
      "entity_id": 5104,
      "route_id": 5104,
      "count": 1,
      "occurred_at": null,
      "data_as_of": "2026-01-15 15:05:00"
    },
    {
      "type": "gps_stale",
      "severity": "warning",
      "reason": "Ruta Ruta Demo Dos en curso sin señal reciente del dispositivo del responsable.",
      "entity_type": "route",
      "entity_id": 5102,
      "route_id": 5102,
      "count": 1,
      "occurred_at": "2026-01-15 14:40:00",
      "data_as_of": "2026-01-15 15:05:00"
    }
  ],
  "data_notes": {
    "times_are_server_received": true,
    "scope_authority": "gf.route.plan.effective_branch_config_id (= branch_config de la supervisora); planes con resolución ambigua/desconocida tienen NULL y quedan excluidos. Sin fallback cross-branch.",
    "sales_source": "sale.order (state in sale/done) ligadas al plan vía gf_route_plan_id; suma de sale_cash_amount + sale_credit_amount del plan, en la moneda del plan.",
    "sales_effective_date": "La venta se atribuye al DÍA DEL PLAN (fecha comercial), no a la hora de sincronización.",
    "incident_markers_note": "Marcadores de catálogo (gf.route.incident) etiquetados en paradas; NO son casos con estado abierto/cerrado. recorded_at aproxima con write_date de la parada.",
    "position_source": "Posición reportada por el dispositivo del RESPONSABLE (hr.employee.latest_*), no del vehículo; solo jornada operativa actual.",
    "tower_cash_note": "Caja desde la vista canónica gf.tower.m1.route.backlog.cash (sin recalcular fórmula). La lectura interna no depende del flag del endpoint Tower M1 (ese flag gatea su superficie HTTP).",
    "loads_source": "Autoridad de cargas = stock.picking ligado al plan (gf_route_plan_id) con gf_route_load_kind (initial|refill|manual) y aceptación gf_route_load_accepted(+_at). Flujo oficial: almacén crea (van_load/create_execute) → chofer acepta (accept-load/accept-refill) → inventario móvil solo tras aceptación. Sin productos/costos/lotes en este resumen.",
    "loads_legacy_note": "Aceptación efectiva legacy de la carga inicial (plan.load_sealed + load_picking_id) espejada de stock.picking._is_route_load_accepted_effective; su accepted_at puede ser null.",
    "return_receipt_note": "Devolución vendible y merma: futuro contrato route_return_receipt (NO implementado). Limitación PREEXISTENTE: action_close_route marca la conciliación de sistema 'done' y genera el return picking DESPUÉS ⇒ la etapa 'validated' refleja conciliación DE SISTEMA, no recepción física en almacén.",
    "sales_multi_currency": "Monedas mixtas en el día: no se emite total consolidado; usar sales_day_by_currency."
  },
  "capabilities": {
    "routes_available": true,
    "sales_day_available": true,
    "sales_consolidated": false,
    "closure_cash_available": false,
    "positions_available": false,
    "incidents_lifecycle_available": false,
    "low_execution": false,
    "loads_available": false,
    "refill_classification_available": false,
    "load_acceptance_status_available": false,
    "route_return_receipt_available": false
  },
  "rejected_params": [],
  "timezone_source": "system_fallback"
})
