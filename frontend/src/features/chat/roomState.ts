import type { AgentMode, ConnectionStatus, ParticipantPresence, RoomMessage, ServerEvent } from '../../shared/ws/protocol'

export interface ChatRoomState {
  roomId: string
  roomCode: string
  expiresAt: string
  participantId: string
  participants: ParticipantPresence[]
  messages: RoomMessage[]
  typing: Record<string, string>
  pendingCorrections: string[]
  agentMode: AgentMode
  connection: ConnectionStatus
  error: string | null
}

type RoomAction =
  | { type: 'snapshot'; event: Extract<ServerEvent, { type: 'room_snapshot' }>; fallbackMode: AgentMode }
  | { type: 'participants'; participants: ParticipantPresence[]; participantId: string; fallbackMode: AgentMode }
  | { type: 'message'; message: RoomMessage }
  | { type: 'typing'; participantId: string; name: string; isTyping: boolean }
  | { type: 'correction_started' | 'correction_finished'; messageId: string }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'error'; message: string | null }
  | { type: 'agent_mode'; agentMode: AgentMode }

export function createInitialRoomState(agentMode: AgentMode): ChatRoomState {
  return {
    roomId: '',
    roomCode: '',
    expiresAt: '',
    participantId: '',
    participants: [],
    messages: [],
    typing: {},
    pendingCorrections: [],
    agentMode,
    connection: 'connecting',
    error: null,
  }
}

export function roomStateReducer(state: ChatRoomState, action: RoomAction): ChatRoomState {
  switch (action.type) {
    case 'snapshot':
      return {
        ...state,
        roomId: action.event.roomId,
        roomCode: action.event.roomCode,
        expiresAt: action.event.expiresAt,
        participantId: action.event.participantId,
        participants: action.event.participants,
        messages: action.event.messages,
        agentMode: resolveAgentMode(action.event.participants, action.event.participantId, action.fallbackMode),
        pendingCorrections: [],
      }
    case 'participants':
      return { ...state, participants: action.participants, agentMode: resolveAgentMode(action.participants, action.participantId, action.fallbackMode) }
    case 'message':
      return state.messages.some((message) => message.id === action.message.id)
        ? state
        : { ...state, messages: [...state.messages, action.message], pendingCorrections: clearPending(state.pendingCorrections, action.message.replyToMessageId) }
    case 'typing':
      return { ...state, typing: action.isTyping ? { ...state.typing, [action.participantId]: action.name } : omitTyping(state.typing, action.participantId) }
    case 'correction_started':
      return state.pendingCorrections.includes(action.messageId) ? state : { ...state, pendingCorrections: [...state.pendingCorrections, action.messageId] }
    case 'correction_finished':
      return { ...state, pendingCorrections: clearPending(state.pendingCorrections, action.messageId) }
    case 'connection':
      return { ...state, connection: action.status }
    case 'error':
      return { ...state, error: action.message }
    case 'agent_mode':
      return { ...state, agentMode: action.agentMode }
  }
}

function resolveAgentMode(participants: ParticipantPresence[], participantId: string, fallbackMode: AgentMode) {
  return participants.find((participant) => participant.participantId === participantId)?.agentMode ?? fallbackMode
}

function clearPending(pendingCorrections: string[], messageId?: string) {
  return messageId ? pendingCorrections.filter((candidate) => candidate !== messageId) : pendingCorrections
}

function omitTyping(typing: Record<string, string>, participantId: string) {
  const nextTyping = { ...typing }
  delete nextTyping[participantId]
  return nextTyping
}