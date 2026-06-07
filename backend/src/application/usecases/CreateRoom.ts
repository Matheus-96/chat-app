import type { StorageAdapter, RoomRecord } from '../../infrastructure/storage/StorageAdapter.js'

export function createRoom(storage: StorageAdapter): RoomRecord {
  return storage.createRoom()
}
