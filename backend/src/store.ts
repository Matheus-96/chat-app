import { customAlphabet, nanoid } from 'nanoid'

export type MessageRole = 'user' | 'assistant'
export type MessageVisibility = 'public' | 'private'
export type AgentMode = 'automatic' | 'manual'

const createRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

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
  createdAt: string
  visibility: MessageVisibility
  visibleToParticipantId?: string
  analysisMode?: 'standard' | 'rewrite'
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

interface ConnectionRecord {
  socketId: string
  roomId: string
  participantId: string
  joinedAt: number
  recentMessages: number[]
}

const HOUR_IN_MS = 60 * 60 * 1000

export const ROOM_TTL_MS = 24 * HOUR_IN_MS
const MESSAGE_RATE_WINDOW_MS = 15 * 1000
const MAX_MESSAGES_PER_WINDOW = 10

export class ChatStore {
  private readonly rooms = new Map<string, RoomRecord>()

  private readonly roomCodeIndex = new Map<string, string>()

  private readonly connections = new Map<string, ConnectionRecord>()

  createRoom() {
    const roomId = nanoid(10)
    const roomCode = this.generateRoomCode()
    const now = new Date().toISOString()

    const room: RoomRecord = {
      id: roomId,
      roomCode,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
      messages: [],
      participants: new Map(),
    }

    this.rooms.set(roomId, room)
    this.roomCodeIndex.set(roomCode, roomId)
    return room
  }

  getRoom(roomId: string) {
    const room = this.rooms.get(roomId)

    if (!room) {
      return null
    }

    if (new Date(room.expiresAt).getTime() <= Date.now()) {
      this.deleteRoom(roomId)
      return null
    }

    return room
  }

  getRoomMeta(roomId: string) {
    const room = this.getRoom(roomId)

    if (!room) {
      return null
    }

    return {
      id: room.id,
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      participantCount: room.participants.size,
      messageCount: room.messages.filter((message) => message.visibility === 'public').length,
    }
  }

  getRoomMetaByCode(roomCode: string) {
    const room = this.getRoomByCode(roomCode)
    return room ? this.getRoomMeta(room.id) : null
  }

  joinRoom(socketId: string, roomCode: string, participantId: string, name: string) {
    const room = this.getRoomByCode(roomCode)

    if (!room) {
      return null
    }

    const connectedAt = new Date().toISOString()
    const existingParticipant = room.participants.get(participantId)

    room.participants.set(participantId, {
      participantId,
      name,
      connectedAt,
      agentMode: existingParticipant?.agentMode ?? 'automatic',
    })

    this.connections.set(socketId, {
      socketId,
      roomId: room.id,
      participantId,
      joinedAt: Date.now(),
      recentMessages: [],
    })

    this.touchRoom(room)

    return {
      room,
      participantId,
      messages: this.getVisibleMessages(room.id, participantId),
      participants: this.getParticipants(room.id),
    }
  }

  disconnect(socketId: string) {
    const connection = this.connections.get(socketId)

    if (!connection) {
      return null
    }

    this.connections.delete(socketId)

    const room = this.getRoom(connection.roomId)

    if (!room) {
      return null
    }

    const participantStillConnected = Array.from(this.connections.values()).some((candidate) => (
      candidate.roomId === connection.roomId && candidate.participantId === connection.participantId
    ))

    if (!participantStillConnected) {
      room.participants.delete(connection.participantId)
      this.touchRoom(room)
    }

    return {
      roomId: connection.roomId,
      participantId: connection.participantId,
      participants: this.getParticipants(connection.roomId),
    }
  }

  getConnection(socketId: string) {
    return this.connections.get(socketId) ?? null
  }

  setParticipantAgentMode(roomId: string, participantId: string, agentMode: AgentMode) {
    const room = this.getRoom(roomId)

    if (!room) {
      return null
    }

    const participant = room.participants.get(participantId)

    if (!participant) {
      return null
    }

    room.participants.set(participantId, {
      ...participant,
      agentMode,
    })

    this.touchRoom(room)
    return this.getParticipants(roomId)
  }

  canSendMessage(socketId: string) {
    const connection = this.connections.get(socketId)

    if (!connection) {
      return false
    }

    const threshold = Date.now() - MESSAGE_RATE_WINDOW_MS
    connection.recentMessages = connection.recentMessages.filter((timestamp) => timestamp >= threshold)

    if (connection.recentMessages.length >= MAX_MESSAGES_PER_WINDOW) {
      return false
    }

    connection.recentMessages.push(Date.now())
    return true
  }

  addMessage(input: Omit<RoomMessage, 'id' | 'createdAt'>) {
    const room = this.getRoom(input.roomId)

    if (!room) {
      return null
    }

    const message: RoomMessage = {
      id: nanoid(12),
      createdAt: new Date().toISOString(),
      ...input,
    }

    room.messages.push(message)
    this.touchRoom(room)
    return message
  }

  getParticipants(roomId: string) {
    const room = this.getRoom(roomId)
    return room ? Array.from(room.participants.values()) : []
  }

  getVisibleMessages(roomId: string, participantId: string) {
    const room = this.getRoom(roomId)

    if (!room) {
      return []
    }

    return room.messages.filter((message) => (
      message.visibility === 'public' || message.visibleToParticipantId === participantId
    ))
  }

  getRoomMessage(roomId: string, messageId: string) {
    const room = this.getRoom(roomId)
    return room ? room.messages.find((message) => message.id === messageId) ?? null : null
  }

  hasReplyForMessage(roomId: string, messageId: string) {
    const room = this.getRoom(roomId)

    if (!room) {
      return false
    }

    return room.messages.some((message) => (
      message.role === 'assistant' && message.replyToMessageId === messageId
    ))
  }

  cleanupExpiredRooms() {
    const expiredIds = Array.from(this.rooms.values())
      .filter((room) => new Date(room.expiresAt).getTime() <= Date.now())
      .map((room) => room.id)

    for (const roomId of expiredIds) {
      this.deleteRoom(roomId)
    }

    return expiredIds.length
  }

  private deleteRoom(roomId: string) {
    const room = this.rooms.get(roomId)

    if (room) {
      this.roomCodeIndex.delete(room.roomCode)
    }

    this.rooms.delete(roomId)

    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.roomId === roomId) {
        this.connections.delete(socketId)
      }
    }
  }

  private touchRoom(room: RoomRecord) {
    room.updatedAt = new Date().toISOString()
    room.expiresAt = new Date(Date.now() + ROOM_TTL_MS).toISOString()
  }

  private getRoomByCode(roomCode: string) {
    const roomId = this.roomCodeIndex.get(roomCode.trim().toUpperCase())
    return roomId ? this.getRoom(roomId) : null
  }

  private generateRoomCode() {
    let roomCode = createRoomCode()

    while (this.roomCodeIndex.has(roomCode)) {
      roomCode = createRoomCode()
    }

    return roomCode
  }
}