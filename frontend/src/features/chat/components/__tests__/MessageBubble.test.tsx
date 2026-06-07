import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageBubble } from '../MessageBubble'
import type { RoomMessage } from '../../../../shared/ws/protocol'

const baseMessage: RoomMessage = {
  id: 'msg1', roomId: 'room1', role: 'user',
  authorId: 'p1', authorName: 'Alice', content: 'Hello world',
  createdAt: '2026-01-01T00:00:00Z', reactions: {},
}

const errorCorrection: RoomMessage = {
  id: 'reply1', roomId: 'room1', role: 'assistant',
  authorId: 'coach', authorName: 'Coach', content: 'Analise indisponivel.',
  replyToMessageId: 'msg1', error: true, errorReason: 'timeout',
  createdAt: '2026-01-01T00:01:00Z', reactions: {},
}

const successCorrection: RoomMessage = {
  id: 'reply2', roomId: 'room1', role: 'assistant',
  authorId: 'coach', authorName: 'Coach', content: 'Hello, world!',
  explanation: 'Added comma after greeting.', replyToMessageId: 'msg1',
  createdAt: '2026-01-01T00:01:00Z', reactions: {},
}

const reactionProps = {
  participantId: 'p1',
  onAddReaction: vi.fn(),
  onAnalyze: vi.fn(),
  onRemoveReaction: vi.fn(),
}

function renderBubble(correction?: RoomMessage) {
  return render(
    <MessageBubble
      canAnalyze={false}
      correction={correction}
      isOwn
      isPending={false}
      message={baseMessage}
      {...reactionProps}
    />
  )
}

describe('MessageBubble — canAnalyze', () => {
  it('exibe botão "Analisar com agente" quando canAnalyze=true', () => {
    render(
      <MessageBubble
        canAnalyze
        isOwn
        isPending={false}
        message={baseMessage}
        {...reactionProps}
      />
    )
    expect(screen.getByRole('button', { name: 'Analisar com agente' })).toBeInTheDocument()
  })

  it('não exibe botão "Analisar com agente" quando canAnalyze=false', () => {
    renderBubble()
    expect(screen.queryByRole('button', { name: 'Analisar com agente' })).not.toBeInTheDocument()
  })
})

describe('MessageBubble — isPending', () => {
  it('exibe indicador "Coach analisando..." quando isPending=true', () => {
    render(
      <MessageBubble
        canAnalyze={false}
        isOwn
        isPending
        message={baseMessage}
        {...reactionProps}
      />
    )
    expect(screen.getByText('Coach analisando...')).toBeInTheDocument()
  })

  it('não exibe indicador de pendência quando isPending=false e sem correção', () => {
    renderBubble()
    expect(screen.queryByText('Coach analisando...')).not.toBeInTheDocument()
  })
})

describe('MessageBubble — error state', () => {
  it('renders "Analise indisponivel" when correction has error', () => {
    renderBubble(errorCorrection)
    expect(screen.getByText('Analise indisponivel.')).toBeInTheDocument()
  })

  it('renders retry button "Analisar" when correction has error', () => {
    renderBubble(errorCorrection)
    expect(screen.getByRole('button', { name: 'Analisar' })).toBeInTheDocument()
  })

  it('does not render CorrectionBlock when correction has error', () => {
    renderBubble(errorCorrection)
    expect(document.querySelector('.message-bubble__corrected')).not.toBeInTheDocument()
  })

  it('renders CorrectionBlock when correction has no error', () => {
    renderBubble(successCorrection)
    const correctedEl = document.querySelector('.message-bubble__corrected')
    expect(correctedEl).toBeInTheDocument()
    expect(correctedEl?.textContent).toBe('Hello, world!')
  })

  it('does not render error block when correction is successful', () => {
    renderBubble(successCorrection)
    expect(screen.queryByText('Analise indisponivel.')).not.toBeInTheDocument()
  })
})

describe('MessageBubble — ReactionBar', () => {
  it('renderiza o botão "+" para adicionar reação', () => {
    renderBubble()
    expect(screen.getByRole('button', { name: 'Adicionar reação' })).toBeInTheDocument()
  })

  it('exibe contagem de reações existentes', () => {
    const msgWithReaction: RoomMessage = { ...baseMessage, reactions: { '👍': ['p2', 'p3'] } }
    render(
      <MessageBubble
        canAnalyze={false}
        isOwn
        isPending={false}
        message={msgWithReaction}
        {...reactionProps}
      />
    )
    expect(screen.getByRole('button', { name: 'React with 👍' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('chama onAddReaction ao clicar em emoji sem reação prévia', () => {
    const onAddReaction = vi.fn()
    const msgWithReaction: RoomMessage = { ...baseMessage, reactions: { '👍': ['p2'] } }
    render(
      <MessageBubble
        canAnalyze={false}
        isOwn
        isPending={false}
        message={msgWithReaction}
        participantId="p1"
        onAddReaction={onAddReaction}
        onAnalyze={vi.fn()}
        onRemoveReaction={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'React with 👍' }))
    expect(onAddReaction).toHaveBeenCalledWith('👍')
  })

  it('chama onRemoveReaction ao clicar em emoji que o participante já reagiu', () => {
    const onRemoveReaction = vi.fn()
    const msgWithOwnReaction: RoomMessage = { ...baseMessage, reactions: { '❤️': ['p1'] } }
    render(
      <MessageBubble
        canAnalyze={false}
        isOwn
        isPending={false}
        message={msgWithOwnReaction}
        participantId="p1"
        onAddReaction={vi.fn()}
        onAnalyze={vi.fn()}
        onRemoveReaction={onRemoveReaction}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'React with ❤️' }))
    expect(onRemoveReaction).toHaveBeenCalledWith('❤️')
  })
})
