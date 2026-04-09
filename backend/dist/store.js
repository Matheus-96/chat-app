import { customAlphabet, nanoid } from 'nanoid';
const createRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const HOUR_IN_MS = 60 * 60 * 1000;
export const ROOM_TTL_MS = 24 * HOUR_IN_MS;
const MESSAGE_RATE_WINDOW_MS = 15 * 1000;
const MAX_MESSAGES_PER_WINDOW = 10;
export class ChatStore {
    rooms = new Map();
    roomCodeIndex = new Map();
    connections = new Map();
    createRoom() {
        const roomId = nanoid(10);
        const roomCode = this.generateRoomCode();
        const now = new Date().toISOString();
        const room = {
            id: roomId,
            roomCode,
            createdAt: now,
            updatedAt: now,
            expiresAt: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
            messages: [],
            participants: new Map(),
        };
        this.rooms.set(roomId, room);
        this.roomCodeIndex.set(roomCode, roomId);
        return room;
    }
    getRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }
        if (new Date(room.expiresAt).getTime() <= Date.now()) {
            this.deleteRoom(roomId);
            return null;
        }
        return room;
    }
    getRoomMeta(roomId) {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        return {
            id: room.id,
            roomCode: room.roomCode,
            createdAt: room.createdAt,
            expiresAt: room.expiresAt,
            participantCount: room.participants.size,
            messageCount: room.messages.filter((message) => message.visibility === 'public').length,
        };
    }
    getRoomMetaByCode(roomCode) {
        const room = this.getRoomByCode(roomCode);
        return room ? this.getRoomMeta(room.id) : null;
    }
    joinRoom(socketId, roomCode, participantId, name) {
        const room = this.getRoomByCode(roomCode);
        if (!room) {
            return null;
        }
        const connectedAt = new Date().toISOString();
        const existingParticipant = room.participants.get(participantId);
        room.participants.set(participantId, {
            participantId,
            name,
            connectedAt,
            agentMode: existingParticipant?.agentMode ?? 'automatic',
        });
        this.connections.set(socketId, {
            socketId,
            roomId: room.id,
            participantId,
            joinedAt: Date.now(),
            recentMessages: [],
        });
        this.touchRoom(room);
        return {
            room,
            participantId,
            messages: this.getVisibleMessages(room.id, participantId),
            participants: this.getParticipants(room.id),
        };
    }
    disconnect(socketId) {
        const connection = this.connections.get(socketId);
        if (!connection) {
            return null;
        }
        this.connections.delete(socketId);
        const room = this.getRoom(connection.roomId);
        if (!room) {
            return null;
        }
        const participantStillConnected = Array.from(this.connections.values()).some((candidate) => (candidate.roomId === connection.roomId && candidate.participantId === connection.participantId));
        if (!participantStillConnected) {
            room.participants.delete(connection.participantId);
            this.touchRoom(room);
        }
        return {
            roomId: connection.roomId,
            participantId: connection.participantId,
            participants: this.getParticipants(connection.roomId),
        };
    }
    getConnection(socketId) {
        return this.connections.get(socketId) ?? null;
    }
    setParticipantAgentMode(roomId, participantId, agentMode) {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        const participant = room.participants.get(participantId);
        if (!participant) {
            return null;
        }
        room.participants.set(participantId, {
            ...participant,
            agentMode,
        });
        this.touchRoom(room);
        return this.getParticipants(roomId);
    }
    canSendMessage(socketId) {
        const connection = this.connections.get(socketId);
        if (!connection) {
            return false;
        }
        const threshold = Date.now() - MESSAGE_RATE_WINDOW_MS;
        connection.recentMessages = connection.recentMessages.filter((timestamp) => timestamp >= threshold);
        if (connection.recentMessages.length >= MAX_MESSAGES_PER_WINDOW) {
            return false;
        }
        connection.recentMessages.push(Date.now());
        return true;
    }
    addMessage(input) {
        const room = this.getRoom(input.roomId);
        if (!room) {
            return null;
        }
        const message = {
            id: nanoid(12),
            createdAt: new Date().toISOString(),
            ...input,
        };
        room.messages.push(message);
        this.touchRoom(room);
        return message;
    }
    getParticipants(roomId) {
        const room = this.getRoom(roomId);
        return room ? Array.from(room.participants.values()) : [];
    }
    getVisibleMessages(roomId, participantId) {
        const room = this.getRoom(roomId);
        if (!room) {
            return [];
        }
        return room.messages.filter((message) => (message.visibility === 'public' || message.visibleToParticipantId === participantId));
    }
    getRoomMessage(roomId, messageId) {
        const room = this.getRoom(roomId);
        return room ? room.messages.find((message) => message.id === messageId) ?? null : null;
    }
    hasReplyForMessage(roomId, messageId) {
        const room = this.getRoom(roomId);
        if (!room) {
            return false;
        }
        return room.messages.some((message) => (message.role === 'assistant' && message.replyToMessageId === messageId));
    }
    cleanupExpiredRooms() {
        const expiredIds = Array.from(this.rooms.values())
            .filter((room) => new Date(room.expiresAt).getTime() <= Date.now())
            .map((room) => room.id);
        for (const roomId of expiredIds) {
            this.deleteRoom(roomId);
        }
        return expiredIds.length;
    }
    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            this.roomCodeIndex.delete(room.roomCode);
        }
        this.rooms.delete(roomId);
        for (const [socketId, connection] of this.connections.entries()) {
            if (connection.roomId === roomId) {
                this.connections.delete(socketId);
            }
        }
    }
    touchRoom(room) {
        room.updatedAt = new Date().toISOString();
        room.expiresAt = new Date(Date.now() + ROOM_TTL_MS).toISOString();
    }
    getRoomByCode(roomCode) {
        const roomId = this.roomCodeIndex.get(roomCode.trim().toUpperCase());
        return roomId ? this.getRoom(roomId) : null;
    }
    generateRoomCode() {
        let roomCode = createRoomCode();
        while (this.roomCodeIndex.has(roomCode)) {
            roomCode = createRoomCode();
        }
        return roomCode;
    }
}
