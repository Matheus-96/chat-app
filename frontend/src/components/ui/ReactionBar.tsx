import * as React from 'react'
import { Button } from './button'
import { ReactionButton } from './ReactionButton'
import { ReactionPicker } from './ReactionPicker'

const EMOJIS = ['👍', '👎', '😂', '❤️'] as const

interface ReactionBarProps {
  reactions: Record<string, string[]>
  participantId: string
  onAdd: (emoji: string) => void
  onRemove: (emoji: string) => void
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, participantId, onAdd, onRemove }) => {
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const visibleEmojis = EMOJIS.filter((e) => (reactions[e]?.length ?? 0) > 0)

  const handleToggle = (emoji: string) => {
    const hasReacted = reactions[emoji]?.includes(participantId) ?? false
    if (hasReacted) { onRemove(emoji) } else { onAdd(emoji) }
  }

  const handlePickerSelect = (emoji: string) => {
    handleToggle(emoji)
    setPickerOpen(false)
  }

  return (
    <div className="relative flex items-center gap-1 mt-1">
      {visibleEmojis.map((emoji) => (
        <ReactionButton
          key={emoji}
          emoji={emoji}
          count={reactions[emoji]?.length ?? 0}
          active={reactions[emoji]?.includes(participantId) ?? false}
          onClick={() => handleToggle(emoji)}
        />
      ))}
      <Button size="xs" variant="ghost" onClick={() => setPickerOpen((o) => !o)} aria-label="Adicionar reação">
        +
      </Button>
      {pickerOpen && (
        <div className="absolute bottom-full mb-1 left-0 z-10">
          <ReactionPicker onSelect={handlePickerSelect} onClose={() => setPickerOpen(false)} />
        </div>
      )}
    </div>
  )
}
