// UI-only projection from the server-authenticated sign-in response.
// Exact booleans only; backend authorization never reads this client cache.
export function buildSupervisorV2SessionProjection(result = {}) {
  return {
    capabilities: {
      supervisorV2: result?.capabilities?.supervisorV2 === true,
    },
    branch: {
      supervisor_v2_enabled: result?.branch?.supervisor_v2_enabled === true,
    },
  }
}
