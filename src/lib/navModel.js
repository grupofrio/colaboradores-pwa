// ─── navModel — modelo PURO de navegación global basada en roles ─────────────
// Fuente ÚNICA de módulos: src/modules/registry.js. Sin JSX ni React → 100%
// testeable. La MISMA autorización decide tarjeta del home, entrada de nav y
// acceso: getEffectiveJobKeys + isModuleVisibleForRoles (fail-closed).
//
// Tower (/torre/backlog) NO está en el registry a propósito: no aparece en
// ninguna nav hasta un PR futuro. Ver src/modules/registry.js.

import { MODULES, isModuleVisibleForRoles } from '../modules/registry.js'
import { getEffectiveJobKeys } from './roleContext.js'

// Anclas fijas (no son módulos del registry). Siempre presentes con sesión:
// todos pueden ir a su Inicio y a su perfil.
export const HOME_ANCHOR = { id: 'home', label: 'Inicio', shortLabel: 'Inicio', route: '/', navIcon: 'home' }
export const PROFILE_ANCHOR = { id: 'perfil', label: 'Yo', shortLabel: 'Yo', route: '/profile', navIcon: 'user' }

// Rutas donde la nav global no debe mostrarse (login / full-screen).
const NAV_HIDDEN_PREFIXES = ['/login']

export function isNavHiddenForPath(pathname = '') {
  const path = String(pathname || '')
  return NAV_HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

function navPriorityOf(module) {
  return Number.isFinite(module?.navPriority) ? module.navPriority : 100
}

// Módulos del registry visibles en navegación para la sesión (fail-closed),
// ordenados por navPriority asc y, a igualdad, por su orden en el registry.
export function getNavModules(session = {}) {
  const roles = getEffectiveJobKeys(session)
  return MODULES
    .map((module, index) => ({ module, index }))
    .filter(({ module }) => module.showInNav !== false && isModuleVisibleForRoles(module, roles))
    .sort((a, b) => (navPriorityOf(a.module) - navPriorityOf(b.module)) || (a.index - b.index))
    .map(({ module }) => module)
}

// ¿la ruta del item corresponde a la ubicación actual? (soporta subrutas)
export function isNavItemActive(route, pathname = '') {
  const path = String(pathname || '')
  if (!route) return false
  if (route === '/') return path === '/'
  return path === route || path.startsWith(route + '/')
}

// El match más específico (ruta más larga) gana; '/' solo si es exacto.
export function resolveActiveId(items = [], pathname = '') {
  let best = null
  for (const item of items) {
    if (isNavItemActive(item.route, pathname) && (!best || item.route.length > best.route.length)) {
      best = item
    }
  }
  return best ? best.id : null
}

// Navegación MÓVIL: maxSlots ranuras → [Inicio, ...primary, (Más?), Yo].
// Reservamos Inicio y Yo; con ≤ moduleSlots módulos van todos directos (sin
// "Más"); con más, se muestran (moduleSlots-1) directos + botón "Más".
export function buildMobileNav(session = {}, pathname = '', options = {}) {
  const maxSlots = Number.isFinite(options.maxSlots) ? options.maxSlots : 5
  const moduleSlots = Math.max(1, maxSlots - 2)
  const modules = getNavModules(session)

  let primary
  let overflow
  if (modules.length <= moduleSlots) {
    primary = modules
    overflow = []
  } else {
    primary = modules.slice(0, moduleSlots - 1)
    overflow = modules.slice(moduleSlots - 1)
  }
  const activeItems = [HOME_ANCHOR, ...modules, PROFILE_ANCHOR]
  return {
    home: HOME_ANCHOR,
    profile: PROFILE_ANCHOR,
    primary,
    overflow,
    hasMore: overflow.length > 0,
    activeId: resolveActiveId(activeItems, pathname),
    hidden: isNavHiddenForPath(pathname),
  }
}

// Navegación DESKTOP/TABLET: rail lateral con TODOS los módulos + anclas.
export function buildDesktopNav(session = {}, pathname = '') {
  const modules = getNavModules(session)
  const activeItems = [HOME_ANCHOR, ...modules, PROFILE_ANCHOR]
  return {
    home: HOME_ANCHOR,
    profile: PROFILE_ANCHOR,
    modules,
    activeId: resolveActiveId(activeItems, pathname),
    hidden: isNavHiddenForPath(pathname),
  }
}

// Etiqueta a usar en la nav (corta si existe).
export function navLabel(item, { short = false } = {}) {
  if (!item) return ''
  return (short && item.shortLabel) ? item.shortLabel : (item.label || item.shortLabel || '')
}
