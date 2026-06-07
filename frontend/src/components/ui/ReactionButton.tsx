import * as React from 'react'
import { Button } from './button'

interface ReactionButtonProps {
  emoji: string
  count: number
  active: boolean
  onClick: () => void
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({ emoji, count, active, onClick }) => (
  <Button
    size="xs"
    variant={active ? 'default' : 'outline'}
    onClick={onClick}
    aria-label={`React with ${emoji}`}
    aria-pressed={active}
  >
    {emoji}{count > 0 && <span className="ml-0.5 tabular-nums">{count}</span>}
  </Button>
)
