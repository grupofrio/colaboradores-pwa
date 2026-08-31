export function resolveClientRuntime(runtimeFlag) {
  if (typeof runtimeFlag === 'string' && runtimeFlag) return runtimeFlag
  if (typeof __GF_PWA_RUNTIME__ === 'string' && __GF_PWA_RUNTIME__) {
    return __GF_PWA_RUNTIME__
  }
  return ''
}

export function shouldShowStagingBanner(runtime) {
  const value = String(resolveClientRuntime(runtime) || '').toLowerCase()
  return value === 'staging' || value === 'preview'
}
