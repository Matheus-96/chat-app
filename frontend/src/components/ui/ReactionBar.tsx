import * as React from 'react'
import { HoverCard } from 'radix-ui'
import { Button } from './button'
import { ReactionButton } from './ReactionButton'

const EMOJIS = ['👍', '👎', '😂', '❤️'] as const

interface ReactionBarProps {
  reactions: Record<string, string[]>
  participantId: string
  onAdd: (emoji: string) => void
  onRemove: (emoji: string) => void
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, participantId, onAdd, onRemove }) => {
  const visibleEmojis = EMOJIS.filter((e) => (reactions[e]?.length ?? 0) > 0)

  const handleToggle = (emoji: string) => {
    const hasReacted = reactions[emoji]?.includes(participantId) ?? false
    if (hasReacted) { onRemove(emoji) } else { onAdd(emoji) }
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {visibleEmojis.map((emoji) => (
        <ReactionButton
          key={emoji}
          emoji={emoji}
          count={reactions[emoji]?.length ?? 0}
          active={reactions[emoji]?.includes(participantId) ?? false}
          onClick={() => handleToggle(emoji)}
        />
      ))}
      <HoverCard.Root openDelay={150} closeDelay={100}>
        <HoverCard.Trigger asChild>
          <Button
            size="xs"
            variant="ghost"
            aria-label="Adicionar reação"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150"
          >
            😊
          </Button>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            side="top"
            align="start"
            sideOffset={6}
            className="flex gap-1 rounded-xl border border-white/10 bg-[#141a28] p-1.5 shadow-xl z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            {EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                size="xs"
                variant="ghost"
                onClick={() => handleToggle(emoji)}
                aria-label={`Reagir com ${emoji}`}
                className="text-base hover:scale-125 transition-transform duration-100"
              >
                {emoji}
              </Button>
            ))}
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </div>
  )
}
