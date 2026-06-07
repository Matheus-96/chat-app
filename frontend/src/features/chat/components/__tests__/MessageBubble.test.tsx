import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageBubble } from '../MessageBubble'
import type { RoomMessage } from '../../../../shared/ws/protocol'

const baseMessage: RoomMessage = {
  id: 'msg1', roomId: 'room1', role: 'user',
  authorId: 'p1', authorName: 'Alice', content: 'Hello world',
  createdAt: '2026-01-01T00:00:00Z',
}

const errorCorrection: RoomMessage = {
  id: 'reply1', roomId: 'room1', role: 'assistant',
  authorId: 'coach', authorName: 'Coach', content: 'Analise indisponivel.',
  replyToMessageId: 'msg1', error: true, errorReason: 'timeout',
  createdAt: '2026-01-01T00:01:00Z',
}

const successCorrection: RoomMessage = {
  id: 'reply2', roomId: 'room1', role: 'assistant',
  authorId: 'coach', authorName: 'Coach', content: 'Hello, world!',
  explanation: 'Added comma after greeting.', replyToMessageId: 'msg1',
  createdAt: '2026-01-01T00:01:00Z',
}

function renderBubble(correction?: RoomMessage) {
  return render(
    <MessageBubble
      canAnalyze={false}
      correction={correction}
      isOwn
      isPending={false}
      message={baseMessage}
      onAnalyze={vi.fn()}
    />
  )
}

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
