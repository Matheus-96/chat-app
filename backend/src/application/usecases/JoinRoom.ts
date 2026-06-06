import type { StorageAdapter, JoinResult } from '../../infrastructure/storage/StorageAdapter.js'

export function joinRoom(
  storage: StorageAdapter,
  socketId: string,
  roomCode: string,
  participantId: string,
  name: string,
): JoinResult | null {
  return storage.joinRoom(socketId, roomCode, participantId, name)
}
