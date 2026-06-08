import type { AgentMode } from '../../../shared/ws/protocol'
import './AutomaticModeChip.css'

interface AutomaticModeChipProps {
  agentMode: AgentMode
}

export function AutomaticModeChip({ agentMode }: AutomaticModeChipProps) {
  if (agentMode !== 'automatic') return null

  return (
    <div className="automatic-mode-chip">
      <span className="automatic-mode-chip__dot" />
      Correção da IA ativada
    </div>
  )
}
