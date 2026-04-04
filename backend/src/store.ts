import { nanoid } from 'nanoid'

export type MessageRole = 'user' | 'assistant'
export type MessageVisibility = 'public' | 'private'

export interface ParticipantPresence {
  participantId: string
  name: string
  connectedAt: string
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

  private readonly connections = new Map<string, ConnectionRecord>()

  createRoom() {
    const roomId = nanoid(10)
    const now = new Date().toISOString()

    const room: RoomRecord = {
      id: roomId,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
      messages: [],
      participants: new Map(),
    }

    this.rooms.set(roomId, room)
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
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      participantCount: room.participants.size,
      messageCount: room.messages.filter((message) => message.visibility === 'public').length,
    }
  }

  joinRoom(socketId: string, roomId: string, participantId: string, name: string) {
    const room = this.getRoom(roomId)

    if (!room) {
      return null
    }

    const connectedAt = new Date().toISOString()
    room.participants.set(participantId, {
      participantId,
      name,
      connectedAt,
    })

    this.connections.set(socketId, {
      socketId,
      roomId,
      participantId,
      joinedAt: Date.now(),
      recentMessages: [],
    })

    this.touchRoom(room)

    return {
      room,
      participantId,
      messages: this.getVisibleMessages(roomId, participantId),
      participants: this.getParticipants(roomId),
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

    if (!room) {
      return []
    }

    return Array.from(room.participants.values())
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

    if (!room) {
      return null
    }

    return room.messages.find((message) => message.id === messageId) ?? null
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
}