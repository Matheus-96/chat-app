import { Router } from 'express'
import type { StorageAdapter } from '../../../infrastructure/storage/StorageAdapter.js'

export function createRoomsRouter(storage: StorageAdapter) {
  const router = Router()

  router.post('/api/rooms', (_req, res) => {
    const room = storage.createRoom()
    res.status(201).json({
      roomId: room.id,
      roomCode: room.roomCode,
      expiresAt: room.expiresAt,
    })
  })

  router.get('/api/rooms/code/:roomCode', (req, res) => {
    const meta = storage.getRoomMetaByCode(req.params.roomCode)
    if (!meta) {
      res.status(404).json({ message: 'Sala nao encontrada ou expirada.' })
      return
    }
    res.json(meta)
  })

  router.get('/api/rooms/:roomId', (req, res) => {
    const meta = storage.getRoomMeta(req.params.roomId)
    if (!meta) {
      res.status(404).json({ message: 'Sala nao encontrada ou expirada.' })
      return
    }
    res.json(meta)
  })

  return router
}
