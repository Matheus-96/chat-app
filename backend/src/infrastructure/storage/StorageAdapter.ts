export type MessageRole = 'user' | 'assistant'
export type AgentMode = 'automatic' | 'manual'

export interface ParticipantPresence {
  participantId: string
  name: string
  connectedAt: string
  agentMode: AgentMode
}

export interface RoomMessage {
  id: string
  roomId: string
  role: MessageRole
  authorId: string
  authorName: string
  content: string
  explanation?: string
  replyToMessageId?: string
  error?: boolean
  errorReason?: string
  createdAt: string
  reactions: Record<string, string[]>
}

export interface RoomRecord {
  id: string
  roomCode: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  messages: RoomMessage[]
  participants: Map<string, ParticipantPresence>
}

export interface RoomMeta {
  id: string
  roomCode: string
  createdAt: string
  expiresAt: string
  participantCount: number
  messageCount: number
}

export interface ConnectionRecord {
  socketId: string
  roomId: string
  participantId: string
  joinedAt: number
}

export interface JoinResult {
  room: RoomRecord
  participantId: string
  messages: RoomMessage[]
  participants: ParticipantPresence[]
}

export interface DisconnectResult {
  roomId: string
  participantId: string
  participants: ParticipantPresence[]
}

export interface StorageAdapter {
  createRoom(): RoomRecord
  getRoom(roomId: string): RoomRecord | null
  getRoomMeta(roomId: string): RoomMeta | null
  getRoomMetaByCode(roomCode: string): RoomMeta | null
  touchRoom(roomId: string): void
  getExpiredRoomIds(): string[]
  cleanupExpiredRooms(): number
  joinRoom(socketId: string, roomCode: string, participantId: string, name: string): JoinResult | null
  disconnect(socketId: string): DisconnectResult | null
  getConnection(socketId: string): ConnectionRecord | null
  getParticipants(roomId: string): ParticipantPresence[]
  getVisibleMessages(roomId: string, participantId: string): RoomMessage[]
  setParticipantAgentMode(roomId: string, participantId: string, agentMode: AgentMode): ParticipantPresence[] | null
  addMessage(input: Omit<RoomMessage, 'id' | 'createdAt' | 'reactions'>): RoomMessage | null
  getRoomMessage(roomId: string, messageId: string): RoomMessage | null
  hasReplyForMessage(roomId: string, messageId: string): boolean
  addReaction(roomId: string, messageId: string, participantId: string, emoji: string): RoomMessage | null
  removeReaction(roomId: string, messageId: string, participantId: string, emoji: string): RoomMessage | null
}
