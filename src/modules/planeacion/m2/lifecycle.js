// ─── KOLD OS · M2 — Ciclo de vida de hallazgos entre corridas ────────────────
// Determinista: el finding_id estable (rule_code + scope + entidad) permite
// comparar corridas del auditor y clasificar cada hallazgo como:
//   · new        → primera aparición (solo existe en la corrida más reciente)
//   · persistent → presente en la corrida más reciente Y en la anterior
//   · recurrent  → presente en la más reciente, ausente en la anterior,
//                  pero existió antes (reapareció tras corregirse)
//   · corrected  → existió antes y YA NO está en la corrida más reciente
// No modifica el origen: consume corridas ya emitidas (read-only).

/** Identificador estable de hallazgo (mismo incumplimiento ⇒ mismo id). */
export function stableFindingId(finding) {
  const rule = String(finding?.rule_code || 'unknown')
  const company = finding?.company_id ?? 'global'
  const branch = finding?.branch_id ?? 'all'
  const entity = finding?.entity_id ?? 'aggregate'
  return `${rule}::${company}:${branch}::${entity}`
}

function runKey(run) {
  return String(run?.report?.finished_at || run?.finished_at || '')
}

/**
 * Aplica lifecycle sobre una historia de corridas.
 * @param {Array<{report: object, findings: Array}>} runs — corridas con sus
 *   hallazgos derivados; se ordenan por finished_at ascendente.
 * @returns {{ findings: Array, corrected: Array, run_count: number }}
 *   findings = hallazgos de la corrida MÁS RECIENTE con lifecycle_status,
 *   first_seen_at, last_seen_at y occurrence_count; corrected = hallazgos que
 *   desaparecieron (con su última evidencia conocida).
 */
export function applyLifecycle(runs = []) {
  const ordered = [...runs]
    .filter((run) => run && Array.isArray(run.findings))
    .sort((a, b) => Date.parse(runKey(a)) - Date.parse(runKey(b)))

  if (!ordered.length) return { findings: [], corrected: [], run_count: 0 }

  // Presencia por corrida: Map<finding_id, {finding, runIndexes: []}>
  const history = new Map()
  ordered.forEach((run, index) => {
    for (const finding of run.findings) {
      const id = stableFindingId(finding)
      if (!history.has(id)) history.set(id, { finding, runs: [] })
      const entry = history.get(id)
      entry.finding = finding // conserva la evidencia más reciente
      entry.runs.push(index)
    }
  })

  const latestIndex = ordered.length - 1
  const latestKey = runKey(ordered[latestIndex])
  const findings = []
  const corrected = []

  for (const [id, entry] of history.entries()) {
    const presentLatest = entry.runs.includes(latestIndex)
    const firstRun = ordered[entry.runs[0]]
    const lastRun = ordered[entry.runs[entry.runs.length - 1]]
    const base = {
      ...entry.finding,
      finding_id: id,
      occurrence_count: entry.runs.length,
      first_seen_at: runKey(firstRun) || null,
      last_seen_at: runKey(lastRun) || null,
    }
    if (presentLatest) {
      let lifecycle = 'new'
      if (entry.runs.length > 1) {
        lifecycle = entry.runs.includes(latestIndex - 1) ? 'persistent' : 'recurrent'
      }
      findings.push({ ...base, lifecycle_status: lifecycle })
    } else {
      corrected.push({
        ...base,
        lifecycle_status: 'corrected',
        corrected_observed_at: latestKey || null,
      })
    }
  }

  const order = { RED: 0, AMBER: 1 }
  findings.sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2) || a.rule_code.localeCompare(b.rule_code))
  corrected.sort((a, b) => a.rule_code.localeCompare(b.rule_code))
  return { findings, corrected, run_count: ordered.length }
}
