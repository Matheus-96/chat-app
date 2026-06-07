import { notifyNewMessage, playNotificationTone } from '../notifications'
import { useRoomStore } from '../../store/roomStore'
import type { AgentMode, ClientEvent, ServerEvent } from './protocol'

const MAX_ATTEMPTS = 10
const MAX_DELAY = 30_000

export interface ConnectArgs {
  wsUrl: string
  roomCode: string
  participantId: string
  name: string
  agentMode: AgentMode
}

export interface WsClient {
  sendEvent: (event: ClientEvent) => void
  close: () => void
}

export function connect(args: ConnectArgs): WsClient {
  let hasSnapshot = false
  let stopped = false
  let attempts = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let socket!: WebSocket

  useRoomStore.getState().setConnection('connecting')
  createSocket()

  function createSocket() {
    socket = new WebSocket(args.wsUrl)

    socket.onopen = () => {
      attempts = 0
      useRoomStore.getState().setConnection('connected')
      useRoomStore.getState().setError(null)
      sendEvent({ type: 'join_room', roomCode: args.roomCode, participantId: args.participantId, name: args.name })
      sendEvent({ type: 'set_agent_mode', agentMode: useRoomStore.getState().agentMode })
    }

    socket.onmessage = (ev) => {
      let parsed: ServerEvent
      try { parsed = JSON.parse(ev.data as string) as ServerEvent }
      catch { useRoomStore.getState().setError('Nao foi possivel interpretar a resposta do servidor.'); return }
      dispatch(parsed)
    }

    socket.onerror = () => useRoomStore.getState().setError('Conexao instavel com a sala.')

    socket.onclose = () => {
      if (stopped || useRoomStore.getState().expired) return
      if (attempts < MAX_ATTEMPTS) {
        useRoomStore.getState().setConnection('reconnecting')
        retryTimer = setTimeout(createSocket, Math.min(1000 * 2 ** attempts, MAX_DELAY))
        attempts++
      } else {
        useRoomStore.getState().setConnection('disconnected')
        useRoomStore.getState().setError('Nao foi possivel reconectar. Clique em Reconectar para tentar novamente.')
      }
    }
  }

  function dispatch(event: ServerEvent) {
    const store = useRoomStore.getState()
    if (event.type === 'room_snapshot') {
      hasSnapshot = true
      store.applySnapshot(event)
    } else if (event.type === 'participant_update') {
      store.applyParticipantUpdate(event)
    } else if (event.type === 'message_created') {
      store.addMessage(event.message)
      const { message } = event
      if (hasSnapshot && message.authorId !== args.participantId && message.role !== 'assistant') {
        playNotificationTone()
        notifyNewMessage(message.authorName, message.content)
      }
    } else if (event.type === 'typing') {
      store.setTyping(event.participantId, event.name, event.isTyping)
    } else if (event.type === 'correction_started') {
      store.addPendingCorrection(event.messageId)
    } else if (event.type === 'correction_finished') {
      store.removePendingCorrection(event.messageId)
    } else if (event.type === 'reaction_added' || event.type === 'reaction_removed') {
      store.updateReactions(event.messageId, event.reactions)
    } else if (event.type === 'room_expired') {
      store.markExpired()
    } else if (event.type === 'error') {
      store.setError(event.message)
    }
  }

  function sendEvent(ev: ClientEvent) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(ev))
  }

  return {
    sendEvent,
    close: () => {
      stopped = true
      if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null }
      socket.close()
    },
  }
}
