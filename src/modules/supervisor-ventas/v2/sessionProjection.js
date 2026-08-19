// UI-only projection from the server-authenticated sign-in response.
// Exact booleans only; backend authorization never reads this client cache.
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOwnTrue(record, key) {
  return isRecord(record)
    && Object.prototype.hasOwnProperty.call(record, key)
    && record[key] === true
}

function ownRecord(record, key) {
  if (!isRecord(record) || !Object.prototype.hasOwnProperty.call(record, key)) return null
  return isRecord(record[key]) ? record[key] : null
}

export function hasSupervisorCopilotCapability(session = {}) {
  const capabilities = ownRecord(session, 'capabilities')
  return hasOwnTrue(capabilities, 'supervisorCopilot')
}

/**
 * Proyecta los gates V2 del sign-in (supervisor + gerente) hacia la sesión PWA.
 * Aditivo: no inventa flags; solo copia booleans exactos `=== true`.
 * El shell Gerente V2 exige capabilities.gerenteV2 AND branch.gerente_v2_enabled.
 */
export function buildSupervisorV2SessionProjection(result = {}) {
  const capabilities = ownRecord(result, 'capabilities')
  const branch = ownRecord(result, 'branch')

  return {
    capabilities: {
      supervisorV2: hasOwnTrue(capabilities, 'supervisorV2'),
      supervisorCopilot: hasOwnTrue(capabilities, 'supervisorCopilot'),
      gerenteV2: hasOwnTrue(capabilities, 'gerenteV2'),
    },
    branch: {
      supervisor_v2_enabled: hasOwnTrue(branch, 'supervisor_v2_enabled'),
      gerente_v2_enabled: hasOwnTrue(branch, 'gerente_v2_enabled'),
    },
  }
}
