import cors from 'cors'
import express from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { z } from 'zod'
import { generateWritingFeedback } from './ai.js'
import { ChatStore, type ParticipantPresence, type RoomMessage } from './store.js'

const port = Number(process.env.PORT ?? 3001)
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
const messageMaxLength = 800

const store = new ChatStore()
const app = express()

app.use(cors({ origin: frontendOrigin }))
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.post('/api/rooms', (_request, response) => {
  const room = store.createRoom()
  response.status(201).json({
    roomId: room.id,
    roomCode: room.roomCode,
    expiresAt: room.expiresAt,
  })
})

app.get('/api/rooms/code/:roomCode', (request, response) => {
  const room = store.getRoomMetaByCode(request.params.roomCode)

  if (!room) {
    response.status(404).json({ message: 'Sala nao encontrada ou expirada.' })
    return
  }

  response.json(room)
})

app.get('/api/rooms/:roomId', (request, response) => {
  const room = store.getRoomMeta(request.params.roomId)

  if (!room) {
    response.status(404).json({ message: 'Sala nao encontrada ou expirada.' })
    return
  }

  response.json(room)
})

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})

server.on('upgrade', (request) => {
  console.log(`[upgrade] ${request.method} ${request.url} — headers: ${JSON.stringify(request.headers)}`)
})

const wss = new WebSocketServer({ server })

wss.on('connection', (_socket, request) => {
  console.log(`[ws connected] path=${request.url}`)
})

const joinSchema = z.object({
  type: z.literal('join_room'),
  roomCode: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
  participantId: z.string().min(1),
  name: z.string().trim().min(1).max(32),
})

const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  content: z.string().trim().min(1).max(messageMaxLength),
  apiKey: z.string().trim().min(1).optional(),
  analyze: z.boolean().optional(),
  analysisMode: z.enum(['standard', 'rewrite']).optional(),
})

const analyzeMessageSchema = z.object({
  type: z.literal('analyze_message'),
  messageId: z.string().min(1),
  apiKey: z.string().trim().min(1).optional(),
  analysisMode: z.enum(['standard', 'rewrite']).optional(),
})

const setAgentModeSchema = z.object({
  type: z.literal('set_agent_mode'),
  agentMode: z.enum(['automatic', 'manual']),
})

const typingSchema = z.object({
  type: z.literal('typing'),
  isTyping: z.boolean(),
})

type ServerEvent =
  | {
      type: 'room_snapshot'
      roomId: string
      roomCode: string
      expiresAt: string
      participantId: string
      participants: ParticipantPresence[]
      messages: RoomMessage[]
    }
  | {
      type: 'participant_update'
      participants: ParticipantPresence[]
    }
  | {
      type: 'message_created'
      message: RoomMessage
    }
  | {
      type: 'correction_started'
      messageId: string
    }
  | {
      type: 'correction_finished'
      messageId: string
    }
  | {
      type: 'typing'
      participantId: string
      name: string
      isTyping: boolean
    }
  | {
      type: 'error'
      message: string
    }

function send(socket: WebSocket, event: ServerEvent) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event))
  }
}

function socketsInRoom(roomId: string) {
  return Array.from(wss.clients).filter((socket) => {
    const socketId = (socket as WebSocket & { socketId?: string }).socketId

    if (!socketId) {
      return false
    }

    return store.getConnection(socketId)?.roomId === roomId
  })
}

function broadcastRoom(roomId: string, event: ServerEvent) {
  for (const socket of socketsInRoom(roomId)) {
    send(socket, event)
  }
}

function sendError(socket: WebSocket, message: string) {
  send(socket, { type: 'error', message })
}

function createAssistantFailureMessage(roomId: string, messageId: string) {
  return store.addMessage({
    roomId,
    role: 'assistant',
    authorId: 'coach',
    authorName: 'Coach',
    content: 'Nao consegui revisar essa mensagem desta vez.',
    explanation: 'Confira se a chave do OpenRouter e valida ou tente novamente em alguns segundos.',
    replyToMessageId: messageId,
    visibility: 'public',
  })
}

async function processCoachAnalysis(args: {
  roomId: string
  userMessage: RoomMessage
  apiKey?: string
  analysisMode?: 'standard' | 'rewrite'
}) {
  const { roomId, userMessage, apiKey, analysisMode } = args

  broadcastRoom(roomId, {
    type: 'correction_started',
    messageId: userMessage.id,
  })

  try {
    const feedback = await generateWritingFeedback({
      apiKey,
      text: userMessage.content,
      mode: analysisMode,
    })

    const assistantMessage = store.addMessage({
      roomId,
      role: 'assistant',
      authorId: 'coach',
      authorName: 'Coach',
      content: feedback.correctedText,
      explanation: feedback.explanation,
      replyToMessageId: userMessage.id,
      visibility: 'public',
      analysisMode: analysisMode ?? 'standard',
    })

    broadcastRoom(roomId, {
      type: 'correction_finished',
      messageId: userMessage.id,
    })

    if (assistantMessage) {
      broadcastRoom(roomId, {
        type: 'message_created',
        message: assistantMessage,
      })
    }
  } catch (error) {
    const assistantMessage = createAssistantFailureMessage(roomId, userMessage.id)

    broadcastRoom(roomId, {
      type: 'correction_finished',
      messageId: userMessage.id,
    })

    if (assistantMessage) {
      broadcastRoom(roomId, {
        type: 'message_created',
        message: assistantMessage,
      })
    }

    console.error('Writing feedback failed:', error)
  }
}

