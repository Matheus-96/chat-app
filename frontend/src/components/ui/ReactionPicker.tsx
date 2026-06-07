import * as React from 'react'
import { Button } from './button'

const EMOJIS = ['👍', '👎', '😂', '❤️'] as const

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, onClose }) => (
  <div
    role="dialog"
    aria-label="Escolha uma reação"
    className="flex gap-1 rounded-lg border bg-popover p-1 shadow-md"
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onClose() }}
  >
    {EMOJIS.map((emoji) => (
      <Button
        key={emoji}
        size="xs"
        variant="ghost"
        onClick={() => { onSelect(emoji); onClose() }}
        aria-label={`Reagir com ${emoji}`}
      >
        {emoji}
      </Button>
    ))}
  </div>
)
