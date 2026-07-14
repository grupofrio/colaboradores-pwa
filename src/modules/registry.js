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

  // ── Administración ───────────────────────────────────────────────────────
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
    status: 'live',
    icon:   'torres',
    navPriority: 15,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ¿el módulo es visible para alguno de estos roles (x_job_key)? (fail-closed)
 *  Los módulos `towerGated` NUNCA son visibles por rol: su autoridad es el
 *  tower_status autoritativo (ver navModel.isModuleVisibleForSession). */
export function isModuleVisibleForRoles(module, roles = []) {
  if (!module || module.towerGated || !Array.isArray(module.roles)) return false
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
