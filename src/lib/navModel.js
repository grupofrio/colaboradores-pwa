// ─── navModel — modelo PURO de navegación global basada en roles ─────────────
// Fuente ÚNICA de módulos: src/modules/registry.js. Sin JSX ni React → 100%
// testeable. La MISMA autorización decide tarjeta del home, entrada de nav y
// acceso por ruta (ModuleRoleRoute en App.jsx): getEffectiveJobKeys +
// isModuleVisibleForRoles (fail-closed) sobre una sesión VÁLIDA
// (isValidAuthenticatedSession — Codex PR #66 BLOCKER 1).
//
// Tower (/torre/backlog) NO está en el registry a propósito: no aparece en
// ninguna nav hasta un PR futuro. Ver src/modules/registry.js.

import { MODULES, isModuleVisibleForRoles } from '../modules/registry.js'
import { getEffectiveJobKeys } from './roleContext.js'
import { isValidAuthenticatedSession } from './session.js'

// Anclas fijas (no son módulos del registry). Siempre presentes con sesión:
// todos pueden ir a su Inicio y a su perfil.
export const HOME_ANCHOR = { id: 'home', label: 'Inicio', shortLabel: 'Inicio', route: '/', navIcon: 'home' }
export const PROFILE_ANCHOR = { id: 'perfil', label: 'Yo', shortLabel: 'Yo', route: '/profile', navIcon: 'user' }

// ── Geometría del layout (puro, testeable) ──────────────────────────────────
// Rail COMPACTO (solo iconos) en 1024–1439 para no comprimir shells con
// sidebar interno (Admin: 220px sidebar + 320px feed — hallazgo Codex PR #66);
// rail COMPLETO desde 1440.
export const DESKTOP_MIN = 1024
export const RAIL_FULL_MIN = 1440
export const DESKTOP_RAIL_WIDTH = 232
export const DESKTOP_RAIL_WIDTH_COMPACT = 76
export const MOBILE_NAV_HEIGHT = 64

// Ancho del rail según viewport (AppShell reserva exactamente este espacio).
export function railWidthFor(width) {
  if (!Number.isFinite(width) || width < DESKTOP_MIN) return 0
  return width < RAIL_FULL_MIN ? DESKTOP_RAIL_WIDTH_COMPACT : DESKTOP_RAIL_WIDTH
}

// ── Normalización de pathname ────────────────────────────────────────────────
// location.pathname no trae query/hash, pero la política debe ser robusta si
// alguien pasa una URL completa: se ignoran ?query y #hash, y se normalizan
// los trailing slashes ('/ruta/' === '/ruta'). '/' se conserva.
export function normalizePath(pathname = '') {
  let path = String(pathname || '')
  const q = path.indexOf('?')
  if (q !== -1) path = path.slice(0, q)
  const h = path.indexOf('#')
  if (h !== -1) path = path.slice(0, h)
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path || '/'
}

// ── Política de navegación oculta (rutas full-screen) ───────────────────────
// Tres familias, cada una con su porqué:
//
// 1. EXACT — pantallas señaladas que ocultan la nav solo en esa ruta.
//    /login: pantalla pública de autenticación (sin sesión no hay nav igual,
//    pero se declara explícito para que nunca haya flash).
//
// 2. PREFIXES — el árbol COMPLETO oculta la nav (raíz incluida).
//    /torre: superficie KOLD Tower full-screen (E1/M1). Mantiene su propio
//      encabezado/volver; la nav global taparía su layout y no aplica a su
//      contexto de supervisión. Cubre /torre y /torre/backlog.
//    /admin/pos y /admin/ticket: punto de venta mostrador + ticket — flujo de
//      cobro con CTA inferior fija; una barra global encima arriesga toques
//      accidentales a mitad de cobro.
//    /admin/cierre: cierre de caja del día — captura financiera con CTA
//      inferior; salir a mitad del corte pierde estado.
//
// 3. SUBTREES — la RAÍZ del módulo (su hub) SÍ muestra la nav; sus subrutas
//    son flujos operativos de captura full-screen (checklist, carga, corte,
//    cierre, liquidación, conciliación, handover, merma, recepción…) donde la
//    barra global tapa CTAs inferiores y una salida accidental puede perder
//    estado a mitad de un registro:
//    /ruta/*        → operación de reparto en calle (jefe/auxiliar de ruta)
//    /produccion/*  → registro de turno de producción (ciclo, empaque, tanque…)
//    /almacen-pt/*  → capturas de almacén PT (recepción, traspaso, merma…)
//    /entregas/*    → operación diaria de entregas (carga, cierre de turno…)
//    /koldcup/*     → capturas KOLDCUP (compra, producción, corte, traspaso)
//    /torres/*      → validación de requisiciones (detalle con acciones)
const NAV_HIDDEN_EXACT = ['/login']
const NAV_HIDDEN_PREFIXES = ['/torre', '/admin/pos', '/admin/ticket', '/admin/cierre']
const NAV_HIDDEN_SUBTREES = ['/ruta', '/produccion', '/almacen-pt', '/entregas', '/koldcup', '/torres']

export function isNavHiddenForPath(pathname = '') {
  const path = normalizePath(pathname)
  if (NAV_HIDDEN_EXACT.includes(path)) return true
  if (NAV_HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return true
  // Subtrees: solo subrutas (la raíz del módulo conserva la nav global).
  if (NAV_HIDDEN_SUBTREES.some((p) => path.startsWith(p + '/'))) return true
  return false
}

function navPriorityOf(module) {
  return Number.isFinite(module?.navPriority) ? module.navPriority : 100
}

// Módulos del registry visibles en navegación para la sesión, ordenados por
// navPriority asc y, a igualdad, por su orden en el registry.
// FAIL-CLOSED (BLOCKER 1): sesión inválida (null/{}/token vacío/expirada/
// corrupta) => []. Sesión válida sin roles especiales => solo universales.
export function getNavModules(session = null) {
  if (!isValidAuthenticatedSession(session)) return []
  const roles = getEffectiveJobKeys(session)
  return MODULES
    .map((module, index) => ({ module, index }))
    .filter(({ module }) => module.showInNav !== false && isModuleVisibleForRoles(module, roles))
    .sort((a, b) => (navPriorityOf(a.module) - navPriorityOf(b.module)) || (a.index - b.index))
    .map(({ module }) => module)
}

// ¿la ruta del item corresponde a la ubicación actual? (soporta subrutas)
export function isNavItemActive(route, pathname = '') {
  const path = normalizePath(pathname)
  if (!route) return false
  const target = normalizePath(route)
  if (target === '/') return path === '/'
  return path === target || path.startsWith(target + '/')
}

// El match más específico (ruta más larga) gana; '/' solo si es exacto.
// Garantiza UN solo activo (o ninguno).
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
// El orden es determinista (navPriority + orden del registry) => estable entre
// sesiones y renders para un mismo conjunto de roles.
export function buildMobileNav(session = null, pathname = '', options = {}) {
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
  const activeId = resolveActiveId(activeItems, pathname)
  return {
    home: HOME_ANCHOR,
    profile: PROFILE_ANCHOR,
    primary,
    overflow,
    hasMore: overflow.length > 0,
    activeId,
    // El activo vive dentro de "Más" => el botón "Más" se marca activo
    // (aria-current) sin duplicar el activo de las pestañas directas.
    moreActive: overflow.some((m) => m.id === activeId),
    hidden: isNavHiddenForPath(pathname),
  }
}

// Navegación DESKTOP/TABLET: rail lateral con TODOS los módulos + anclas.
export function buildDesktopNav(session = null, pathname = '') {
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
