// Catálogo canónico M4, proyectado de gf_kold_os_m4/lib/kold_os_m4_core.py
// en la revisión auditada del catálogo backend M4.
// Solo contiene metadata estática de reglas; nunca métricas ni evidencia de producción.
const RAW_M4_RULE_CATALOG = {
  "M4-A-01": {
    "approved_threshold": false,
    "business_assumption": "El canal es un atributo del cliente (channel_id): su ausencia impide clasificar la venta. La cobertura medida viaja en numerator/denominator, no en este texto.",
    "category": "maestro_clientes",
    "classification": "caveated",
    "confidence": "high",
    "description": "Clientes del universo comercial cuyo res.partner.channel_id está vacío HOY.",
    "entity_type": "customer",
    "evidence_fields": [
      "no_channel_count",
      "customer_count"
    ],
    "evidence_limitations": "El campo no es obligatorio por constraint: parte de los clientes sin canal pueden ser altas legítimas todavía sin clasificar.",
    "expected_rule": "Todo cliente comercial debería declarar su canal.",
    "granularity": "aggregate",
    "name": "Cliente comercial actualmente sin canal clasificado",
    "query_id": "customer_master_metrics",
    "recommended_action": "Clasificar el canal del cliente en el maestro.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "high",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada del maestro (no umbral aprobado de negocio).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-02": {
    "approved_threshold": false,
    "business_assumption": "La geo alimenta a M2 (planeación) y M4 (ejecución).",
    "category": "maestro_clientes",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Clientes sin partner_latitude.",
    "entity_type": "customer",
    "evidence_fields": [
      "no_geo_count",
      "customer_count"
    ],
    "evidence_limitations": "La geo mide geocódigo, no conducta comercial; algunos clientes de mostrador no requieren coordenada.",
    "expected_rule": "Un cliente comercial debería tener coordenadas para ruteo/planeación.",
    "granularity": "aggregate",
    "name": "Cliente comercial sin geolocalización",
    "query_id": "customer_master_metrics",
    "recommended_action": "Geocodificar el cliente.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada (no umbral aprobado).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-03": {
    "approved_threshold": false,
    "business_assumption": "País es higiene mínima del maestro.",
    "category": "maestro_clientes",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Clientes sin country_id.",
    "entity_type": "customer",
    "evidence_fields": [
      "no_country_count",
      "customer_count"
    ],
    "evidence_limitations": "Campo no obligatorio; señal de calidad de datos.",
    "expected_rule": "Higiene mínima del maestro geográfico.",
    "granularity": "aggregate",
    "name": "Cliente comercial sin país",
    "query_id": "customer_master_metrics",
    "recommended_action": "Completar país en el maestro.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "low",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada (no umbral aprobado).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-04": {
    "approved_threshold": false,
    "business_assumption": "Archivar un cliente con ventas puede ocultar una pérdida comercial.",
    "category": "maestro_clientes",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Raices comerciales con active=False que sin embargo tienen pedidos confirmados.",
    "entity_type": "customer",
    "evidence_fields": [
      "archived_with_sales_count",
      "root_count"
    ],
    "evidence_limitations": "El archivado puede ser una depuración legítima; no hay motivo estructurado obligatorio.",
    "expected_rule": "Un cliente con ventas no debería quedar archivado sin traza.",
    "granularity": "aggregate",
    "name": "Cliente archivado con historial de pedidos confirmados",
    "query_id": "customer_master_metrics",
    "recommended_action": "Revisar si el archivado es intencional o una pérdida no clasificada.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (active), sin política de archivado aprobada.",
    "universe": "Raíces comerciales (res.partner con commercial_partner_id = id) con al menos un pedido confirmado histórico en las compañías del scope, ACTIVAS y ARCHIVADAS.",
    "universe_id": "commercial_customer_roots_in_scope"
  },
  "M4-A-05": {
    "approved_threshold": false,
    "business_assumption": "El pricelist gobierna el precio; su ausencia es un riesgo comercial.",
    "category": "maestro_clientes",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "property_product_pricelist por cliente.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "GOTCHA verificado (Codex A7): property_product_pricelist es un campo company-dependent (ir.property): el mismo dominio devuelve el MISMO conteo con !=False y con =False, así que medirlo por dominio sería inventar un número. NO es imposible de evaluar: se puede con ORM with_company()/ir.property, pero eso está FUERA del alcance del auditor v1 (capability pricelist_evaluation=false).",
    "expected_rule": "Cada cliente debería tener lista de precios cuando el canal lo exija.",
    "granularity": "aggregate",
    "name": "Cobertura de lista de precios del cliente",
    "query_id": "customer_master_metrics",
    "recommended_action": "Definir la medición por réplica SQL en v1.1 (no por dominio XML-RPC).",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "property_product_pricelist es company-dependent: el dominio devuelve el mismo conteo con !=False y =False, no es medible de forma confiable."
    },
    "threshold_source": "n/a (fuera del alcance del auditor v1, no imposible).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-06": {
    "approved_threshold": false,
    "business_assumption": "RFC duplicado sugiere identidad comercial fragmentada.",
    "category": "maestro_clientes",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Grupos de VAT compartido por >1 cliente (conteo sanitizado, sin exponer el valor).",
    "entity_type": "customer",
    "evidence_fields": [
      "vat_dup_groups",
      null
    ],
    "evidence_limitations": "Matrices/sucursales pueden compartir RFC legítimamente; sin política de deduplicación aprobada.",
    "expected_rule": "Un RFC debería identificar a un solo cliente comercial.",
    "granularity": "aggregate",
    "name": "RFC (VAT) duplicado entre clientes",
    "query_id": "customer_dup_metrics",
    "recommended_action": "Fusionar o corregir identidades duplicadas.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "high",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (vat), sin regla de unicidad aprobada.",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-07": {
    "approved_threshold": false,
    "business_assumption": "Teléfono repetido puede indicar duplicado.",
    "category": "maestro_clientes",
    "classification": "exploratory",
    "confidence": "low",
    "description": "Grupos de teléfono/móvil compartido (conteo sanitizado).",
    "entity_type": "customer",
    "evidence_fields": [
      "contact_dup_groups",
      null
    ],
    "evidence_limitations": "El teléfono se comparte legítimamente (mismo dueño, varias sucursales); umbral no aprobado.",
    "expected_rule": "Un teléfono suele identificar a un cliente.",
    "granularity": "aggregate",
    "name": "Teléfono duplicado entre clientes",
    "query_id": "customer_dup_metrics",
    "recommended_action": "Revisar identidades con teléfono compartido.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "low",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Sin política aprobada.",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-A-08": {
    "approved_threshold": false,
    "business_assumption": "NINGUNA verificada. A5 DESMINTIÓ la premisa original de esta regla: en el maestro, company_id vacío significa partner COMPARTIDO entre compañías — el diseño multiempresa de Odoo, no un defecto. La cifra de cuántos lo están vive en docs/M4_EVIDENCE_STATUS.md, no aquí.",
    "category": "maestro_clientes",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Raices comerciales con company_id vacío.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "A5 probó que company_id vacío es legítimo en el maestro compartido, así que 'sin compañía' no es un incumplimiento: era una regla escrita sobre un supuesto falso. Queda NO EVALUABLE por declaración explícita (threshold manual), no por accidente: la versión anterior leía un campo fantasma (`no_company_count`) que ninguna query emite, así que salía no evaluable sin decir por qué.",
    "expected_rule": "Un cliente comercial declara su compañía, O es compartido a propósito.",
    "granularity": "aggregate",
    "name": "Cliente comercial sin compañía asignada",
    "query_id": "customer_master_metrics",
    "recommended_action": "Ninguna sin antes ratificar la política: el maestro compartido puede ser el diseño.",
    "responsible_area": "Comercial / Administración de datos maestros",
    "severity": "high",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "A5 refutó la premisa: company_id vacío en el maestro es el diseño multiempresa de Odoo, no un defecto. El auditor no mide este campo hasta que exista una política aprobada."
    },
    "threshold_source": "n/a (premisa refutada por A5; sin política aprobada).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-B-01": {
    "approved_threshold": false,
    "business_assumption": "sale.order NO tiene channel_id (verificado): el canal se lee de partner_id.channel_id, es decir del CLIENTE, no del pedido.",
    "category": "clasificacion_canal",
    "classification": "caveated",
    "confidence": "high",
    "description": "Pedidos confirmados cuyo partner_id.channel_id está vacío AL MOMENTO de la auditoría.",
    "entity_type": "order",
    "evidence_fields": [
      "no_channel_customer_count",
      "confirmed_count"
    ],
    "evidence_limitations": "CANAL ACTUAL, NO HISTÓRICO (Codex A4): channel_id refleja la clasificación de HOY del cliente, no un snapshot del momento del pedido. Un cliente reclasificado o clasificado después cambia este conteo retroactivamente ⇒ NO se puede afirmar 'el pedido se originó sin canal'. Sin snapshot histórico (capability historical_order_channel=false) esto es cobertura del maestro proyectada sobre pedidos, no un hecho del pedido.",
    "expected_rule": "Un pedido confirmado debería poder atribuirse a un canal vía su cliente.",
    "granularity": "aggregate",
    "name": "Pedido confirmado cuyo cliente actualmente no tiene canal clasificado",
    "query_id": "order_metrics",
    "recommended_action": "Clasificar el canal del cliente en el maestro.",
    "responsible_area": "Comercial / Dirección de canal",
    "severity": "high",
    "source_model": "sale.order",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura ACTUAL del canal en el maestro (no umbral aprobado).",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-B-02": {
    "approved_threshold": false,
    "business_assumption": "Un canal archivado con ventas indica clasificación obsoleta.",
    "category": "clasificacion_canal",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Pedidos confirmados de clientes cuyo canal está archivado.",
    "entity_type": "order",
    "evidence_fields": [],
    "evidence_limitations": "No agregado en v1; los 5 canales medidos están activos.",
    "expected_rule": "Un canal archivado no debería recibir ventas nuevas.",
    "granularity": "aggregate",
    "name": "Canal inactivo con pedidos confirmados recientes",
    "query_id": "order_metrics",
    "recommended_action": "Extensión v1.1: cruzar gf.sales.channel.active con ventas.",
    "responsible_area": "Comercial / Dirección de canal",
    "severity": "medium",
    "source_model": "sale.order",
    "threshold": {
      "kind": "manual",
      "reason": "Requiere join canal.active ↔ ventas; el catálogo v1 no lo agrega."
    },
    "threshold_source": "n/a (no medible en v1).",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-B-03": {
    "approved_threshold": false,
    "business_assumption": "Vender fuera del portafolio del canal diluye la estrategia.",
    "category": "clasificacion_canal",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Líneas de producto que no pertenecen al portafolio del canal.",
    "entity_type": "line",
    "evidence_fields": [],
    "evidence_limitations": "Sin portafolio-por-canal aprobado, cualquier conteo sería arbitrario.",
    "expected_rule": "Cada canal tiene un portafolio esperado.",
    "granularity": "aggregate",
    "name": "Pedido confirmado fuera del portafolio del canal",
    "query_id": "order_line_metrics",
    "recommended_action": "Requiere definición aprobada de portafolio por canal (dirección de canal).",
    "responsible_area": "Comercial / Dirección de canal",
    "severity": "medium",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "manual",
      "reason": "No existe un portafolio-por-canal aprobado contra el cual comparar."
    },
    "threshold_source": "n/a (no hay política aprobada).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-C-01": {
    "approved_threshold": false,
    "business_assumption": "Un lead sin dueño no se trabaja.",
    "category": "leads_oportunidades",
    "classification": "caveated",
    "confidence": "high",
    "description": "crm.lead sin user_id.",
    "entity_type": "lead",
    "evidence_fields": [
      "no_owner_count",
      "lead_count"
    ],
    "evidence_limitations": "Medido 0 sin owner; el pipeline está limpio a este nivel.",
    "expected_rule": "Todo lead debería tener responsable.",
    "granularity": "aggregate",
    "name": "Lead sin responsable (owner)",
    "query_id": "crm_metrics",
    "recommended_action": "Asignar owner al lead.",
    "responsible_area": "Comercial / Prospección",
    "severity": "medium",
    "source_model": "crm.lead",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada (no umbral aprobado).",
    "universe": "Registros de crm.lead de las compañías del scope.",
    "universe_id": "leads_in_scope"
  },
  "M4-C-02": {
    "approved_threshold": false,
    "business_assumption": "La etapa ordena el pipeline.",
    "category": "leads_oportunidades",
    "classification": "caveated",
    "confidence": "high",
    "description": "crm.lead sin stage_id.",
    "entity_type": "lead",
    "evidence_fields": [
      "no_stage_count",
      "lead_count"
    ],
    "evidence_limitations": "Medido 0 sin etapa.",
    "expected_rule": "Un lead debería estar en una etapa del pipeline.",
    "granularity": "aggregate",
    "name": "Lead sin etapa",
    "query_id": "crm_metrics",
    "recommended_action": "Colocar el lead en una etapa.",
    "responsible_area": "Comercial / Prospección",
    "severity": "low",
    "source_model": "crm.lead",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada.",
    "universe": "Registros de crm.lead de las compañías del scope.",
    "universe_id": "leads_in_scope"
  },
  "M4-C-03": {
    "approved_threshold": false,
    "business_assumption": "El equipo enruta la atención.",
    "category": "leads_oportunidades",
    "classification": "caveated",
    "confidence": "high",
    "description": "crm.lead sin team_id.",
    "entity_type": "lead",
    "evidence_fields": [
      "no_team_count",
      "lead_count"
    ],
    "evidence_limitations": "Medido 0 sin equipo.",
    "expected_rule": "Un lead debería pertenecer a un equipo.",
    "granularity": "aggregate",
    "name": "Lead sin equipo comercial",
    "query_id": "crm_metrics",
    "recommended_action": "Asignar equipo al lead.",
    "responsible_area": "Comercial / Prospección",
    "severity": "low",
    "source_model": "crm.lead",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada.",
    "universe": "Registros de crm.lead de las compañías del scope.",
    "universe_id": "leads_in_scope"
  },
  "M4-C-04": {
    "approved_threshold": false,
    "business_assumption": "Ganar sin pedido señala fuga entre CRM y ventas.",
    "category": "leads_oportunidades",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Leads won sin sale.order asociado.",
    "entity_type": "lead",
    "evidence_fields": [],
    "evidence_limitations": "El join CRM↔ventas no está en el contrato v1.",
    "expected_rule": "Una oportunidad ganada debería materializarse en pedido.",
    "granularity": "aggregate",
    "name": "Oportunidad ganada sin pedido vinculado",
    "query_id": "crm_metrics",
    "recommended_action": "Extensión v1.1: cruzar leads ganados con pedidos.",
    "responsible_area": "Comercial / Prospección",
    "severity": "medium",
    "source_model": "crm.lead",
    "threshold": {
      "kind": "manual",
      "reason": "Requiere join crm.lead(won) ↔ sale.order; no agregado en v1."
    },
    "threshold_source": "n/a (no medible en v1).",
    "universe": "Registros de crm.lead de las compañías del scope.",
    "universe_id": "leads_in_scope"
  },
  "M4-D-01": {
    "approved_threshold": false,
    "business_assumption": "sale.order.user_id es el ÚNICO campo de vendedor medido por este auditor.",
    "category": "pedidos_ventas",
    "classification": "caveated",
    "confidence": "high",
    "description": "Pedidos confirmados (state='sale') cuyo campo sale.order.user_id está vacío.",
    "entity_type": "order",
    "evidence_fields": [
      "no_salesperson_count",
      "confirmed_count"
    ],
    "evidence_limitations": "MIDE SOLO sale.order.user_id (Codex A3). NO evalúa res.partner.user_id, crm.team, vendedor de ruta, campos custom de empleado, POS, ecommerce ni integraciones ⇒ este número NO es 'ownership comercial total': un pedido sin user_id puede tener responsable por otra vía. Además incluye mostrador y PWA B2C, que legítimamente no tienen vendedor individual. Sin umbral de cobertura aprobado.",
    "expected_rule": "Un pedido confirmado debería declarar su vendedor en sale.order.user_id.",
    "granularity": "aggregate",
    "name": "Pedido confirmado sin vendedor asignado en sale.order.user_id",
    "query_id": "order_metrics",
    "recommended_action": "Asignar user_id, o documentar los flujos que legítimamente no lo llevan (mostrador, PWA B2C) y excluirlos del universo en v1.1.",
    "responsible_area": "Comercial / Ventas",
    "severity": "high",
    "source_model": "sale.order",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada de un ÚNICO campo (no umbral aprobado).",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-D-02": {
    "approved_threshold": false,
    "business_assumption": "customer_rank>0 es como Odoo marca a un cliente; vender a rank<=0 es vender a un contacto/proveedor.",
    "category": "pedidos_ventas",
    "classification": "caveated",
    "confidence": "high",
    "description": "Pedidos confirmados cuyo partner tiene customer_rank<=0.",
    "entity_type": "order",
    "evidence_fields": [
      "non_customer_count",
      "confirmed_count"
    ],
    "evidence_limitations": "El modelo permite la venta: no hay constraint que lo prohíba.",
    "expected_rule": "Una venta comercial debería ser a un cliente comercial (customer_rank>0).",
    "granularity": "aggregate",
    "name": "Pedido confirmado a contacto no-cliente comercial",
    "query_id": "order_metrics",
    "recommended_action": "Marcar el partner como cliente o corregir el pedido.",
    "responsible_area": "Comercial / Ventas",
    "severity": "high",
    "source_model": "sale.order",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (customer_rank), sin constraint de bloqueo.",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-D-03": {
    "approved_threshold": false,
    "business_assumption": "x_analytic_account_id es la plaza canónica (la misma que usan M2 y M4).",
    "category": "pedidos_ventas",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Pedidos confirmados sin x_analytic_account_id.",
    "entity_type": "order",
    "evidence_fields": [
      "no_analytic_count",
      "confirmed_count"
    ],
    "evidence_limitations": "Puede ser captura pendiente: el campo no es obligatorio por constraint.",
    "expected_rule": "Toda venta debería atribuirse a una plaza (analytic).",
    "granularity": "aggregate",
    "name": "Pedido confirmado sin plaza / cuenta analítica",
    "query_id": "order_metrics",
    "recommended_action": "Asignar la cuenta analítica de plaza.",
    "responsible_area": "Comercial / Ventas",
    "severity": "medium",
    "source_model": "sale.order",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Cobertura observada (no umbral aprobado).",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-D-04": {
    "approved_threshold": false,
    "business_assumption": "Una línea de producto con cantidad cero no aporta al pedido y suele ser un residuo de captura.",
    "category": "pedidos_ventas",
    "classification": "caveated",
    "confidence": "medium",
    "description": "sale.order.line de PRODUCTO (display_type vacío) de pedidos confirmados con product_uom_qty<=0.",
    "entity_type": "line",
    "evidence_fields": [
      "qty_le_zero_count",
      "product_line_count"
    ],
    "evidence_limitations": "INSPECCIÓN A6 (read-only, sanitizada) de los casos reales: TODAS son qty=0 EXACTA (ninguna negativa), con qty_delivered=0 y qty_invoiced=0 (no afectan entrega ni facturación), sobre productos consu vendibles. Odoo NO lo prohíbe: no hay constraint ni política que exija qty>0 ⇒ es una anomalía de captura sin efecto operativo, NO un incumplimiento definitivo. El universo excluye los encabezados display_type='line_section', que por definición tienen qty=0 y no son líneas de producto (la historia de esa corrección está en docs/M4_EVIDENCE_STATUS.md, no aquí).",
    "expected_rule": "Una línea de producto de un pedido confirmado debería tener cantidad > 0.",
    "granularity": "aggregate",
    "name": "Línea de pedido confirmado con cantidad <= 0",
    "query_id": "order_line_metrics",
    "recommended_action": "Revisar si son residuos de captura; depurarlas o documentar el flujo que las crea.",
    "responsible_area": "Comercial / Ventas",
    "severity": "medium",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (product_uom_qty), SIN constraint ni política aprobada de cantidad mínima.",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-D-05": {
    "approved_threshold": true,
    "business_assumption": "Precio negativo es aritméticamente inválido en una venta.",
    "category": "pedidos_ventas",
    "classification": "definitive",
    "confidence": "high",
    "description": "sale.order.line con price_unit<0.",
    "entity_type": "line",
    "evidence_fields": [
      "price_lt_zero_count",
      "product_line_count"
    ],
    "evidence_limitations": "Ninguna: aritmética dura (0 casos medidos).",
    "expected_rule": "El precio unitario de un pedido confirmado no puede ser negativo.",
    "granularity": "aggregate",
    "name": "Línea de pedido confirmado con precio unitario negativo",
    "query_id": "order_line_metrics",
    "recommended_action": "Corregir la línea.",
    "responsible_area": "Comercial / Ventas",
    "severity": "high",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Aritmética del modelo (precio de venta).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-D-06": {
    "approved_threshold": true,
    "business_assumption": "Una línea de producto sin product_id es inválida (0 casos medidos).",
    "category": "pedidos_ventas",
    "classification": "definitive",
    "confidence": "high",
    "description": "sale.order.line con display_type vacío y sin product_id.",
    "entity_type": "line",
    "evidence_fields": [
      "no_product_count",
      "product_line_count"
    ],
    "evidence_limitations": "Ninguna: el modelo distingue línea de producto (display_type vacío) de nota.",
    "expected_rule": "Una línea de producto de un pedido confirmado debe referir a un producto.",
    "granularity": "aggregate",
    "name": "Línea de pedido confirmado sin producto",
    "query_id": "order_line_metrics",
    "recommended_action": "Corregir la línea o marcarla como nota.",
    "responsible_area": "Comercial / Ventas",
    "severity": "high",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (product_id requerido en línea de producto).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-D-07": {
    "approved_threshold": false,
    "business_assumption": "Es señal comercial, no verdad de inventario.",
    "category": "pedidos_ventas",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Pedidos confirmados con delivery_status pendiente.",
    "entity_type": "order",
    "evidence_fields": [],
    "evidence_limitations": "La verdad de entrega es M5; M4 no la evalúa.",
    "expected_rule": "Observación: pedidos confirmados aún sin entrega.",
    "granularity": "aggregate",
    "name": "Pedido confirmado pendiente de entrega (señal)",
    "query_id": "order_metrics",
    "recommended_action": "La ejecución de entrega es de M4/M5; M4 solo observa la señal.",
    "responsible_area": "Comercial / Ventas",
    "severity": "low",
    "source_model": "sale.order",
    "threshold": {
      "kind": "manual",
      "reason": "La verdad de entrega/inventario pertenece a M5; aquí es solo señal cruda."
    },
    "threshold_source": "n/a (frontera M5).",
    "universe": "Pedidos confirmados (sale.order state='sale') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_orders_in_window"
  },
  "M4-D-08": {
    "approved_threshold": false,
    "business_assumption": "El volumen de cancelación es una señal de fricción comercial.",
    "category": "pedidos_ventas",
    "classification": "exploratory",
    "confidence": "low",
    "description": "Pedidos en estado cancel en la ventana.",
    "entity_type": "order",
    "evidence_fields": [],
    "evidence_limitations": "Sin umbral aprobado de cancelación aceptable. Los cancelados NO pertenecen al universo de pedidos confirmados: son poblaciones disjuntas y no se dividen entre sí.",
    "expected_rule": "Observación del volumen de cancelaciones.",
    "granularity": "aggregate",
    "name": "Pedidos cancelados (observación cruda)",
    "query_id": "order_state_metrics",
    "recommended_action": "Revisar patrones de cancelación si superan lo esperado.",
    "responsible_area": "Comercial / Ventas",
    "severity": "low",
    "source_model": "sale.order",
    "threshold": {
      "kind": "manual",
      "reason": "OBSERVACIÓN: la cancelación puede ser legítima; sin política aprobada de cancelación no es incumplimiento. Además el conteo vive en una fila agrupada por estado (order_state_metrics), no en un campo escalar: extraerlo exige una lectura por grupo que el contrato v1 no implementa."
    },
    "threshold_source": "Sin política aprobada.",
    "universe": "Pedidos CANCELADOS (sale.order state='cancel') de las compañías del scope con date_order en [window_start, window_end_exclusive).",
    "universe_id": "cancelled_orders_in_window"
  },
  "M4-E-01": {
    "approved_threshold": false,
    "business_assumption": "El descuento afecta el margen (margen total es de M7).",
    "category": "precio_descuento",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "sale.order.line con discount>0.",
    "entity_type": "line",
    "evidence_fields": [
      "discount_gt0_count",
      "product_line_count"
    ],
    "evidence_limitations": "Sin política de descuento aprobada no hay umbral: el observatorio observa, no juzga.",
    "expected_rule": "Observación del uso de descuento.",
    "granularity": "aggregate",
    "name": "Líneas con descuento aplicado",
    "query_id": "order_line_metrics",
    "recommended_action": "Ratificar una política de descuento (dirección de precios).",
    "responsible_area": "Comercial / Dirección de precios",
    "severity": "low",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Umbral NO aprobado (pendiente dirección de precios).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-E-02": {
    "approved_threshold": false,
    "business_assumption": "Un descuento alto sin autorización erosiona precio.",
    "category": "precio_descuento",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Líneas con discount>=50.",
    "entity_type": "line",
    "evidence_fields": [
      "discount_ge50_count",
      "product_line_count"
    ],
    "evidence_limitations": "El umbral 50% es un default del observatorio, NO aprobado por dirección.",
    "expected_rule": "Descuentos altos deberían tener autorización.",
    "granularity": "aggregate",
    "name": "Descuento >= 50%",
    "query_id": "order_line_metrics",
    "recommended_action": "Definir umbral y flujo de autorización de descuento.",
    "responsible_area": "Comercial / Dirección de precios",
    "severity": "medium",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Umbral NO aprobado (50% es default).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-E-03": {
    "approved_threshold": false,
    "business_assumption": "Descuento >=90% es anómalo.",
    "category": "precio_descuento",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Líneas con discount>=90.",
    "entity_type": "line",
    "evidence_fields": [
      "discount_ge90_count",
      "product_line_count"
    ],
    "evidence_limitations": "3 líneas; umbral 90% es default del observatorio, NO aprobado.",
    "expected_rule": "Un descuento casi total suele ser un error o un caso especial.",
    "granularity": "aggregate",
    "name": "Descuento >= 90%",
    "query_id": "order_line_metrics",
    "recommended_action": "Revisar caso por caso; definir umbral de bloqueo.",
    "responsible_area": "Comercial / Dirección de precios",
    "severity": "high",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Umbral NO aprobado (90% es default).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-E-04": {
    "approved_threshold": false,
    "business_assumption": "Precio cero puede ser muestra legítima o error de captura.",
    "category": "precio_descuento",
    "classification": "caveated",
    "confidence": "medium",
    "description": "Líneas con price_unit=0 (posible regalo/muestra).",
    "entity_type": "line",
    "evidence_fields": [
      "price_zero_count",
      "product_line_count"
    ],
    "evidence_limitations": "0 casos medidos; sin flujo de 'muestra' aprobado no se distingue intención.",
    "expected_rule": "Un precio cero debería ser un regalo/muestra intencional.",
    "granularity": "aggregate",
    "name": "Línea con precio unitario cero",
    "query_id": "order_line_metrics",
    "recommended_action": "Verificar que el precio cero sea deliberado.",
    "responsible_area": "Comercial / Dirección de precios",
    "severity": "medium",
    "source_model": "sale.order.line",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Modelo (price_unit), sin política de muestras aprobada.",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-F-01": {
    "approved_threshold": false,
    "business_assumption": "La inactividad comercial es una señal de riesgo de cartera.",
    "category": "recurrencia",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Clientes del universo sin ningún pedido confirmado en la ventana.",
    "entity_type": "customer",
    "evidence_fields": [
      "dormant_count",
      "customer_count"
    ],
    "evidence_limitations": "'Dormido' NO tiene definición de ventana aprobada por dirección: el corte lo fija la ventana de la corrida, no una política.",
    "expected_rule": "Un cliente comercial activo debería comprar dentro de la ventana.",
    "granularity": "aggregate",
    "name": "Clientes sin pedido confirmado en la ventana (dormidos)",
    "query_id": "recurrence_metrics",
    "recommended_action": "Definir la ventana de 'dormido' con dirección comercial.",
    "responsible_area": "Comercial / Desarrollo de clientes",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Ventana de dormido NO aprobada (180d es default).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-F-02": {
    "approved_threshold": false,
    "business_assumption": "La segunda compra mide activación real del cliente nuevo.",
    "category": "recurrencia",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Clientes creados en la ventana con exactamente 1 pedido.",
    "entity_type": "customer",
    "evidence_fields": [
      "new_without_second_count",
      "new_with_order_count"
    ],
    "evidence_limitations": "Sin objetivo aprobado de 2ª compra: qué porcentaje debería repetir es una decisión comercial que no existe todavía.",
    "expected_rule": "Un cliente nuevo debería repetir compra.",
    "granularity": "aggregate",
    "name": "Clientes nuevos sin segunda compra",
    "query_id": "recurrence_metrics",
    "recommended_action": "Definir el objetivo de segunda compra (desarrollo de clientes).",
    "responsible_area": "Comercial / Desarrollo de clientes",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "zero"
    },
    "threshold_source": "Objetivo NO aprobado.",
    "universe": "Raíces comerciales activas cuyo PRIMER pedido confirmado del historial cae dentro de [window_start, window_end_exclusive).",
    "universe_id": "new_customer_roots_first_order_in_window"
  },
  "M4-F-03": {
    "approved_threshold": false,
    "business_assumption": "La caída de recurrencia es la señal más accionable de pérdida.",
    "category": "recurrencia",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Clientes con compra en 365d pero no en los últimos 180d.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "'Perdido' NO tiene definición aprobada: sin ventana ratificada, cualquier corte (180d/365d) sería del observatorio, no del negocio.",
    "expected_rule": "Un cliente que compraba y dejó de comprar es candidato a pérdida.",
    "granularity": "aggregate",
    "name": "Candidatos a pérdida (activos 365d, no 180d)",
    "query_id": "recurrence_metrics",
    "recommended_action": "Definir 'perdido' con dirección comercial y activar reactivación (M8).",
    "responsible_area": "Comercial / Desarrollo de clientes",
    "severity": "high",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "Las ventanas 365d/180d son una definición de 'perdido' que dirección NO ha ratificado, así que el auditor v1 no emite el campo. La versión anterior declaraba leer `lost_180_365_count` —que ninguna query produce— y salía no evaluable en silencio, sin decir por qué."
    },
    "threshold_source": "Definición de pérdida NO aprobada.",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-F-04": {
    "approved_threshold": false,
    "business_assumption": "La base recurrente es el núcleo del forecast comercial.",
    "category": "recurrencia",
    "classification": "exploratory",
    "confidence": "medium",
    "description": "Clientes con >=2 pedidos confirmados en la ventana.",
    "entity_type": "customer",
    "evidence_fields": [
      "recurrent_count",
      "customer_count"
    ],
    "evidence_limitations": "Es una observación, no una falta: recurrente (>=2 pedidos) es un default del observatorio, no una definición ratificada.",
    "expected_rule": "Observación de la base recurrente.",
    "granularity": "aggregate",
    "name": "Clientes recurrentes (observación)",
    "query_id": "recurrence_metrics",
    "recommended_action": "Sostener la recurrencia; base para el forecast de M2.",
    "responsible_area": "Comercial / Desarrollo de clientes",
    "severity": "low",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "OBSERVACIÓN positiva: base recurrente. No es incumplimiento."
    },
    "threshold_source": "Observación (no umbral).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-G-01": {
    "approved_threshold": false,
    "business_assumption": "La penetración de portafolio es palanca de crecimiento.",
    "category": "portafolio",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Clientes cuyos pedidos confirmados de la ventana se concentran en 1 producto.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "El agregado producto×cliente no está en v1.",
    "expected_rule": "La concentración en 1 SKU limita el valor del cliente.",
    "granularity": "aggregate",
    "name": "Concentración: cliente compra un solo SKU",
    "query_id": "portfolio_metrics",
    "recommended_action": "Extensión v1.1: penetración de portafolio por cliente.",
    "responsible_area": "Comercial / Categoría y portafolio",
    "severity": "low",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "Requiere agregación por producto×cliente; no en el contrato v1."
    },
    "threshold_source": "n/a (no medible en v1).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-G-02": {
    "approved_threshold": false,
    "business_assumption": "La penetración por canal guía la estrategia.",
    "category": "portafolio",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Portafolio esperado del canal no comprado.",
    "entity_type": "channel",
    "evidence_fields": [],
    "evidence_limitations": "Sin portafolio-por-canal aprobado.",
    "expected_rule": "Cada canal tiene un portafolio esperado.",
    "granularity": "aggregate",
    "name": "Penetración por canal",
    "query_id": "portfolio_metrics",
    "recommended_action": "Requiere definición aprobada de portafolio por canal.",
    "responsible_area": "Comercial / Categoría y portafolio",
    "severity": "low",
    "source_model": "gf.sales.channel",
    "threshold": {
      "kind": "manual",
      "reason": "No hay portafolio-esperado-por-canal aprobado."
    },
    "threshold_source": "n/a (sin política aprobada).",
    "universe": "Líneas de PRODUCTO (display_type vacío) de los pedidos confirmados en [window_start, window_end_exclusive).",
    "universe_id": "confirmed_order_lines_in_window"
  },
  "M4-H-01": {
    "approved_threshold": false,
    "business_assumption": "M4 define segmento/motivo/oferta; M8 ejecuta (WhatsApp/email/push) — LOCK.",
    "category": "perdida_recompra",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Candidatos a pérdida sin segmento de reactivación definido.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "El segmento no está poblado en v1; M4 lo propone, no lo ejecuta.",
    "expected_rule": "Un cliente perdido elegible debería tener segmento de reactivación.",
    "granularity": "aggregate",
    "name": "Clientes elegibles a reactivación sin segmento",
    "query_id": "recurrence_metrics",
    "recommended_action": "Definir segmentos (M4); ejecutar campaña es M8 (fuera de alcance).",
    "responsible_area": "Comercial / Reactivación",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "M4 DEFINE el segmento; no hay campo de segmento poblado en v1. La EJECUCIÓN es M8 (LOCK)."
    },
    "threshold_source": "n/a (definición de segmento pendiente; ejecución = M8).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-H-02": {
    "approved_threshold": false,
    "business_assumption": "El motivo de pérdida orienta la reactivación.",
    "category": "perdida_recompra",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Clientes perdidos sin razón de pérdida.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "No hay campo de motivo de pérdida poblado/verificado.",
    "expected_rule": "Una pérdida debería registrar su motivo.",
    "granularity": "aggregate",
    "name": "Motivo de pérdida ausente",
    "query_id": "recurrence_metrics",
    "recommended_action": "Definir el campo de motivo de pérdida (producto).",
    "responsible_area": "Comercial / Reactivación",
    "severity": "low",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "No existe campo de 'motivo de pérdida' verificado en el maestro v1."
    },
    "threshold_source": "n/a (campo no existe en v1).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-I-01": {
    "approved_threshold": false,
    "business_assumption": "M4 produce la señal comercial; M2 la convierte en planeación. M4 solo observa la coherencia.",
    "category": "senal_m4_m2",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Clientes activos (comprando) que M2 no incorpora al forecast.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "El join con M2 no está en el contrato v1; M4 NUNCA escribe en M2.",
    "expected_rule": "La señal comercial de M4 debería reflejarse en la planeación de M2.",
    "granularity": "aggregate",
    "name": "Cliente activo comercialmente no reflejado en planeación",
    "query_id": "handoff_metrics",
    "recommended_action": "Observar el handoff; la incorporación es decisión de M2, no de M4.",
    "responsible_area": "Comercial ↔ Planeación (handoff)",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "Requiere join con el forecast de M2; M4 solo OBSERVA, no escribe en M2."
    },
    "threshold_source": "n/a (frontera M2; observación en v1.1).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  },
  "M4-I-02": {
    "approved_threshold": false,
    "business_assumption": "La señal de pérdida debería depurar el forecast; M4 solo observa.",
    "category": "senal_m4_m2",
    "classification": "not_evaluable",
    "confidence": "n/a",
    "description": "Clientes candidatos a pérdida que M2 sigue planeando.",
    "entity_type": "customer",
    "evidence_fields": [],
    "evidence_limitations": "El join con M2 no está en v1.",
    "expected_rule": "Un cliente perdido no debería seguir consumiendo capacidad de planeación.",
    "granularity": "aggregate",
    "name": "Cliente perdido todavía planeado",
    "query_id": "handoff_metrics",
    "recommended_action": "Observar el handoff; el ajuste es de M2.",
    "responsible_area": "Comercial ↔ Planeación (handoff)",
    "severity": "medium",
    "source_model": "res.partner",
    "threshold": {
      "kind": "manual",
      "reason": "Requiere join con la planeación de M2; observación de v1.1."
    },
    "threshold_source": "n/a (frontera M2).",
    "universe": "Raíces comerciales ACTIVAS (active = true) con al menos un pedido confirmado histórico en las compañías del scope.",
    "universe_id": "active_commercial_customer_roots_in_scope"
  }
}

export const M4_RULE_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(RAW_M4_RULE_CATALOG).map(([code, rule]) => [code, Object.freeze(rule)]),
))

export const M4_RULE_CODES = Object.freeze(Object.keys(M4_RULE_CATALOG))
