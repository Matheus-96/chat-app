import { z } from 'zod'
import { WebSocketServer, type WebSocket } from 'ws'
import type { StorageAdapter, RoomMessage, ParticipantPresence } from '../../infrastructure/storage/StorageAdapter.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import { sendMessage } from '../../application/usecases/SendMessage.js'
import { analyzeMessage } from '../../application/usecases/AnalyzeMessage.js'
import { OpenRouterProvider } from '../../infrastructure/ai/OpenRouterProvider.js'

type ServerEvent =
  | { type: 'room_snapshot'; roomId: string; roomCode: string; expiresAt: string; participantId: string; participants: ParticipantPresence[]; messages: RoomMessage[] }
  | { type: 'participant_update'; participants: ParticipantPresence[] }
  | { type: 'message_created'; message: RoomMessage }
  | { type: 'correction_started'; messageId: string }
  | { type: 'correction_finished'; messageId: string; error?: boolean; errorReason?: string }
  | { type: 'typing'; participantId: string; name: string; isTyping: boolean }
  | { type: 'room_expired' }
  | { type: 'error'; message: string }

const joinSchema = z.object({
  type: z.literal('join_room'),
  roomCode: z.string().trim().min(1).max(16).transform((v) => v.toUpperCase()),
  participantId: z.string().min(1),
  name: z.string().trim().min(1).max(32),
})

const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  content: z.string().trim().min(1).max(800),
  apiKey: z.string().trim().min(1).optional(),
  analyze: z.boolean().optional(),
  customInstructions: z.string().max(250).optional(),
})

const analyzeMessageSchema = z.object({
  type: z.literal('analyze_message'),
  messageId: z.string().min(1),
  apiKey: z.string().trim().min(1).optional(),
  customInstructions: z.string().max(250).optional(),
})

const setAgentModeSchema = z.object({
  type: z.literal('set_agent_mode'),
  agentMode: z.enum(['automatic', 'manual']),
})

const typingSchema = z.object({
  type: z.literal('typing'),
  isTyping: z.boolean(),
})

function send(socket: WebSocket, event: ServerEvent) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
}

function sendError(socket: WebSocket, message: string) {
  send(socket, { type: 'error', message })
}

function socketsInRoom(wss: WebSocketServer, storage: StorageAdapter, roomId: string) {
  return Array.from(wss.clients).filter((s) => {
    const socketId = (s as WebSocket & { socketId?: string }).socketId
    return socketId ? storage.getConnection(socketId)?.roomId === roomId : false
  })
}

function broadcastRoom(wss: WebSocketServer, storage: StorageAdapter, roomId: string, event: ServerEvent) {
  for (const s of socketsInRoom(wss, storage, roomId)) send(s as WebSocket, event)
}

const aiProvider = new OpenRouterProvider()

async function runCoachAnalysis(args: {
  wss: WebSocketServer
  storage: StorageAdapter
  roomId: string
  userMessage: RoomMessage
  apiKey?: string
  customInstructions?: string
}) {
  const { wss, storage, roomId, userMessage, apiKey, customInstructions } = args

  broadcastRoom(wss, storage, roomId, { type: 'correction_started', messageId: userMessage.id })

  const result = await analyzeMessage({ storage, aiProvider, roomId, userMessage, apiKey, customInstructions })

  broadcastRoom(wss, storage, roomId, {
    type: 'correction_finished',
    messageId: userMessage.id,
    error: result.error,
    errorReason: result.errorReason,
  })
  broadcastRoom(wss, storage, roomId, { type: 'message_created', message: result.message })
}

