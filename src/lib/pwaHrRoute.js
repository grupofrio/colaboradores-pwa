const POSITIVE_ID = '[1-9]\\d*'

const ROUTES = [
  { methods: ['GET'], pattern: /^\/pwa-hr\/attendance\/capabilities$/, name: 'capabilities' },
  { methods: ['GET', 'POST'], pattern: /^\/pwa-hr\/attendance$/, name: 'attendance' },
  { methods: ['PATCH'], pattern: new RegExp(`^/pwa-hr/attendance/(${POSITIVE_ID})$`), name: 'attendance_update' },
  { methods: ['POST'], pattern: /^\/pwa-hr\/faltas$/, name: 'absence_create' },
  { methods: ['POST'], pattern: new RegExp(`^/pwa-hr/faltas/(${POSITIVE_ID})/justify$`), name: 'absence_justify' },
  { methods: ['GET'], pattern: /^\/pwa-hr\/audit$/, name: 'audit' },
  { methods: ['GET'], pattern: /^\/pwa-hr\/attendance\/export\.xlsx$/, name: 'export' },
]

export function isPwaHrNamespace(path = '') {
  const cleanPath = String(path).split('?')[0]
  return cleanPath === '/pwa-hr' || cleanPath.startsWith('/pwa-hr/')
}

export function matchPwaHrAttendanceRoute(method, path) {
  const cleanPath = String(path || '').split('?')[0]
  const normalizedMethod = String(method || '').toUpperCase()

  for (const route of ROUTES) {
    const match = cleanPath.match(route.pattern)
    if (!match) continue
    return {
      recognized: true,
      allowed: route.methods.includes(normalizedMethod),
      name: route.name,
      id: match[1] ? Number(match[1]) : null,
      path: cleanPath,
    }
  }

  return {
    recognized: false,
    allowed: false,
    name: null,
    id: null,
    path: cleanPath,
  }
}
