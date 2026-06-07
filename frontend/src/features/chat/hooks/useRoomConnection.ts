import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from '../../../shared/config'
import { saveStoredAgentMode } from '../../../shared/storage/profile'
import { connect, type WsClient } from '../../../shared/ws/client'
import type { AgentMode, ClientEvent } from '../../../shared/ws/protocol'
import { useRoomStore } from '../../../store/roomStore'

interface UseRoomConnectionArgs {
  roomCode: string
  name: string
  apiKey: string
  customInstructions: string
  participantId: string
  initialAgentMode: AgentMode
}

export function useRoomConnection(args: UseRoomConnectionArgs) {
  const state = useRoomStore()
  const clientRef = useRef<WsClient | null>(null)
  const typingRef = useRef(false)
  const argsRef = useRef(args)
  argsRef.current = args
  const [reconnectKey, setReconnectKey] = useState(0)

  useEffect(() => {
    const client = connect({
      wsUrl,
      roomCode: argsRef.current.roomCode,
      participantId: argsRef.current.participantId,
      name: argsRef.current.name,
      agentMode: argsRef.current.initialAgentMode,
    })
    clientRef.current = client
    return () => client.close()
  }, [reconnectKey])

  const sendEvent = useCallback((event: ClientEvent) => {
    clientRef.current?.sendEvent(event)
  }, [])

  function setAgentMode(agentMode: AgentMode) {
    saveStoredAgentMode(agentMode)
    useRoomStore.getState().setAgentMode(agentMode)
    sendEvent({ type: 'set_agent_mode', agentMode })
  }

  function sendMessage(content: string, analyze?: boolean) {
    typingRef.current = false
    sendEvent({ type: 'typing', isTyping: false })
    sendEvent({
      type: 'send_message',
      content,
      analyze,
      apiKey: argsRef.current.apiKey.trim() || undefined,
      customInstructions: argsRef.current.customInstructions.trim() || undefined,
    })
  }

  function analyzeMessage(messageId: string) {
    sendEvent({
      type: 'analyze_message',
      messageId,
      apiKey: argsRef.current.apiKey.trim() || undefined,
      customInstructions: argsRef.current.customInstructions.trim() || undefined,
    })
  }

  function sendTyping(isTyping: boolean) {
    if (typingRef.current !== isTyping) {
      typingRef.current = isTyping
      sendEvent({ type: 'typing', isTyping })
    }
  }

  function reconnect() { setReconnectKey((k) => k + 1) }

  return { state, actions: { analyzeMessage, reconnect, sendMessage, sendTyping, setAgentMode } }
}
