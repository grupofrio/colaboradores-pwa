// ─── EvidenceSection — evidencia técnica, colapsable, íntegra (Etapa 0A) ─────
// Baja de la capa 1: hashes, manifest, duración, nº de consultas, modelos, códigos,
// lineage y rutas internas. No se ELIMINA nada (auditoría); se REUBICA. Usa <details>
// nativo (operable por teclado, sin JS de estado; funciona en SSR).
import { TOKENS } from '../../tokens'

const C = TOKENS.colors

function Row({ k, v }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.6 }}>
      <span style={{ color: C.textLow, minWidth: 150, fontWeight: 600 }}>{k}</span>
      <span style={{ color: C.textSoft, wordBreak: 'break-all' }}>{String(v)}</span>
    </div>
  )
}

export default function EvidenceSection({ evidence = {}, auditor = null, source = null, extraRows = [], testid = 'kold-evidence' }) {
  const e = evidence || {}
  return (
    <details data-testid={testid} style={{ marginTop: 12 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
        color: C.textLow, padding: '4px 0', listStyle: 'revert',
      }}>Evidencia técnica</summary>
      <div style={{
        marginTop: 8, padding: '10px 12px', background: C.surfaceSoft,
        border: `1px solid ${C.border}`, borderRadius: TOKENS.radius.sm,
      }}>
        <Row k="Auditor del contrato" v={auditor} />
        <Row k="Fuente / medición" v={source} />
        <Row k="run_id" v={e.run_id} />
        <Row k="scope_key" v={e.scope_key} />
        <Row k="evidence_sha256" v={e.evidence_sha256} />
        <Row k="auditor_build_sha" v={e.auditor_build_sha} />
        <Row k="contract_build_sha" v={e.contract_build_sha} />
        <Row k="Duración (ms)" v={e.duration_ms} />
        <Row k="Consultas ejecutadas" v={e.executed_queries} />
        {extraRows.map((r, i) => <Row key={i} k={r.k} v={r.v} />)}
      </div>
    </details>
  )
}
