// ─── Registro de Módulos PWA — FUENTE CANÓNICA ÚNICA ─────────────────────────
// Define qué módulos existen, qué roles los ven, su estado y su metadata de
// navegación. Es la ÚNICA fuente para: (1) tarjetas de "Mis módulos",
// (2) navegación inferior móvil, (3) navegación persistente/desktop, (4) "Más".
//
// roles: ['*']          → visible para todos
// roles: ['jefe_ruta']  → solo ese rol
// status: 'live'        → funcional · 'pending' → placeholder
//
// Metadata de navegación (opcional, con defaults sanos):
//   shortLabel     → etiqueta corta para barras de navegación (default: label)
//   navPriority    → orden en navegación (menor = más prioritario; default: 100)
//   showOnHome     → aparece como tarjeta en el home (default: true)
//   showInNav      → aparece en la navegación global (default: true)
//
// Tower NO está en este catálogo a propósito (se agrega en un PR futuro con
// roles: ['admin_plataforma','supervisor_ventas']). Ver src/lib/navModel.js.

export const MODULES = [

  // ── Universales — todos los colaboradores ───────────────────────────────
  {
    id:     'kpis',
    label:  'Mis KPIs',
    shortLabel: 'KPIs',
    route:  '/kpis',
    tone:   'blue',
    roles:  ['*'],
    status: 'live',
    icon:   'kpis',
    navPriority: 30,
  },
  {
    id:     'encuestas',
    label:  'Encuestas',
    shortLabel: 'Encuestas',
    route:  '/surveys',
    tone:   'blueSoft',
    roles:  ['*'],
    status: 'live',
    icon:   'encuestas',
    badge:  null, // se carga dinámico desde API
    navPriority: 40,
  },
  {
    id:     'logros',
    label:  'Premios',
    shortLabel: 'Premios',
    route:  '/badges',
    tone:   'steel',
    roles:  ['*'],
    status: 'live',
    icon:   'logros',
    navPriority: 50,
  },

  // ── Producción — Fabricación de Congelados (company 35) ─────────────────
  {
    id:     'registro_produccion',
    label:  'Registro de Turno',
    shortLabel: 'Turno',
    route:  '/produccion',
    tone:   'blueDeep',
    roles:  ['operador_barra', 'operador_rolito', 'auxiliar_produccion'],
    roleContextRoles: ['operador_barra', 'operador_rolito', 'auxiliar_produccion'],
    status: 'live',
    icon:   'produccion',
    navPriority: 10,
  },
  {
    id:     'supervision_produccion',
    label:  'Supervisión',
    shortLabel: 'Superv.',
    route:  '/supervision',
    tone:   'blue',
    roles:  ['supervisor_produccion'],
    status: 'live',
    icon:   'supervision',
    navPriority: 10,
  },
  // Brief de PLANTA — misma mecánica que el brief de ventas (mismo componente,
  // mismo candado en el endpoint), otra variante del catálogo. `roles` debe
  // coincidir con briefCatalog.viewerRoles (hay test). direccion_general ve la
  // entrada porque dirección revisa el piloto; el candado del endpoint es el
  // que autoriza el dato. Ver src/modules/brief/briefCatalog.js.
  {
    id:     'brief_produccion',
    label:  'Mi Brief de planta',
    shortLabel: 'Brief',
    route:  '/brief-produccion',
    tone:   'blue',
    roles:  ['supervisor_produccion', 'direccion_general'],
    status: 'live',
    icon:   'kpis',
    // Mismo 16 que el brief de ventas: entra después de las superficies
    // operativas del rol y no las desplaza de la barra móvil.
    navPriority: 16,
  },
  {
    id:     'almacen_pt',
    label:  'Almacén PT',
    shortLabel: 'Almacén',
    route:  '/almacen-pt',
    tone:   'steel',
    roles:  ['almacenista_pt'],
    status: 'live',
    icon:   'almacen',
    navPriority: 10,
  },
  {
    id:     'koldcup',
    label:  'KOLDCUP',
    shortLabel: 'KOLDCUP',
    route:  '/koldcup',
    tone:   'blue',
    roles:  ['operador_koldcup'],
    status: 'live',
    icon:   'produccion',
    navPriority: 10,
  },

  // ── Logística / Ventas — GLACIEM (34) y Vía Ágil (36) ──────────────────
  {
    id:     'cierre_ruta',
    label:  'Mi Ruta',
    shortLabel: 'Ruta',
    route:  '/ruta',
    tone:   'blue',
    roles:  ['jefe_ruta', 'auxiliar_ruta'],
    status: 'live',
    icon:   'ruta',
    navPriority: 10,
  },
  {
    id:     'almacen_entregas',
    label:  'Entregas',
    shortLabel: 'Entregas',
    route:  '/entregas',
    tone:   'blueSoft',
    roles:  ['almacenista_entregas'],
    status: 'live',
    icon:   'entregas',
    navPriority: 10,
  },
  {
    id:     'supervisor_ventas',
    label:  'Equipo',
    shortLabel: 'Equipo',
    route:  '/equipo',
    tone:   'blueSoft',
    roles:  ['supervisor_ventas'],
    status: 'live',
    icon:   'equipo',
    navPriority: 10,
  },
  // Brief de VENTAS — dashboard operativo de rutas y ventas servido por n8n.
  // `roles` aquí decide SOLO si se muestra la entrada, y debe coincidir con
  // briefCatalog.viewerRoles (hay test). El dato lo gatea el endpoint, que
  // valida el gf_employee_token contra gf.employee.mobile.session y aplica su
  // propia allowlist: ampliar esta lista NO amplía el acceso, quien no esté
  // autorizado recibe 403. Ver src/modules/brief/briefCatalog.js.
  {
    id:     'brief_dia',
    label:  'Mi Brief del día',
    shortLabel: 'Brief',
    route:  '/brief',
    tone:   'blue',
    roles:  ['supervisor_ventas', 'direccion_general'],
    status: 'live',
    icon:   'kpis',
    // 16 (no 11) a propósito: entra DESPUÉS de Torre operativa (15) para no
    // desplazarla de la barra móvil de quien tiene tower_status. Agregar una
    // superficie no debe degradar una existente.
    navPriority: 16,
  },

  // ── Asistencias de Iguala — allowlist exacta por employee_id ────────────
  // `roles` es solo metadata de contexto. La política attendance_manager es
  // la única autoridad local para tarjeta, nav y clic; Odoo revalida todo.
  {
    id:     'asistencias',
    label:  'Asistencias',
    shortLabel: 'Asistencias',
    route:  '/asistencias',
    tone:   'blueSoft',
    roles:  ['gerente_sucursal'],
    accessPolicy: 'attendance_manager',
    status: 'live',
    icon:   'equipo',
    navPriority: 11,
    showOnHome: true,
    showInNav:  true,
  },

  // ── Administración ───────────────────────────────────────────────────────
  {
    id: 'pos_nocturno',
    label: 'POS nocturno',
    shortLabel: 'POS Noche',
    route: '/pos-nocturno',
    tone: 'blueDeep',
    roles: ['hector_tapia'],
    accessPolicy: 'hectorNightPos',
    status: 'live',
    icon: 'admin',
    navPriority: 10,
    showOnHome: true,
    showInNav: true,
  },
  {
    id: 'pos_diurno',
    label: 'POS día',
    shortLabel: 'POS Día',
    route: '/pos-diurno',
    tone: 'blueDeep',
    roles: ['pos_diurno'],
    status: 'live',
    icon: 'admin',
    navPriority: 10,
    showOnHome: true,
    showInNav: true,
  },
  {
    id:     'admin_sucursal',
    label:  'Admin Sucursal',
    shortLabel: 'Admin',
    route:  '/admin',
    tone:   'blueDeep',
    roles:  ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'],
    roleContextRoles: ['auxiliar_admin', 'gerente_sucursal', 'direccion_general'],
    status: 'live',
    icon:   'admin',
    navPriority: 10,
  },

  // ── KOLD OS · M2 — Planeación y readiness (observatorio read-only) ───────
  // Evidencia incumplimientos de planeación (territorio/solver/capacidad/
  // carga/snapshots/resultado real) desde la API autenticada gf_kold_os_m2.
  // accessPolicy 'm2': tarjeta, nav Y clic se deciden con readM2Access
  // (direccion_general x_job_key o admin_plataforma tower_status — misma
  // verdad, ver access.js), NUNCA por roles genéricos. `roles` queda SOLO
  // como documentación; isModuleVisibleForRoles excluye módulos con política.
  // M2PlaneacionRoute (App.jsx) revalida como autoridad final de la ruta.
  {
    id:     'planeacion',
    label:  'Planeación',
    shortLabel: 'Planeación',
    route:  '/planeacion',
    tone:   'steel',
    roles:  ['direccion_general'],
    accessPolicy: 'm2',
    status: 'live',
    icon:   'supervision',
    navPriority: 13,
    showOnHome: true,
    showInNav:  true,
  },

  // ── KOLD OS · M3 — Ejecución de rutas (observatorio read-only) ────────────
  // Evidencia incumplimientos de EJECUCIÓN (arranque/paradas/comercial/carga/
  // incidentes/cierre/plan-vs-real) desde la API autenticada gf_kold_os_m3.
  // accessPolicy 'm3': misma mecánica que M2 — se resuelve por el registro
  // ACCESS_POLICY_RESOLVERS de navModel, NUNCA por roles genéricos.
  // M3EjecucionRoute (App.jsx) revalida como autoridad final.
  {
    id:     'ejecucion',
    label:  'Ejecución de rutas',
    shortLabel: 'Ejecución',
    route:  '/ejecucion',
    tone:   'blueDeep',
    roles:  ['direccion_general'],
    accessPolicy: 'm3',
    status: 'live',
    icon:   'ruta',
    navPriority: 14,
    showOnHome: true,
    showInNav:  true,
  },

  // ── KOLD OS · M4 — Ventas y clientes (observatorio read-only) ────────────
  // Evidencia de la operación comercial (maestro de clientes, canal, leads,
  // pedidos confirmados, precio/descuento, recurrencia, portafolio,
  // pérdida/recompra, señal M4→M2) desde la API autenticada gf_kold_os_m4
  // (aún sin instalación ni validación runtime).
  // accessPolicy 'm4': tarjeta, nav Y clic se deciden con readM4Access
  // mediante ACCESS_POLICY_RESOLVERS en navModel, NUNCA por roles
  // genéricos. `roles` queda SOLO como documentación. M4VentasRoute (App.jsx)
  // revalida como autoridad final de la ruta.
  {
    id:     'ventas-clientes',
    label:  'Ventas y clientes',
    shortLabel: 'Ventas',
    route:  '/ventas-clientes',
    tone:   'blueDeep',
    roles:  ['direccion_general'],
    accessPolicy: 'm4',
    status: 'live',
    icon:   'kpis',
    navPriority: 15,
    showOnHome: true,
    showInNav:  true,
  },

  // ── KOLD OS · M5 — Inventario y flujo (observatorio read-only) ───────────
  // M5 observa carga, salidas, devoluciones y señales de conciliación sin
  // modificar inventario, pickings, planes ni conciliaciones.
  {
    id:     'inventario-flujo',
    label:  'Inventario y flujo',
    shortLabel: 'Inventario',
    route:  '/inventario-flujo',
    tone:   'blueDeep',
    roles:  ['direccion_general'],
    accessPolicy: 'm5',
    status: 'live',
    icon:   'kpis',
    navPriority: 16,
    showOnHome: true,
    showInNav:  true,
  },

  // ── KOLD OS · M6 — Caja y conciliación (observatorio read-only) ───────────
  // Señales del ESTADO FINANCIERO/ADMINISTRATIVO de caja: facturación y cuentas
  // por cobrar, pagos, caja de ruta, cierre de caja, cierre administrativo,
  // conciliación, cartera y aging. M6 NO afirma un cuadre: presenta señales
  // reportadas, cobertura de instrumentación y capacidades no disponibles.
  //
  // La disponibilidad se confirma únicamente con la API autenticada y su flag;
  // la PWA no infiere instalación ni habilitación desde el cliente.
  //
  // accessPolicy 'm6': tarjeta, nav Y clic se deciden con readM6Access (misma
  // mecánica inline que M2), NUNCA por roles genéricos. `roles` queda SOLO como
  // documentación. M6CajaRoute (App.jsx) revalida como autoridad final.
  //
  // OJO — a diferencia de M2, M6 NO acepta `admin_plataforma`: su backend sólo
  // valida el job key `direccion_general`. Aceptarlo aquí mostraría la tarjeta a
  // quien el backend responde 403 (el bug de M1).
  {
    id:     'cash-reconciliation',
    label:  'Caja y conciliación',
    shortLabel: 'Caja',
    route:  '/caja-conciliacion',
    tone:   'blueDeep',
    roles:  ['direccion_general'],
    accessPolicy: 'm6',
    status: 'live',
    icon:   'kpis',
    navPriority: 17,
    showOnHome: true,
    showInNav:  true,
  },

  // ── KOLD OS · M7 — Rentabilidad y costos (observatorio read-only) ─────────
  // Rentabilidad, costos, márgenes y desempeño económico. M7 v1 sólo alcanza
  // NIVEL L1 (ingreso observable por moneda): NO afirma utilidad, margen real ni
  // rentabilidad completa. accessPolicy 'm7' se resuelve con readM7Access (misma
  // autoridad que tarjeta, nav, clic y route guard). Como M6, NO acepta
  // `admin_plataforma`: el backend #211 sólo valida `direccion_general`.
  {
    id:     'profitability-costs',
    label:  'Rentabilidad y costos',
    shortLabel: 'Rentabilidad',
    route:  '/rentabilidad-costos',
    tone:   'blueDeep',
    roles:  ['direccion_general'],
    accessPolicy: 'm7',
    status: 'live',
    icon:   'kpis',
    navPriority: 18,
    showOnHome: true,
    showInNav:  true,
  },

  // ── Ventas Iguala — acceso UX configurado por employee_id ────────────────
  // Odoo sigue siendo la autoridad de seguridad; accessPolicy solo gobierna
  // qué superficie cliente se ofrece a los colaboradores configurados.
  {
    id:     'ventas_iguala',
    label:  'Ventas Iguala',
    shortLabel: 'Ventas',
    route:  '/ventas-iguala',
    tone:   'blueSoft',
    roles:  ['*'],
    accessPolicy: 'iguala_sales',
    status: 'live',
    icon:   'kpis',
    navPriority: 14,
  },

  // ── Torres de Control — CSC GF ───────────────────────────────────────────
  {
    id:     'torre_control',
    label:  'Validar',
    shortLabel: 'Validar',
    route:  '/torres',
    tone:   'steel',
    roles:  ['operador_torres'],
    status: 'live',
    icon:   'torres',
    navPriority: 10,
  },

  // ── Gerente de Sucursal ────────────────────────────────────────────────
  {
    id:     'gerente',
    label:  'Gerente',
    shortLabel: 'Gerente',
    route:  '/gerente',
    tone:   'blueDeep',
    roles:  ['gerente_sucursal'],
    status: 'live',
    icon:   'admin',
    navPriority: 12,
  },

  // ── KOLD Tower M1 — superficie de supervisión (read-only) ────────────────
  // towerGated: la visibilidad NO se decide por x_job_key sino por el rol
  // AUTORITATIVO tower_status (session.employee.tower_status), vía
  // readAuthoritativeTowerStatus (allowlist dura admin_plataforma/
  // supervisor_ventas). `roles` queda SOLO como documentación/coherencia; el
  // gate real de visibilidad es towerGated. TowerRoute sigue siendo la
  // autoridad final de la ruta. La pantalla muestra feature_disabled si el
  // flag backend gf_tower.m1.enabled está OFF.
  {
    id:     'torre_operativa',
    label:  'Torre operativa',
    shortLabel: 'Torre',
    route:  '/torre/backlog',
    tone:   'blue',
    roles:  ['admin_plataforma', 'supervisor_ventas'],
    towerGated: true,
    showOnHome: true,   // explícito: tarjeta en el home (autoridad = tower_status)
    showInNav:  true,   // explícito: entrada en la navegación global
    status: 'live',
    icon:   'torres',
    navPriority: 15,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ¿el módulo es visible para alguno de estos roles (x_job_key)? (fail-closed)
 *  Los módulos `towerGated` o con `accessPolicy` NUNCA son visibles por rol
 *  genérico: su autoridad vive en navModel.isModuleVisibleForSession. */
export function isModuleVisibleForRoles(module, roles = []) {
  if (!module || module.towerGated || module.accessPolicy || !Array.isArray(module.roles)) return false
  return module.roles.includes('*') || roles.some((role) => module.roles.includes(role))
}

/** Módulos visibles para un rol dado */
export function getModulesForRole(role) {
  return MODULES.filter((m) => isModuleVisibleForRoles(m, [role]))
}

/** Módulos visibles para un conjunto de roles efectivos (sin duplicados) */
export function getModulesForRoles(roles = []) {
  const seen = new Set()
  return MODULES.filter((module) => {
    if (!isModuleVisibleForRoles(module, roles) || seen.has(module.id)) return false
    seen.add(module.id)
    return true
  })
}

/** Lookup rápido por id */
export function getModuleById(id) {
  return MODULES.find((m) => m.id === id)
}
