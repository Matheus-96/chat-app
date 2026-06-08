import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '../Header'
import type { ParticipantPresence } from '../../../../shared/ws/protocol'

describe('Header', () => {
  const mockParticipants: ParticipantPresence[] = [
    {
      participantId: 'p1',
      name: 'Alice',
      connectedAt: '2026-06-07T10:00:00Z',
      agentMode: 'manual',
    },
    {
      participantId: 'p2',
      name: 'Bob',
      connectedAt: '2026-06-07T10:05:00Z',
      agentMode: 'manual',
    },
  ]

  it('renderiza nomes dos participantes quando há participantes', () => {
    const onSettingsToggle = vi.fn()
    render(
      <Header
        participants={mockParticipants}
        roomCode="VERB0-7K2P"
        onSettingsToggle={onSettingsToggle}
      />
    )

    expect(screen.getByText('Alice, Bob')).toBeInTheDocument()
  })

  it('renderiza roomCode como fallback quando não há participantes', () => {
    const onSettingsToggle = vi.fn()
    render(
      <Header participants={[]} roomCode="VERB0-7K2P" onSettingsToggle={onSettingsToggle}/>
    )

    expect(screen.getByText('VERB0-7K2P')).toBeInTheDocument()
  })

  it('renderiza chip com roomCode no DOM', () => {
    const onSettingsToggle = vi.fn()
    render(
      <Header
        participants={mockParticipants}
        roomCode="VERB0-7K2P"
        onSettingsToggle={onSettingsToggle}
      />
    )

    expect(screen.getByText('# VERB0-7K2P')).toBeInTheDocument()
  })

  it('chama onSettingsToggle ao clicar no gear button', async () => {
    const onSettingsToggle = vi.fn()
    const user = userEvent.setup()

    render(
      <Header
        participants={mockParticipants}
        roomCode="VERB0-7K2P"
        onSettingsToggle={onSettingsToggle}
      />
    )

    const button = screen.getByRole('button', { name: /configurações/i })
    await user.click(button)

    expect(onSettingsToggle).toHaveBeenCalledTimes(1)
  })

  it('renderiza avatares com iniciais dos participantes', () => {
    const onSettingsToggle = vi.fn()
    render(
      <Header
        participants={mockParticipants}
        roomCode="VERB0-7K2P"
        onSettingsToggle={onSettingsToggle}
      />
    )

    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(screen.getByText('BO')).toBeInTheDocument()
  })
})
