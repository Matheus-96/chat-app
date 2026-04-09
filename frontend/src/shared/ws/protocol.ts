export type AgentMode = 'automatic' | 'manual'
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface ParticipantPresence {
  participantId: string
  name: string
  connectedAt: string
  agentMode: AgentMode
}

export interface RoomMessage {
  id: string
  roomId: string
  role: 'user' | 'assistant'
  authorId: string
  authorName: string
  content: string
  explanation?: string
  replyToMessageId?: string
  createdAt: string
  visibility: 'public' | 'private'
}

export type ServerEvent =
  | { type: 'room_snapshot'; roomId: string; roomCode: string; expiresAt: string; participantId: string; participants: ParticipantPresence[]; messages: RoomMessage[] }
  | { type: 'participant_update'; participants: ParticipantPresence[] }
  | { type: 'message_created'; message: RoomMessage }
  | { type: 'correction_started'; messageId: string }
  | { type: 'correction_finished'; messageId: string }
  | { type: 'typing'; participantId: string; name: string; isTyping: boolean }
  | { type: 'error'; message: string }

export type ClientEvent =
  | { type: 'join_room'; roomCode: string; participantId: string; name: string }
  | { type: 'send_message'; content: string; apiKey?: string; analyze?: boolean }
  | { type: 'analyze_message'; messageId: string; apiKey?: string }
  | { type: 'set_agent_mode'; agentMode: AgentMode }
  | { type: 'typing'; isTyping: boolean }