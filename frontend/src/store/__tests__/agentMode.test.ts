import { beforeEach, describe, expect, it } from 'vitest'
import { useRoomStore, INITIAL_STATE } from '../roomStore'
import type { ParticipantPresence } from '../../shared/ws/protocol'

const participant: ParticipantPresence = {
  participantId: 'p1',
  name: 'Alice',
  connectedAt: '2026-01-01T00:00:00Z',
  agentMode: 'manual',
}

beforeEach(() => {
  useRoomStore.setState(INITIAL_STATE)
})

describe('agentMode', () => {
  it('defaults to manual', () => {
    expect(useRoomStore.getState().agentMode).toBe('manual')
  })

  it('setAgentMode changes the value', () => {
    useRoomStore.getState().setAgentMode('automatic')
    expect(useRoomStore.getState().agentMode).toBe('automatic')
  })
})

describe('applyParticipantUpdate with name change', () => {
  it('reflects updated name in participants list', () => {
    useRoomStore.setState({ participantId: 'p1', participants: [participant] })
    useRoomStore.getState().applyParticipantUpdate({
      type: 'participant_update',
      participants: [{ ...participant, name: 'Alice Renomeada' }],
    })
    const updated = useRoomStore.getState().participants.find((p) => p.participantId === 'p1')
    expect(updated?.name).toBe('Alice Renomeada')
  })
})