export function createWsHandler(wss: WebSocketServer, storage: StorageAdapter, rateLimiter: RateLimiter) {
  return function handleConnection(socket: WebSocket) {
    const wsSocket = socket as WebSocket & { socketId: string }
    wsSocket.socketId = crypto.randomUUID()
    const socketId = wsSocket.socketId

    socket.on('message', async (rawPayload) => {
      let payload: unknown
      try {
        payload = JSON.parse(rawPayload.toString())
      } catch {
        sendError(socket, 'Payload invalido.')
        return
      }

      const maybeTyping = typingSchema.safeParse(payload)
      if (maybeTyping.success) {
        const conn = storage.getConnection(socketId)
        if (conn) {
          const author = storage.getParticipants(conn.roomId).find((p) => p.participantId === conn.participantId)
          if (author) {
            for (const peer of socketsInRoom(wss, storage, conn.roomId)) {
              if (peer !== socket) send(peer as WebSocket, { type: 'typing', participantId: conn.participantId, name: author.name, isTyping: maybeTyping.data.isTyping })
            }
          }
        }
        return
      }

      const maybeJoin = joinSchema.safeParse(payload)
      if (maybeJoin.success) {
        const joined = storage.joinRoom(socketId, maybeJoin.data.roomCode, maybeJoin.data.participantId, maybeJoin.data.name)
        if (!joined) { sendError(socket, 'Sala nao encontrada ou expirada.'); return }

        send(socket, { type: 'room_snapshot', roomId: joined.room.id, roomCode: joined.room.roomCode, expiresAt: joined.room.expiresAt, participantId: joined.participantId, participants: joined.participants, messages: joined.messages })
        broadcastRoom(wss, storage, joined.room.id, { type: 'participant_update', participants: joined.participants })
        return
      }

      const maybeSetAgentMode = setAgentModeSchema.safeParse(payload)
      if (maybeSetAgentMode.success) {
        const conn = storage.getConnection(socketId)
        if (!conn) { sendError(socket, 'Voce precisa entrar em uma sala antes de alterar o modo do agente.'); return }

        const participants = storage.setParticipantAgentMode(conn.roomId, conn.participantId, maybeSetAgentMode.data.agentMode)
        if (!participants) { sendError(socket, 'Nao foi possivel atualizar o modo do agente.'); return }

        broadcastRoom(wss, storage, conn.roomId, { type: 'participant_update', participants })
        return
      }

      const maybeSend = sendMessageSchema.safeParse(payload)
      const maybeAnalyze = analyzeMessageSchema.safeParse(payload)

      if (!maybeSend.success && !maybeAnalyze.success) { sendError(socket, 'Evento nao reconhecido.'); return }

      const conn = storage.getConnection(socketId)
      if (!conn) { sendError(socket, 'Voce precisa entrar em uma sala antes de enviar mensagens.'); return }
      if (!rateLimiter.check(socketId)) { sendError(socket, 'Voce atingiu o limite temporario de mensagens. Tente novamente em alguns segundos.'); return }

      const author = storage.getParticipants(conn.roomId).find((p) => p.participantId === conn.participantId)
      if (!author) { sendError(socket, 'Participante nao encontrado para esta conexao.'); return }

      if (maybeSend.success) {
        const userMessage = sendMessage({ storage, roomId: conn.roomId, authorId: author.participantId, authorName: author.name, content: maybeSend.data.content })
        if (!userMessage) { sendError(socket, 'Sala indisponivel.'); return }

        broadcastRoom(wss, storage, conn.roomId, { type: 'message_created', message: userMessage })

        const shouldAnalyze = maybeSend.data.analyze ?? author.agentMode === 'automatic'
        if (shouldAnalyze) await runCoachAnalysis({ wss, storage, roomId: conn.roomId, userMessage, apiKey: maybeSend.data.apiKey, customInstructions: maybeSend.data.customInstructions })
        return
      }

      if (!maybeAnalyze.success) { sendError(socket, 'Evento de analise invalido.'); return }

      const existing = storage.getRoomMessage(conn.roomId, maybeAnalyze.data.messageId)
      if (!existing) { sendError(socket, 'Mensagem nao encontrada para analise.'); return }
      if (existing.role !== 'user' || existing.authorId !== conn.participantId) { sendError(socket, 'Voce so pode analisar mensagens proprias.'); return }
      if (storage.hasReplyForMessage(conn.roomId, maybeAnalyze.data.messageId)) { sendError(socket, 'Esta mensagem ja foi analisada.'); return }

      await runCoachAnalysis({ wss, storage, roomId: conn.roomId, userMessage: existing, apiKey: maybeAnalyze.data.apiKey, customInstructions: maybeAnalyze.data.customInstructions })
    })

    socket.on('close', () => {
      const result = storage.disconnect(socketId)
      if (!result) return
      broadcastRoom(wss, storage, result.roomId, { type: 'participant_update', participants: result.participants })
    })
  }
}
