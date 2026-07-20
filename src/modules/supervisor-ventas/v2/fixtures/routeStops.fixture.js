// Route-stops SINTÉTICOS (gf.route.stop) para QA/demo de la superficie Clientes.
// 100% artificiales (BR-DEMO, ids en banda demo, sin PII). Keyed por plan_id de
// los golden day_control/radar (#80). Solo lo carga el demoLoader.dev.
export const ROUTE_STOPS_FIXTURE = Object.freeze({
  5101: [
    { stop_id: 6101, plan_id: 5101, sequence: 1, customer_id: 910001, name: 'Cliente Demo Uno', state: 'done', result_status: 'con_venta', sale_order_count: 1, has_checkin: true, actual_end_time: '2026-01-15 14:20:00', not_visited_reason: null, incident_count: 0, latitude: 10.501, longitude: -35.501, route_name: 'Ruta Demo Uno' },
    { stop_id: 6102, plan_id: 5101, sequence: 2, customer_id: 910002, name: 'Cliente Demo Dos', state: 'pending', result_status: null, sale_order_count: 0, has_checkin: false, actual_end_time: null, not_visited_reason: null, incident_count: 0, latitude: 10.502, longitude: -35.502, route_name: 'Ruta Demo Uno' },
    { stop_id: 6103, plan_id: 5101, sequence: 3, customer_id: 910003, name: 'Cliente Demo Tres', state: 'done', result_status: 'no_venta', sale_order_count: 0, has_checkin: true, actual_end_time: '2026-01-15 14:50:00', not_visited_reason: 'cerrado', incident_count: 0, latitude: null, longitude: null, route_name: 'Ruta Demo Uno' },
  ],
  5102: [
    { stop_id: 6201, plan_id: 5102, sequence: 1, customer_id: 910011, name: 'Cliente Demo Once', state: 'done', result_status: 'con_venta', sale_order_count: 2, has_checkin: true, actual_end_time: '2026-01-15 14:35:00', not_visited_reason: null, incident_count: 1, latitude: 10.5102, longitude: -35.5102, route_name: 'Ruta Demo Dos' },
    { stop_id: 6202, plan_id: 5102, sequence: 2, customer_id: 910012, name: 'Cliente Demo Doce', state: 'pending', result_status: null, sale_order_count: 0, has_checkin: false, actual_end_time: null, not_visited_reason: null, incident_count: 0, latitude: 10.5103, longitude: -35.5103, route_name: 'Ruta Demo Dos' },
  ],
})
