import { customAlphabet, nanoid } from 'nanoid'
import type {
  StorageAdapter,
  RoomRecord,
  RoomMessage,
  RoomMeta,
  ParticipantPresence,
  AgentMode,
  JoinResult,
  DisconnectResult,
  ConnectionRecord,
} from './StorageAdapter.js'

const createRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

interface AdapterConfig {
  roomTtlMs: number
  rateLimitMax: number
  rateLimitWindowMs: number
}

interface InternalConnection extends ConnectionRecord {
  recentMessages: number[]
}

export class InMemoryAdapter implements StorageAdapter {
  private readonly rooms = new Map<string, RoomRecord>()
  private readonly roomCodeIndex = new Map<string, string>()
  private readonly connections = new Map<string, InternalConnection>()

  constructor(private readonly cfg: AdapterConfig) {}

  createRoom(): RoomRecord {
    const roomId = nanoid(10)
    const roomCode = this.generateUniqueCode()
    const now = new Date().toISOString()

    const room: RoomRecord = {
      id: roomId,
      roomCode,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + this.cfg.roomTtlMs).toISOString(),
      messages: [],
      participants: new Map(),
    }

    this.rooms.set(roomId, room)
    this.roomCodeIndex.set(roomCode, roomId)
    return room
  }

  getRoom(roomId: string): RoomRecord | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    if (new Date(room.expiresAt).getTime() <= Date.now()) {
      this.deleteRoom(roomId)
      return null
    }

    return room
  }

  getRoomMeta(roomId: string): RoomMeta | null {
    const room = this.getRoom(roomId)
    if (!room) return null

    return {
      id: room.id,
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      participantCount: room.participants.size,
      messageCount: room.messages.filter((m) => m.visibility === 'public').length,
    }
  }

  getRoomMetaByCode(roomCode: string): RoomMeta | null {
    const roomId = this.roomCodeIndex.get(roomCode.trim().toUpperCase())
    return roomId ? this.getRoomMeta(roomId) : null
  }

  touchRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.updatedAt = new Date().toISOString()
    room.expiresAt = new Date(Date.now() + this.cfg.roomTtlMs).toISOString()
  }

  getExpiredRoomIds(): string[] {
    return Array.from(this.rooms.values())
      .filter((room) => new Date(room.expiresAt).getTime() <= Date.now())
      .map((room) => room.id)
  }

  cleanupExpiredRooms(): number {
    const expiredIds = this.getExpiredRoomIds()
    for (const roomId of expiredIds) this.deleteRoom(roomId)
    return expiredIds.length
  }

  joinRoom(socketId: string, roomCode: string, participantId: string, name: string): JoinResult | null {
    const roomId = this.roomCodeIndex.get(roomCode.trim().toUpperCase())
    const room = roomId ? this.getRoom(roomId) : null
    if (!room) return null

    const existing = room.participants.get(participantId)
    room.participants.set(participantId, {
      participantId,
      name,
      connectedAt: new Date().toISOString(),
      agentMode: existing?.agentMode ?? 'automatic',
    })

    this.connections.set(socketId, {
      socketId,
      roomId: room.id,
      participantId,
      joinedAt: Date.now(),
      recentMessages: [],
    })

    this.touchRoom(room.id)

    return {
      room,
      participantId,
      messages: this.getVisibleMessages(room.id, participantId),
      participants: this.getParticipants(room.id),
    }
  }

  disconnect(socketId: string): DisconnectResult | null {
    const connection = this.connections.get(socketId)
    if (!connection) return null

    this.connections.delete(socketId)

    const room = this.getRoom(connection.roomId)
    if (!room) return null

    const stillConnected = Array.from(this.connections.values()).some(
      (c) => c.roomId === connection.roomId && c.participantId === connection.participantId,
    )

    if (!stillConnected) {
      room.participants.delete(connection.participantId)
      this.touchRoom(room.id)
    }

    return {
      roomId: connection.roomId,
      participantId: connection.participantId,
      participants: this.getParticipants(connection.roomId),
    }
  }

  getConnection(socketId: string): ConnectionRecord | null {
    return this.connections.get(socketId) ?? null
  }

  getParticipants(roomId: string): ParticipantPresence[] {
    const room = this.getRoom(roomId)
    return room ? Array.from(room.participants.values()) : []
  }

  getVisibleMessages(roomId: string, participantId: string): RoomMessage[] {
    const room = this.getRoom(roomId)
    if (!room) return []

    return room.messages.filter(
      (m) => m.visibility === 'public' || m.visibleToParticipantId === participantId,
    )
  }

  updateParticipantName(roomId: string, participantId: string, name: string): ParticipantPresence[] | null {
    const room = this.getRoom(roomId)
    if (!room) return null

    const participant = room.participants.get(participantId)
    if (!participant) return null

    room.participants.set(participantId, { ...participant, name })
    this.touchRoom(roomId)
    return this.getParticipants(roomId)
  }

  setParticipantAgentMode(roomId: string, participantId: string, agentMode: AgentMode): ParticipantPresence[] | null {
    const room = this.getRoom(roomId)
    if (!room) return null

    const participant = room.participants.get(participantId)
    if (!participant) return null

    room.participants.set(participantId, { ...participant, agentMode })
    this.touchRoom(roomId)
    return this.getParticipants(roomId)
  }

  addMessage(input: Omit<RoomMessage, 'id' | 'createdAt'>): RoomMessage | null {
    const room = this.getRoom(input.roomId)
    if (!room) return null

    const message: RoomMessage = {
      id: nanoid(12),
      createdAt: new Date().toISOString(),
      ...input,
    }

    room.messages.push(message)
    this.touchRoom(room.id)
    return message
  }

  getRoomMessage(roomId: string, messageId: string): RoomMessage | null {
    const room = this.getRoom(roomId)
    return room ? (room.messages.find((m) => m.id === messageId) ?? null) : null
  }

  hasReplyForMessage(roomId: string, messageId: string): boolean {
    const room = this.getRoom(roomId)
    if (!room) return false
    return room.messages.some((m) => m.role === 'assistant' && m.replyToMessageId === messageId)
  }

  canSendMessage(socketId: string): boolean {
    const connection = this.connections.get(socketId)
    if (!connection) return false

    const threshold = Date.now() - this.cfg.rateLimitWindowMs
    connection.recentMessages = connection.recentMessages.filter((ts) => ts >= threshold)

    if (connection.recentMessages.length >= this.cfg.rateLimitMax) return false

    connection.recentMessages.push(Date.now())
    return true
  }

  private deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room) this.roomCodeIndex.delete(room.roomCode)
    this.rooms.delete(roomId)

    for (const [socketId, conn] of this.connections.entries()) {
      if (conn.roomId === roomId) this.connections.delete(socketId)
    }
  }

  private generateUniqueCode(): string {
    let code = createRoomCode()
    while (this.roomCodeIndex.has(code)) code = createRoomCode()
    return code
  }
}
