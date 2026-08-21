import { TOKENS as DARK_TOKENS } from '../../../tokens'
import { normalizeTransformationUiState } from '../utils/transformationState'

function badgeStyle(tone, tokens) {
  const toneMap = {
    success: {
      color: tokens.colors.success,
      background: 'rgba(34,197,94,0.10)',
      border: 'rgba(34,197,94,0.20)',
    },
    warning: {
      color: tokens.colors.warning,
      background: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.20)',
    },
    error: {
      color: tokens.colors.error,
      background: tokens.colors.errorSoft,
      border: 'rgba(239,68,68,0.20)',
    },
    muted: {
      color: tokens.colors.textMuted,
      background: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.10)',
    },
  }
  const config = toneMap[tone] || toneMap.muted
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: tokens.radius.pill,
    background: config.background,
    border: `1px solid ${config.border}`,
    color: config.color,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  }
}

export default function TransformationStateBadges({ item, tokens = DARK_TOKENS }) {
  const { primary, secondary } = normalizeTransformationUiState(item)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <span style={badgeStyle(primary?.tone, tokens)}>{primary?.label}</span>
      {secondary ? <span style={badgeStyle(secondary.tone, tokens)}>{secondary.label}</span> : null}
    </div>
  )
}
