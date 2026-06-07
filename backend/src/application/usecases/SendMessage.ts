import type { StorageAdapter, RoomMessage } from '../../infrastructure/storage/StorageAdapter.js'

export function sendMessage(args: {
  storage: StorageAdapter
  roomId: string
  authorId: string
  authorName: string
  content: string
}): RoomMessage | null {
  const { storage, roomId, authorId, authorName, content } = args
  return storage.addMessage({ roomId, role: 'user', authorId, authorName, content })
}
