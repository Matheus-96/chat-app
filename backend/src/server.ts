import cors from 'cors'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { config } from './config.js'
import { InMemoryAdapter } from './infrastructure/storage/InMemoryAdapter.js'
import { RateLimiter } from './infrastructure/RateLimiter.js'
import { MockAIProvider } from './infrastructure/ai/MockAIProvider.js'
import { OpenRouterProvider } from './infrastructure/ai/OpenRouterProvider.js'
import { createRoomsRouter } from './interface/http/routes/rooms.js'
import { createWsHandler } from './interface/ws/handler.js'

const storage = new InMemoryAdapter({ roomTtlMs: config.ROOM_TTL_MS })
const rateLimiter = new RateLimiter(config.RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS)
const aiProvider = config.AI_PROVIDER === 'mock' ? new MockAIProvider() : new OpenRouterProvider()

const app = express()
app.use(cors({ origin: config.FRONTEND_ORIGIN }))
app.use(express.json())
app.get('/health', (_req, res) => { res.json({ status: 'ok' }) })
app.use(createRoomsRouter(storage))

const server = app.listen(config.PORT, () => {
  console.log(`Backend listening on http://localhost:${config.PORT}`)
})

const wss = new WebSocketServer({ server })
wss.on('connection', createWsHandler(wss, storage, rateLimiter, aiProvider))

setInterval(() => {
  const expiredIds = storage.getExpiredRoomIds()

  for (const roomId of expiredIds) {
    for (const socket of wss.clients) {
      const socketId = (socket as WebSocket & { socketId?: string }).socketId
      if (socketId && storage.getConnection(socketId)?.roomId === roomId) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'room_expired' }))
        }
      }
    }
  }

  const removed = storage.cleanupExpiredRooms()
  if (removed > 0) console.log(`Removed ${removed} expired room(s).`)
}, 60_000)
