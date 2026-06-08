import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoomConnection } from '../useRoomConnection'
import * as wsClient from '../../../../shared/ws/client'
import type { ClientEvent } from '../../../../shared/ws/protocol'

vi.mock('../../../../shared/ws/client')
vi.mock('../../../../shared/config', () => ({
  wsUrl: 'ws://localhost:8080',
}))
vi.mock('../../../../shared/storage/profile', () => ({
  saveStoredAgentMode: vi.fn(),
}))

describe('useRoomConnection', () => {
  const mockClient = {
    sendEvent: vi.fn(),
    close: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(wsClient.connect).mockReturnValue(mockClient as any)
  })

  it('connects to room on mount', () => {
    renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'key',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    expect(wsClient.connect).toHaveBeenCalledWith({
      wsUrl: 'ws://localhost:8080',
      roomCode: 'ABC123',
      participantId: 'p1',
      name: 'Alice',
      agentMode: 'manual',
    })
  })

  it('analyzeMessage with mode=chunking sends analyze_message event with mode', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'key',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1', 'chunking')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        mode: 'chunking',
      })
    )
  })

  it('analyzeMessage with mode=normal sends analyze_message event with mode', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'key',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1', 'normal')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        mode: 'normal',
      })
    )
  })

  it('analyzeMessage with no mode defaults to undefined (backend uses normal)', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'key',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        mode: undefined,
      })
    )
  })

  it('analyzeMessage includes apiKey when provided', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'my-api-key',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1', 'chunking')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        mode: 'chunking',
        apiKey: 'my-api-key',
      })
    )
  })

  it('analyzeMessage includes customInstructions when provided', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: 'key',
      customInstructions: 'focus on verbs',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1', 'chunking')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        mode: 'chunking',
        customInstructions: 'focus on verbs',
      })
    )
  })

  it('analyzeMessage trims whitespace from apiKey', () => {
    const { result } = renderHook(() => useRoomConnection({
      roomCode: 'ABC123',
      name: 'Alice',
      apiKey: '  key-with-spaces  ',
      customInstructions: '',
      participantId: 'p1',
      initialAgentMode: 'manual',
    }))

    result.current.actions.analyzeMessage('msg1', 'chunking')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze_message',
        messageId: 'msg1',
        apiKey: 'key-with-spaces',
      })
    )
  })
})