function registerSocketHandlers(socket: WebSocket) {
  const wsSocket = socket as WebSocket & { socketId?: string }
  wsSocket.socketId = crypto.randomUUID()
  const socketId = wsSocket.socketId

  socket.on('message', async (rawPayload) => {
    let parsedPayload: unknown

    try {
      parsedPayload = JSON.parse(rawPayload.toString())
    } catch {
      sendError(socket, 'Payload invalido.')
      return
    }

    const maybeTyping = typingSchema.safeParse(parsedPayload)

    if (maybeTyping.success) {
      const connection = store.getConnection(socketId)

      if (connection) {
        const author = store.getParticipants(connection.roomId)
          .find((participant) => participant.participantId === connection.participantId)

        if (author) {
          for (const peer of socketsInRoom(connection.roomId)) {
            if (peer !== socket) {
              send(peer, {
                type: 'typing',
                participantId: connection.participantId,
                name: author.name,
                isTyping: maybeTyping.data.isTyping,
              })
            }
          }
        }
      }

      return
    }

    const maybeJoin = joinSchema.safeParse(parsedPayload)

    if (maybeJoin.success) {
      const joined = store.joinRoom(socketId, maybeJoin.data.roomCode, maybeJoin.data.participantId, maybeJoin.data.name)

      if (!joined) {
        sendError(socket, 'Sala nao encontrada ou expirada.')
        return
      }

      send(socket, {
        type: 'room_snapshot',
        roomId: joined.room.id,
        roomCode: joined.room.roomCode,
        expiresAt: joined.room.expiresAt,
        participantId: joined.participantId,
        participants: joined.participants,
        messages: joined.messages,
      })

      broadcastRoom(joined.room.id, {
        type: 'participant_update',
        participants: joined.participants,
      })

      return
    }

    const maybeSetAgentMode = setAgentModeSchema.safeParse(parsedPayload)

    if (maybeSetAgentMode.success) {
      const connection = store.getConnection(socketId)

      if (!connection) {
        sendError(socket, 'Voce precisa entrar em uma sala antes de alterar o modo do agente.')
        return
      }

      const participants = store.setParticipantAgentMode(
        connection.roomId,
        connection.participantId,
        maybeSetAgentMode.data.agentMode,
      )

      if (!participants) {
        sendError(socket, 'Nao foi possivel atualizar o modo do agente.')
        return
      }

      broadcastRoom(connection.roomId, {
        type: 'participant_update',
        participants,
      })

      return
    }

    const maybeSendMessage = sendMessageSchema.safeParse(parsedPayload)
    const maybeAnalyzeMessage = analyzeMessageSchema.safeParse(parsedPayload)

    if (!maybeSendMessage.success && !maybeAnalyzeMessage.success) {
      sendError(socket, 'Evento nao reconhecido.')
      return
    }

    const connection = store.getConnection(socketId)

    if (!connection) {
      sendError(socket, 'Voce precisa entrar em uma sala antes de enviar mensagens.')
      return
    }

    if (!store.canSendMessage(socketId)) {
      sendError(socket, 'Voce atingiu o limite temporario de mensagens. Tente novamente em alguns segundos.')
      return
    }

    const author = store.getParticipants(connection.roomId)
      .find((participant) => participant.participantId === connection.participantId)

    if (!author) {
      sendError(socket, 'Participante nao encontrado para esta conexao.')
      return
    }

    if (maybeSendMessage.success) {
      const userMessage = store.addMessage({
        roomId: connection.roomId,
        role: 'user',
        authorId: author.participantId,
        authorName: author.name,
        content: maybeSendMessage.data.content,
        visibility: 'public',
      })

      if (!userMessage) {
        sendError(socket, 'Sala indisponivel.')
        return
      }

      broadcastRoom(connection.roomId, {
        type: 'message_created',
        message: userMessage,
      })

      const shouldAnalyze = maybeSendMessage.data.analyze ?? author.agentMode === 'automatic'

      if (shouldAnalyze) {
        await processCoachAnalysis({
          roomId: connection.roomId,
          userMessage,
          apiKey: maybeSendMessage.data.apiKey,
          analysisMode: maybeSendMessage.data.analysisMode,
        })
      }

      return
    }

    if (!maybeAnalyzeMessage.success) {
      sendError(socket, 'Evento de analise invalido.')
      return
    }

    const existingMessage = store.getRoomMessage(connection.roomId, maybeAnalyzeMessage.data.messageId)

    if (!existingMessage) {
      sendError(socket, 'Mensagem nao encontrada para analise.')
      return
    }

    if (existingMessage.role !== 'user' || existingMessage.authorId !== connection.participantId) {
      sendError(socket, 'Voce so pode analisar mensagens proprias.')
      return
    }

    if (store.hasReplyForMessage(connection.roomId, maybeAnalyzeMessage.data.messageId)) {
      sendError(socket, 'Esta mensagem ja foi analisada.')
      return
    }

    await processCoachAnalysis({
      roomId: connection.roomId,
      userMessage: existingMessage,
      apiKey: maybeAnalyzeMessage.data.apiKey,
      analysisMode: maybeAnalyzeMessage.data.analysisMode,
    })
  })

  socket.on('close', () => {
    const result = store.disconnect(socketId)

    if (!result) {
      return
    }

    broadcastRoom(result.roomId, {
      type: 'participant_update',
      participants: result.participants,
    })
  })
}

wss.on('connection', registerSocketHandlers)

setInterval(() => {
  const removedRooms = store.cleanupExpiredRooms()

  if (removedRooms > 0) {
    console.log(`Removed ${removedRooms} expired room(s).`)
  }
}, 60_000)