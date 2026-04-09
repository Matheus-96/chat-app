import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { wsUrl } from '../../../shared/config'
import { notifyNewMessage, playNotificationTone } from '../../../shared/notifications'
import { saveStoredAgentMode } from '../../../shared/storage/profile'
import type { AgentMode, ClientEvent, RoomMessage, ServerEvent } from '../../../shared/ws/protocol'
import { createInitialRoomState, roomStateReducer } from '../roomState'

interface UseRoomConnectionArgs { roomCode: string; name: string; apiKey: string; participantId: string; initialAgentMode: AgentMode }

export function useRoomConnection(args: UseRoomConnectionArgs) {
  const [state, dispatch] = useReducer(roomStateReducer, createInitialRoomState(args.initialAgentMode))
  const [reconnectKey, setReconnectKey] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const hasSnapshotRef = useRef(false)
  const typingRef = useRef(false)
  const agentModeRef = useRef(args.initialAgentMode)
  const sendEvent = useCallback((event: ClientEvent) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event))
    }
  }, [])
  const handleServerEvent = useCallback((event: ServerEvent) => {
    if (event.type === 'room_snapshot') {
      hasSnapshotRef.current = true
      agentModeRef.current = event.participants.find((participant) => participant.participantId === event.participantId)?.agentMode ?? agentModeRef.current
      dispatch({ type: 'snapshot', event, fallbackMode: agentModeRef.current })
      return
    }
    if (event.type === 'participant_update') {
      agentModeRef.current = event.participants.find((participant) => participant.participantId === args.participantId)?.agentMode ?? agentModeRef.current
      dispatch({ type: 'participants', participants: event.participants, participantId: args.participantId, fallbackMode: agentModeRef.current })
      return
    }
    if (event.type === 'message_created') {
      dispatch({ type: 'message', message: event.message })
      if (hasSnapshotRef.current && shouldNotify(event.message, args.participantId)) {
        playNotificationTone()
        notifyNewMessage(event.message.authorName, event.message.content)
      }
      return
    }
    if (event.type === 'typing') {
      dispatch({ type: 'typing', participantId: event.participantId, name: event.name, isTyping: event.isTyping })
      return
    }
    if (event.type === 'correction_started' || event.type === 'correction_finished') {
      dispatch({ type: event.type, messageId: event.messageId })
      return
    }
    dispatch({ type: 'error', message: event.message })
  }, [args.participantId])

  useEffect(() => {
    let active = true
    dispatch({ type: 'connection', status: 'connecting' })
    const socket = new WebSocket(wsUrl)
    socketRef.current = socket
    socket.onopen = () => {
      dispatch({ type: 'connection', status: 'connected' })
      dispatch({ type: 'error', message: null })
      sendEvent({ type: 'join_room', roomCode: args.roomCode, participantId: args.participantId, name: args.name })
      sendEvent({ type: 'set_agent_mode', agentMode: agentModeRef.current })
    }
    socket.onmessage = (event) => {
      try {
        handleServerEvent(JSON.parse(event.data as string) as ServerEvent)
      } catch {
        dispatch({ type: 'error', message: 'Nao foi possivel interpretar a resposta do servidor.' })
      }
    }
    socket.onerror = () => dispatch({ type: 'error', message: 'Conexao instavel com a sala.' })
    socket.onclose = () => {
      dispatch({ type: 'connection', status: 'disconnected' })
      if (active) {
        retryRef.current = window.setTimeout(() => setReconnectKey((value) => value + 1), 1500)
      }
    }
    return () => {
      active = false
      if (retryRef.current !== null) {
        window.clearTimeout(retryRef.current)
      }
      socketRef.current = null
      socket.close()
    }
  }, [args.name, args.participantId, args.roomCode, reconnectKey, sendEvent, handleServerEvent])

  function setAgentMode(agentMode: AgentMode) {
    agentModeRef.current = agentMode
    saveStoredAgentMode(agentMode)
    dispatch({ type: 'agent_mode', agentMode })
    sendEvent({ type: 'set_agent_mode', agentMode })
  }

  function sendMessage(content: string, analyze?: boolean) {
    typingRef.current = false
    sendEvent({ type: 'typing', isTyping: false })
    sendEvent({ type: 'send_message', content, analyze, apiKey: args.apiKey.trim() || undefined })
  }

  function analyzeMessage(messageId: string) { sendEvent({ type: 'analyze_message', messageId, apiKey: args.apiKey.trim() || undefined }) }
  function sendTyping(isTyping: boolean) {
    if (typingRef.current !== isTyping) {
      typingRef.current = isTyping
      sendEvent({ type: 'typing', isTyping })
    }
  }
  function reconnect() {
    if (retryRef.current !== null) {
      window.clearTimeout(retryRef.current)
    }
    setReconnectKey((value) => value + 1)
  }

  return { state, actions: { analyzeMessage, reconnect, sendMessage, sendTyping, setAgentMode } }
}

function shouldNotify(message: RoomMessage, participantId: string) { return message.authorId !== participantId || message.role === 'assistant' }